const enabledButton = document.querySelector('#enabled');
const status = document.querySelector('#status');
const siteName = document.querySelector('#siteName');
const modeButtons = document.querySelectorAll('[data-mode]');
const intensity = document.querySelector('#intensity');
const intensityValue = document.querySelector('#intensityValue');
const fontScale = document.querySelector('#fontScale');
const fontScaleValue = document.querySelector('#fontScaleValue');
const semanticHints = document.querySelector('#semanticHints');
const enhanceImages = document.querySelector('#enhanceImages');
const autoContrast = document.querySelector('#autoContrast');
const linkHints = document.querySelector('#linkHints');
const colorRemap = document.querySelector('#colorRemap');
const requiredHints = document.querySelector('#requiredHints');
const focusHints = document.querySelector('#focusHints');
let settings = { enabled: false, mode: 'deuteranopia', intensity: 65, fontScale: 100, focusHints: true, semanticHints: true, enhanceImages: true, autoContrast: true, chartHints: true, linkHints: true, requiredHints: true, colorRemap: true, excluded: false, customMappings: [] };
let siteKey = 'global';

async function getSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { const url = new URL(tab.url); siteKey = `site:${url.hostname}`; siteName.textContent = url.hostname || '当前网站'; }
  catch { siteName.textContent = '当前页面（浏览器内置页不可修改）'; }
  const saved = await chrome.storage.sync.get({ global: settings, [siteKey]: null });
  settings = { ...settings, ...(saved[siteKey] || saved.global || {}) };
  render();
  renderFeedback();
}

function render() {
  enabledButton.classList.toggle('on', settings.enabled); enabledButton.setAttribute('aria-checked', settings.enabled);
  status.textContent = settings.enabled ? '当前网站已启用' : '当前网站未启用';
  modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mode === settings.mode));
  intensity.value = settings.intensity; intensityValue.textContent = `${settings.intensity}%`;
  fontScale.value = settings.fontScale ?? 100; fontScaleValue.textContent = `${settings.fontScale ?? 100}%`;
  semanticHints.checked = settings.semanticHints; enhanceImages.checked = settings.enhanceImages;
  autoContrast.checked = settings.autoContrast; linkHints.checked = settings.linkHints; colorRemap.checked = settings.colorRemap !== false; requiredHints.checked = settings.requiredHints !== false;
  focusHints.checked = settings.focusHints !== false;
  renderMappings();
}

async function apply() {
  await chrome.storage.sync.set({ [siteKey]: settings, global: settings });
  const usageKey = `usage:${siteKey}`; const usage = await chrome.storage.local.get({ [usageKey]: { lastUsed: 0, modes: {} } }); const record = usage[usageKey]; record.lastUsed = Date.now(); record.modes[settings.mode] = (record.modes[settings.mode] || 0) + 1; await chrome.storage.local.set({ [usageKey]: record });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'apply-settings', settings }).catch(() => {});
  render();
}

async function renderFeedback() {
  const keys = ['success', 'chart', 'link'].map((kind) => `feedback:${siteKey}:${settings.mode}:${kind}`);
  const saved = await chrome.storage.local.get(keys);
  const total = keys.reduce((sum, key) => sum + Number(saved[key] || 0), 0);
  document.querySelector('#feedbackSummary').textContent = total ? `本网站此模式已记录 ${total} 次完成反馈` : '还没有记录';
}

enabledButton.addEventListener('click', () => { settings.enabled = !settings.enabled; apply(); });
modeButtons.forEach((button) => button.addEventListener('click', () => { settings.mode = button.dataset.mode; settings.enabled = true; apply(); }));
intensity.addEventListener('input', () => { settings.intensity = Number(intensity.value); intensityValue.textContent = `${settings.intensity}%`; apply(); });
fontScale.addEventListener('input', () => { settings.fontScale = Number(fontScale.value); fontScaleValue.textContent = `${settings.fontScale}%`; apply(); });
semanticHints.addEventListener('change', () => { settings.semanticHints = semanticHints.checked; apply(); });
enhanceImages.addEventListener('change', () => { settings.enhanceImages = enhanceImages.checked; apply(); });
autoContrast.addEventListener('change', () => { settings.autoContrast = autoContrast.checked; apply(); });
linkHints.addEventListener('change', () => { settings.linkHints = linkHints.checked; apply(); });
colorRemap.addEventListener('change', () => { settings.colorRemap = colorRemap.checked; apply(); });
requiredHints.addEventListener('change', () => { settings.requiredHints = requiredHints.checked; apply(); });
focusHints.addEventListener('change', () => { settings.focusHints = focusHints.checked; apply(); });

