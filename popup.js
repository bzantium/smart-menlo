document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const switchStatus = document.getElementById('switchStatus');
  const forceMenloListDiv = document.getElementById('forceMenloList');
  const newUrlInput = document.getElementById('newUrlInput');
  const addUrlBtn = document.getElementById('addUrlBtn');
  const languageSelect = document.getElementById('language-select');
  const messageArea = document.getElementById('messageArea');

  let translations = {};
  let messageTimer = null;

  const i18n = (key) => {
    return translations[key] ? translations[key].message : `__${key}__`;
  };

  const loadTranslations = async (locale) => {
    try {
      let url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
      let response = await fetch(url);
      if (!response.ok) {
        console.warn(`[Smart Menlo] Locale file for '${locale}' not found. Falling back to 'en'.`);
        url = chrome.runtime.getURL(`_locales/en/messages.json`);
        response = await fetch(url);
      }
      translations = await response.json();
    } catch (error) {
      console.error('[Smart Menlo] Error loading translation file:', error);
      const fallbackUrl = chrome.runtime.getURL(`_locales/en/messages.json`);
      const fallbackResponse = await fetch(fallbackUrl);
      translations = await fallbackResponse.json();
    }
  };

  const applyTranslations = () => {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
      const key = elem.getAttribute('data-i18n');
      elem.textContent = i18n(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
      const key = elem.getAttribute('data-i18n-placeholder');
      elem.placeholder = i18n(key);
    });
    updateStatusText(toggleSwitch.checked);
  };

  function updateStatusText(isEnabled) {
    switchStatus.textContent = isEnabled ? i18n('enable') : i18n('disable');
    switchStatus.style.color = isEnabled ? '#d63328' : '#888';
  }

  const showMessage = (key, isError = true) => {
    if (messageTimer) {
      clearTimeout(messageTimer);
    }
    messageArea.textContent = i18n(key);
    messageArea.style.color = isError ? '#d63328' : '#008000'; // Error or Success
    
    messageTimer = setTimeout(() => {
      messageArea.textContent = '';
    }, 2000);
  };
  
  newUrlInput.addEventListener('input', () => {
     if (messageTimer) {
       clearTimeout(messageTimer);
     }
     messageArea.textContent = '';
  });

  languageSelect.addEventListener('change', async (event) => {
    const selectedLang = event.target.value;
    await chrome.storage.local.set({ language: selectedLang });
    await loadTranslations(selectedLang);
    applyTranslations();
  });

  toggleSwitch.addEventListener('change', () => {
    const isEnabled = toggleSwitch.checked;
    chrome.storage.local.set({ isEnabled: isEnabled });
    updateStatusText(isEnabled);
  });

  let forceMenloList = [];

  const sanitizePattern = (url) => {
    if (!url) return null;
    return url.trim()
              .replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .replace(/\/$/, '');
  };

  const loadAndRenderList = async () => {
    try {
      const data = await chrome.storage.local.get('forceMenloList');
      forceMenloList = data.forceMenloList || [];
      renderList();
    } catch(e) {
      console.error('[Smart Menlo] Error loading force list:', e);
    }
  };

  const renderList = () => {
    forceMenloListDiv.innerHTML = '';
    forceMenloList.forEach((pattern, index) => {
      const listItem = document.createElement('div');
      listItem.className = 'list-item';

      const urlSpan = document.createElement('span');
      urlSpan.textContent = pattern;
      urlSpan.title = pattern;
      urlSpan.addEventListener('click', () => editUrl(index, listItem));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = i18n('deleteUrlTitle');
      deleteBtn.addEventListener('click', () => deleteUrl(index));

      listItem.appendChild(urlSpan);
      listItem.appendChild(deleteBtn);
      forceMenloListDiv.appendChild(listItem);
    });
  };

  const addUrl = async () => {
    try {
      const newPattern = sanitizePattern(newUrlInput.value);
      if (!newPattern) {
        return;
      }
      
      if (forceMenloList.includes(newPattern)) {
        showMessage('urlAlreadyExists', true);
      } else {
        forceMenloList.push(newPattern);
        await chrome.storage.local.set({ forceMenloList: forceMenloList });
        newUrlInput.value = '';
        renderList();
      }
    } catch(e) {
      console.error('[Smart Menlo] Error adding URL:', e);
    }
  };

  const deleteUrl = async (index) => {
    try {
      forceMenloList.splice(index, 1);
      await chrome.storage.local.set({ forceMenloList: forceMenloList });
      renderList();
    } catch(e) {
      console.error('[Smart Menlo] Error deleting URL:', e);
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

    const saveChanges = async () => {
      try {
        const newPattern = sanitizePattern(input.value);
        if (newPattern && newPattern !== currentPattern && !forceMenloList.includes(newPattern)) {
          forceMenloList[index] = newPattern;
          await chrome.storage.local.set({ forceMenloList: forceMenloList });
        }
      } catch(e) {
        console.error('[Smart Menlo] Error editing URL:', e);
      } finally {
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

  const initializePopup = async () => {
    const data = await chrome.storage.local.get(['language', 'isEnabled']);
    
    const lang = data.language || chrome.i18n.getUILanguage().split('-')[0] || 'en';
    languageSelect.value = lang;

    toggleSwitch.checked = data.isEnabled !== false;

    await loadTranslations(lang);
    applyTranslations();
    
    await loadAndRenderList();
  };

  initializePopup();
});