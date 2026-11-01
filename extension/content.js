const { parseRgb, contrastRatio, backgroundFor, textContrast } = MingxiContrast;
const STYLE_ID = 'mingxi-color-friendly-style';
let scanTimer;
let observerTimer;
let scanGeneration = 0;
let probeEnabled = false;
let activeSettings = null;

const modeStyles = {
  protanopia: (t) => `sepia(${.18*t}) saturate(${1+.18*t}) hue-rotate(${-12*t}deg) contrast(${1+.12*t})`,
  deuteranopia: (t) => `sepia(${.10*t}) saturate(${1+.20*t}) hue-rotate(${14*t}deg) contrast(${1+.12*t})`,
  tritanopia: (t) => `hue-rotate(${38*t}deg) saturate(${1+.12*t}) contrast(${1+.12*t})`,
  contrast: (t) => `contrast(${1+.6*t})`
};

function applySettings(settings) {
  scanGeneration++;
  activeSettings = settings;
  let style = document.getElementById(STYLE_ID);
  if (!style) { style = document.createElement('style'); style.id = STYLE_ID; (document.head || document.documentElement).appendChild(style); }
  if (!settings.enabled || settings.excluded) {
    clearTimeout(scanTimer);
    style.textContent = '';
    document.documentElement.dataset.mingxiImages = 'false';
    document.documentElement.dataset.mingxiLinks = 'false';
    document.documentElement.dataset.mingxiRemap = 'false';
    document.documentElement.dataset.mingxiFocus = 'false';
    document.documentElement.style.removeProperty('--mingxi-remap-filter');
    document.documentElement.style.removeProperty('--mingxi-image-filter');
    clearEnhancements();
    return;
  }
  const intensity = Math.max(0, Math.min(100, Number(settings.intensity ?? 65)));
  const filter = (modeStyles[settings.mode] || modeStyles.deuteranopia)(intensity / 100);
  // Apply the remap to the body's top-level content instead of html/body.
  // A filter on body can change fixed-position/stacking behavior and create
  // an apparent blank strip above the page on some sites.
  if (settings.colorRemap !== false) {
    document.documentElement.dataset.mingxiRemap = 'true';
    document.documentElement.style.setProperty('--mingxi-remap-filter', filter, 'important');
  } else {
    document.documentElement.dataset.mingxiRemap = 'false';
    document.documentElement.style.removeProperty('--mingxi-remap-filter');
  }
  document.documentElement.style.setProperty('--mingxi-image-filter', filter, 'important');
  style.textContent = `
    html[data-mingxi-remap="true"] body > *:not(#mingxi-reader) { filter:var(--mingxi-remap-filter) !important; }
    [data-mingxi-mark]::before { content:attr(data-mingxi-mark); display:inline-block; margin-right:.4em; font-weight:700; }
    [data-mingxi-mark="✓"]::before { color:#087443; } [data-mingxi-mark="!"]::before { color:#a34a00; } [data-mingxi-mark="×"]::before { color:#a00025; }
    html[data-mingxi-links="true"] a:not([role="button"]):not([class*="button" i]) { text-decoration-line:underline !important; text-decoration-thickness:.12em !important; text-underline-offset:.16em !important; }
    html[data-mingxi-images="true"] img, html[data-mingxi-images="true"] canvas, html[data-mingxi-images="true"] video { outline:1px solid rgba(30,77,59,.18); }
    html[data-mingxi-images="true"][data-mingxi-remap="false"] img, html[data-mingxi-images="true"][data-mingxi-remap="false"] canvas, html[data-mingxi-images="true"][data-mingxi-remap="false"] video { filter:var(--mingxi-image-filter) !important; }
    html[data-mingxi-images="true"] svg[role="img"], html[data-mingxi-images="true"] [aria-label*="chart" i], html[data-mingxi-images="true"] [aria-label*="图表"] { outline:2px solid rgba(30,77,59,.35) !important; }
    [data-mingxi-required]::after { content:' (必填)'; color:#8b3a24; font-size:.9em; font-weight:700; }
    html[data-mingxi-focus="true"] :focus-visible { outline:3px solid #005fcc !important; outline-offset:3px !important; box-shadow:0 0 0 5px #fff, 0 0 0 8px #005fcc !important; }
    #mingxi-color-probe { position:fixed; z-index:2147483647; pointer-events:none; padding:7px 9px; border-radius:7px; background:#18251f; color:#fff; font:12px Arial,sans-serif; box-shadow:0 4px 15px #0004; }
    #mingxi-reader { position:fixed; inset:0; z-index:2147483646; overflow:auto; background:#fff; color:#111; padding:7vh max(7vw,24px); font:19px/1.9 Georgia,'Noto Serif SC',serif; }
    #mingxi-reader article { max-width:760px; margin:auto; } #mingxi-reader article > :not(button), #mingxi-reader article > :not(button) * { background:#fff !important; color:#111 !important; text-shadow:none !important; } #mingxi-reader article p { margin:1em 0; } #mingxi-reader article img { max-width:100%; filter:grayscale(1) contrast(1.15) !important; } #mingxi-reader h1 { font:700 34px/1.3 Arial,'Noto Sans SC',sans-serif; } #mingxi-reader button { position:fixed; right:24px; top:20px; padding:9px 13px; border:1px solid #777; border-radius:6px; background:#fff; cursor:pointer; }
  `;
  document.documentElement.dataset.mingxiImages = settings.enhanceImages ? 'true' : 'false';
  document.documentElement.dataset.mingxiLinks = settings.linkHints ? 'true' : 'false';
  document.documentElement.dataset.mingxiFocus = settings.focusHints === false ? 'false' : 'true';
  markSemanticElements(Boolean(settings.semanticHints));
  applyCustomMappings(settings.customMappings || []);
  if (settings.autoContrast) scheduleContrastScan(); else clearContrastFixes();
  applyFontScale(Number(settings.fontScale ?? 100));
  if (settings.chartHints) markCharts(); else clearChartEnhancements();
  if (settings.requiredHints !== false) markRequiredFields();
}

