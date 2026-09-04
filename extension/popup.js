const enabledButton = document.querySelector('#enabled');
const status = document.querySelector('#status');
const siteName = document.querySelector('#siteName');
const modeButtons = document.querySelectorAll('[data-mode]');
const intensity = document.querySelector('#intensity');
const intensityValue = document.querySelector('#intensityValue');
const semanticHints = document.querySelector('#semanticHints');
const enhanceImages = document.querySelector('#enhanceImages');
const autoContrast = document.querySelector('#autoContrast');
const linkHints = document.querySelector('#linkHints');
const colorRemap = document.querySelector('#colorRemap');
const requiredHints = document.querySelector('#requiredHints');
let settings = { enabled: false, mode: 'deuteranopia', intensity: 65, semanticHints: true, enhanceImages: true, autoContrast: true, chartHints: true, linkHints: true, requiredHints: true, colorRemap: true, excluded: false };
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
  semanticHints.checked = settings.semanticHints; enhanceImages.checked = settings.enhanceImages;
  autoContrast.checked = settings.autoContrast; linkHints.checked = settings.linkHints; colorRemap.checked = settings.colorRemap !== false; requiredHints.checked = settings.requiredHints !== false;
}

async function apply() {
  await chrome.storage.sync.set({ [siteKey]: settings, global: settings });
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
semanticHints.addEventListener('change', () => { settings.semanticHints = semanticHints.checked; apply(); });
enhanceImages.addEventListener('change', () => { settings.enhanceImages = enhanceImages.checked; apply(); });
autoContrast.addEventListener('change', () => { settings.autoContrast = autoContrast.checked; apply(); });
linkHints.addEventListener('change', () => { settings.linkHints = linkHints.checked; apply(); });
colorRemap.addEventListener('change', () => { settings.colorRemap = colorRemap.checked; apply(); });
requiredHints.addEventListener('change', () => { settings.requiredHints = requiredHints.checked; apply(); });

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
  settings = { enabled:false, mode:'deuteranopia', intensity:65, semanticHints:true, enhanceImages:true, autoContrast:true, chartHints:true, linkHints:true, requiredHints:true, colorRemap:true, excluded:false };
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
