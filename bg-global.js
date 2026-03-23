const VPN_POLICY_URL = "https://selka.onkakao.net/sase/policy";

const checkVpnPolicy = async () => {
  if (vpnMode !== 'global') return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(VPN_POLICY_URL, { cache: 'no-cache', signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      const isProd = data.policy === 'prod';
      vpnConnected = true;
      if (vpnPolicyProd !== isProd) {
        vpnPolicyProd = isProd;
        await chrome.storage.local.set({ vpnPolicyProd: isProd, vpnConnected: true, vpnPolicy: data.policy });
        log(`[Smart Menlo] VPN policy updated: ${data.policy} (auto-redirect: ${isProd ? 'ON' : 'OFF'})`);
      } else {
        await chrome.storage.local.set({ vpnConnected: true, vpnPolicy: data.policy });
      }
      updateBadge();
    } else {
      vpnConnected = false;
      vpnPolicyProd = false;
      await chrome.storage.local.set({ vpnPolicyProd: false, vpnConnected: false, vpnPolicy: '' });
      updateBadge();
    }
  } catch (e) {
    vpnConnected = false;
    vpnPolicyProd = false;
    await chrome.storage.local.set({ vpnPolicyProd: false, vpnConnected: false, vpnPolicy: '' });
    updateBadge();
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
      // In prod — VPN auto-redirect is active, don't interfere
    }
    return;
  }

  if (!vpnPolicyProd) return;

  if (isUrlForced(url)) {
    await redirectTab(tabId, MENLO_PREFIX + url);
  }
};