function markSemanticElements(enabled) {
  document.querySelectorAll('[data-mingxi-mark]').forEach((node) => node.removeAttribute('data-mingxi-mark'));
  if (!enabled) return;
  const groups = [
    { mark:'✓', selectors:'[aria-label*="success" i], [aria-label*="成功"], .success, .is-success, [data-status="success"]' },
    { mark:'!', selectors:'[role="alert"], [aria-label*="warning" i], [aria-label*="警告"], .warning, .is-warning, [data-status="warning"]' },
    { mark:'×', selectors:'[aria-invalid="true"], [aria-label*="error" i], [aria-label*="错误"], .error, .is-error, [data-status="error"]' }
  ];
  groups.forEach(({ mark, selectors }) => document.querySelectorAll(selectors).forEach((node) => node.setAttribute('data-mingxi-mark', mark)));
}

function markCharts() {
  document.querySelectorAll('svg[role="img"],svg[aria-label*="chart" i],svg[aria-label*="图表"]').forEach(enhanceSvgChart);
}

function chartSeries(node) {
  const group = node.closest('g[data-series],g[data-series-id],g[aria-label*="series" i],g[aria-label*="系列"]');
  return node.getAttribute('data-series') || node.getAttribute('data-series-id') || group?.getAttribute('data-series') || group?.getAttribute('data-series-id') || group?.getAttribute('aria-label') || null;
}

