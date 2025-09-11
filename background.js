const MENLO_PREFIX = "https://safe.menlosecurity.com/";

const tabStates = new Map();
let forceMenloList = [];

/**
 * 저장소에서 최신 강제 목록을 불러와 메모리에 저장합니다.
 */
const loadForceMenloList = async () => {
  const data = await chrome.storage.local.get('forceMenloList');
  forceMenloList = data.forceMenloList || [];
  console.log('[Smart Menlo] 강제 목록 로드:', forceMenloList);
};

/**
 * URL이 강제 목록 패턴과 일치하는지 확인하는 핵심 함수입니다.
 * @param {string} url 확인할 전체 URL
 * @returns {boolean} 일치 여부
 */
const isUrlForced = (url) => {
  const currentUrl = new URL(url);
  const currentHostname = currentUrl.hostname;
  const urlWithoutProtocol = url.replace(/^https?:\/\//, '');

  return forceMenloList.some(pattern => {
    // 1. 경로가 포함된 규칙 (예: 'linkedin.com/feed')
    if (pattern.includes('/')) {
      const check = (targetUrl, p) => {
        if (targetUrl.startsWith(p)) {
          // 패턴과 정확히 일치하거나, 그 뒤에 /, ?, #가 오는 경우만 참으로 인정
          const charAfterPattern = targetUrl[p.length];
          return charAfterPattern === undefined || ['/', '?', '#'].includes(charAfterPattern);
        }
        return false;
      };
      // 'www.'가 있거나 없는 경우 모두를 확인
      return check(urlWithoutProtocol, pattern) ||
             (urlWithoutProtocol.startsWith('www.') && check(urlWithoutProtocol.substring(4), pattern));
    }
    // 2. 경로가 없는 규칙 (호스트 및 서브도메인 규칙)
    else {
      return currentHostname === pattern || currentHostname.endsWith('.' + pattern);
    }
  });
};


/**
 * 웹 탐색 이벤트를 처리하는 핵심 핸들러입니다.
 */
const handleBeforeNavigate = (details) => {
  if (details.frameId !== 0) return;

  const { tabId, url } = details;

  if (tabStates.get(tabId)) {
    tabStates.delete(tabId);
    return;
  }

  // --- 로직 분기 ---

  // 1. 현재 URL이 Menlo URL인 경우
  if (url.startsWith(MENLO_PREFIX)) {
    const originalUrlString = url.substring(MENLO_PREFIX.length);

    // 원본 URL이 "강제 목록"에 포함되는지 확인합니다.
    if (isUrlForced(originalUrlString)) {
      // 목록에 있으므로 Menlo 접속을 그대로 유지합니다.
      console.log(`[Smart Menlo] 강제 목록 URL(${originalUrlString})이므로 Menlo 접속을 유지합니다.`);
    } else {
      // 📌 이 부분이 바로 사용자가 말씀하신 핵심 로직입니다.
      // "강제 목록"에 없으므로, Menlo prefix를 제거하고 원본 주소로 다시 접속을 시도합니다.
      console.log(`[Smart Menlo] 등록되지 않은 Menlo URL 감지. 원본(${originalUrlString})으로 재접속 시도.`);
      tabStates.set(tabId, true);
      chrome.tabs.update(tabId, { url: originalUrlString });
    }
    return;
  }

  // 2. 현재 URL이 "강제 목록"에 해당하여 Menlo로 보내야 하는 경우
  if (isUrlForced(url)) {
    console.log(`[Smart Menlo] 강제 목록 URL(${url}) 감지. Menlo로 리디렉션합니다.`);
    tabStates.set(tabId, true);
    chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
    return;
  }
};

/**
 * 웹 페이지 접속 오류 발생 시 Menlo로 리디렉션합니다.
 */
const handleError = (details) => {
  const { tabId, url, error, frameId } = details;
  if (frameId !== 0 || !url.startsWith('http') || url.startsWith(MENLO_PREFIX)) return;
  if (error === 'net::ERR_ABORTED') return;
  
  console.log(`[Smart Menlo] 접속 실패(${error}). Menlo로 리디렉션: ${url}`);
  tabStates.set(tabId, true);
  chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
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