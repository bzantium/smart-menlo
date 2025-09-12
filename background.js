const log = (...args) => {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...args);
};

const error = (...args) => {
  console.error(`[${new Date().toLocaleTimeString()}]`, ...args);
};

log('[Smart Menlo] Service Worker script evaluating.');

const MENLO_PREFIX = "https://safe.menlosecurity.com/";
let forceMenloList = [];
let isEnabled = true;
const KEEPALIVE_ALARM_NAME = 'smart-menlo-keepalive';

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
        const isMatch = check(urlWithoutProtocol, pattern) || (urlWithoutProtocol.startsWith('www.') && check(urlWithoutProtocol.substring(4), pattern));
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
  if (details.frameId !== 0) {
    log('[Smart Menlo] Skipping navigation for non-main frame:', details.frameId);
    return;
  }

  if (!isEnabled) {
    log('[Smart Menlo] Extension is disabled, skipping handleBeforeNavigate.');
    return;
  }

  log('[Smart Menlo] onBeforeNavigate event triggered for URL:', details.url);
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
  if (!isEnabled) {
    return;
  }
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

chrome.runtime.onInstalled.addListener(() => {
  log('[Smart Menlo] Extension installed or updated.');
  chrome.alarms.create(KEEPALIVE_ALARM_NAME, { periodInMinutes: 1 });
  log('[Smart Menlo] Keep-alive alarm created.');
  chrome.storage.local.get('isEnabled', (data) => {
    if (typeof data.isEnabled === 'undefined') {
      chrome.storage.local.set({ isEnabled: true });
      log('[Smart Menlo] isEnabled not set, setting to true.');
    }
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM_NAME) {
    log('[Smart Menlo] Keep-alive alarm fired. Service worker is active.');
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    log('[Smart Menlo] storage.local onChanged event detected:', changes);
    if (changes.isEnabled) {
      isEnabled = changes.isEnabled.newValue;
      log(`[Smart Menlo] isEnabled state updated to: ${isEnabled}`);
    }
    if (changes.forceMenloList) {
      forceMenloList = changes.forceMenloList.newValue || [];
      log('[Smart Menlo] forceMenloList reloaded:', forceMenloList);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  log(`[Smart Menlo] Tab ${tabId} removed, clearing session data.`);
  chrome.storage.session.remove(tabId.toString()).catch(e => error(`[Smart Menlo] Error clearing session data for tab ${tabId}:`, e));
});

const loadInitialState = async () => {
  log('[Smart Menlo] Loading initial state.');
  try {
    const data = await chrome.storage.local.get(['forceMenloList', 'isEnabled']);
    forceMenloList = data.forceMenloList || [];
    isEnabled = data.isEnabled !== false;
    log('[Smart Menlo] State loaded:', { isEnabled, forceMenloList });
  } catch (e) {
    error('[Smart Menlo] Error loading initial state:', e);
  }
};

chrome.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
chrome.webNavigation.onErrorOccurred.addListener(handleError, { url: [{ schemes: ['http', 'https'] }] });

loadInitialState();