document.querySelector('#audit').addEventListener('click', async () => { const [tab] = await chrome.tabs.query({ active:true, currentWindow:true }); try { const report = await chrome.tabs.sendMessage(tab.id, { type:'run-audit' }); alert(`页面无障碍诊断\n\n扫描元素：${report.scanned}\n对比度不足：${report.contrast}\n可能仅靠颜色区分：${report.colorOnly}\n链接：${report.links}\n表单控件：${report.forms}\n\n这是启发式检查，不等同于 Lighthouse 或医学评估。`); } catch (_) { alert('当前页面不支持诊断，请刷新页面后重试。'); } });
document.querySelector('#stats').addEventListener('click', async () => { const all = await chrome.storage.local.get(null); const records = Object.entries(all).filter(([key]) => key.startsWith('usage:site:')).map(([key, value]) => ({ host:key.slice(11), ...value })).sort((a,b) => b.lastUsed - a.lastUsed).slice(0,5); const modes = {}; records.forEach((record) => Object.entries(record.modes || {}).forEach(([mode,count]) => { modes[mode] = (modes[mode] || 0) + count; })); const top = Object.entries(modes).sort((a,b) => b[1]-a[1])[0]; alert(`使用统计\n\n最近使用的网站：\n${records.length ? records.map((r,i) => `${i+1}. ${r.host}`).join('\n') : '暂无记录'}\n\n最常用模式：${top ? `${top[0]}（${top[1]} 次）` : '暂无记录'}`); });

