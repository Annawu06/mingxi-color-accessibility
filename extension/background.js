chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ global: { enabled: false, mode: 'deuteranopia', intensity: 65, semanticHints: true, enhanceImages: true, autoContrast: true, chartHints: true, linkHints: true, colorRemap: true, readerMode: false } });
  chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { type: 'refresh-settings' }).catch(() => {});
  }
});

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, message).catch(() => {});
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-mingxi') sendToActiveTab({ type: 'toggle-settings' });
  if (command === 'open-mingxi-reader') sendToActiveTab({ type: 'toggle-reader' });
});
