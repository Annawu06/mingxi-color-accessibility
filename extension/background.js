importScripts('core/settings.js');
function createContextMenus() { chrome.contextMenus.removeAll().then(() => chrome.contextMenus.create({ id:'mingxi-inspect', title:'明晰：检查当前元素对比度', contexts:['page','selection','image'] })).catch(() => {}); }
chrome.runtime.onInstalled.addListener(({ reason }) => {
  createContextMenus();
  if (reason === 'install') {
    chrome.storage.sync.get('global').then((saved) => {
      if (!saved.global) chrome.storage.sync.set({ global: MingxiSettings.defaults });
    });
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
  }
});
chrome.runtime.onStartup.addListener(createContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'mingxi-inspect' && tab?.id) chrome.tabs.sendMessage(tab.id, { type:'inspect-element', selectionText:info.selectionText || '', srcUrl:info.srcUrl || '' }).then((result) => {
    if (result) chrome.notifications?.create({ type:'basic', iconUrl:'icon128.png', title:'明晰对比度检查', message:`${result.element || '当前元素'}：对比度 ${result.contrast ?? '—'}，${result.friendly ? '基本友好' : '可能需要增强'}` });
  }).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { type: 'refresh-settings' }).catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));
chrome.tabs.onUpdated.addListener((tabId) => updateBadge(tabId));
chrome.storage.onChanged.addListener(async () => { const tabs = await chrome.tabs.query({}); tabs.forEach((tab) => { if (tab.id) updateBadge(tab.id); }); });
async function updateBadge(tabId) { try { const tab = await chrome.tabs.get(tabId); const host = new URL(tab.url).hostname; const key = `site:${host}`; const saved = await chrome.storage.sync.get({ global:{}, [key]:null }); const settings = MingxiSettings.effective(saved.global, saved[key]); chrome.action.setBadgeText({ tabId, text:settings.enabled && !settings.excluded ? '✓' : '' }); chrome.action.setBadgeBackgroundColor({ tabId, color:'#16704a' }); } catch (_) {} }

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-mingxi') sendToActiveTab({ type: 'toggle-settings' });
  if (command === 'open-mingxi-reader') sendToActiveTab({ type: 'toggle-reader' });
});
