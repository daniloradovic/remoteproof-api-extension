// Generic helpers + dispatch. Site-specific knowledge lives in sites.js.

function getText(el) {
  if (!el) return '';
  var visible = (el.innerText || '').trim();
  if (visible.length >= 100) return visible;
  return (el.textContent || '').trim();
}

function extractJobDescription() {
  var site = findSite(window.location);
  if (!site) return null;

  if (site.extract) return site.extract();

  if (site.descSelectors) {
    for (var i = 0; i < site.descSelectors.length; i++) {
      var text = getText(document.querySelector(site.descSelectors[i]));
      if (text && text.length >= 100) return text;
    }
  }

  if (site.fallback) return site.fallback();
  return null;
}

function extractJobTitle() {
  var site = findSite(window.location);
  if (!site || !site.titleSelector) return null;
  var el = document.querySelector(site.titleSelector);
  return el ? el.innerText.trim() : null;
}

function isJobUrlForSite() {
  var site = findSite(window.location);
  if (!site) return false;
  return site.isJobUrl ? site.isJobUrl(window.location) : true;
}
