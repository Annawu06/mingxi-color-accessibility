document.querySelector('#start').addEventListener('click', () => { chrome.tabs.create({ url: `${chrome.runtime.getURL('popup.html')}?onboarding=1` }); window.close(); });
