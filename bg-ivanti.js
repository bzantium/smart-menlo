const handleBeforeNavigateIvanti = async (tabId, url) => {
  if (!isEnabled) return;
  if (await checkSessionFlag(tabId)) return;

  if (url.startsWith(MENLO_PREFIX)) {
    const pathAfterPrefix = url.substring(MENLO_PREFIX.length);
    if (pathAfterPrefix.startsWith('http://') || pathAfterPrefix.startsWith('https://')) {
      if (!isUrlForced(pathAfterPrefix)) {
        await redirectTab(tabId, pathAfterPrefix);
      }
    }
    return;
  }

  if (isUrlForced(url)) {
    await redirectTab(tabId, MENLO_PREFIX + url);
  }
};
