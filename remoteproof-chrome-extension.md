# RemoteProof — Chrome Extension Plan
> Your first Chrome extension. Built with vanilla JS, Manifest V3.

---

## Before You Start — How Chrome Extensions Work

A Chrome extension is just a folder of files. No build step needed for v1.
There are three types of scripts and they each do different things:

| Script type | What it does | Your file |
|---|---|---|
| **Content Script** | Runs inside the actual web page (LinkedIn, Indeed etc.) Can read/modify the DOM | `content/content.js` |
| **Background Script** | Runs in the background, always. Handles events, API calls, storage | `background/background.js` |
| **Popup Script** | Runs when user clicks the extension icon | `popup/popup.js` |

The `manifest.json` is the config file that tells Chrome what your extension is,
what permissions it needs, and which scripts to load where.

---

## Folder Structure

```
remoteproof-extension/
├── manifest.json           ← Chrome reads this first
├── content/
│   ├── content.js          ← Injected into job pages, injects badge
│   └── extractor.js        ← Extracts job description text from the DOM
├── background/
│   └── background.js       ← Service worker, handles API calls
├── popup/
│   ├── popup.html          ← UI when you click the extension icon
│   └── popup.js            ← Logic for the popup
├── styles/
│   └── badge.css           ← Styles for the verdict badge
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## TASK 1 — Create the folder structure

Create the folder and all files listed above (empty is fine for now).
For icons, use any placeholder PNG for now — even a coloured square.
You can replace with proper icons later.

**Done when:** Folder exists with all files in place.

---

## TASK 2 — Create manifest.json

This is the most important file. Chrome won't load the extension without it.

```json
{
  "manifest_version": 3,
  "name": "RemoteProof",
  "version": "0.1.0",
  "description": "Know if a remote job is truly worldwide before you apply.",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://www.indeed.com/*",
    "https://weworkremotely.com/*",
    "http://localhost/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://www.linkedin.com/jobs/*",
        "https://www.indeed.com/viewjob*",
        "https://weworkremotely.com/remote-jobs/*"
      ],
      "js": ["content/extractor.js", "content/content.js"],
      "css": ["styles/badge.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background/background.js"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**How to load in Chrome:**
1. Go to `chrome://extensions`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select your `remoteproof-extension` folder

**Done when:** Extension appears in `chrome://extensions` with no errors shown.

---

## TASK 3 — Build extractor.js

This file's only job: find the job description text on the page and return it.

Each platform has different HTML structure so you need platform-specific selectors:

```javascript
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
    description: '.listing-container',
    title: '.listing-header-container h2',
  }
};

function extractJobDescription() {
  const hostname = window.location.hostname;
  const selectors = SELECTORS[hostname];

  if (!selectors) return null;

  const descriptionEl = document.querySelector(selectors.description);
  if (!descriptionEl) return null;

  // Get text only, strip HTML tags, clean whitespace
  return descriptionEl.innerText.trim();
}

function extractJobTitle() {
  const hostname = window.location.hostname;
  const selectors = SELECTORS[hostname];
  if (!selectors) return null;

  const titleEl = document.querySelector(selectors.title);
  return titleEl ? titleEl.innerText.trim() : null;
}
```

**How to test without the full extension wired up:**
1. Open a LinkedIn job listing
2. Open DevTools Console
3. Paste the function in and call `extractJobDescription()`
4. You should see the job description text printed

**Done when:** Calling `extractJobDescription()` in the console on a LinkedIn,
Indeed, and WWR job page returns the correct job description text each time.

---

## TASK 4 — Build background.js (API caller)

The background service worker handles the call to your Laravel API.
Content scripts can make fetch calls directly, but using the background
script keeps the API logic in one place and avoids CORS issues.

```javascript
const API_URL = 'http://localhost:8000/api/classify';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

async function classifyJob(text, url) {
  // Check chrome.storage.local cache first
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

  // Call Laravel API
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, url })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const result = await response.json();

  // Store in cache
  if (url) {
    await chrome.storage.local.set({
      [cacheKey]: { data: result, timestamp: Date.now() }
    });
  }

  return result;
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLASSIFY') {
    classifyJob(message.text, message.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required to keep the message channel open for async response
  }
});
```

**Done when:** You can trigger a message from the console and get a classification
back. Test with:
```javascript
chrome.runtime.sendMessage({
  type: 'CLASSIFY',
  text: 'paste a job description here',
  url: 'https://test.com/job/123'
}, response => console.log(response));
```

---

## TASK 5 — Build badge styles (badge.css)

```css
#remoteproof-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-weight: 500;
  margin: 12px 0;
  border: 1px solid transparent;
  position: relative;
  cursor: default;
}

#remoteproof-badge.worldwide {
  background: #f0fdf4;
  border-color: #86efac;
  color: #166534;
}

#remoteproof-badge.restricted {
  background: #fff1f2;
  border-color: #fda4af;
  color: #9f1239;
}

#remoteproof-badge.unclear {
  background: #fefce8;
  border-color: #fde047;
  color: #854d0e;
}

#remoteproof-badge.loading {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #64748b;
}

#remoteproof-badge .rp-reason {
  font-size: 11px;
  opacity: 0.8;
  margin-left: 4px;
}

#remoteproof-badge .rp-dismiss {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
  font-size: 14px;
  padding: 0 0 0 8px;
  color: inherit;
}

#remoteproof-badge .rp-dismiss:hover {
  opacity: 1;
}
```

**Done when:** Badge styles are in the file. Visual testing comes in Task 6.

---

## TASK 6 — Build content.js (badge injector)

This is the main content script. It ties everything together:
1. Extracts the job description
2. Sends it to the background script for classification
3. Injects the badge into the page

```javascript
const BADGE_ID = 'remoteproof-badge';

const VERDICT_CONFIG = {
  WORLDWIDE: { emoji: '🟢', label: 'Worldwide Remote', cssClass: 'worldwide' },
  RESTRICTED: { emoji: '🔴', label: 'Restricted Remote', cssClass: 'restricted' },
  UNCLEAR:    { emoji: '🟡', label: 'Unclear',           cssClass: 'unclear' },
};

function createBadge(verdict, reason) {
  const existing = document.getElementById(BADGE_ID);
  if (existing) existing.remove();

  const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG['UNCLEAR'];

  const badge = document.createElement('div');
  badge.id = BADGE_ID;
  badge.className = config.cssClass;
  badge.innerHTML = `
    <span>${config.emoji} ${config.label}</span>
    <span class="rp-reason">${reason || ''}</span>
    <button class="rp-dismiss" title="Dismiss">×</button>
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
  badge.innerHTML = `<span>⏳ Checking remote status...</span>`;
  return badge;
}

