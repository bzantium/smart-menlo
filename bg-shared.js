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
let forceMenloEnabled = true;
let vpnMode = 'global';

const isUrlForced = (url) => {
  if (!forceMenloEnabled) {
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
