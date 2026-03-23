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
let vpnConnected = false;
let _blinkInterval = null;
let _iconBitmapCache = null;

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

const getIconBitmap = async () => {
  if (_iconBitmapCache) return _iconBitmapCache;
  const response = await fetch(chrome.runtime.getURL('assets/icon48.png'));
  const blob = await response.blob();
  _iconBitmapCache = await createImageBitmap(blob);
  return _iconBitmapCache;
};

const renderIcon = async (color) => {
  const size = 48;
  const bitmap = await getIconBitmap();
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, size, size);

  if (color) {
    const dotRadius = 10;
    const dotX = size - dotRadius - 2;
    const dotY = dotRadius + 2;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  const imageData = ctx.getImageData(0, 0, size, size);
  chrome.action.setIcon({ imageData: { 48: imageData } });
};

const setIconWithDot = (color) => renderIcon(color);

const stopBlink = () => {
  if (_blinkInterval) {
    clearInterval(_blinkInterval);
    _blinkInterval = null;
  }
};

const startBlink = (color, intervalMs) => {
  stopBlink();
  let visible = true;
  renderIcon(color);
  _blinkInterval = setInterval(() => {
    visible = !visible;
    renderIcon(visible ? color : null);
  }, intervalMs);
};

const updateBadge = async () => {
  chrome.action.setBadgeText({ text: '' });
  stopBlink();

  if (vpnMode === 'global' && (vpnPolicyProd || vpnConnected)) {
    const color = vpnPolicyProd ? '#e67e22' : '#42a5f5';
    const data = await chrome.storage.local.get('vpnSessionStart');
    const sessionStart = data.vpnSessionStart;

    if (sessionStart && typeof VPN_SESSION_DURATION !== 'undefined') {
      const remaining = VPN_SESSION_DURATION - (Date.now() - sessionStart);
      if (remaining <= 10 * 60 * 1000) {
        startBlink('#f44336', 500);
        return;
      } else if (remaining <= 60 * 60 * 1000) {
        startBlink('#ff9800', 1500);
        return;
      }
    }
    renderIcon(color);
  } else {
    renderIcon(null);
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
