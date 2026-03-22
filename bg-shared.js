const log = (...args) => {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...args);
};

const error = (...args) => {
  console.error(`[${new Date().toLocaleTimeString()}]`, ...args);
};

const MENLO_PREFIX = "https://safe.menlosecurity.com/";
const KEEPALIVE_ALARM_NAME = 'smart-menlo-keepalive';

let forceMenloList = [];
let vpnPolicyProd = false;
let isEnabled = true;
let forceMenloEnabledGlobal = true;
let forceMenloEnabledIvanti = true;
let vpnMode = 'global';

const checkSessionFlag = async (tabId) => {
  const key = tabId.toString();
  const tabState = await chrome.storage.session.get(key);
  if (tabState[key]) {
    log(`[Smart Menlo] Tab ${tabId} has a session flag, removing it and allowing navigation.`);
    await chrome.storage.session.remove(key);
    return true;
  }
  return false;
};

const redirectTab = async (tabId, url) => {
  await chrome.storage.session.set({ [tabId.toString()]: true });
  chrome.tabs.update(tabId, { url });
};

const setIconWithDot = async (color) => {
  const size = 48;
  const dotRadius = 10;
  const dotX = size - dotRadius;
  const dotY = size - dotRadius;

  try {
    const response = await fetch(chrome.runtime.getURL('assets/icon48.png'));
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, size, size);

    // White border
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Color dot
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    const imageData = ctx.getImageData(0, 0, size, size);
    chrome.action.setIcon({ imageData: { 48: imageData } });
  } catch (e) {
    log('[Smart Menlo] Failed to set icon with dot:', e);
  }
};

const updateBadge = () => {
  chrome.action.setBadgeText({ text: '' });
  if (vpnMode === 'global') {
    if (vpnPolicyProd) {
      setIconWithDot('#2e7d32');
    } else {
      chrome.storage.local.get(['vpnConnected'], (data) => {
        setIconWithDot(data.vpnConnected ? '#1565c0' : '#999');
      });
    }
  } else {
    setIconWithDot(isEnabled ? '#2e7d32' : '#999');
  }
};

const isUrlForced = (url) => {
  const forceMenloEnabled = vpnMode === 'global' ? forceMenloEnabledGlobal : forceMenloEnabledIvanti;
  if (!forceMenloEnabled || forceMenloList.length === 0) {
    log('[Smart Menlo] isUrlForced: Force Menlo list is disabled.');
    return false;
  }
  if (!url || !url.startsWith('http')) {
    log('[Smart Menlo] isUrlForced: URL is invalid or not HTTP/HTTPS.', url);
    return false;
  }
  try {
    const currentUrl = new URL(url);
    const currentHostname = currentUrl.hostname;
    const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
    const isForced = forceMenloList.some(pattern => {
      if (pattern.includes('/')) {
        const check = (targetUrl, p) => {
          if (targetUrl.startsWith(p)) {
            const charAfterPattern = targetUrl[p.length];
            return charAfterPattern === undefined || ['/', '?', '#'].includes(charAfterPattern);
          }
          return false;
        };
        const isMatch = check(urlWithoutProtocol, pattern) || (urlWithoutProtocol.startsWith('www.') && check(urlWithoutProtocol.substring(4), pattern));
        if (isMatch) log(`[Smart Menlo] isUrlForced: URL matched path pattern '${pattern}'. URL: ${url}`);
        return isMatch;
      } else {
        const isMatch = currentHostname === pattern || currentHostname.endsWith('.' + pattern);
        if (isMatch) log(`[Smart Menlo] isUrlForced: URL matched subdomain pattern '${pattern}'. URL: ${url}`);
        return isMatch;
      }
    });
    return isForced;
  } catch (e) {
    error(`[Smart Menlo] URL parsing error in isUrlForced for URL: ${url}`, e);
    return false;
  }
};
