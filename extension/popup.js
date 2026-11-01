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
let settings = MingxiSettings.effective();
let siteKey = 'global';

async function getSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { const url = new URL(tab.url); siteKey = `site:${url.hostname}`; siteName.textContent = url.hostname || '当前网站'; }
  catch { siteName.textContent = '当前页面（浏览器内置页不可修改）'; }
  const saved = await chrome.storage.sync.get({ global: {}, [siteKey]: null });
  settings = MingxiSettings.effective(saved.global, siteKey === 'global' ? null : saved[siteKey]);
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
  const valid = MingxiSettings.validate(settings);
  if (siteKey === 'global') await chrome.storage.sync.set({ global: valid });
  else {
    const saved = await chrome.storage.sync.get({ global: {} });
    const baseline = MingxiSettings.effective(saved.global);
    const override = Object.fromEntries(Object.entries(valid).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(baseline[key])));
    if (Object.keys(override).length) await chrome.storage.sync.set({ [siteKey]: override });
    else await chrome.storage.sync.remove(siteKey);
  }
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
intensity.addEventListener('input', () => { intensityValue.textContent = `${intensity.value}%`; });
intensity.addEventListener('change', () => { settings.intensity = Number(intensity.value); apply(); });
fontScale.addEventListener('input', () => { fontScaleValue.textContent = `${fontScale.value}%`; });
fontScale.addEventListener('change', () => { settings.fontScale = Number(fontScale.value); apply(); });
semanticHints.addEventListener('change', () => { settings.semanticHints = semanticHints.checked; apply(); });
enhanceImages.addEventListener('change', () => { settings.enhanceImages = enhanceImages.checked; apply(); });
autoContrast.addEventListener('change', () => { settings.autoContrast = autoContrast.checked; apply(); });
linkHints.addEventListener('change', () => { settings.linkHints = linkHints.checked; apply(); });
colorRemap.addEventListener('change', () => { settings.colorRemap = colorRemap.checked; apply(); });
requiredHints.addEventListener('change', () => { settings.requiredHints = requiredHints.checked; apply(); });
focusHints.addEventListener('change', () => { settings.focusHints = focusHints.checked; apply(); });

let latestAudit = null;
document.querySelector('#audit').addEventListener('click', async () => {
  const panel = document.querySelector('#auditResults');
  const summary = document.querySelector('#auditSummary');
  const examples = document.querySelector('#auditExamples');
  panel.hidden = false;
  latestAudit = null;
  summary.textContent = '正在检查…';
  examples.replaceChildren();
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  try {
    const report = await chrome.tabs.sendMessage(tab.id, { type:'run-audit' });
    if (report.error) throw new Error(report.error);
    latestAudit = report;
    summary.textContent = `扫描元素 ${report.scanned} 个；检查文字 ${report.checked} 处；无法可靠判断 ${report.skipped} 处；未达 WCAG AA：${report.aa} 处；未达 AAA：${report.aaa} 处；可能仅靠颜色区分：${report.colorOnly} 处。${report.issuesOmitted ? `报告省略 ${report.issuesOmitted} 项。` : ''}`;
    for (const item of report.examples) {
      const li = document.createElement('li');
      li.textContent = `“${item.text}” ${item.ratio}:1`;
      examples.appendChild(li);
    }
    document.querySelector('#fixContrast').hidden = report.aa === 0;
  } catch (_) { summary.textContent = '当前页面不支持诊断，请刷新页面后重试。'; document.querySelector('#fixContrast').hidden = true; }
});
document.querySelector('#auditExport').addEventListener('click', () => { if (latestAudit) downloadJson('mingxi-audit.json', latestAudit); });
document.querySelector('#fixContrast').addEventListener('click', async () => {
  settings.enabled = true;
  settings.autoContrast = true;
  await apply();
  document.querySelector('#fixContrast').textContent = '已启用自动增强';
});
document.querySelector('#stats').addEventListener('click', async () => { const all = await chrome.storage.local.get(null); const records = Object.entries(all).filter(([key]) => key.startsWith('usage:site:')).map(([key, value]) => ({ host:key.slice(11), ...value })).sort((a,b) => b.lastUsed - a.lastUsed).slice(0,5); const modes = {}; records.forEach((record) => Object.entries(record.modes || {}).forEach(([mode,count]) => { modes[mode] = (modes[mode] || 0) + count; })); const top = Object.entries(modes).sort((a,b) => b[1]-a[1])[0]; alert(`使用统计\n\n最近使用的网站：\n${records.length ? records.map((r,i) => `${i+1}. ${r.host}`).join('\n') : '暂无记录'}\n\n最常用模式：${top ? `${top[0]}（${top[1]} 次）` : '暂无记录'}`); });

