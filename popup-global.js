const PopupGlobal = {
  vpnPolicyBanner: null,
  vpnPolicyText: null,
  refreshPolicyBtn: null,
  policyModeSelect: null,

  init(elements, i18n) {
    this.vpnPolicyBanner = elements.vpnPolicyBanner;
    this.vpnPolicyText = elements.vpnPolicyText;
    this.refreshPolicyBtn = elements.refreshPolicyBtn;
    this.policyModeSelect = elements.policyModeSelect;
    this._i18n = i18n;

    this.refreshPolicyBtn.addEventListener('click', async () => {
      this.refreshPolicyBtn.classList.add('spinning');
      const result = await this.checkPolicy();
      this.updateUI(result);
      setTimeout(() => this.refreshPolicyBtn.classList.remove('spinning'), 600);
    });

    this.policyModeSelect.addEventListener('change', async () => {
      const targetMode = this.policyModeSelect.value;
      this.showSwitching(targetMode);
      await chrome.storage.local.set({ vpnSwitching: targetMode });

      // Send to background (survives popup close)
      chrome.runtime.sendMessage({ action: 'switchPolicyMode', mode: targetMode }).catch(() => {});
    });
  },

  showSwitching(targetMode) {
    this.policyModeSelect.disabled = true;
    this.refreshPolicyBtn.disabled = true;
    const from = targetMode === 'prod' ? 'dev' : 'prod';
    const to = targetMode === 'prod' ? 'prod' : 'dev';
    this.vpnPolicyText.textContent = `Switching (${from} → ${to})`;
    this.vpnPolicyBanner.className = 'vpn-policy-banner switching';
  },

  updateUI({ connected, policy }) {
    this.policyModeSelect.disabled = false;
    this.refreshPolicyBtn.disabled = false;
    if (connected) {
      const isProd = policy === 'prod';
      this.vpnPolicyBanner.className = 'vpn-policy-banner ' + (isProd ? 'prod' : 'dev');
      this.vpnPolicyText.textContent = `VPN: On (${isProd ? 'prod' : 'dev'})`;
      this.policyModeSelect.value = isProd ? 'prod' : 'default';
      this.policyModeSelect.disabled = false;
    } else {
      this.vpnPolicyBanner.className = 'vpn-policy-banner inactive';
      this.vpnPolicyText.textContent = 'VPN: Off';
      this.policyModeSelect.disabled = true;
    }
  },

  async checkPolicy() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch('https://selka.onkakao.net/sase/policy', {
        cache: 'no-cache',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        const policy = data.policy || '';
        await chrome.storage.local.set({ vpnPolicyProd: policy === 'prod', vpnConnected: true, vpnPolicy: policy });
        return { connected: true, policy };
      }
    } catch (e) {
      console.log('[Smart Menlo] Popup VPN policy check failed:', e);
    }
    await chrome.storage.local.set({ vpnPolicyProd: false, vpnConnected: false, vpnPolicy: '' });
    return { connected: false, policy: '' };
  }
};