function downloadJson(filename, value) { const blob = new Blob([JSON.stringify(value, null, 2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
document.querySelector('#settingsExport').addEventListener('click', async () => downloadJson('mingxi-settings.json', await chrome.storage.sync.get(null)));
document.querySelector('#settingsImport').addEventListener('click', () => document.querySelector('#settingsFile').click());
document.querySelector('#settingsFile').addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const imported = JSON.parse(await file.text()); if (!imported || typeof imported !== 'object' || (!imported.global && !Object.keys(imported).some((key) => key.startsWith('site:')))) throw new Error('invalid'); await chrome.storage.sync.set(imported); await getSite(); alert('设置已导入。'); } catch (_) { alert('导入失败：请选择明晰导出的 JSON 设置文件。'); } event.target.value = ''; });

function renderMappings() { const list = document.querySelector('#mappingList'); list.innerHTML = settings.customMappings?.length ? settings.customMappings.map((rule, index) => `<button data-remove-mapping="${index}" title="删除规则"><i style="background:${rule.from}"></i>${rule.from} → <i style="background:${rule.to}"></i>${rule.to} ×</button>`).join('') : '暂未添加规则'; list.querySelectorAll('[data-remove-mapping]').forEach((button) => button.addEventListener('click', () => { settings.customMappings.splice(Number(button.dataset.removeMapping), 1); apply(); })); }
document.querySelector('#addMapping').addEventListener('click', () => { const rule = { from:document.querySelector('#mapFrom').value.toUpperCase(), to:document.querySelector('#mapTo').value.toUpperCase() }; settings.customMappings = [...(settings.customMappings || []).filter((item) => item.from !== rule.from), rule]; apply(); });

document.querySelector('#probe').addEventListener('click', () => sendToolMessage('toggle-probe'));
document.querySelector('#reader').addEventListener('click', () => sendToolMessage('toggle-reader'));
document.querySelector('#exclude').addEventListener('click', async () => { settings.excluded = !settings.excluded; settings.enabled = !settings.excluded; await apply(); document.querySelector('#exclude').textContent = settings.excluded ? '已排除本站' : '排除本站'; });
async function sendToolMessage(type) { const [tab] = await chrome.tabs.query({ active:true, currentWindow:true }); if (tab?.id) chrome.tabs.sendMessage(tab.id, { type }).catch(() => {}); }
document.querySelector('#shortcuts').addEventListener('click', () => chrome.tabs.create({ url:'chrome://extensions/shortcuts' }));

document.querySelectorAll('[data-feedback]').forEach((button) => button.addEventListener('click', async () => {
  const key = `feedback:${siteKey}:${settings.mode}:${button.dataset.feedback}`;
  const saved = await chrome.storage.local.get({ [key]: 0 });
  await chrome.storage.local.set({ [key]: saved[key] + 1 });
  button.textContent = '已记录 ✓'; button.disabled = true;
  renderFeedback();
}));
document.querySelector('#resetSite').addEventListener('click', async () => {
  if (siteKey !== 'global') await chrome.storage.sync.remove(siteKey);
  const feedbackKeys = ['success', 'chart', 'link'].map((kind) => `feedback:${siteKey}:${settings.mode}:${kind}`);
  await chrome.storage.local.remove(feedbackKeys);
  settings = { enabled:false, mode:'deuteranopia', intensity:65, fontScale:100, focusHints:true, semanticHints:true, enhanceImages:true, autoContrast:true, chartHints:true, linkHints:true, requiredHints:true, colorRemap:true, excluded:false, customMappings:[] };
  await apply();
});
document.querySelector('#dataTools').addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null); const feedback = Object.fromEntries(Object.entries(all).filter(([key]) => key.startsWith('feedback:')));
  const blob = new Blob([JSON.stringify(feedback, null, 2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'mingxi-feedback.json'; link.click(); URL.revokeObjectURL(url);
  if (confirm('反馈数据已导出。是否同时清除本机反馈记录？')) await chrome.storage.local.clear();
});

const testPanel = document.querySelector('#testPanel');
const testValues = [
  { number: '12', axis: 'rg', question: '你能看见圆点中的数字吗？' },
  { number: '8', axis: 'rg', question: '换一种色彩组合后，你还能看见数字吗？' },
  { number: '6', axis: 'by', question: '最后一张图中的数字清楚吗？' }
]; let testIndex = 0; let misses = 0;
function drawPlate(test) {
  const canvas = document.querySelector('#ishihara'); const ctx = canvas.getContext('2d'); const size = canvas.width; const center = size / 2;
  const palette = test.axis === 'by' ? { bg: [44, 98, 145], fg: [222, 191, 58] } : (test.number === '12' ? { bg: [112, 145, 82], fg: [201, 92, 61] } : { bg: [190, 120, 79], fg: [87, 71, 145] });
  ctx.clearRect(0, 0, size, size); ctx.fillStyle = '#f7f8f4'; ctx.fillRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(center, center, 136, 0, Math.PI * 2); ctx.clip();
  ctx.font = '900 104px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const mask = document.createElement('canvas'); mask.width = size; mask.height = size; const mctx = mask.getContext('2d'); mctx.font = ctx.font; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillText(test.number, center, center + 3);
  const pixels = mctx.getImageData(0, 0, size, size).data; const vary = (base) => Math.max(0, Math.min(255, base + Math.round((Math.random() - .5) * 42)));
  for (let y = 10; y < size - 10; y += 9) for (let x = 10; x < size - 10; x += 9) { const i = (y * size + x) * 4; const p = pixels[i + 3] > 0 ? palette.fg : palette.bg; ctx.fillStyle = `rgb(${vary(p[0])},${vary(p[1])},${vary(p[2])})`; ctx.beginPath(); ctx.arc(x + Math.random() * 6, y + Math.random() * 6, 2 + Math.random() * 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function nextTest(saw) {
  if (!saw) misses += 1; testIndex += 1;
  if (testIndex >= testValues.length) { document.querySelector('#questionNo').textContent = '完成'; document.querySelector('#ishihara').textContent = '✓'; document.querySelector('.test-actions').hidden = true; document.querySelector('#testResult').textContent = misses ? '建议先尝试绿色辨识优化，也可以逐一体验其他模式。' : '结果没有显示出明显的辨识困难，仍可按舒适度选择模式。'; return; }
  const test = testValues[testIndex];
  document.querySelector('#questionNo').textContent = `${testIndex + 1} / 3`;
  document.querySelector('#testQuestion').textContent = test.question;
  drawPlate(test);
}
document.querySelector('#openTest').addEventListener('click', () => { testIndex = 0; misses = 0; document.querySelector('.test-actions').hidden = false; document.querySelector('#testResult').textContent = ''; testPanel.hidden = false; drawPlate(testValues[0]); });
document.querySelector('#closeTest').addEventListener('click', () => { testPanel.hidden = true; });
document.querySelector('#canSee').addEventListener('click', () => nextTest(true));
document.querySelector('#cannotSee').addEventListener('click', () => nextTest(false));
getSite();
