const MENLO_PREFIX = "https://safe.menlosecurity.com/";

let forceMenloList = [];

const loadForceMenloList = async () => {
  try {
    const data = await chrome.storage.local.get('forceMenloList');
    forceMenloList = data.forceMenloList || [];
    console.log('[Smart Menlo] Force list loaded:', forceMenloList);
  } catch (error) {
    console.error('[Smart Menlo] Error loading force list:', error);
  }
};

const isUrlForced = (url) => {
  if (!url || !url.startsWith('http')) {
    return false;
  }

  try {
    const currentUrl = new URL(url);
    const currentHostname = currentUrl.hostname;
    const urlWithoutProtocol = url.replace(/^https?:\/\//, '');

    return forceMenloList.some(pattern => {
      if (pattern.includes('/')) {
        const check = (targetUrl, p) => {
          if (targetUrl.startsWith(p)) {
            const charAfterPattern = targetUrl[p.length];
            return charAfterPattern === undefined || ['/', '?', '#'].includes(charAfterPattern);
          }
          return false;
        };
        return check(urlWithoutProtocol, pattern) ||
               (urlWithoutProtocol.startsWith('www.') && check(urlWithoutProtocol.substring(4), pattern));
      } else {
        return currentHostname === pattern || currentHostname.endsWith('.' + pattern);
      }
    });
  } catch (error) {
    console.error(`[Smart Menlo] URL parsing error: ${url}`, error);
    return false;
  }
};

const handleBeforeNavigate = async (details) => {
  if (details.frameId !== 0) return;

  const { tabId, url } = details;

  try {
    const tabState = await chrome.storage.session.get(tabId.toString());

    if (tabState[tabId.toString()]) {
      await chrome.storage.session.remove(tabId.toString());
      return;
    }

    if (url.startsWith(MENLO_PREFIX)) {
      const pathAfterPrefix = url.substring(MENLO_PREFIX.length);

      if (pathAfterPrefix.startsWith('http://') || pathAfterPrefix.startsWith('https://')) {
        const originalUrlString = pathAfterPrefix;
        if (!isUrlForced(originalUrlString)) {
          await chrome.storage.session.set({ [tabId.toString()]: true });
          chrome.tabs.update(tabId, { url: originalUrlString });
        }
      }
      return;
    }

    if (isUrlForced(url)) {
      await chrome.storage.session.set({ [tabId.toString()]: true });
      chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
    }
  } catch (error) {
    console.error('[Smart Menlo] Error in handleBeforeNavigate:', error);
  }
};

const handleError = async (details) => {
  const { tabId, url, error, frameId } = details;
  
  if (frameId !== 0 || !url.startsWith('http') || url.startsWith(MENLO_PREFIX)) return;
  
  if (error === 'net::ERR_ABORTED') return;
  
  try {
    console.log(`[Smart Menlo] Connection failed (${error}). Redirecting to Menlo: ${url}`);
    await chrome.storage.session.set({ [tabId.toString()]: true });
    chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
  } catch (e) {
    console.error('[Smart Menlo] Error in handleError:', e);
  }
};

const updateListeners = (isEnabled) => {
  chrome.webNavigation.onBeforeNavigate.removeListener(handleBeforeNavigate);
  chrome.webNavigation.onErrorOccurred.removeListener(handleError);

  if (isEnabled) {
    chrome.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
    chrome.webNavigation.onErrorOccurred.addListener(handleError, { url: [{ schemes: ['http', 'https'] }] });
  }
};

const initialize = async () => {
  await loadForceMenloList();
  const data = await chrome.storage.local.get('isEnabled');
  const isEnabled = data.isEnabled !== false;
  if (typeof data.isEnabled === 'undefined') {
    await chrome.storage.local.set({ isEnabled: true });
  }
  updateListeners(isEnabled);
};

chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    if (changes.isEnabled) {
      updateListeners(changes.isEnabled.newValue);
    }
    if (changes.forceMenloList) {
      await loadForceMenloList();
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(tabId.toString()).catch(e => console.error(e));
});