const log = (...args) => {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...args);
};

const error = (...args) => {
  console.error(`[${new Date().toLocaleTimeString()}]`, ...args);
};

log('[Smart Menlo] Service Worker started.');

const MENLO_PREFIX = "https://safe.menlosecurity.com/";
let forceMenloList = [];

const KEEPALIVE_ALARM_NAME = 'smart-menlo-keepalive';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(KEEPALIVE_ALARM_NAME, {
    periodInMinutes: 1
  });
  log('[Smart Menlo] Keep-alive alarm created.');
  initialize();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM_NAME) {
    log('[Smart Menlo] Keep-alive alarm fired. Service worker is active.');
  }
});

const loadForceMenloList = async () => {
  try {
    const data = await chrome.storage.local.get('forceMenloList');
    forceMenloList = data.forceMenloList || [];
    log('[Smart Menlo] Force list loaded:', forceMenloList);
  } catch (e) {
    error('[Smart Menlo] Error loading force list:', e);
  }
};

const isUrlForced = (url) => {
  if (!url || !url.startsWith('http')) {
    log('[Smart Menlo] isUrlForced: URL is invalid or not HTTP/HTTPS.', url);
    return false;
  }

  try {
    const currentUrl = new URL(url);
    const currentHostname = currentUrl.hostname;
    const urlWithoutProtocol = url.replace(/^https?:\/\//, '');

    const isForced = forceMenloList.some(pattern => {
      if (pattern.includes('/')) {
        const check = (targetUrl, p) => {
          if (targetUrl.startsWith(p)) {
            const charAfterPattern = targetUrl[p.length];
            return charAfterPattern === undefined || ['/', '?', '#'].includes(charAfterPattern);
          }
          return false;
        };
        const isMatch = check(urlWithoutProtocol, pattern) ||
               (urlWithoutProtocol.startsWith('www.') && check(urlWithoutProtocol.substring(4), pattern));
        if (isMatch) log(`[Smart Menlo] isUrlForced: URL matched path pattern '${pattern}'. URL: ${url}`);
        return isMatch;
      } else {
        const isMatch = currentHostname === pattern || currentHostname.endsWith('.' + pattern);
        if (isMatch) log(`[Smart Menlo] isUrlForced: URL matched subdomain pattern '${pattern}'. URL: ${url}`);
        return isMatch;
      }
    });
    return isForced;
  } catch (e) {
    error(`[Smart Menlo] URL parsing error in isUrlForced for URL: ${url}`, e);
    return false;
  }
};

const handleBeforeNavigate = async (details) => {
  log('[Smart Menlo] onBeforeNavigate event triggered for URL:', details.url);

  if (details.frameId !== 0) {
    log('[Smart Menlo] Skipping navigation for non-main frame:', details.frameId);
    return;
  }

  const { tabId, url } = details;

  try {
    const tabState = await chrome.storage.session.get(tabId.toString());

    if (tabState[tabId.toString()]) {
      log(`[Smart Menlo] Tab ${tabId} has a session flag, removing it and allowing navigation.`);
      await chrome.storage.session.remove(tabId.toString());
      return;
    }

    if (url.startsWith(MENLO_PREFIX)) {
      log('[Smart Menlo] Detected Menlo URL:', url);
      const pathAfterPrefix = url.substring(MENLO_PREFIX.length);

      if (pathAfterPrefix.startsWith('http://') || pathAfterPrefix.startsWith('https://')) {
        const originalUrlString = pathAfterPrefix;
        log('[Smart Menlo] Extracted original URL:', originalUrlString);
        if (!isUrlForced(originalUrlString)) {
          log(`[Smart Menlo] URL is not in force list. Redirecting tab ${tabId} to original URL.`);
          await chrome.storage.session.set({ [tabId.toString()]: true });
          chrome.tabs.update(tabId, { url: originalUrlString });
        } else {
            log('[Smart Menlo] Original URL is in the force list, not redirecting from Menlo.');
        }
      }
      return;
    }

    if (isUrlForced(url)) {
      log(`[Smart Menlo] URL is in force list. Redirecting tab ${tabId} to Menlo.`);
      await chrome.storage.session.set({ [tabId.toString()]: true });
      chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
    }
  } catch (e) {
    error('[Smart Menlo] Error in handleBeforeNavigate:', e);
  }
};

const handleError = async (details) => {
  const { tabId, url, error: err, frameId } = details;

  log(`[Smart Menlo] onErrorOccurred event triggered for URL: ${url} with error: ${err}`);

  if (frameId !== 0) {
    log('[Smart Menlo] Skipping error handling for non-main frame:', frameId);
    return;
  }

  if (!url.startsWith('http')) {
      log('[Smart Menlo] Skipping error handling for non-HTTP/HTTPS URL.');
      return;
  }

  if (url.startsWith(MENLO_PREFIX)) {
      log('[Smart Menlo] Skipping error handling for Menlo URL.');
      return;
  }
  
  if (err === 'net::ERR_ABORTED') {
      log('[Smart Menlo] Skipping error handling for net::ERR_ABORTED.');
      return;
  }
  
  try {
    log(`[Smart Menlo] Connection failed (${err}). Redirecting to Menlo: ${url}`);
    await chrome.storage.session.set({ [tabId.toString()]: true });
    chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
  } catch (e) {
    error('[Smart Menlo] Error in handleError:', e);
  }
};

const updateListeners = (isEnabled) => {
  log(`[Smart Menlo] updateListeners called with isEnabled: ${isEnabled}`);
  chrome.webNavigation.onBeforeNavigate.removeListener(handleBeforeNavigate);
  chrome.webNavigation.onErrorOccurred.removeListener(handleError);

  if (isEnabled) {
    log('[Smart Menlo] Adding webNavigation listeners.');
    chrome.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
    chrome.webNavigation.onErrorOccurred.addListener(handleError, { url: [{ schemes: ['http', 'https'] }] });
  } else {
      log('[Smart Menlo] Removing webNavigation listeners.');
  }
};

const initialize = async () => {
  log('[Smart Menlo] Initializing extension.');
  await loadForceMenloList();
  const data = await chrome.storage.local.get('isEnabled');
  const isEnabled = data.isEnabled !== false;
  log(`[Smart Menlo] Extension is ${isEnabled ? 'enabled' : 'disabled'}.`);
  if (typeof data.isEnabled === 'undefined') {
    log('[Smart Menlo] isEnabled not set, setting to true.');
    await chrome.storage.local.set({ isEnabled: true });
  }
  updateListeners(isEnabled);
};

chrome.runtime.onStartup.addListener(initialize);

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    log('[Smart Menlo] storage.local onChanged event detected:', changes);
    if (changes.isEnabled) {
        log(`[Smart Menlo] isEnabled changed to: ${changes.isEnabled.newValue}`);
      updateListeners(changes.isEnabled.newValue);
    }
    if (changes.forceMenloList) {
        log('[Smart Menlo] forceMenloList changed, reloading list.');
      await loadForceMenloList();
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    log(`[Smart Menlo] Tab ${tabId} removed, clearing session data.`);
  chrome.storage.session.remove(tabId.toString()).catch(e => error(`[Smart Menlo] Error clearing session data for tab ${tabId}:`, e));
});