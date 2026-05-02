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
  return true;
}

let processedUrl = null;

async function run() {
  const text = extractJobDescription();
  if (!text || text.length < 100) return;

  if (processedUrl === window.location.href) return;

  const MIN_LOADING_MS = 800;
  const loadStart = Date.now();
  injectBadge(createLoadingBadge());
  processedUrl = window.location.href;

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

let lastUrl = location.href;
let debounceTimer;

const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    processedUrl = null;
    document.getElementById(BADGE_ID)?.remove();
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 400);
});

observer.observe(document.body, { childList: true, subtree: true });

run();
[500, 1500, 3000, 5000].forEach(delay => setTimeout(run, delay));
