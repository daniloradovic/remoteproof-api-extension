// Site adapter registry. Each entry describes one supported job portal.
//
// To add a new site:
//   1. Append an entry to SITES below.
//   2. Add the URL match pattern to manifest.json (`content_scripts[0].matches`
//      and `host_permissions`).
//   3. Update JOB_URL_RE and the webNavigation filter in background.js so SPA
//      injection works on the new site.
//
// Adapter shape:
//   {
//     id:             'unique-id',
//     host:           'www.example.com',          // OR
//     hostMatch:      function (host) { ... },    // dynamic match (subdomains, etc.)
//     isJobUrl:       function (location) { ... }, // optional; defaults to true
//     descSelectors:  ['.css selector', ...],     // tried in order
//     titleSelector:  '.css selector',            // optional
//     extract:        function () { ... },        // optional override; bypasses descSelectors
//     fallback:       function () { ... },        // optional; runs if descSelectors all miss
//   }

var SITES = [
  {
    id: 'indeed',
    host: 'www.indeed.com',
    isJobUrl: function (loc) {
      return loc.pathname.startsWith('/viewjob') || loc.pathname.startsWith('/jobs');
    },
    descSelectors: ['#jobDescriptionText'],
    titleSelector: '[data-testid="jobsearch-JobInfoHeader-title"]',
  },
  {
    id: 'wwr',
    host: 'weworkremotely.com',
    isJobUrl: function (loc) { return loc.pathname.startsWith('/remote-jobs/'); },
    extract: function () {
      var desc = getText(document.querySelector('.lis-container__job__content'));
      var about = getText(document.querySelector('.lis-container__job__sidebar__job-about'));
      var combined = [desc, about].filter(Boolean).join('\n\n').trim();
      return combined || null;
    },
    titleSelector: '.lis-container__header__hero__company-info__title',
  },
  {
    id: 'remoteok',
    host: 'remoteok.com',
    isJobUrl: function (loc) { return loc.pathname.startsWith('/remote-jobs/'); },
    descSelectors: [
      '.description.markdown',
      'td.description .markdown',
      '.description',
      '[itemprop="description"]',
    ],
    titleSelector: '[itemprop="title"], h2[itemprop="title"]',
  },
  {
    id: 'greenhouse',
    hostMatch: function (h) {
      return h === 'boards.greenhouse.io' || h.endsWith('.greenhouse.io') || h === 'job-boards.greenhouse.io';
    },
    isJobUrl: function (loc) { return loc.pathname.includes('/jobs/'); },
    descSelectors: [
      '#content',
      '.app-body',
      '.body--medium',
      '.body',
      '[class*="job__description"]',
    ],
    titleSelector: '.app-title, h1.section-header__title, h1',
  },
  {
    id: 'lever',
    host: 'jobs.lever.co',
    isJobUrl: function (loc) { return loc.pathname.split('/').filter(Boolean).length >= 2; },
    descSelectors: [
      '[data-qa="job-description"]',
      '.posting-page .section-wrapper',
      '.posting-page',
      '.section.page-centered',
    ],
    titleSelector: '[data-qa="posting-name"], .posting-headline h2',
  },
  {
    id: 'ashby',
    host: 'jobs.ashbyhq.com',
    isJobUrl: function (loc) { return loc.pathname.split('/').filter(Boolean).length >= 2; },
    descSelectors: [
      '[class*="_descriptionText_"]',
      '[class*="JobDescription"]',
      '[class*="description"]',
      'main',
    ],
    titleSelector: 'h1, [class*="title"]',
  },
];

function findSite(loc) {
  for (var i = 0; i < SITES.length; i++) {
    var s = SITES[i];
    var hostMatches = s.host
      ? loc.hostname === s.host
      : (typeof s.hostMatch === 'function' ? s.hostMatch(loc.hostname) : false);
    if (hostMatches) return s;
  }
  return null;
}
