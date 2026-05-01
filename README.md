# RemoteProof — Chrome Extension

Classifies remote job listings on LinkedIn, Indeed, and We Work Remotely as **Worldwide**, **Restricted**, or **Unclear** so you know up front whether you're allowed to apply.

A small badge appears on each supported job page after the page loads:

```
●  Worldwide Remote                                 ×
   Listing explicitly states open to candidates anywhere.
```

The classification comes from a companion Laravel API (separate repo). This extension extracts the job description, sends it to the API, caches the result, and renders the verdict.

---

## Supported sites

| Site | URL pattern |
|---|---|
| LinkedIn | `https://www.linkedin.com/jobs/*` |
| Indeed | `https://www.indeed.com/viewjob*` |
| We Work Remotely | `https://weworkremotely.com/remote-jobs/*` |

LinkedIn's SPA navigation is handled — clicking between jobs in the sidebar re-runs the classifier without a page reload.

---

## Install (development)

This is an unpacked Manifest V3 extension. No build step.

1. Clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right)
4. Click **Load unpacked** and select this folder
5. The extension icon appears in your toolbar

To pick up code changes: hit the reload icon on the RemoteProof card in `chrome://extensions`, then reload any open job tab.

---

## API contract

The extension sends every job description to a Laravel API and renders the response. Default endpoint:

```
POST http://remoteproof-api.test/api/classify
```

**Request:**
```json
{ "text": "<job description>", "url": "<job url>" }
```

**Response:**
```json
{
  "verdict": "WORLDWIDE" | "RESTRICTED" | "UNCLEAR",
  "reason":  "short explanation shown under the badge"
}
```

If the API is unreachable or returns an error, the extension renders a yellow `Unclear` badge with `Could not classify this listing.` rather than failing silently.

To change the API URL, edit `API_URL` in `background/background.js` and update `host_permissions` in `manifest.json`.

---

## Project structure

```
remoteproof-extension/
├── manifest.json              Manifest V3 config
├── content/
│   ├── extractor.js           Reads job description from each platform's DOM
│   └── content.js             Injects the badge, handles SPA navigation
├── background/
│   └── background.js          Service worker — calls API, caches results 24h
├── popup/
│   ├── popup.html             Toolbar popup (static)
│   └── popup.js               (empty — reserved for v2)
├── styles/
│   └── badge.css              Pill, dot, dismiss button, loading animation
└── icons/
    └── icon{16,48,128}.png    Placeholder icons (replace before publishing)
```

---

## How it works

1. Chrome injects the content scripts on a matching job page (`document_idle`).
2. `extractor.js` finds the job description using a platform-specific CSS selector.
3. `content.js` sends a `CLASSIFY` message to the background service worker with the description and URL.
4. `background.js` checks `chrome.storage.local` for a cached classification (24h TTL). On miss, it calls the API and caches the result.
5. The verdict is rendered as a coloured pill, anchored to a stable element near the top of the page (the qualifications card on LinkedIn, the title-container on Indeed, the header hero on WWR).
6. A `MutationObserver` watches for URL changes (LinkedIn SPA) and re-runs the flow without a full reload.

---

## Caching

- **Extension side:** `chrome.storage.local`, keyed by URL, 24 hours.
- **API side:** the Laravel controller caches by hash of the job description, separately.

---

## Known limitations

- Selectors break when LinkedIn/Indeed/WWR change their DOM. When the badge stops appearing, update the selectors in `content/extractor.js` and the platform-specific anchors in `content/content.js → injectBadge()`.
- Job descriptions under 100 characters are skipped (they're not enough signal to classify).
- Placeholder icons — replace `icons/*.png` before publishing.

---

## License

MIT
