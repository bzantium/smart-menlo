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
    }
    if (changes.vpnPolicyProd) {
      vpnPolicyProd = changes.vpnPolicyProd.newValue;
      log(`[Smart Menlo] vpnPolicyProd state updated to: ${vpnPolicyProd}`);
    }
    if (changes.isEnabled) {
      isEnabled = changes.isEnabled.newValue;
      log(`[Smart Menlo] isEnabled state updated to: ${isEnabled}`);
    }
    if (changes.forceMenloEnabled) {
      forceMenloEnabled = changes.forceMenloEnabled.newValue;
      log(`[Smart Menlo] forceMenloEnabled state updated to: ${forceMenloEnabled}`);
    }
    if (changes.forceMenloList) {
      forceMenloList = changes.forceMenloList.newValue || [];
      log('[Smart Menlo] forceMenloList reloaded:', forceMenloList);
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'switchPolicyMode') {
    (async () => {
      try {
        log('[Smart Menlo] Switching policy mode to:', message.mode);
        const endpoint = message.mode === 'prod'
          ? 'https://selka.onkakao.net/sase/prod'
          : 'https://selka.onkakao.net/sase/default';
        await fetch(endpoint, { method: 'POST', cache: 'no-cache' });
        await checkVpnPolicy();
      } catch (e) {
        log('[Smart Menlo] Policy mode switch failed:', e);
      }
      await chrome.storage.local.set({ vpnSwitching: false });
    })();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  log(`[Smart Menlo] Tab ${tabId} removed, clearing session data.`);
  chrome.storage.session.remove(tabId.toString()).catch(e => error(`[Smart Menlo] Error clearing session data for tab ${tabId}:`, e));
});

const loadInitialState = async () => {
  log('[Smart Menlo] Loading initial state.');
  try {
    const data = await chrome.storage.local.get(['forceMenloList', 'vpnPolicyProd', 'isEnabled', 'forceMenloEnabled', 'vpnMode']);
    forceMenloList = data.forceMenloList || [];
    vpnPolicyProd = data.vpnPolicyProd || false;
    isEnabled = data.isEnabled !== false;
    forceMenloEnabled = data.forceMenloEnabled !== false;
    vpnMode = data.vpnMode || 'global';
    log('[Smart Menlo] State loaded:', { vpnMode, vpnPolicyProd, isEnabled, forceMenloEnabled, forceMenloList });
    await chrome.storage.local.set({ vpnSwitching: false });
    await checkVpnPolicy();
  } catch (e) {
    error('[Smart Menlo] Error loading initial state:', e);
  }
};

chrome.webNavigation.onBeforeNavigate.addListener(handleBeforeNavigate);
chrome.webNavigation.onErrorOccurred.addListener(handleError, { url: [{ schemes: ['http', 'https'] }] });

loadInitialState();
