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

const tabState = new Map();

function applyBadge(tabId, state) {
  if (state === 'stuck') {
    chrome.action.setBadgeText({ tabId, text: '!' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#f59e0b' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLASSIFY') {
    classifyJob(message.text, message.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'STATE' && sender.tab?.id) {
    tabState.set(sender.tab.id, message.state);
    applyBadge(sender.tab.id, message.state);
    return false;
  }

  if (message.type === 'GET_STATE') {
    const state = tabState.get(message.tabId) || 'idle';
    sendResponse({ state });
    return false;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
});

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/sites.js', 'content/extractor.js', 'content/content.js']
  });
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['styles/badge.css']
  });
}

const JOB_URL_RE = /^https:\/\/(www\.indeed\.com\/(viewjob|jobs)|weworkremotely\.com\/remote-jobs\/|remoteok\.com\/remote-jobs\/|[a-z0-9-]+\.greenhouse\.io\/|jobs\.lever\.co\/|jobs\.ashbyhq\.com\/)/;

async function isContentScriptAlive(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return response?.alive === true;
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId, url) {
  if (await isContentScriptAlive(tabId)) return;
  try {
    await injectContentScript(tabId);
    await chrome.tabs.sendMessage(tabId, { type: 'REFRESH' }).catch(() => {});
  } catch (e) {
    console.error('[RemoteProof] inject failed →', url, e.message);
  }
}

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    if (!JOB_URL_RE.test(details.url || '')) return;
    ensureContentScript(details.tabId, details.url);
  },
  {
    url: [
      { hostEquals: 'www.indeed.com', pathPrefix: '/viewjob' },
      { hostEquals: 'www.indeed.com', pathPrefix: '/jobs' },
      { hostEquals: 'weworkremotely.com', pathPrefix: '/remote-jobs/' },
      { hostEquals: 'remoteok.com', pathPrefix: '/remote-jobs/' },
      { hostSuffix: '.greenhouse.io' },
      { hostEquals: 'jobs.lever.co' },
      { hostEquals: 'jobs.ashbyhq.com' }
    ]
  }
);

async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({
    url: [
      'https://www.indeed.com/*',
      'https://weworkremotely.com/remote-jobs/*',
      'https://remoteok.com/remote-jobs/*',
      'https://*.greenhouse.io/*',
      'https://jobs.lever.co/*',
      'https://jobs.ashbyhq.com/*'
    ]
  });
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    injectContentScript(tab.id).catch(() => {});
  }
}

chrome.runtime.onInstalled.addListener(injectIntoOpenTabs);
chrome.runtime.onStartup.addListener(injectIntoOpenTabs);
