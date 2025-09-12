const MENLO_PREFIX = "https://safe.menlosecurity.com/";

let forceMenloList = [];

const loadForceMenloList = async () => {
  try {
    const data = await chrome.storage.local.get('forceMenloList');
    forceMenloList = data.forceMenloList || [];
    console.log('[Smart Menlo] Force list loaded:', forceMenloList);
  } catch (error) {
    console.log('[Smart Menlo] Error loading force list:', error);
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
    console.log(`[Smart Menlo] URL parsing error: ${url}`, error);
    return false;
  }
};

const handleBeforeRequest = (details) => {
  if (details.type !== 'main_frame' || details.method !== 'GET') {
    return {};
  }

  const { url } = details;

  if (url.startsWith(MENLO_PREFIX)) {
    const pathAfterPrefix = url.substring(MENLO_PREFIX.length);

    if (!pathAfterPrefix.startsWith('http')) {
      return {};
    }

    const originalUrlString = pathAfterPrefix;
    if (!isUrlForced(originalUrlString)) {
      console.log(`[Smart Menlo] Redirecting from Menlo to: ${originalUrlString}`);
      return { redirectUrl: originalUrlString };
    }
  }
  else if (url.startsWith('http')) {
    if (isUrlForced(url)) {
      const menloUrl = MENLO_PREFIX + url;
      console.log(`[Smart Menlo] Forcing redirect through Menlo: ${menloUrl}`);
      return { redirectUrl: menloUrl };
    }
  }

  return {};
};

const handleError = (details) => {
    const { tabId, url, error, frameId } = details;
    if (frameId !== 0 || !url.startsWith('http') || url.startsWith(MENLO_PREFIX)) return;
    if (error === 'net::ERR_ABORTED') return;

    try {
        console.log(`[Smart Menlo] Connection failed (${error}). Redirecting to Menlo: ${url}`);
        chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
    } catch (e) {
        console.log('[Smart Menlo] Error in handleError:', e);
    }
};

const updateListeners = (isEnabled) => {
  chrome.webRequest.onBeforeRequest.removeListener(handleBeforeRequest);
  chrome.webNavigation.onErrorOccurred.removeListener(handleError);

  if (isEnabled) {
    chrome.webRequest.onBeforeRequest.addListener(
      handleBeforeRequest,
      { urls: ["<all_urls>"] },
      ["blocking"]
    );
    chrome.webNavigation.onErrorOccurred.addListener(handleError, { urls: ["<all_urls>"] });
  }
};

const initialize = async () => {
  await loadForceMenloList();
  const data = await chrome.storage.local.get('isEnabled');
  const isEnabled = typeof data.isEnabled === 'undefined' ? true : !!data.isEnabled;
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
