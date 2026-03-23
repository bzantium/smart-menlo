const VPN_POLICY_URL = "https://selka.onkakao.net/sase/policy";
const NATIVE_HOST_NAME = "com.smartmenlo.sessiond";
const VPN_SESSION_DURATION = 9 * 60 * 60 * 1000;
const VPN_DISCONNECTED_STATE = { vpnPolicyProd: false, vpnConnected: false, vpnPolicy: '', vpnSessionStart: 0 };

const queryNativeVpnSession = () => {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, { action: "getVpnSession" }, (response) => {
        if (chrome.runtime.lastError) {
          log('[Smart Menlo] Native host unavailable:', chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      resolve(null);
    }
  });
};

const clearVpnState = async () => {
  vpnConnected = false;
  vpnPolicyProd = false;
  await chrome.storage.local.set(VPN_DISCONNECTED_STATE);
  updateBadge();
};

const checkVpnPolicy = async () => {
  if (vpnMode !== 'global') return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const [response, stored] = await Promise.all([
      fetch(VPN_POLICY_URL, { cache: 'no-cache', signal: controller.signal }),
      chrome.storage.local.get('vpnSessionStart')
    ]);
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      const isProd = data.policy === 'prod';
      vpnConnected = true;
      const storageUpdate = { vpnConnected: true, vpnPolicy: data.policy };

      if (!stored.vpnSessionStart) {
        const nativeInfo = await queryNativeVpnSession();
        if (nativeInfo && nativeInfo.connected && nativeInfo.sessionStart) {
          storageUpdate.vpnSessionStart = nativeInfo.sessionStart;
          log('[Smart Menlo] VPN session start from native host:', new Date(nativeInfo.sessionStart).toLocaleTimeString());
        } else {
          storageUpdate.vpnSessionStart = Date.now();
          log('[Smart Menlo] VPN session start estimated (native host unavailable).');
        }
      }

      if (vpnPolicyProd !== isProd) {
        vpnPolicyProd = isProd;
        storageUpdate.vpnPolicyProd = isProd;
        log(`[Smart Menlo] VPN policy updated: ${data.policy} (auto-redirect: ${isProd ? 'ON' : 'OFF'})`);
      }
      await chrome.storage.local.set(storageUpdate);
      updateBadge();
    } else {
      await clearVpnState();
    }
  } catch (e) {
    await clearVpnState();
  }
};

const handleBeforeNavigateGlobal = async (tabId, url) => {
  if (await checkSessionFlag(tabId)) return;

  if (url.startsWith(MENLO_PREFIX)) {
    const pathAfterPrefix = url.substring(MENLO_PREFIX.length);
    if (pathAfterPrefix.startsWith('http://') || pathAfterPrefix.startsWith('https://')) {
      if (!vpnPolicyProd) {
        await redirectTab(tabId, pathAfterPrefix);
        return;
      }
    }
    return;
  }

  if (!vpnPolicyProd) return;

  if (isUrlForced(url)) {
    await redirectTab(tabId, MENLO_PREFIX + url);
  }
};