function downloadJson(filename, value) { const blob = new Blob([JSON.stringify(value, null, 2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 500); }
document.querySelector('#settingsExport').addEventListener('click', async () => { const all = await chrome.storage.sync.get(null); const clean = Object.fromEntries(Object.entries(all).filter(([key]) => key === 'global' || key.startsWith('site:')).map(([key, value]) => [key, MingxiSettings.stored(value)])); downloadJson('mingxi-settings.json', clean); });
document.querySelector('#settingsImport').addEventListener('click', () => document.querySelector('#settingsFile').click());
document.querySelector('#settingsFile').addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; try { if (file.size > 1000000) throw new Error('File too large'); const imported = MingxiSettings.validateImport(JSON.parse(await file.text())); await chrome.storage.sync.set(imported); await getSite(); alert('设置已导入。'); } catch (_) { alert('导入失败：设置文件包含无效字段或颜色规则。'); } event.target.value = ''; });

function renderMappings() {
  const list = document.querySelector('#mappingList');
  list.replaceChildren();
  if (!settings.customMappings.length) { list.textContent = '暂未添加规则'; return; }
  settings.customMappings.forEach((rule, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.title = '删除规则';
    const from = document.createElement('i'); from.style.backgroundColor = rule.from;
    const to = document.createElement('i'); to.style.backgroundColor = rule.to;
    button.append(from, document.createTextNode(`${rule.from} → `), to, document.createTextNode(`${rule.to} ×`));
    button.addEventListener('click', () => { settings.customMappings.splice(index, 1); apply(); });
    list.appendChild(button);
  });
}
document.querySelector('#addMapping').addEventListener('click', () => { const rule = { from:document.querySelector('#mapFrom').value.toUpperCase(), to:document.querySelector('#mapTo').value.toUpperCase() }; const next = [...settings.customMappings.filter((item) => item.from !== rule.from), rule]; if (next.length > 20) { alert('最多添加 20 条颜色映射。'); return; } settings.customMappings = next; apply(); });

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
  await chrome.storage.sync.remove(siteKey);
  const feedbackKeys = ['success', 'chart', 'link'].map((kind) => `feedback:${siteKey}:${settings.mode}:${kind}`);
  await chrome.storage.local.remove(feedbackKeys);
  await getSite();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'refresh-settings' }).catch(() => {});
});
document.querySelector('#dataTools').addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null); const feedback = Object.fromEntries(Object.entries(all).filter(([key]) => key.startsWith('feedback:')));
  const blob = new Blob([JSON.stringify(feedback, null, 2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'mingxi-feedback.json'; link.click(); URL.revokeObjectURL(url);
  if (confirm('反馈数据已导出。是否同时清除本机反馈记录？')) await chrome.storage.local.remove(Object.keys(feedback));
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
  if (testIndex >= testValues.length) { document.querySelector('#questionNo').textContent = '完成'; document.querySelector('#ishihara').textContent = '✓'; document.querySelector('.test-actions').hidden = true; document.querySelector('#testResult').textContent = misses ? '这组演示图有难以辨认之处。请逐一比较各模式，按实际舒适度选择。' : '这组演示图已完成。请按实际舒适度选择模式。'; return; }
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