function enhanceSvgChart(svg) {
  if (svg.dataset.mingxiChartEnhanced === 'true') return;
  const shapes = [...svg.querySelectorAll('rect,path,circle,polyline,polygon')]
    .filter((node) => !node.closest('defs') && chartSeries(node));
  const series = [...new Set(shapes.map(chartSeries))].sort();
  if (series.length < 2) return;
  const ns = 'http://www.w3.org/2000/svg';
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(ns, 'defs');
    defs.dataset.mingxiGenerated = 'true';
    svg.insertBefore(defs, svg.firstChild);
  }
  const patterns = series.map((name, index) => {
    const pattern = document.createElementNS(ns, 'pattern');
    pattern.id = `mingxi-pattern-${Math.random().toString(36).slice(2)}`;
    pattern.dataset.mingxiGenerated = 'true';
    pattern.setAttribute('width', '8'); pattern.setAttribute('height', '8'); pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const directions = ['M-2 2L2 -2M0 8L8 0M6 10L10 6', 'M-2 6L6 -2M2 10L10 2', 'M4 0V8M0 4H8'];
    pattern.innerHTML = `<path d="${directions[index % directions.length]}" stroke="currentColor" stroke-width="1.4" opacity=".7"/>`;
    defs.appendChild(pattern);
    return pattern.id;
  });
  for (const node of shapes) {
    const index = series.indexOf(chartSeries(node));
    const tag = node.tagName.toLowerCase();
    const fill = node.getAttribute('fill') || getComputedStyle(node).fill;
    if (fill && fill !== 'none' && (tag === 'rect' || tag === 'circle' || tag === 'polygon' || tag === 'path')) {
      const overlay = node.cloneNode(false);
      overlay.removeAttribute('id'); overlay.removeAttribute('aria-label');
      overlay.setAttribute('aria-hidden', 'true'); overlay.setAttribute('pointer-events', 'none');
      overlay.style.setProperty('fill', `url(#${patterns[index]})`, 'important');
      overlay.style.setProperty('stroke', 'none', 'important');
      overlay.dataset.mingxiGenerated = 'true';
      node.after(overlay);
    }
    if ((tag === 'path' || tag === 'polyline') && index % 3) {
      node.dataset.mingxiOriginalDash = node.getAttribute('stroke-dasharray') ?? '';
      node.setAttribute('stroke-dasharray', ['','7 3', '2 3'][index % 3]);
    }
    const value = node.getAttribute('data-value');
    if (tag === 'rect' && value && /^[-+]?\d+(?:\.\d+)?$/.test(value)) {
      try {
        const box = node.getBBox();
        const label = document.createElementNS(ns, 'text');
        label.setAttribute('x', box.x + box.width / 2); label.setAttribute('y', Math.max(12, box.y - 4));
        label.setAttribute('text-anchor', 'middle'); label.setAttribute('font-size', '10');
        label.setAttribute('fill', 'currentColor'); label.textContent = value;
        label.dataset.mingxiGenerated = 'true'; svg.appendChild(label);
      } catch (_) { /* The chart may not be laid out yet. */ }
    }
  }
  svg.dataset.mingxiChartEnhanced = 'true';
}

function markRequiredFields() { document.querySelectorAll('input[required],select[required],textarea[required], [aria-required="true"]').forEach((field) => { const label = field.labels?.[0]; if (label) label.setAttribute('data-mingxi-required', 'true'); else field.setAttribute('data-mingxi-required', 'true'); }); }

