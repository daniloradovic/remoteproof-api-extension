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

function extractJobDescription() {
  const hostname = window.location.hostname;

  if (hostname === 'weworkremotely.com') {
    const desc = document.querySelector('.lis-container__job__content')?.innerText.trim() || '';
    const about = document.querySelector('.lis-container__job__sidebar__job-about')?.innerText.trim() || '';
    const combined = [desc, about].filter(Boolean).join('\n\n').trim();
    return combined || null;
  }

  const selectors = SELECTORS[hostname];
  if (!selectors) return null;

  const descriptionEl = document.querySelector(selectors.description);
  if (!descriptionEl) return null;

  return descriptionEl.innerText.trim();
}

function extractJobTitle() {
  const hostname = window.location.hostname;
  const selectors = SELECTORS[hostname];
  if (!selectors) return null;

  const titleEl = document.querySelector(selectors.title);
  return titleEl ? titleEl.innerText.trim() : null;
}
