const PopupIvanti = {
  init(elements) {
    elements.toggleSwitch.addEventListener('change', () => {
      chrome.storage.local.set({ isEnabled: elements.toggleSwitch.checked });
    });
  }
};
