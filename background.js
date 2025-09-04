const MENLO_PREFIX = "https://safe.menlosecurity.com/";

/**
 * Map object to manage the redirection state of each tab.
 * key: tabId (unique ID of the tab)
 * value: state string ('RETRYING_DIRECT' or 'REDIRECTING_TO_MENLO')
 *
 * - RETRYING_DIRECT: Detected Menlo URL and trying to access the original URL first
 * - REDIRECTING_TO_MENLO: After failing to access the original URL, redirecting back to the Menlo URL
 */
const tabStates = new Map();

/**
 * Event listener called before web page navigation starts.
 * Detects navigation to a Menlo URL and tries the original URL first.
 */
const handleBeforeNavigate = (details) => {
  // Only handle events from the main frame.
  if (details.frameId !== 0) return;

  const currentState = tabStates.get(details.tabId);

  // If the current URL is a Menlo URL and the tab is not already in 'redirecting to Menlo' state
  if (details.url.startsWith(MENLO_PREFIX) && currentState !== 'REDIRECTING_TO_MENLO') {
    const originalUrl = details.url.substring(MENLO_PREFIX.length);

    // Do nothing if the original URL is invalid.
    if (!originalUrl || !originalUrl.startsWith('http')) return;

    console.log(`[Smart Menlo] Detected Menlo URL. Trying to access the original URL first: ${originalUrl}`);

    // Set the current tab's state to 'trying to access original URL'.
    tabStates.set(details.tabId, 'RETRYING_DIRECT');

    // Update the tab's URL to the original URL to redirect.
    chrome.tabs.update(details.tabId, { url: originalUrl });
  }
};

/**
 * Event listener called when an error occurs during web page access.
 * Handles the core functionality of redirecting to the Menlo URL upon access failure.
 */
const handleError = (details) => {
  // Only handle errors from the main frame and http(s) protocols.
  if (details.frameId !== 0 || !details.url.startsWith('http')) return;
  // Ignore cases where the user manually aborted (e.g., back, refresh).
  if (details.error === 'net::ERR_ABORTED') return;

  // If the error occurred while accessing the Menlo URL itself, log and reset state.
  if (details.url.startsWith(MENLO_PREFIX)) {
    console.log(`[Smart Menlo] Failed to access Menlo URL (${details.error}). Stopping redirection.`);
    tabStates.delete(details.tabId);
    return;
  }

  // For all other access failures, redirect to the Menlo URL.
  // (Covers both initial access failure and 'trying original URL' failure)
  console.log(`[Smart Menlo] Access failure detected (${details.error}). Redirecting ${details.url} to Menlo.`);

  // Set the current tab's state to 'redirecting to Menlo' to prevent infinite loops.
  tabStates.set(details.tabId, 'REDIRECTING_TO_MENLO');

  // Redirect to the Menlo URL.
  chrome.tabs.update(details.tabId, { url: MENLO_PREFIX + details.url });
};

/**
 * Registers or removes event listeners based on the extension's enabled/disabled state.
 */
const updateListeners = (isEnabled) => {
  // Remove existing listeners to prevent duplicate registration.
  chrome.webNavigation.onBeforeNavigate.removeListener(handleBeforeNavigate);
  chrome.webNavigation.onErrorOccurred.removeListener(handleError);

  if (isEnabled) {
    // Register necessary event listeners when the feature is enabled.
    chrome.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
    chrome.webNavigation.onErrorOccurred.addListener(handleError);
    console.log('[Smart Menlo] Auto redirection feature enabled.');
  } else {
    console.log('[Smart Menlo] Auto redirection feature disabled.');
  }
};

// --- The following logic is mostly unchanged, with some cleanup. ---

// Set the default to 'enabled' when the extension is first installed or updated.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('isEnabled', (data) => {
    const isEnabled = typeof data.isEnabled === 'undefined' ? true : data.isEnabled;
    chrome.storage.local.set({ isEnabled: isEnabled }, () => {
      updateListeners(isEnabled);
    });
  });
});

// Update listener state whenever the isEnabled value in storage changes (e.g., via popup switch).
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.isEnabled) {
    updateListeners(changes.isEnabled.newValue);
  }
});

// Initialize listeners based on the saved value when the browser starts.
chrome.storage.local.get('isEnabled', (data) => {
  updateListeners(!!data.isEnabled);
});

// When a page loads successfully, remove the state record for that tab.
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {
    tabStates.delete(details.tabId);
  }
});

// When a tab is closed, remove its state record from memory.
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});