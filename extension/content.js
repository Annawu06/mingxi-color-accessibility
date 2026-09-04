const STYLE_ID = 'mingxi-color-friendly-style';
let originalRootFilter;
let hasCapturedRootFilter = false;
let scanTimer;
let observerTimer;
let probeEnabled = false;
let readerOpen = false;
let activeSettings = null;

const modeStyles = {
  protanopia: 'sepia(.18) saturate(1.18) hue-rotate(-12deg)',
  deuteranopia: 'sepia(.10) saturate(1.20) hue-rotate(14deg)',
  tritanopia: 'hue-rotate(38deg) saturate(1.12)',
  contrast: 'contrast(1.14)'
};

function applySettings(settings) {
  activeSettings = settings;
  let style = document.getElementById(STYLE_ID);
  if (!style) { style = document.createElement('style'); style.id = STYLE_ID; (document.head || document.documentElement).appendChild(style); }
  if (!settings.enabled || settings.excluded) {
    style.textContent = '';
    if (hasCapturedRootFilter) { if (originalRootFilter.value) document.documentElement.style.setProperty('filter', originalRootFilter.value, originalRootFilter.priority); else document.documentElement.style.removeProperty('filter'); }
    document.documentElement.dataset.mingxiImages = 'false';
    document.documentElement.dataset.mingxiLinks = 'false';
    clearEnhancements();
    return;
  }
  const intensity = Math.max(0, Math.min(100, Number(settings.intensity ?? 65)));
  const contrast = (1 + intensity / 100 * 0.12).toFixed(2);
  const filter = modeStyles[settings.mode] || modeStyles.deuteranopia;
  if (!hasCapturedRootFilter) { originalRootFilter = { value: document.documentElement.style.getPropertyValue('filter'), priority: document.documentElement.style.getPropertyPriority('filter') }; hasCapturedRootFilter = true; }
  if (settings.colorRemap !== false) document.documentElement.style.setProperty('filter', `${filter} contrast(${contrast})`, 'important');
  else if (originalRootFilter.value) document.documentElement.style.setProperty('filter', originalRootFilter.value, originalRootFilter.priority);
  else document.documentElement.style.removeProperty('filter');
  style.textContent = `
    svg#mingxi-filter-defs { position:absolute; width:0; height:0; }
    [data-mingxi-mark]::before { content:attr(data-mingxi-mark); display:inline-block; margin-right:.4em; font-weight:700; }
    [data-mingxi-mark="✓"]::before { color:#087443; } [data-mingxi-mark="!"]::before { color:#a34a00; } [data-mingxi-mark="×"]::before { color:#a00025; }
    html[data-mingxi-links="true"] a:not([role="button"]):not([class*="button" i]) { text-decoration-line:underline !important; text-decoration-thickness:.12em !important; text-underline-offset:.16em !important; }
    html[data-mingxi-images="true"] img, html[data-mingxi-images="true"] canvas, html[data-mingxi-images="true"] video { filter:url("#mingxi-daltonize-${settings.mode}") contrast(1.04) !important; outline:1px solid rgba(30,77,59,.18); }
    html[data-mingxi-images="true"] svg[role="img"], html[data-mingxi-images="true"] [aria-label*="chart" i], html[data-mingxi-images="true"] [aria-label*="图表"] { outline:2px solid rgba(30,77,59,.35) !important; }
    [data-mingxi-chart-mark] { stroke-dasharray:7 3 !important; }
    [data-mingxi-required]::after { content:' (必填)'; color:#8b3a24; font-size:.9em; font-weight:700; }
    #mingxi-color-probe { position:fixed; z-index:2147483647; pointer-events:none; padding:7px 9px; border-radius:7px; background:#18251f; color:#fff; font:12px Arial,sans-serif; box-shadow:0 4px 15px #0004; }
    #mingxi-reader { position:fixed; inset:0; z-index:2147483646; overflow:auto; background:#fff; color:#111; padding:7vh max(7vw,24px); font:19px/1.9 Georgia,'Noto Serif SC',serif; }
    #mingxi-reader article { max-width:760px; margin:auto; } #mingxi-reader article > :not(button), #mingxi-reader article > :not(button) * { background:#fff !important; color:#111 !important; text-shadow:none !important; } #mingxi-reader article p { margin:1em 0; } #mingxi-reader article img { max-width:100%; filter:grayscale(1) contrast(1.15) !important; } #mingxi-reader h1 { font:700 34px/1.3 Arial,'Noto Sans SC',sans-serif; } #mingxi-reader button { position:fixed; right:24px; top:20px; padding:9px 13px; border:1px solid #777; border-radius:6px; background:#fff; cursor:pointer; }
  `;
  document.documentElement.dataset.mingxiImages = settings.enhanceImages ? 'true' : 'false';
  document.documentElement.dataset.mingxiLinks = settings.linkHints ? 'true' : 'false';
  markSemanticElements(Boolean(settings.semanticHints));
  applyCustomMappings(settings.customMappings || []);
  if (settings.autoContrast) scheduleContrastScan(); else clearContrastFixes();
  applyFontScale(Number(settings.fontScale ?? 100));
  if (settings.chartHints) markCharts();
  if (settings.requiredHints !== false) markRequiredFields();
  if (settings.enhanceImages) enhanceCanvases(settings.mode);
  else document.querySelectorAll('canvas[data-mingxi-canvas-mode]').forEach((canvas) => { try { canvas.getContext('2d')?.putImageData(canvas.__mingxiOriginal, 0, 0); } catch (_) {} canvas.removeAttribute('data-mingxi-canvas-mode'); });
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
  document.querySelectorAll('svg[role="img"] path, [aria-label*="chart" i] path, [aria-label*="图表"] path').forEach((node, index) => { if (index % 2) node.setAttribute('data-mingxi-chart-mark', 'true'); });
  document.querySelectorAll('svg[role="img"] rect, [aria-label*="chart" i] rect, [aria-label*="图表"] rect').forEach((node, index) => { if (index % 3 === 1) node.setAttribute('data-mingxi-chart-mark', 'true'); });
  document.querySelectorAll('svg[role="img"], [aria-label*="chart" i], [aria-label*="图表"]').forEach(enhanceSvgChart);
}