function walkElements(root, visit, generation = scanGeneration) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = root;
  function batch() {
    if (generation !== scanGeneration) return;
    let count = 0;
    while (node && count++ < 100) {
      visit(node);
      node = walker.nextNode();
    }
    if (node) setTimeout(batch, 0);
  }
  batch();
}
function scheduleContrastScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scanContrast, 250); }
function scanContrast(root = document.body, reset = true) {
  if (!root) return;
  if (reset) clearContrastFixes();
  walkElements(root, (node) => {
    if (node.hasAttribute('data-mingxi-contrast-fix')) return;
    const info = textContrast(node);
    if (!info || info.ratio >= (info.large ? 3 : 4.5)) return;
    const black = contrastRatio([0,0,0], info.bg);
    const white = contrastRatio([255,255,255], info.bg);
    node.dataset.mingxiOriginalColor = node.style.getPropertyValue('color');
    node.dataset.mingxiOriginalPriority = node.style.getPropertyPriority('color');
    node.style.setProperty('color', black > white ? '#000' : '#fff', 'important');
    node.dataset.mingxiAppliedColor = node.style.getPropertyValue('color');
    node.setAttribute('data-mingxi-contrast-fix', 'true');
  });
}
function restoreProperty(node, property, original, priority, applied) {
  if (node.style.getPropertyValue(property) !== applied || node.style.getPropertyPriority(property) !== 'important') return;
  if (original) node.style.setProperty(property, original, priority || '');
  else node.style.removeProperty(property);
}
function restoreContrastFix(node) { restoreProperty(node, 'color', node.dataset.mingxiOriginalColor, node.dataset.mingxiOriginalPriority, node.dataset.mingxiAppliedColor); node.removeAttribute('data-mingxi-original-color'); node.removeAttribute('data-mingxi-original-priority'); node.removeAttribute('data-mingxi-applied-color'); node.removeAttribute('data-mingxi-contrast-fix'); }
function clearContrastFixes() { document.querySelectorAll('[data-mingxi-contrast-fix]').forEach(restoreContrastFix); }
function applyFontScale(scale, root = document.body, reset = true) {
  if (reset) clearFontScale();
  if (!scale || scale <= 100 || !root) return;
  const ratio = Math.max(1, Math.min(1.6, scale / 100));
  walkElements(root, (node) => {
    if (!Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim()) || node.closest('svg,canvas,video,#mingxi-reader') || node.matches('script,style,noscript')) return;
    const size = Number.parseFloat(getComputedStyle(node).fontSize);
    if (!Number.isFinite(size) || size < 10) return;
    node.dataset.mingxiOriginalFontSize = node.style.getPropertyValue('font-size');
    node.dataset.mingxiOriginalFontPriority = node.style.getPropertyPriority('font-size');
    node.style.setProperty('font-size', `${Math.round(size * ratio * 10) / 10}px`, 'important');
    node.dataset.mingxiAppliedFontSize = node.style.getPropertyValue('font-size');
    node.setAttribute('data-mingxi-font-scale', 'true');
  });
}
function clearFontScale() { document.querySelectorAll('[data-mingxi-font-scale]').forEach((node) => { restoreProperty(node, 'font-size', node.dataset.mingxiOriginalFontSize, node.dataset.mingxiOriginalFontPriority, node.dataset.mingxiAppliedFontSize); node.removeAttribute('data-mingxi-original-font-size'); node.removeAttribute('data-mingxi-original-font-priority'); node.removeAttribute('data-mingxi-applied-font-size'); node.removeAttribute('data-mingxi-font-scale'); }); }
function hexRgb(hex) { const value = hex.replace('#',''); return value.length === 6 ? [parseInt(value.slice(0,2),16),parseInt(value.slice(2,4),16),parseInt(value.slice(4,6),16)] : null; }
function sameRgb(a, b) { return a && b && a.slice(0,3).every((value, index) => value === b[index]); }
function applyCustomMappings(rules, root = document.body, reset = true) {
  if (reset) restoreCustomMappings();
  if (!rules.length || !root) return;
  const mappings = rules.map((rule) => ({ from:hexRgb(rule.from), to:rule.to }));
  walkElements(root, (node) => {
    const css = getComputedStyle(node);
    const colorRule = mappings.find((rule) => sameRgb(parseRgb(css.color), rule.from));
    if (colorRule) {
      node.dataset.mingxiMapColor = node.style.getPropertyValue('color');
      node.dataset.mingxiMapColorPriority = node.style.getPropertyPriority('color');
      node.style.setProperty('color', colorRule.to, 'important');
      node.dataset.mingxiAppliedMapColor = node.style.getPropertyValue('color');
    }
    const bgRule = mappings.find((rule) => sameRgb(parseRgb(css.backgroundColor), rule.from));
    if (bgRule) {
      node.dataset.mingxiMapBackground = node.style.getPropertyValue('background-color');
      node.dataset.mingxiMapBackgroundPriority = node.style.getPropertyPriority('background-color');
      node.style.setProperty('background-color', bgRule.to, 'important');
      node.dataset.mingxiAppliedMapBackground = node.style.getPropertyValue('background-color');
    }
  });
}
function restoreCustomMappings() { document.querySelectorAll('[data-mingxi-map-color],[data-mingxi-map-background]').forEach((node) => { if (node.hasAttribute('data-mingxi-map-color')) restoreProperty(node, 'color', node.dataset.mingxiMapColor, node.dataset.mingxiMapColorPriority, node.dataset.mingxiAppliedMapColor); if (node.hasAttribute('data-mingxi-map-background')) restoreProperty(node, 'background-color', node.dataset.mingxiMapBackground, node.dataset.mingxiMapBackgroundPriority, node.dataset.mingxiAppliedMapBackground); for (const name of ['data-mingxi-map-color','data-mingxi-map-color-priority','data-mingxi-applied-map-color','data-mingxi-map-background','data-mingxi-map-background-priority','data-mingxi-applied-map-background']) node.removeAttribute(name); }); }
function clearChartEnhancements() {
  document.querySelectorAll('[data-mingxi-generated]').forEach((node) => node.remove());
  document.querySelectorAll('[data-mingxi-original-dash]').forEach((node) => {
    if (node.dataset.mingxiOriginalDash) node.setAttribute('stroke-dasharray', node.dataset.mingxiOriginalDash);
    else node.removeAttribute('stroke-dasharray');
    node.removeAttribute('data-mingxi-original-dash');
  });
  document.querySelectorAll('[data-mingxi-chart-enhanced]').forEach((node) => {
    node.removeAttribute('data-mingxi-chart-enhanced');
  });
}
function clearEnhancements() { markSemanticElements(false); clearContrastFixes(); clearFontScale(); restoreCustomMappings(); clearChartEnhancements(); document.querySelectorAll('[data-mingxi-required]').forEach((node) => node.removeAttribute('data-mingxi-required')); }
function elementPath(node) {
  const parts = [];
  while (node && node !== document.body && parts.length < 5) {
    const tag = node.tagName.toLowerCase();
    let position = 1;
    for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) if (sibling.tagName === node.tagName) position++;
    parts.unshift(`${tag}:nth-of-type(${position})`);
    node = node.parentElement;
  }
  return `body > ${parts.join(' > ')}`;
}
async function auditPage() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  let scanned = 0; let checked = 0; let skipped = 0; let aa = 0; let aaa = 0; let colorOnly = 0;
  const examples = []; const issues = [];
  while (node) {
    scanned++;
    const directText = Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
    if (directText) {
      const info = textContrast(node);
      if (!info) skipped++;
      else {
        checked++;
        if (info.ratio < (info.large ? 3 : 4.5)) {
          aa++;
          if (examples.length < 5) examples.push({ text:node.textContent.trim().slice(0, 40), ratio:Number(info.ratio.toFixed(2)) });
          if (issues.length < 500) {
            const black = contrastRatio([0,0,0], info.bg);
            const white = contrastRatio([255,255,255], info.bg);
            issues.push({ rule:'WCAG 2.1 1.4.3', severity:'AA', path:elementPath(node), text:node.textContent.trim().slice(0, 80), ratio:Number(info.ratio.toFixed(2)), threshold:info.large ? 3 : 4.5, suggestedColor:black > white ? '#000000' : '#FFFFFF', status:'unresolved' });
          }
        }
        if (info.ratio < (info.large ? 4.5 : 7)) aaa++;
        const css = getComputedStyle(node);
        if (node.matches('a') && css.textDecorationLine === 'none') colorOnly++;
        if (node.matches('[role="alert"],.error,.warning,.success,[data-status]') && !node.textContent.match(/error|错误|warning|警告|success|成功|失败|完成/i)) colorOnly++;
      }
    }
    node = walker.nextNode();
    if (scanned % 100 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { scanned, checked, skipped, aa, aaa, colorOnly, examples, issues, issuesOmitted:Math.max(0, aa - issues.length), links:document.querySelectorAll('a').length, forms:document.querySelectorAll('input,select,textarea').length };
}
function inspectElement(info = {}) { let node; if (info.srcUrl) node = [...document.images].find((image) => image.currentSrc === info.srcUrl || image.src === info.srcUrl); if (!node && info.selectionText) { const selection = window.getSelection(); node = selection?.anchorNode?.parentElement; } node ||= document.elementFromPoint(innerWidth / 2, innerHeight / 2); if (!node) return { ok:false }; const css = getComputedStyle(node); const fg = parseRgb(css.color) || [0,0,0]; const bg = backgroundFor(node); return { ok:true, element:node.tagName.toLowerCase(), text:(node.textContent || info.selectionText || '').trim().slice(0,80), contrast:Number(contrastRatio(fg,bg).toFixed(2)), friendly:contrastRatio(fg,bg) >= 4.5 }; }

function toggleProbe() { probeEnabled = !probeEnabled; let tip = document.querySelector('#mingxi-color-probe'); if (!probeEnabled) { tip?.remove(); document.removeEventListener('mousemove', probeMove, true); return; } if (!tip) { tip = document.createElement('div'); tip.id = 'mingxi-color-probe'; document.body.appendChild(tip); } document.addEventListener('mousemove', probeMove, true); }
function probeMove(event) { if (!probeEnabled) return; const node = document.elementFromPoint(event.clientX, event.clientY); if (!node) return; const color = getComputedStyle(node).color; const bg = backgroundFor(node); const tip = document.querySelector('#mingxi-color-probe'); if (!tip) return; const fg = parseRgb(color) || [0,0,0]; const ratio = contrastRatio(fg, bg).toFixed(2); tip.textContent = `文字：${colorName(fg)} · 背景：${colorName(bg)} · 对比度 ${ratio}:1`; tip.style.left = `${Math.min(event.clientX + 14, innerWidth - 220)}px`; tip.style.top = `${Math.min(event.clientY + 14, innerHeight - 46)}px`; }
function colorName(rgb) { const [r,g,b] = rgb.map((value) => value / 255); const max = Math.max(r,g,b); const min = Math.min(r,g,b); const delta = max - min; if (max < .14) return '黑色'; if (min > .88) return '白色'; if (delta < .09) return max < .55 ? '深灰色' : '灰色'; let h = 0; if (delta) { if (max === r) h = 60 * (((g - b) / delta) % 6); else if (max === g) h = 60 * ((b - r) / delta + 2); else h = 60 * ((r - g) / delta + 4); } if (h < 0) h += 360; if (h < 15 || h >= 345) return '红色'; if (h < 38) return '橙色'; if (h < 68) return '黄色'; if (h < 165) return '绿色'; if (h < 255) return '蓝色'; if (h < 315) return '紫色'; return '粉红色'; }
function toggleReader() { const existing = document.querySelector('#mingxi-reader'); if (existing) { existing.remove(); return; } const source = document.querySelector('article, main, [role="main"]') || document.body; const clone = source.cloneNode(true); clone.querySelectorAll('script,style,nav,aside,form,button,iframe,canvas,video,[aria-hidden="true"],[role="navigation"]').forEach((node) => node.remove()); const reader = document.createElement('div'); reader.id = 'mingxi-reader'; const article = document.createElement('article'); const title = document.querySelector('h1')?.textContent || document.title; article.innerHTML = `<button id="mingxi-reader-close">关闭阅读模式</button><h1>${escapeHtml(title)}</h1>`; const content = clone.querySelector('article,main,[role="main"]') || clone; article.appendChild(content); reader.appendChild(article); document.body.appendChild(reader); document.querySelector('#mingxi-reader-close').addEventListener('click', toggleReader); }
function escapeHtml(value) { return value.replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])); }

