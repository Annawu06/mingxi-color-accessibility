(() => {
function parseRgb(value) { const match = value && value.match(/rgba?\(([^)]+)\)/); if (!match) return null; const nums = match[1].replace('/', ' ').trim().split(/[\s,]+/).map((part) => Number.parseFloat(part)); return nums.length >= 3 && nums.slice(0,3).every(Number.isFinite) ? nums : null; }
function luminance(rgb) { const c = rgb.slice(0, 3).map((v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; }
function contrastRatio(a, b) { const l1 = luminance(a); const l2 = luminance(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); }
function backgroundInfoFor(node) {
  const ancestors = [];
  for (let current = node; current; current = current.parentElement) ancestors.push(current);
  const result = [255, 255, 255];
  let uncertain = false;
  for (const current of ancestors.reverse()) {
    const css = getComputedStyle(current);
    if (css.backgroundImage !== 'none' || Number(css.opacity) < 1 || css.mixBlendMode !== 'normal') uncertain = true;
    const bg = parseRgb(css.backgroundColor);
    if (!bg) continue;
    const alpha = Math.max(0, Math.min(1, bg[3] ?? 1));
    for (let i = 0; i < 3; i++) result[i] = bg[i] * alpha + result[i] * (1 - alpha);
  }
  return { color: result, uncertain };
}
function backgroundFor(node) { return backgroundInfoFor(node).color; }
function isLargeText(css) { const size = Number.parseFloat(css.fontSize); const weight = Number.parseInt(css.fontWeight, 10) || (css.fontWeight === 'bold' ? 700 : 400); return size >= 24 || (size >= 18.66 && weight >= 700); }
function textContrast(node) {
  if (!Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim())) return null;
  if (node.closest('svg,canvas,video,#mingxi-reader') || node.matches('script,style,noscript')) return null;
  const css = getComputedStyle(node);
  if (css.display === 'none' || css.visibility !== 'visible' || Number(css.opacity) === 0) return null;
  const fg = parseRgb(css.color);
  if (!fg) return null;
  const background = backgroundInfoFor(node);
  if (background.uncertain) return null;
  const bg = background.color;
  const alpha = Math.max(0, Math.min(1, fg[3] ?? 1));
  const rendered = fg.slice(0, 3).map((value, i) => value * alpha + bg[i] * (1 - alpha));
  return { ratio: contrastRatio(rendered, bg), bg, large: isLargeText(css) };
}

  globalThis.MingxiContrast = Object.freeze({ parseRgb, luminance, contrastRatio, backgroundInfoFor, backgroundFor, isLargeText, textContrast });
})();
