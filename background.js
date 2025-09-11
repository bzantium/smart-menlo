const MENLO_PREFIX = "https://safe.menlosecurity.com/";

const tabStates = new Map();
let forceMenloList = [];

const loadForceMenloList = async () => {
  try {
    const data = await chrome.storage.local.get('forceMenloList');
    forceMenloList = data.forceMenloList || [];
    console.log('[Smart Menlo] 강제 목록 로드:', forceMenloList);
  } catch (error) {
    console.log('[Smart Menlo] 강제 목록 로드 중 오류 발생:', error);
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
    console.log(`[Smart Menlo] URL 파싱 오류: ${url}`, error);
    return false;
  }
};


const handleBeforeNavigate = (details) => {
  try {
    if (details.frameId !== 0) return;

    const { tabId, url } = details;

    if (tabStates.get(tabId)) {
      tabStates.delete(tabId);
      return;
    }

    if (url.startsWith(MENLO_PREFIX)) {
      if (url.startsWith("https://safe.menlosecurity.com/account")) {
        return;
      }

      const originalUrlString = url.substring(MENLO_PREFIX.length);
      if (isUrlForced(originalUrlString)) {
      } else {
        tabStates.set(tabId, true);
        chrome.tabs.update(tabId, { url: originalUrlString });
      }
      return;
    }

    if (isUrlForced(url)) {
      tabStates.set(tabId, true);
      chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
      return;
    }
  } catch (error) {
    console.log('[Smart Menlo] handleBeforeNavigate 처리 중 오류 발생:', error);
  }
};

const handleError = (details) => {
  try {
    const { tabId, url, error, frameId } = details;
    if (frameId !== 0 || !url.startsWith('http') || url.startsWith(MENLO_PREFIX)) return;
    if (error === 'net::ERR_ABORTED') return;
    
    console.log(`[Smart Menlo] 접속 실패(${error}). Menlo로 리디렉션: ${url}`);
    tabStates.set(tabId, true);
    chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
  } catch (e) {
    console.log('[Smart Menlo] handleError 처리 중 오류 발생:', e);
  }
};

const updateListeners = (isEnabled) => {
  chrome.webNavigation.onBeforeNavigate.removeListener(handleBeforeNavigate);
  chrome.webNavigation.onErrorOccurred.removeListener(handleError);

  if (isEnabled) {
    chrome.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
    chrome.webNavigation.onErrorOccurred.addListener(handleError);
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

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});