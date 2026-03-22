const MENLO_PREFIX = "https://safe.menlosecurity.com/";

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    forceMenloListDiv: document.getElementById('forceMenloList'),
    newUrlInput: document.getElementById('newUrlInput'),
    addUrlBtn: document.getElementById('addUrlBtn'),
    openWithMenloBtn: document.getElementById('openWithMenloBtn'),
    languageSelect: document.getElementById('language-select'),
    messageArea: document.getElementById('messageArea'),
    vpnModeSelect: document.getElementById('vpnModeSelect'),
    globalSection: document.getElementById('globalSection'),
    ivantiSection: document.getElementById('ivantiSection'),
    // Global-specific
    vpnPolicyBanner: document.getElementById('vpnPolicyBanner'),
    vpnPolicyText: document.getElementById('vpnPolicyText'),
    refreshPolicyBtn: document.getElementById('refreshPolicyBtn'),
    policyModeSelect: document.getElementById('policyModeSelect'),
    // Ivanti-specific
    toggleSwitch: document.getElementById('toggleSwitch'),
    forceMenloToggle: document.getElementById('forceMenloToggle'),
  };

  let translations = {};
  let messageTimer = null;
  let currentMode = 'global';

  const i18n = (key) => {
    return translations[key] ? translations[key].message : `__${key}__`;
  };

  // Initialize mode-specific modules
  PopupGlobal.init(elements, i18n);
  PopupIvanti.init(elements);

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
    updateModeUI(currentMode);
  };

  const showMessage = (key, isError = true) => {
    if (messageTimer) clearTimeout(messageTimer);
    elements.messageArea.textContent = i18n(key);
    elements.messageArea.style.color = isError ? '#d63328' : '#008000';
    messageTimer = setTimeout(() => { elements.messageArea.textContent = ''; }, 2000);
  };

  elements.newUrlInput.addEventListener('input', () => {
    if (messageTimer) clearTimeout(messageTimer);
    elements.messageArea.textContent = '';
  });

  elements.languageSelect.addEventListener('change', async (event) => {
    const selectedLang = event.target.value;
    await chrome.storage.local.set({ language: selectedLang });
    await loadTranslations(selectedLang);
    applyTranslations();
  });

  const getForceListKey = (mode) => mode === 'global' ? 'forceMenloEnabledGlobal' : 'forceMenloEnabledIvanti';

  const updateModeUI = async (mode) => {
    currentMode = mode;
    const isGlobal = mode === 'global';

    elements.globalSection.style.display = isGlobal ? '' : 'none';
    elements.ivantiSection.style.display = isGlobal ? 'none' : '';

    // Load mode-specific force list toggle state
    const key = getForceListKey(mode);
    const data = await chrome.storage.local.get([key]);
    elements.forceMenloToggle.checked = data[key] !== false;
  };

  elements.vpnModeSelect.addEventListener('change', async () => {
    const mode = elements.vpnModeSelect.value;
    await chrome.storage.local.set({ vpnMode: mode });
    await updateModeUI(mode);
    if (mode === 'global') {
      const result = await PopupGlobal.checkPolicy();
      PopupGlobal.updateUI(result);
    }
  });

  elements.forceMenloToggle.addEventListener('change', async () => {
    const key = getForceListKey(currentMode);
    await chrome.storage.local.set({ [key]: elements.forceMenloToggle.checked });
  });

  // Listen for switching completion
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.vpnSwitching && changes.vpnSwitching.newValue === false && currentMode === 'global') {
      PopupGlobal.checkPolicy().then(result => PopupGlobal.updateUI(result));
    }
  });

  // --- Force list management ---
  let forceMenloList = [];

  const sanitizePattern = (url) => {
    if (!url) return null;
    return url.trim()
              .replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .replace(/\/$/, '');
  };

  const isValidPattern = (pattern) => {
    if (!pattern) return false;
    if (/\s/.test(pattern)) return false;
    if (!pattern.includes('.')) return false;
    if (pattern.startsWith('.') || pattern.endsWith('.') || pattern.startsWith('/')) return false;
    if (pattern.includes('/') && pattern.split('/')[0] === '') return false;
    return true;
  };

  const renderList = () => {
    elements.forceMenloListDiv.innerHTML = '';
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
      elements.forceMenloListDiv.appendChild(listItem);
    });
  };

  const addUrl = async () => {
    try {
      const rawInput = elements.newUrlInput.value;
      if (!rawInput || rawInput.trim() === '') {
        elements.newUrlInput.value = '';
        return;
      }
      const newPattern = sanitizePattern(rawInput);
      if (!isValidPattern(newPattern)) {
        showMessage('urlFormatInvalid', true);
        return;
      }
      if (forceMenloList.includes(newPattern)) {
        showMessage('urlAlreadyExists', true);
      } else {
        forceMenloList.push(newPattern);
        await chrome.storage.local.set({ forceMenloList });
        elements.newUrlInput.value = '';
        renderList();
      }
    } catch (e) {
      console.error('[Smart Menlo] Error adding URL:', e);
    }
  };

  const deleteUrl = async (index) => {
    try {
      forceMenloList.splice(index, 1);
      await chrome.storage.local.set({ forceMenloList });
      renderList();
    } catch (e) {
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
          if (!isValidPattern(newPattern)) {
            showMessage('urlFormatInvalid', true);
            renderList();
            return;
          }
          forceMenloList[index] = newPattern;
          await chrome.storage.local.set({ forceMenloList });
        }
      } catch (e) {
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

  elements.addUrlBtn.addEventListener('click', addUrl);
  elements.newUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addUrl();
  });

  elements.openWithMenloBtn.addEventListener('click', async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        const currentTab = tabs[0];
        const currentUrl = currentTab.url;
        if (currentUrl.startsWith('http') && !currentUrl.startsWith(MENLO_PREFIX)) {
          const menloUrl = MENLO_PREFIX + currentUrl;
          await chrome.storage.session.set({ [currentTab.id.toString()]: true });
          await chrome.tabs.update(currentTab.id, { url: menloUrl });
          window.close();
        } else {
          showMessage('urlCannotRedirect', true);
        }
      }
    } catch (e) {
      console.error('[Smart Menlo] Error in openWithMenloBtn click:', e);
    }
  });

  const initializePopup = async () => {
    const data = await chrome.storage.local.get(['language', 'vpnMode', 'isEnabled', 'forceMenloList']);

    const lang = data.language || chrome.i18n.getUILanguage().split('-')[0] || 'en';
    elements.languageSelect.value = lang;

    const mode = data.vpnMode || 'global';
    currentMode = mode;
    elements.vpnModeSelect.value = mode;

    elements.toggleSwitch.checked = data.isEnabled !== false;

    // Apply mode UI immediately before translations to avoid flash
    await updateModeUI(mode);

    await loadTranslations(lang);
    applyTranslations();

    if (mode === 'global') {
      const stored = await chrome.storage.local.get(['vpnSwitching', 'vpnConnected', 'vpnPolicy']);
      if (stored.vpnSwitching) {
        PopupGlobal.showSwitching(stored.vpnSwitching);
      } else {
        // Show cached state immediately
        PopupGlobal.updateUI({ connected: !!stored.vpnConnected, policy: stored.vpnPolicy || '' });
        // Then refresh from server
        PopupGlobal.checkPolicy().then(result => PopupGlobal.updateUI(result));
      }
    }

    forceMenloList = data.forceMenloList || [];
    renderList();
  };

  initializePopup();
});
