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
      if (vpnPolicyProd !== isProd) {
        vpnPolicyProd = isProd;
        await chrome.storage.local.set({ vpnPolicyProd: isProd });
        log(`[Smart Menlo] VPN policy updated: ${data.policy} (auto-redirect: ${isProd ? 'ON' : 'OFF'})`);
      }
    } else {
      if (vpnPolicyProd !== false) {
        vpnPolicyProd = false;
        await chrome.storage.local.set({ vpnPolicyProd: false });
        log('[Smart Menlo] VPN policy endpoint not reachable, setting vpnPolicyProd to false.');
      }
    }
  } catch (e) {
    if (vpnPolicyProd !== false) {
      vpnPolicyProd = false;
      await chrome.storage.local.set({ vpnPolicyProd: false });
    }
    log('[Smart Menlo] VPN policy check failed (endpoint unreachable), vpnPolicyProd set to false.');
  }
};

const handleBeforeNavigateGlobal = async (tabId, url) => {
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

      if (!vpnPolicyProd) {
        log('[Smart Menlo] VPN policy is not prod. Stripping Menlo prefix.');
        await chrome.storage.session.set({ [tabId.toString()]: true });
        chrome.tabs.update(tabId, { url: originalUrlString });
        return;
      }

      if (!tabState[tabId.toString()]) {
        log('[Smart Menlo] VPN auto-redirect detected (no session flag). Confirming vpnPolicyProd = true.');
      }

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

  if (!vpnPolicyProd) {
    return;
  }

  if (isUrlForced(url)) {
    log(`[Smart Menlo] URL is in force list. Redirecting tab ${tabId} to Menlo.`);
    await chrome.storage.session.set({ [tabId.toString()]: true });
    chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
  }
};