function enhanceSvgChart(svg) {
  if (svg.dataset.mingxiChartEnhanced === 'true') return;
  const candidates = svg.querySelectorAll('rect,path,circle,polyline,polygon');
  if (candidates.length < 3) return;
  const ns = 'http://www.w3.org/2000/svg'; const defsNode = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(ns, 'defs'), svg.firstChild); const patternId = `mingxi-pattern-${Math.random().toString(36).slice(2)}`; const pattern = document.createElementNS(ns, 'pattern'); pattern.id = patternId; pattern.setAttribute('width','8'); pattern.setAttribute('height','8'); pattern.setAttribute('patternUnits','userSpaceOnUse'); pattern.innerHTML = '<path d="M-2 2L2 -2M0 8L8 0M6 10L10 6" stroke="currentColor" stroke-width="1.4" opacity=".6"/>'; defsNode.appendChild(pattern);
  candidates.forEach((node, index) => { const fill = node.getAttribute('fill') || getComputedStyle(node).fill; if (fill && fill !== 'none' && (index % 2 === 0 || node.tagName.toLowerCase() === 'rect')) node.setAttribute('fill', `url(#${patternId})`); if (node.tagName.toLowerCase() === 'path' || node.tagName.toLowerCase() === 'polyline') { node.setAttribute('stroke-width', node.getAttribute('stroke-width') || '2'); if (index % 2) node.setAttribute('stroke-dasharray','7 3'); } const value = node.getAttribute('data-value') || node.getAttribute('aria-label') || node.querySelector('title')?.textContent; if (value && /\d/.test(value) && node.tagName.toLowerCase() === 'rect') { const label = document.createElementNS(ns, 'text'); const box = node.getBBox(); label.setAttribute('x', box.x + box.width / 2); label.setAttribute('y', Math.max(12, box.y - 4)); label.setAttribute('text-anchor','middle'); label.setAttribute('font-size','10'); label.setAttribute('fill','currentColor'); label.textContent = value.match(/[-+]?\d+(?:\.\d+)?/)[0]; svg.appendChild(label); } });
  svg.dataset.mingxiChartEnhanced = 'true';
}

