chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ enabled: false, mode: 'deuteranopia' });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { type: 'refresh-settings' }).catch(() => {});
  }
});
