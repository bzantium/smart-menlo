const handleBeforeNavigateIvanti = async (tabId, url) => {
  if (!isEnabled) {
    log('[Smart Menlo] Extension is disabled, skipping.');
    return;
  }

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

  if (isUrlForced(url)) {
    log(`[Smart Menlo] URL is in force list. Redirecting tab ${tabId} to Menlo.`);
    await chrome.storage.session.set({ [tabId.toString()]: true });
    chrome.tabs.update(tabId, { url: MENLO_PREFIX + url });
  }
};