const lmsMatrix = [[0.31399022,0.63951294,0.04649755],[0.15537241,0.75789446,0.08670142],[0.01775239,0.10944209,0.87256922]];
const rgbMatrix = [[5.47221206,-4.6419601,0.16963708],[-1.1252419,2.29317094,-0.1678952],[0.02980165,-0.19318073,1.16364789]];
const confusion = { protanopia:[[0,2.02344,-2.52581],[0,1,0],[0,0,1]], deuteranopia:[[1,0,0],[0.494207,0,1.24827],[0,0,1]], tritanopia:[[1,0,0],[0,1,0],[-0.395913,0.801109,0]] };
function multiply(matrix, vector) { return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0)); }
function clamp(value) { return Math.max(0, Math.min(255, value)); }
function daltonizePixel(rgb, mode) { const matrix = confusion[mode]; if (!matrix) return rgb; const lms = multiply(lmsMatrix, rgb.map((value) => value / 255)); const simulated = multiply(matrix, lms); const error = lms.map((value, index) => value - simulated[index]); const correction = mode === 'protanopia' ? [0, error[0], error[0]] : mode === 'deuteranopia' ? [error[1], 0, error[1]] : [error[2], error[2], 0]; return multiply(rgbMatrix, lms.map((value, index) => value + correction[index] * .65)).map(clamp); }
function enhanceCanvases(mode) { document.querySelectorAll('canvas').forEach((canvas) => { if (!canvas.width || !canvas.height || canvas.dataset.mingxiCanvasMode === mode) return; try { const ctx = canvas.getContext('2d'); if (!ctx) return; if (!canvas.__mingxiOriginal) canvas.__mingxiOriginal = ctx.getImageData(0,0,canvas.width,canvas.height); else ctx.putImageData(canvas.__mingxiOriginal,0,0); const image = ctx.getImageData(0,0,canvas.width,canvas.height); for (let i=0; i<image.data.length; i+=4) { const next = daltonizePixel([image.data[i],image.data[i+1],image.data[i+2]], mode); image.data[i]=next[0]; image.data[i+1]=next[1]; image.data[i+2]=next[2]; } ctx.putImageData(image,0,0); canvas.dataset.mingxiCanvasMode = mode; } catch (_) { /* cross-origin or protected canvas: leave it untouched */ } }); }

function markRequiredFields() { document.querySelectorAll('input[required],select[required],textarea[required], [aria-required="true"]').forEach((field) => { const label = field.labels?.[0]; if (label) label.setAttribute('data-mingxi-required', 'true'); else field.setAttribute('data-mingxi-required', 'true'); }); }

