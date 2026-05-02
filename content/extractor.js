const SELECTORS = {
  'www.linkedin.com': {
    description: '.jobs-description__content',
    title: '.job-details-jobs-unified-top-card__job-title',
  },
  'www.indeed.com': {
    description: '#jobDescriptionText',
    title: '[data-testid="jobsearch-JobInfoHeader-title"]',
  },
  'weworkremotely.com': {
    description: '.lis-container__job__content',
    title: '.lis-container__header__hero__company-info__title',
  }
};

function getText(el) {
  if (!el) return '';
  const visible = (el.innerText || '').trim();
  if (visible.length >= 100) return visible;
  return (el.textContent || '').trim();
}

function extractJobDescription() {
  const hostname = window.location.hostname;

  if (hostname === 'weworkremotely.com') {
    const desc = getText(document.querySelector('.lis-container__job__content'));
    const about = getText(document.querySelector('.lis-container__job__sidebar__job-about'));
    const combined = [desc, about].filter(Boolean).join('\n\n').trim();
    return combined || null;
  }

  const selectors = SELECTORS[hostname];
  if (!selectors) return null;

  const text = getText(document.querySelector(selectors.description));
  return text || null;
}

function extractJobTitle() {
  const hostname = window.location.hostname;
  const selectors = SELECTORS[hostname];
  if (!selectors) return null;

  const titleEl = document.querySelector(selectors.title);
  return titleEl ? titleEl.innerText.trim() : null;
}
