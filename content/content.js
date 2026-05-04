if (window.__remoteproofLoaded) {
  // already initialized in this tab
} else {
  window.__remoteproofLoaded = true;
  document.documentElement.setAttribute('data-remoteproof', 'loaded');

const BADGE_ID = 'remoteproof-badge';

const VERDICT_CONFIG = {
  WORLDWIDE:  { label: 'Worldwide Remote',  cssClass: 'worldwide' },
  RESTRICTED: { label: 'Restricted Remote', cssClass: 'restricted' },
  UNCLEAR:    { label: 'Unclear',           cssClass: 'unclear' },
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function createBadge(verdict, reason) {
  const existing = document.getElementById(BADGE_ID);
  if (existing) existing.remove();

  const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG['UNCLEAR'];
  const safeReason = escapeHtml(reason || '');

  const badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.className = config.cssClass;
  badge.innerHTML = `
    <span class="rp-dot"></span>
    <span class="rp-label">${config.label}</span>
    <button class="rp-dismiss" title="Dismiss">×</button>
    ${safeReason ? `<span class="rp-reason">${safeReason}</span>` : ''}
  `;

  badge.querySelector('.rp-dismiss').addEventListener('click', () => badge.remove());
  return badge;
}

function createLoadingBadge() {
  const existing = document.getElementById(BADGE_ID);
  if (existing) existing.remove();

  const badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.className = 'loading';
  badge.innerHTML = `<span class="rp-dot"></span><span class="rp-label">Checking…</span>`;
  return badge;
}

function injectBadge(badgeEl) {
  document.body.appendChild(badgeEl);
}

let processedUrl = null;
let currentState = 'idle';

function setState(next) {
  if (currentState === next) return;
  currentState = next;
  try {
    chrome.runtime.sendMessage({ type: 'STATE', state: next }).catch(() => {});
  } catch {}
}

function classifyAndRender(text) {
  const MIN_LOADING_MS = 800;
  const loadStart = Date.now();
  injectBadge(createLoadingBadge());

  chrome.runtime.sendMessage(
    { type: 'CLASSIFY', text, url: window.location.href },
    (response) => {
      const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - loadStart));
      setTimeout(() => {
        if (response && response.success) {
          const { verdict, reason } = response.data;
          injectBadge(createBadge(verdict, reason));
        } else {
          injectBadge(createBadge('UNCLEAR', 'Could not classify this listing.'));
        }
      }, wait);
    }
  );
}

function isJobUrl() {
  return isJobUrlForSite();
}

function run() {
  if (!isJobUrl()) {
    setState('idle');
    return;
  }
  if (processedUrl === window.location.href) return;

  const text = extractJobDescription();
  if (text && text.length >= 100) {
    processedUrl = window.location.href;
    setState('working');
    classifyAndRender(text);
  }
}

function getNavKey() {
  const url = new URL(window.location.href);
  const jobId = url.searchParams.get('currentJobId');
  return url.origin + url.pathname + (jobId ? '#' + jobId : '');
}

let lastUrl = getNavKey();
let debounceTimer = null;
let pollHandle = null;

const STUCK_AFTER_POLLS = 6;

function startPolling() {
  if (pollHandle) clearInterval(pollHandle);
  if (!isJobUrl()) return;
  if (processedUrl === null) setState('pending');
  let attempts = 0;
  let markedStuck = false;
  pollHandle = setInterval(() => {
    if (!isJobUrl() || processedUrl === window.location.href) {
      clearInterval(pollHandle);
      pollHandle = null;
      return;
    }
    run();
    attempts++;
    if (attempts >= STUCK_AFTER_POLLS && !markedStuck && processedUrl === null) {
      markedStuck = true;
      setState('stuck');
    }
  }, 1000);
}

function onUrlChanged() {
  lastUrl = getNavKey();
  processedUrl = null;
  document.getElementById(BADGE_ID)?.remove();
  setState(isJobUrl() ? 'pending' : 'idle');
  run();
  startPolling();
}

const observer = new MutationObserver(() => {
  if (getNavKey() !== lastUrl) {
    onUrlChanged();
    return;
  }
  if (processedUrl === window.location.href) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 300);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

window.addEventListener('popstate', () => {
  if (getNavKey() !== lastUrl) onUrlChanged();
});

setInterval(() => {
  if (getNavKey() !== lastUrl) onUrlChanged();
}, 1000);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ alive: true });
    return;
  }
  if (message?.type === 'REFRESH') {
    processedUrl = null;
    document.getElementById(BADGE_ID)?.remove();
    run();
    startPolling();
  }
});

document.addEventListener('remoteproof:debug', () => {
  const text = extractJobDescription();
  const el = document.documentElement;
  el.setAttribute('data-rp-extracted-len', text ? String(text.length) : 'null');
  el.setAttribute('data-rp-processed', processedUrl || 'null');
  el.setAttribute('data-rp-isjob', String(isJobUrl()));
  el.setAttribute('data-rp-lasturl', lastUrl);
  el.setAttribute('data-rp-navkey', getNavKey());
});

run();
startPolling();

}
