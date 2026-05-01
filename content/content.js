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
  const hostname = window.location.hostname;
  let insertBefore;

  if (hostname.includes('linkedin')) {
    insertBefore = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container')
      || document.querySelector('.job-details-fit-level-card')?.closest('.artdeco-card')
      || document.querySelector('.jobs-description__content');
  } else if (hostname.includes('indeed')) {
    const titleContainer = document.querySelector('.jobsearch-JobInfoHeader-title-container');
    insertBefore = titleContainer?.nextElementSibling
      || document.querySelector('#jobDescriptionText');
  } else if (hostname.includes('weworkremotely')) {
    const titleEl = document.querySelector('.lis-container__header__hero__company-info__title');
    const hero = titleEl?.closest('[class*="lis-container__header"]');
    insertBefore = hero?.nextElementSibling
      || document.querySelector('.lis-container__job')
      || document.querySelector('.lis-container__job__content');
  }

  if (insertBefore && insertBefore.parentNode) {
    insertBefore.parentNode.insertBefore(badgeEl, insertBefore);
  }
}

let processedUrl = null;

async function run() {
  const text = extractJobDescription();
  if (!text || text.length < 100) return;

  if (processedUrl === window.location.href) return;
  processedUrl = window.location.href;

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