function parseRgb(value) { const match = value && value.match(/rgba?\(([^)]+)\)/); if (!match) return null; const nums = match[1].replace('/', ' ').trim().split(/[\s,]+/).map((part) => Number.parseFloat(part)); return nums.length >= 3 && nums.slice(0,3).every(Number.isFinite) ? nums : null; }
function luminance(rgb) { const c = rgb.slice(0, 3).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; }
function contrastRatio(a, b) { const l1 = luminance(a); const l2 = luminance(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); }
function backgroundFor(node) { let current = node; while (current && current !== document.documentElement) { const bg = parseRgb(getComputedStyle(current).backgroundColor); if (bg && (bg.length < 4 || bg[3] !== 0)) return bg; current = current.parentElement; } return [255,255,255]; }
function scheduleContrastScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scanContrast, 250); }
function scanContrast() {
  document.querySelectorAll('[data-mingxi-contrast-fix]').forEach(restoreContrastFix);
  Array.from(document.querySelectorAll('body *')).slice(0, 1600).forEach((node) => { if (!node.textContent?.trim() || node.children.length > 3 || node.closest('img,svg,canvas')) return; const css = getComputedStyle(node); const fg = parseRgb(css.color); const bg = backgroundFor(node); if (!fg || contrastRatio(fg, bg) >= 4.5) return; const black = contrastRatio([0,0,0], bg); const white = contrastRatio([255,255,255], bg); node.dataset.mingxiOriginalColor = node.style.getPropertyValue('color'); node.dataset.mingxiOriginalPriority = node.style.getPropertyPriority('color'); node.style.setProperty('color', black > white ? '#000' : '#fff', 'important'); node.setAttribute('data-mingxi-contrast-fix', 'true'); });
}
function restoreContrastFix(node) { if (node.dataset.mingxiOriginalColor) node.style.setProperty('color', node.dataset.mingxiOriginalColor, node.dataset.mingxiOriginalPriority || ''); else node.style.removeProperty('color'); node.removeAttribute('data-mingxi-original-color'); node.removeAttribute('data-mingxi-original-priority'); node.removeAttribute('data-mingxi-contrast-fix'); }
function clearContrastFixes() { document.querySelectorAll('[data-mingxi-contrast-fix]').forEach(restoreContrastFix); }
function applyFontScale(scale) { clearFontScale(); if (!scale || scale <= 100) return; const ratio = Math.max(1, Math.min(1.6, scale / 100)); Array.from(document.querySelectorAll('body *')).slice(0, 1600).forEach((node) => { if (!node.textContent?.trim() || node.children.length > 3 || node.closest('img,svg,canvas,video')) return; const computed = getComputedStyle(node); const size = Number.parseFloat(computed.fontSize); if (!Number.isFinite(size) || size < 10) return; node.dataset.mingxiOriginalFontSize = node.style.getPropertyValue('font-size'); node.dataset.mingxiOriginalFontPriority = node.style.getPropertyPriority('font-size'); node.style.setProperty('font-size', `${Math.round(size * ratio * 10) / 10}px`, 'important'); node.setAttribute('data-mingxi-font-scale', 'true'); }); }
function clearFontScale() { document.querySelectorAll('[data-mingxi-font-scale]').forEach((node) => { if (node.dataset.mingxiOriginalFontSize) node.style.setProperty('font-size', node.dataset.mingxiOriginalFontSize, node.dataset.mingxiOriginalFontPriority || ''); else node.style.removeProperty('font-size'); node.removeAttribute('data-mingxi-original-font-size'); node.removeAttribute('data-mingxi-original-font-priority'); node.removeAttribute('data-mingxi-font-scale'); }); }
function hexRgb(hex) { const value = hex.replace('#',''); return value.length === 6 ? [parseInt(value.slice(0,2),16),parseInt(value.slice(2,4),16),parseInt(value.slice(4,6),16)] : null; }
function sameRgb(a, b) { return a && b && a.slice(0,3).every((value, index) => value === b[index]); }
function applyCustomMappings(rules) { restoreCustomMappings(); if (!rules.length) return; const mappings = rules.map((rule) => ({ from:hexRgb(rule.from), to:rule.to })); Array.from(document.querySelectorAll('body *')).slice(0, 1600).forEach((node) => { const css = getComputedStyle(node); const colorRule = mappings.find((rule) => sameRgb(parseRgb(css.color), rule.from)); if (colorRule) { node.dataset.mingxiMapColor = node.style.getPropertyValue('color'); node.dataset.mingxiMapColorPriority = node.style.getPropertyPriority('color'); node.style.setProperty('color', colorRule.to, 'important'); } const bgRule = mappings.find((rule) => sameRgb(parseRgb(css.backgroundColor), rule.from)); if (bgRule) { node.dataset.mingxiMapBackground = node.style.getPropertyValue('background-color'); node.dataset.mingxiMapBackgroundPriority = node.style.getPropertyPriority('background-color'); node.style.setProperty('background-color', bgRule.to, 'important'); } }); }
function restoreCustomMappings() { document.querySelectorAll('[data-mingxi-map-color],[data-mingxi-map-background]').forEach((node) => { if (node.hasAttribute('data-mingxi-map-color')) { if (node.dataset.mingxiMapColor) node.style.setProperty('color', node.dataset.mingxiMapColor, node.dataset.mingxiMapColorPriority || ''); else node.style.removeProperty('color'); } if (node.hasAttribute('data-mingxi-map-background')) { if (node.dataset.mingxiMapBackground) node.style.setProperty('background-color', node.dataset.mingxiMapBackground, node.dataset.mingxiMapBackgroundPriority || ''); else node.style.removeProperty('background-color'); } node.removeAttribute('data-mingxi-map-color'); node.removeAttribute('data-mingxi-map-color-priority'); node.removeAttribute('data-mingxi-map-background'); node.removeAttribute('data-mingxi-map-background-priority'); }); }
function clearEnhancements() { markSemanticElements(false); clearContrastFixes(); clearFontScale(); restoreCustomMappings(); document.querySelectorAll('canvas[data-mingxi-canvas-mode]').forEach((canvas) => { try { canvas.getContext('2d')?.putImageData(canvas.__mingxiOriginal, 0, 0); } catch (_) {} canvas.removeAttribute('data-mingxi-canvas-mode'); }); document.querySelectorAll('[data-mingxi-chart-mark],[data-mingxi-required]').forEach((node) => { node.removeAttribute('data-mingxi-chart-mark'); node.removeAttribute('data-mingxi-required'); }); document.querySelectorAll('[data-mingxi-chart-enhanced="true"]').forEach((node) => node.removeAttribute('data-mingxi-chart-enhanced')); }

