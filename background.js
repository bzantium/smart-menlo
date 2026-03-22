importScripts('bg-shared.js', 'bg-global.js', 'bg-ivanti.js');

log('[Smart Menlo] Service Worker script evaluating.');

const handleBeforeNavigate = async (details) => {
  if (details.frameId !== 0) return;
  log('[Smart Menlo] onBeforeNavigate event triggered for URL:', details.url);
  const { tabId, url } = details;
  try {
    if (vpnMode === 'global') {
      await handleBeforeNavigateGlobal(tabId, url);
    } else {
      await handleBeforeNavigateIvanti(tabId, url);
    }
  } catch (e) {
    error('[Smart Menlo] Error in handleBeforeNavigate:', e);
  }
};

const handleError = async (details) => {
  if (vpnMode === 'global' && !vpnPolicyProd) return;
  if (vpnMode === 'ivanti' && !isEnabled) return;

  const { tabId, url, error: err, frameId } = details;
  log(`[Smart Menlo] onErrorOccurred event triggered for URL: ${url} with error: ${err}`);

  if (frameId !== 0) return;
  if (!url.startsWith('http')) return;
  if (url.startsWith(MENLO_PREFIX)) return;
  if (err === 'net::ERR_ABORTED') return;

  try {
    log(`[Smart Menlo] Connection failed (${err}). Redirecting to Menlo: ${url}`);
    await redirectTab(tabId, MENLO_PREFIX + url);
  } catch (e) {
    error('[Smart Menlo] Error in handleError:', e);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  log('[Smart Menlo] Extension installed or updated.');
  chrome.alarms.create(KEEPALIVE_ALARM_NAME, { periodInMinutes: 1 });
  log('[Smart Menlo] Keep-alive alarm created.');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM_NAME) {
    log('[Smart Menlo] Keep-alive alarm fired. Service worker is active.');
    checkVpnPolicy();
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    log('[Smart Menlo] storage.local onChanged event detected:', changes);
    if (changes.vpnMode) {
      vpnMode = changes.vpnMode.newValue;
      log(`[Smart Menlo] vpnMode updated to: ${vpnMode}`);
      if (vpnMode === 'global') checkVpnPolicy();
      updateBadge();
    }
    if (changes.vpnPolicyProd) {
      vpnPolicyProd = changes.vpnPolicyProd.newValue;
      log(`[Smart Menlo] vpnPolicyProd state updated to: ${vpnPolicyProd}`);
      updateBadge();
    }
    if (changes.vpnConnected) {
      log(`[Smart Menlo] vpnConnected updated to: ${changes.vpnConnected.newValue}`);
      updateBadge();
    }
    if (changes.isEnabled) {
      isEnabled = changes.isEnabled.newValue;
      log(`[Smart Menlo] isEnabled state updated to: ${isEnabled}`);
      updateBadge();
    }
    if (changes.forceMenloEnabledGlobal) {
      forceMenloEnabledGlobal = changes.forceMenloEnabledGlobal.newValue;
      log(`[Smart Menlo] forceMenloEnabledGlobal updated to: ${forceMenloEnabledGlobal}`);
    }
    if (changes.forceMenloEnabledIvanti) {
      forceMenloEnabledIvanti = changes.forceMenloEnabledIvanti.newValue;
      log(`[Smart Menlo] forceMenloEnabledIvanti updated to: ${forceMenloEnabledIvanti}`);
    }
    if (changes.forceMenloList) {
      forceMenloList = changes.forceMenloList.newValue || [];
      log('[Smart Menlo] forceMenloList reloaded:', forceMenloList);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'switchPolicyMode') {
    (async () => {
      try {
        log('[Smart Menlo] Switching policy mode to:', message.mode);
        setIconWithDot('#e67e22');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const endpoint = message.mode === 'prod'
          ? 'https://selka.onkakao.net/sase/prod'
          : 'https://selka.onkakao.net/sase/default';
        await fetch(endpoint, { method: 'POST', cache: 'no-cache', signal: controller.signal });
        clearTimeout(timeoutId);
        await checkVpnPolicy();
      } catch (e) {
        log('[Smart Menlo] Policy mode switch failed:', e);
      }
      await chrome.storage.local.set({ vpnSwitching: false });
      updateBadge();
      sendResponse({ done: true });
    })();
    return true; // keep message channel open for async response
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  log(`[Smart Menlo] Tab ${tabId} removed, clearing session data.`);
  chrome.storage.session.remove(tabId.toString()).catch(e => error(`[Smart Menlo] Error clearing session data for tab ${tabId}:`, e));
});

const loadInitialState = async () => {
  log('[Smart Menlo] Loading initial state.');
  try {
    const data = await chrome.storage.local.get(['forceMenloList', 'vpnPolicyProd', 'isEnabled', 'forceMenloEnabledGlobal', 'forceMenloEnabledIvanti', 'vpnMode', 'vpnSwitching']);
    forceMenloList = data.forceMenloList || [];
    vpnPolicyProd = data.vpnPolicyProd || false;
    isEnabled = data.isEnabled !== false;
    forceMenloEnabledGlobal = data.forceMenloEnabledGlobal !== false;
    forceMenloEnabledIvanti = data.forceMenloEnabledIvanti !== false;
    vpnMode = data.vpnMode || 'global';
    log('[Smart Menlo] State loaded:', { vpnMode, vpnPolicyProd, isEnabled, forceMenloEnabledGlobal, forceMenloEnabledIvanti, forceMenloList });
    if (data.vpnSwitching) {
      await chrome.storage.local.set({ vpnSwitching: false });
    }
    updateBadge();
    checkVpnPolicy();
  } catch (e) {
    error('[Smart Menlo] Error loading initial state:', e);
  }
};

chrome.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
chrome.webNavigation.onErrorOccurred.addListener(handleError, { url: [{ schemes: ['http', 'https'] }] });

loadInitialState();
