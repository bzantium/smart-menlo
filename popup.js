document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const switchStatus = document.getElementById('switchStatus');
  const forceMenloListDiv = document.getElementById('forceMenloList');
  const newUrlInput = document.getElementById('newUrlInput');
  const addUrlBtn = document.getElementById('addUrlBtn');

  // 활성화/비활성화 관련 코드는 기존과 동일
  chrome.storage.local.get('isEnabled', (data) => {
    toggleSwitch.checked = typeof data.isEnabled === 'undefined' ? true : !!data.isEnabled;
    updateStatusText(toggleSwitch.checked);
  });

  toggleSwitch.addEventListener('change', () => {
    const isEnabled = toggleSwitch.checked;
    chrome.storage.local.set({ isEnabled: isEnabled });
    updateStatusText(isEnabled);
  });

  function updateStatusText(isEnabled) {
    switchStatus.textContent = isEnabled ? '활성화' : '비활성화';
    switchStatus.style.color = isEnabled ? '#d63328' : '#888';
  }

  // --- Force Menlo List 관련 로직 ---

  let forceMenloList = [];

  /**
   * 입력된 URL 패턴을 정리합니다.
   * 1. http/https 프로토콜 제거
   * 2. www. 접두사 제거
   * 3. 마지막에 붙은 슬래시(/) 제거
   */
  const sanitizePattern = (url) => {
    if (!url) return null;
    return url.trim()
              .replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .replace(/\/$/, '');
  };

  const loadAndRenderList = () => {
    chrome.storage.local.get('forceMenloList', (data) => {
      forceMenloList = data.forceMenloList || [];
      renderList();
    });
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
    const newPattern = sanitizePattern(newUrlInput.value);
    if (newPattern && !forceMenloList.includes(newPattern)) {
      forceMenloList.push(newPattern);
      chrome.storage.local.set({ forceMenloList: forceMenloList }, () => {
        newUrlInput.value = '';
        renderList();
      });
    }
  };

  const deleteUrl = (index) => {
    forceMenloList.splice(index, 1);
    chrome.storage.local.set({ forceMenloList: forceMenloList }, renderList);
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
      const newPattern = sanitizePattern(input.value);
      if (newPattern && newPattern !== currentPattern && !forceMenloList.includes(newPattern)) {
        forceMenloList[index] = newPattern;
        chrome.storage.local.set({ forceMenloList: forceMenloList }, renderList);
      } else {
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

  loadAndRenderList();
});