function injectBadge(badgeEl) {
  // Try to insert after the job title
  const hostname = window.location.hostname;
  let insertAfter;

  if (hostname.includes('linkedin')) {
    insertAfter = document.querySelector('.job-details-jobs-unified-top-card__job-title');
  } else if (hostname.includes('indeed')) {
    insertAfter = document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]');
  } else if (hostname.includes('weworkremotely')) {
    insertAfter = document.querySelector('.listing-header-container h2');
  }

  if (insertAfter && insertAfter.parentNode) {
    insertAfter.parentNode.insertBefore(badgeEl, insertAfter.nextSibling);
  }
}

async function run() {
  const text = extractJobDescription(); // from extractor.js
  if (!text || text.length < 100) return;

  // Show loading badge immediately
  injectBadge(createLoadingBadge());

  // Ask background script to classify
  chrome.runtime.sendMessage(
    { type: 'CLASSIFY', text, url: window.location.href },
    (response) => {
      if (response && response.success) {
        const { verdict, reason } = response.data;
        injectBadge(createBadge(verdict, reason));
      } else {
        document.getElementById(BADGE_ID)?.remove();
      }
    }
  );
}

// Run on page load
run();
```

**Done when:** Opening a job listing shows the loading badge briefly, then the
correct verdict badge appears near the job title.

---

## TASK 7 — Handle LinkedIn's dynamic navigation

LinkedIn is a Single Page App. When you click between jobs in the sidebar,
the URL changes but the page doesn't fully reload — so your content script
won't re-run automatically.

You need to watch for DOM changes and re-run when a new job loads:

Add this to the bottom of `content.js`:

```javascript
// LinkedIn SPA navigation handler
let lastUrl = location.href;
let debounceTimer;

