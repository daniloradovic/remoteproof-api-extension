const API_URL = 'http://remoteproof-api.test/api/classify';
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function classifyJob(text, url) {
  const cacheKey = `classification_${url}`;

  if (url) {
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) {
      const entry = cached[cacheKey];
      const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
      if (!isExpired) {
        return { ...entry.data, cached: true };
      }
    }
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ text, url })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const result = await response.json();

  if (url) {
    await chrome.storage.local.set({
      [cacheKey]: { data: result, timestamp: Date.now() }
    });
  }

  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLASSIFY') {
    classifyJob(message.text, message.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'REFRESH' }).catch(() => {});
});
