var LINKEDIN_DESC_SELECTORS = [
  '.jobs-description__content',
  '.jobs-description-content',
  '.jobs-box__html-content',
  '.jobs-description__container',
  '.jobs-search__job-details--container',
  '.jobs-details__main-content',
  '[class*="jobs-description"]',
  '[class*="job-details"]',
  '.job-view-layout',
  '[class*="description"]',
];

var SELECTORS = {
  'www.linkedin.com': {
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
  var visible = (el.innerText || '').trim();
  if (visible.length >= 100) return visible;
  return (el.textContent || '').trim();
}

var JOB_KEYWORDS = [
  'about the job', 'about this role', 'responsibilities', 'requirements',
  'qualifications', 'what you\'ll do', 'what you will do', 'who you are',
  'about us', 'about the company', 'we are looking for', 'we\'re looking for',
];

function scoreLinkedInCandidate(el) {
  var text = (el.innerText || '').trim();
  var len = text.length;
  if (len < 200 || len > 50000) return { text: null, score: 0 };
  var lower = text.toLowerCase();
  var keywordHits = JOB_KEYWORDS.reduce(function (n, kw) { return n + (lower.includes(kw) ? 1 : 0); }, 0);
  if (keywordHits < 2) return { text: null, score: 0 };
  return { text: text, score: keywordHits * 100000 - len };
}

function extractLinkedInFallback() {
  var main = document.querySelector('main') || document.body;
  var best = null;
  var bestScore = 0;
  var nodes = main.querySelectorAll('article, section, div');
  for (var i = 0; i < nodes.length; i++) {
    var result = scoreLinkedInCandidate(nodes[i]);
    if (result.score > bestScore) {
      best = result.text;
      bestScore = result.score;
    }
  }
  return best;
}

function extractJobDescription() {
  var hostname = window.location.hostname;

  if (hostname === 'www.linkedin.com') {
    for (var i = 0; i < LINKEDIN_DESC_SELECTORS.length; i++) {
      var text = getText(document.querySelector(LINKEDIN_DESC_SELECTORS[i]));
      if (text && text.length >= 100) return text;
    }
    return extractLinkedInFallback();
  }

  if (hostname === 'weworkremotely.com') {
    var desc = getText(document.querySelector('.lis-container__job__content'));
    var about = getText(document.querySelector('.lis-container__job__sidebar__job-about'));
    var combined = [desc, about].filter(Boolean).join('\n\n').trim();
    return combined || null;
  }

  var selectors = SELECTORS[hostname];
  if (!selectors) return null;
  var t = getText(document.querySelector(selectors.description));
  return t || null;
}

function extractJobTitle() {
  var hostname = window.location.hostname;
  var selectors = SELECTORS[hostname];
  if (!selectors) return null;
  var titleEl = document.querySelector(selectors.title);
  return titleEl ? titleEl.innerText.trim() : null;
}