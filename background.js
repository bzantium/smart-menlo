const MENLO_PREFIX = "https://safe.menlosecurity.com/";

const tabStates = new Map();
let forceMenloList = [];

/**
 * 저장소에서 최신 강제 목록을 불러와 메모리에 저장합니다.
 */
const loadForceMenloList = async () => {
  try {
    const data = await chrome.storage.local.get('forceMenloList');
    forceMenloList = data.forceMenloList || [];
    console.log('[Smart Menlo] 강제 목록 로드:', forceMenloList);
  } catch (error) {
    console.log('[Smart Menlo] 강제 목록 로드 중 오류 발생:', error);
  }
};

/**
 * URL이 강제 목록 패턴과 일치하는지 확인하는 핵심 함수입니다.
 * @param {string} url 확인할 전체 URL
 * @returns {boolean} 일치 여부
 */
const isUrlForced = (url) => {
  // 📌 1. 오류 처리 추가: 유효하지 않은 URL로 인한 스크립트 중단을 방지합니다.
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
    // 📌 2. 오류 처리 추가: URL 파싱 중 예외가 발생해도 false를 반환하고 계속 작동합니다.
    console.log(`[Smart Menlo] URL 파싱 오류: ${url}`, error);
    return false;
  }
};


/**
 * 웹 탐색 이벤트를 처리하는 핵심 핸들러입니다.
 */
const handleBeforeNavigate = (details) => {
  // 📌 3. 오류 처리 추가: 리디렉션 로직 전체를 감싸 예기치 않은 오류에도 확장 프로그램이 멈추지 않도록 합니다.
  try {
    if (details.frameId !== 0) return;

    const { tabId, url } = details;

    if (tabStates.get(tabId)) {
      tabStates.delete(tabId);
      return;
    }

    if (url.startsWith(MENLO_PREFIX)) {
      const originalUrlString = url.substring(MENLO_PREFIX.length);
      if (isUrlForced(originalUrlString)) {
        // 목록에 있으므로 Menlo 접속 유지
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

/**
 * 웹 페이지 접속 오류 발생 시 Menlo로 리디렉션합니다.
 */
const handleError = (details) => {
  // 📌 4. 오류 처리 추가: 오류 처리 함수 자체의 안정성을 높입니다.
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

/**
 * 확장 프로그램의 활성화/비활성화 상태에 따라 리스너를 업데이트합니다.
 */
const updateListeners = (isEnabled) => {
  chrome.webNavigation.onBeforeNavigate.removeListener(handleBeforeNavigate);
  chrome.webNavigation.onErrorOccurred.removeListener(handleError);

  if (isEnabled) {
    chrome.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
    chrome.webNavigation.onErrorOccurred.addListener(handleError);
  }
};

// --- 확장 프로그램 초기화 및 상태 관리 로직 ---
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