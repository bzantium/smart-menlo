document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const switchStatus = document.getElementById('switchStatus');
  const forceMenloListDiv = document.getElementById('forceMenloList');
  const newUrlInput = document.getElementById('newUrlInput');
  const addUrlBtn = document.getElementById('addUrlBtn');
  const languageSelect = document.getElementById('language-select');

  let translations = {}; // This will hold our loaded translation messages

  // Helper function to get a string from our loaded translations
  const i18n = (key) => {
    return translations[key] ? translations[key].message : `__${key}__`;
  };

  // Fetches the correct messages.json file based on the selected language
  const loadTranslations = async (locale) => {
    try {
      const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
      const response = await fetch(url);
      if (!response.ok) {
        // If the language file doesn't exist, fall back to English
        console.warn(`[Smart Menlo] Locale file for '${locale}' not found. Falling back to 'en'.`);
        const fallbackUrl = chrome.runtime.getURL(`_locales/en/messages.json`);
        const fallbackResponse = await fetch(fallbackUrl);
        translations = await fallbackResponse.json();
      } else {
        translations = await response.json();
      }
    } catch (error) {
      console.error('[Smart Menlo] Error loading translation file:', error);
    }
  };

  // Applies the loaded translations to all elements in the popup
  const applyTranslations = () => {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
      const key = elem.getAttribute('data-i18n');
      elem.textContent = i18n(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
      const key = elem.getAttribute('data-i18n-placeholder');
      elem.placeholder = i18n(key);
    });
    // Re-apply translation for the dynamic status text
    updateStatusText(toggleSwitch.checked);
  };

  // Updates the status text next to the toggle switch
  function updateStatusText(isEnabled) {
    switchStatus.textContent = isEnabled ? i18n('enable') : i18n('disable');
    switchStatus.style.color = isEnabled ? '#d63328' : '#888';
  }
  
  // --- Event Listeners and Initial Setup ---

  languageSelect.addEventListener('change', async (event) => {
    const selectedLang = event.target.value;
    await chrome.storage.local.set({ language: selectedLang });
    await loadTranslations(selectedLang);
    applyTranslations();
  });

  toggleSwitch.addEventListener('change', () => {
    const isEnabled = toggleSwitch.checked;
    try {
      chrome.storage.local.set({ isEnabled: isEnabled });
      updateStatusText(isEnabled);
    } catch (e) {
      console.log('[Smart Menlo] Error saving enabled state:', e);
    }
  });

  // --- Logic for the URL list (no changes needed here) ---

  let forceMenloList = [];

  const sanitizePattern = (url) => {
    if (!url) return null;
    return url.trim()
              .replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .replace(/\/$/, '');
  };

  const loadAndRenderList = () => {
    try {
      chrome.storage.local.get('forceMenloList', (data) => {
        forceMenloList = data.forceMenloList || [];
        renderList();
      });
    } catch(e) {
      console.log('[Smart Menlo] Error loading force list:', e);
    }
  };

  const renderList = () => {
    forceMenloListDiv.innerHTML = '';
    forceMenloList.forEach((pattern, index) => {
      const listItem = document.createElement('div');
      listItem.className = 'list-item';
      const urlSpan = document.createElement('span');
      urlSpan.textContent = pattern;
      urlSpan.addEventListener('click', () => editUrl(index, listItem));
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', () => deleteUrl(index));
      listItem.appendChild(urlSpan);
      listItem.appendChild(deleteBtn);
      forceMenloListDiv.appendChild(listItem);
    });
  };

  const addUrl = () => {
    try {
      const newPattern = sanitizePattern(newUrlInput.value);
      if (newPattern && !forceMenloList.includes(newPattern)) {
        forceMenloList.push(newPattern);
        chrome.storage.local.set({ forceMenloList: forceMenloList }, () => {
          newUrlInput.value = '';
          renderList();
        });
      }
    } catch(e) {
      console.log('[Smart Menlo] Error adding URL:', e);
    }
  };

  const deleteUrl = (index) => {
    try {
      forceMenloList.splice(index, 1);
      chrome.storage.local.set({ forceMenloList: forceMenloList }, renderList);
    } catch(e) {
      console.log('[Smart Menlo] Error deleting URL:', e);
    }
  };

  const editUrl = (index, listItem) => {
    const urlSpan = listItem.querySelector('span');
    const currentPattern = urlSpan.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentPattern;
    listItem.replaceChild(input, urlSpan);
    input.focus();
    const saveChanges = () => {
      try {
        const newPattern = sanitizePattern(input.value);
        if (newPattern && newPattern !== currentPattern && !forceMenloList.includes(newPattern)) {
          forceMenloList[index] = newPattern;
          chrome.storage.local.set({ forceMenloList: forceMenloList }, renderList);
        } else {
          renderList();
        }
      } catch(e) {
        console.log('[Smart Menlo] Error editing URL:', e);
        renderList();
      }
    };
    input.addEventListener('blur', saveChanges);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      else if (e.key === 'Escape') renderList();
    });
  };

  addUrlBtn.addEventListener('click', addUrl);
  newUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addUrl();
  });

  // --- Main function to initialize the popup ---

  const initializePopup = async () => {
    const data = await chrome.storage.local.get(['language', 'isEnabled']);
    
    // 1. Set language (saved > browser > default 'en')
    const lang = data.language || chrome.i18n.getUILanguage().split('-')[0] || 'en';
    languageSelect.value = lang;
    
    // 2. Load and apply translations
    await loadTranslations(lang);
    applyTranslations();
    
    // 3. Set toggle switch state
    toggleSwitch.checked = typeof data.isEnabled === 'undefined' ? true : !!data.isEnabled;
    updateStatusText(toggleSwitch.checked);

    // 4. Load the URL list
    loadAndRenderList();
  };

  initializePopup();
});