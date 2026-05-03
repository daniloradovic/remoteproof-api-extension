const STATE_MESSAGES = {
  idle: 'Open a job listing to detect.',
  pending: 'Looking for the job description…',
  working: 'Detected. Badge shown on the page.',
  stuck: "Couldn't read this listing. Reload the page to retry.",
};

(async () => {
  const statusEl = document.getElementById('status');
  const reloadBtn = document.getElementById('reload');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let state = 'idle';
  if (tab?.id) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE', tabId: tab.id });
      state = response?.state || 'idle';
    } catch {
      state = 'idle';
    }
  }

  statusEl.textContent = STATE_MESSAGES[state] || STATE_MESSAGES.idle;
  statusEl.classList.remove('stuck', 'working');
  if (state === 'stuck') statusEl.classList.add('stuck');
  if (state === 'working') statusEl.classList.add('working');

  reloadBtn.addEventListener('click', () => {
    if (tab?.id) chrome.tabs.reload(tab.id);
    window.close();
  });
})();