async function refresh() { const siteKey = `site:${location.hostname}`; try { const saved = await chrome.storage.sync.get({ global:{}, [siteKey]:null }); applySettings(MingxiSettings.effective(saved.global, saved[siteKey])); } catch (error) { if (!String(error?.message || error).includes('Extension context invalidated')) console.warn('[明晰]', error); } }
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'apply-settings') applySettings(MingxiSettings.effective(message.settings));
  if (message.type === 'refresh-settings') refresh().catch(() => {});
  if (message.type === 'toggle-probe') toggleProbe();
  if (message.type === 'toggle-reader') toggleReader();
  if (message.type === 'run-audit') { auditPage().then(sendResponse).catch(() => sendResponse({ error:'Audit failed' })); return true; }
  if (message.type === 'inspect-element') { sendResponse(inspectElement(message)); return true; }
  if (message.type === 'toggle-settings') {
    const siteKey = `site:${location.hostname}`;
    chrome.storage.sync.get({ global:{}, [siteKey]:null }).then(async (saved) => {
      const current = MingxiSettings.effective(saved.global, saved[siteKey]);
      const next = { ...current, enabled: !current.enabled };
      const override = { ...(saved[siteKey] || {}), enabled: next.enabled };
      await chrome.storage.sync.set({ [siteKey]: override });
      applySettings(next);
    }).catch(() => {});
  }
});
refresh().catch(() => {});
function enhanceAddedNode(root) {
  if (!root.isConnected || !activeSettings?.enabled || activeSettings.excluded || root.closest('#mingxi-reader')) return;
  const semantic = [
    ['✓', '[aria-label*="success" i], [aria-label*="成功"], .success, .is-success, [data-status="success"]'],
    ['!', '[role="alert"], [aria-label*="warning" i], [aria-label*="警告"], .warning, .is-warning, [data-status="warning"]'],
    ['×', '[aria-invalid="true"], [aria-label*="error" i], [aria-label*="错误"], .error, .is-error, [data-status="error"]']
  ];
  walkElements(root, (node) => {
    if (activeSettings.semanticHints) for (const [mark, selector] of semantic) if (node.matches(selector)) node.setAttribute('data-mingxi-mark', mark);
    if (activeSettings.requiredHints !== false && node.matches('input[required],select[required],textarea[required],[aria-required="true"]')) (node.labels?.[0] || node).setAttribute('data-mingxi-required', 'true');
    if (activeSettings.chartHints && node.matches('svg[role="img"],svg[aria-label*="chart" i],svg[aria-label*="图表"]')) enhanceSvgChart(node);
  });
  applyFontScale(Number(activeSettings.fontScale ?? 100), root, false);
  applyCustomMappings(activeSettings.customMappings || [], root, false);
  if (activeSettings.autoContrast) scanContrast(root, false);
}
const pendingRoots = new Set();
function flushAddedNodes() {
  observerTimer = undefined;
  const roots = Array.from(pendingRoots).slice(0, 40);
  roots.forEach((root) => pendingRoots.delete(root));
  roots.forEach(enhanceAddedNode);
  if (pendingRoots.size) observerTimer = setTimeout(flushAddedNodes, 150);
}
const observer = new MutationObserver((records) => {
  if (!activeSettings?.enabled || activeSettings.excluded) return;
  for (const record of records) for (const node of record.addedNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE || node.id === STYLE_ID || node.id === 'mingxi-reader') continue;
    if ([...pendingRoots].some((root) => root.contains(node))) continue;
    for (const root of pendingRoots) if (node.contains(root)) pendingRoots.delete(root);
    pendingRoots.add(node);
  }
  if (pendingRoots.size && !observerTimer) observerTimer = setTimeout(flushAddedNodes, 150);
});
observer.observe(document.documentElement, { childList:true, subtree:true });
