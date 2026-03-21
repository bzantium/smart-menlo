const PopupIvanti = {
  toggleSwitch: null,
  switchStatus: null,
  forceMenloToggle: null,

  init(elements, i18n) {
    this.toggleSwitch = elements.toggleSwitch;
    this.switchStatus = elements.switchStatus;
    this.forceMenloToggle = elements.forceMenloToggle;
    this._i18n = i18n;

    this.toggleSwitch.addEventListener('change', () => {
      const isEnabled = this.toggleSwitch.checked;
      chrome.storage.local.set({ isEnabled });
      this.updateStatusText(isEnabled);
    });

    this.forceMenloToggle.addEventListener('change', () => {
      chrome.storage.local.set({ forceMenloEnabled: this.forceMenloToggle.checked });
    });
  },

  updateStatusText() {
  }
};
