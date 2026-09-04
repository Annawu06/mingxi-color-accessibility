const STYLE_ID = 'mingxi-color-friendly-style';
let originalRootFilter;
let hasCapturedRootFilter = false;
let scanTimer;

const modeStyles = {
  protanopia: 'sepia(.18) saturate(1.18) hue-rotate(-12deg)',
  deuteranopia: 'sepia(.10) saturate(1.20) hue-rotate(14deg)',
  tritanopia: 'hue-rotate(38deg) saturate(1.12)',
  contrast: 'contrast(1.14)'
};

function applySettings(settings) {
  let style = document.getElementById(STYLE_ID);
  if (!style) { style = document.createElement('style'); style.id = STYLE_ID; (document.head || document.documentElement).appendChild(style); }
  if (!settings.enabled) {
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
  else document.documentElement.style.removeProperty('filter');
  style.textContent = `
    svg#mingxi-filter-defs { position:absolute; width:0; height:0; }
    [data-mingxi-mark]::before { content:attr(data-mingxi-mark); display:inline-block; margin-right:.4em; font-weight:700; }
    [data-mingxi-mark="✓"]::before { color:#087443; } [data-mingxi-mark="!"]::before { color:#a34a00; } [data-mingxi-mark="×"]::before { color:#a00025; }
    html[data-mingxi-links="true"] a:not([role="button"]):not([class*="button" i]) { text-decoration-line:underline !important; text-decoration-thickness:.12em !important; text-underline-offset:.16em !important; }
    html[data-mingxi-images="true"] img, html[data-mingxi-images="true"] canvas { filter:url("#mingxi-daltonize-${settings.mode}") contrast(1.04) !important; outline:1px solid rgba(30,77,59,.18); }
    html[data-mingxi-images="true"] svg[role="img"], html[data-mingxi-images="true"] [aria-label*="chart" i], html[data-mingxi-images="true"] [aria-label*="图表"] { outline:2px solid rgba(30,77,59,.35) !important; }
    [data-mingxi-chart-mark] { stroke-dasharray:7 3 !important; }
  `;
  document.documentElement.dataset.mingxiImages = settings.enhanceImages ? 'true' : 'false';
  document.documentElement.dataset.mingxiLinks = settings.linkHints ? 'true' : 'false';
  markSemanticElements(Boolean(settings.semanticHints));
  if (settings.autoContrast) scheduleContrastScan(); else clearContrastFixes();
  if (settings.chartHints) markCharts();
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
}

function parseRgb(value) { const match = value && value.match(/rgba?\(([^)]+)\)/); if (!match) return null; const nums = match[1].split(',').map(Number); return nums.length >= 3 ? nums : null; }
function luminance(rgb) { const c = rgb.slice(0, 3).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; }
function contrastRatio(a, b) { const l1 = luminance(a); const l2 = luminance(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); }
function backgroundFor(node) { let current = node; while (current && current !== document.documentElement) { const bg = parseRgb(getComputedStyle(current).backgroundColor); if (bg && (bg.length < 4 || bg[3] !== 0)) return bg; current = current.parentElement; } return [255,255,255]; }
function scheduleContrastScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scanContrast, 250); }
function scanContrast() {
  document.querySelectorAll('[data-mingxi-contrast-fix]').forEach((node) => { if (node.dataset.mingxiOriginalColor !== undefined) node.style.setProperty('color', node.dataset.mingxiOriginalColor, node.dataset.mingxiOriginalPriority || ''); node.removeAttribute('data-mingxi-original-color'); node.removeAttribute('data-mingxi-contrast-fix'); });
  document.querySelectorAll('body *').forEach((node) => { if (!node.textContent?.trim() || node.children.length > 3) return; const css = getComputedStyle(node); const fg = parseRgb(css.color); const bg = backgroundFor(node); if (!fg || contrastRatio(fg, bg) >= 4.5) return; const black = contrastRatio([0,0,0], bg); const white = contrastRatio([255,255,255], bg); node.dataset.mingxiOriginalColor = node.style.getPropertyValue('color'); node.dataset.mingxiOriginalPriority = node.style.getPropertyPriority('color'); node.style.setProperty('color', black > white ? '#000' : '#fff', 'important'); node.setAttribute('data-mingxi-contrast-fix', 'true'); });
}
function clearContrastFixes() { document.querySelectorAll('[data-mingxi-contrast-fix]').forEach((node) => { if (node.dataset.mingxiOriginalColor) node.style.setProperty('color', node.dataset.mingxiOriginalColor, node.dataset.mingxiOriginalPriority || ''); else node.style.removeProperty('color'); node.removeAttribute('data-mingxi-original-color'); node.removeAttribute('data-mingxi-original-priority'); node.removeAttribute('data-mingxi-contrast-fix'); }); }
function clearEnhancements() { markSemanticElements(false); clearContrastFixes(); document.querySelectorAll('[data-mingxi-chart-mark]').forEach((node) => node.removeAttribute('data-mingxi-chart-mark')); }

async function refresh() { const defaults = { enabled:false, mode:'deuteranopia', intensity:65, semanticHints:true, enhanceImages:true, autoContrast:true, chartHints:true, linkHints:true, colorRemap:true }; const siteKey = `site:${location.hostname}`; try { const saved = await chrome.storage.sync.get({ global:defaults, [siteKey]:null }); applySettings(saved[siteKey] || saved.global || defaults); } catch (error) { if (!String(error?.message || error).includes('Extension context invalidated')) console.warn('[明晰]', error); } }
chrome.runtime.onMessage.addListener((message) => { if (message.type === 'apply-settings') applySettings(message.settings); if (message.type === 'refresh-settings') refresh().catch(() => {}); });
const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); defs.id = 'mingxi-filter-defs'; defs.innerHTML = `<defs><filter id="mingxi-daltonize-protanopia"><feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/></filter><filter id="mingxi-daltonize-deuteranopia"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/></filter><filter id="mingxi-daltonize-tritanopia"><feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/></filter><filter id="mingxi-daltonize-contrast"><feComponentTransfer><feFuncR type="linear" slope="1.15"/><feFuncG type="linear" slope="1.15"/><feFuncB type="linear" slope="1.15"/></feComponentTransfer></filter></defs>`; document.documentElement.appendChild(defs); refresh().catch(() => {});
const observer = new MutationObserver((records) => { const styleNode = document.getElementById(STYLE_ID); if (styleNode && records.every((record) => record.target === styleNode)) return; refresh().catch(() => {}); }); observer.observe(document.documentElement, { childList:true, subtree:true });