function toggleProbe() { probeEnabled = !probeEnabled; let tip = document.querySelector('#mingxi-color-probe'); if (!probeEnabled) { tip?.remove(); return; } if (!tip) { tip = document.createElement('div'); tip.id = 'mingxi-color-probe'; document.body.appendChild(tip); } document.addEventListener('mousemove', probeMove, true); }
function probeMove(event) { if (!probeEnabled) return; const node = document.elementFromPoint(event.clientX, event.clientY); if (!node) return; const color = getComputedStyle(node).color; const bg = backgroundFor(node); const tip = document.querySelector('#mingxi-color-probe'); const bgName = colorName(bg); const fgName = colorName(parseRgb(color) || [0,0,0]); tip.innerHTML = `<b>文字：${fgName}</b> · 背景：${bgName}<br><small>${brightnessName(bg)} · ${colorConfusable(color) ? '红绿色彩可能接近' : '未发现明显红绿混淆'}</small>`; tip.style.left = `${Math.min(event.clientX + 14, innerWidth - 220)}px`; tip.style.top = `${Math.min(event.clientY + 14, innerHeight - 46)}px`; }
function colorConfusable(value) { const rgb = parseRgb(value); return rgb && Math.abs(rgb[0] - rgb[1]) < 45 && rgb[2] < 150; }
function colorName(rgb) { const [r,g,b] = rgb.map((value) => value / 255); const max = Math.max(r,g,b); const min = Math.min(r,g,b); const delta = max - min; if (max < .14) return '黑色'; if (min > .88) return '白色'; if (delta < .09) return max < .55 ? '深灰色' : '灰色'; let h = 0; if (delta) { if (max === r) h = 60 * (((g - b) / delta) % 6); else if (max === g) h = 60 * ((b - r) / delta + 2); else h = 60 * ((r - g) / delta + 4); } if (h < 0) h += 360; if (h < 15 || h >= 345) return '红色'; if (h < 38) return '橙色'; if (h < 68) return '黄色'; if (h < 165) return '绿色'; if (h < 255) return '蓝色'; if (h < 315) return '紫色'; return '粉红色'; }
function brightnessName(rgb) { const value = luminance(rgb); return value > .72 ? '明亮背景' : value < .22 ? '深色背景' : '中等明度背景'; }
function toggleReader() { const existing = document.querySelector('#mingxi-reader'); if (existing) { existing.remove(); readerOpen = false; return; } const source = document.querySelector('article, main, [role="main"]') || document.body; const clone = source.cloneNode(true); clone.querySelectorAll('script,style,nav,aside,form,button,iframe,canvas,video,[aria-hidden="true"],[role="navigation"]').forEach((node) => node.remove()); const reader = document.createElement('div'); reader.id = 'mingxi-reader'; const article = document.createElement('article'); const title = document.querySelector('h1')?.textContent || document.title; article.innerHTML = `<button id="mingxi-reader-close">关闭阅读模式</button><h1>${escapeHtml(title)}</h1>`; const content = clone.querySelector('article,main,[role="main"]') || clone; article.appendChild(content); reader.appendChild(article); document.body.appendChild(reader); document.querySelector('#mingxi-reader-close').addEventListener('click', toggleReader); readerOpen = true; }
function escapeHtml(value) { return value.replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char])); }

