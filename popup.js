document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const switchStatus = document.getElementById('switchStatus');

    // Load the saved state and update the switch and text
    chrome.storage.local.get('isEnabled', (data) => {
      toggleSwitch.checked = !!data.isEnabled;
      updateStatusText(toggleSwitch.checked);
    });
  
    // Save the state and update the text whenever the switch is toggled
    toggleSwitch.addEventListener('change', () => {
      const isEnabled = toggleSwitch.checked;
      chrome.storage.local.set({ isEnabled: isEnabled });
      updateStatusText(isEnabled);
    });
  
    function updateStatusText(isEnabled) {
      if (isEnabled) {
        switchStatus.textContent = 'Enabled';
        switchStatus.style.color = '#d63328';
      } else {
        switchStatus.textContent = 'Disabled';
        switchStatus.style.color = '#888';
      }
    }
  });