const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      run();
    }, 800); // Wait 800ms for job content to load
  }
});

observer.observe(document.body, { childList: true, subtree: true });
```

**Done when:** Clicking between jobs in LinkedIn's left panel updates the badge
for each new job without needing to refresh the page.

---

## TASK 8 — Build popup.html and popup.js

The popup appears when the user clicks the extension icon.
Keep it minimal for v1 — just show the current page's classification status.

`popup.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      width: 280px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #1e293b;
    }
    h1 { font-size: 15px; margin: 0 0 12px; }
    p { margin: 0; color: #64748b; line-height: 1.5; }
    a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <h1>🛡️ RemoteProof</h1>
  <p>Open a job listing on LinkedIn, Indeed, or We Work Remotely to see the remote classification.</p>
  <br>
  <p><a href="https://remoteproof.app" target="_blank">remoteproof.app</a></p>
  <script src="popup.js"></script>
</body>
</html>
```

`popup.js`: empty for now — static HTML is enough for v1.

**Done when:** Clicking the extension icon opens the popup without errors.

---

## TASK 9 — End to end local smoke test

Run through this full checklist before calling the extension done:

- [ ] Laravel API running on `http://localhost:8000`
- [ ] Extension loaded in Chrome (unpacked, no errors in chrome://extensions)
- [ ] Open LinkedIn Jobs → search "remote software engineer"
- [ ] Badge appears on first listing (loading → verdict)
- [ ] Verdict is correct (manually check the description)
- [ ] Click a different job in sidebar → badge updates ✅ (LinkedIn SPA test)
- [ ] Revisit a previous job → badge loads instantly from cache
- [ ] Test on an Indeed job listing → badge appears
- [ ] Test on a WWR job listing → badge appears
- [ ] Test a clearly US-only listing → shows 🔴 Restricted
- [ ] Test a "work from anywhere" listing → shows 🟢 Worldwide
- [ ] Click × on badge → dismisses cleanly
- [ ] Click extension icon → popup opens without errors

**Done when:** All checkboxes pass.

---

## Common Gotchas (Read Before You Start)

**`return true` in message listeners is mandatory**
In background.js, when handling async messages, you must `return true`
from the listener — otherwise Chrome closes the message channel before
the async response arrives.

**Content scripts can't access chrome.storage directly in all contexts**
Use `chrome.storage.local` from the background script, not the content script,
for reliability. The message passing pattern in this plan handles this correctly.

**LinkedIn changes their selectors regularly**
If the badge stops appearing on LinkedIn, the first thing to check is whether
their CSS class names changed. Inspect the element and update `extractor.js`.

**Manifest V3 service workers don't persist**
The background service worker can be killed by Chrome at any time when idle.
Don't store state in background.js variables — always use `chrome.storage`.

**localhost in host_permissions**
You need `http://localhost/*` in `host_permissions` for the extension to call
your local Laravel API during development. Remove this before publishing.

---

## Completion Checklist

- [ ] TASK 1 — Folder structure created
- [ ] TASK 2 — manifest.json working, extension loads in Chrome
- [ ] TASK 3 — extractor.js returns correct text on all 3 platforms
- [ ] TASK 4 — background.js calls API and caches results
- [ ] TASK 5 — badge.css styles in place
- [ ] TASK 6 — content.js injects badge with correct verdict
- [ ] TASK 7 — LinkedIn SPA navigation handled
- [ ] TASK 8 — Popup opens cleanly
- [ ] TASK 9 — Full smoke test passes