async function refresh() { const defaults = { enabled:false, mode:'deuteranopia', intensity:65, fontScale:100, semanticHints:true, enhanceImages:true, autoContrast:true, chartHints:true, linkHints:true, requiredHints:true, colorRemap:true, excluded:false, customMappings:[] }; const siteKey = `site:${location.hostname}`; try { const saved = await chrome.storage.sync.get({ global:defaults, [siteKey]:null }); applySettings({ ...defaults, ...(saved.global || {}), ...(saved[siteKey] || {}) }); } catch (error) { if (!String(error?.message || error).includes('Extension context invalidated')) console.warn('[明晰]', error); } }
chrome.runtime.onMessage.addListener((message) => { if (message.type === 'apply-settings') applySettings(message.settings); if (message.type === 'refresh-settings') refresh().catch(() => {}); if (message.type === 'toggle-probe') toggleProbe(); if (message.type === 'toggle-reader') toggleReader(); if (message.type === 'toggle-settings') refresh().then(() => chrome.storage.sync.get({ global:{} }).then((saved) => { const siteKey = `site:${location.hostname}`; return chrome.storage.sync.get({ [siteKey]:saved.global }).then((current) => { const next = { ...(current[siteKey] || saved.global), enabled: !(current[siteKey] || saved.global).enabled }; return chrome.storage.sync.set({ [siteKey]:next }).then(() => applySettings(next)); }); })).catch(() => {}); });
const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); defs.id = 'mingxi-filter-defs'; defs.innerHTML = `<defs><filter id="mingxi-daltonize-protanopia"><feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/></filter><filter id="mingxi-daltonize-deuteranopia"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/></filter><filter id="mingxi-daltonize-tritanopia"><feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/></filter><filter id="mingxi-daltonize-contrast"><feComponentTransfer><feFuncR type="linear" slope="1.15"/><feFuncG type="linear" slope="1.15"/><feFuncB type="linear" slope="1.15"/></feComponentTransfer></filter></defs>`; document.documentElement.appendChild(defs); refresh().catch(() => {});
function enhanceAddedNodes(records) { if (!activeSettings?.enabled || activeSettings.excluded) return; records.forEach((record) => record.addedNodes.forEach((node) => { if (node.nodeType !== 1) return; const children = node.querySelectorAll ? [...node.querySelectorAll('canvas,svg[role="img"],[aria-label*="chart" i],[aria-label*="图表"]')] : []; const elements = [node, ...children]; elements.forEach((element) => { if (element.matches?.('canvas')) enhanceCanvases(activeSettings.mode); if (element.matches?.('svg[role="img"],[aria-label*="chart" i],[aria-label*="图表"]')) enhanceSvgChart(element); }); })); }
const observer = new MutationObserver((records) => {
  const styleNode = document.getElementById(STYLE_ID);
  if (styleNode && records.every((record) => record.target === styleNode)) return;
  clearTimeout(observerTimer);
  observerTimer = setTimeout(() => enhanceAddedNodes(records), 450);
});
observer.observe(document.documentElement, { childList:true, subtree:true });
