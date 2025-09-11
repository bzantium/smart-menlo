document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const switchStatus = document.getElementById('switchStatus');
  const forceMenloListDiv = document.getElementById('forceMenloList');
  const newUrlInput = document.getElementById('newUrlInput');
  const addUrlBtn = document.getElementById('addUrlBtn');

  try {
    chrome.storage.local.get('isEnabled', (data) => {
      toggleSwitch.checked = typeof data.isEnabled === 'undefined' ? true : !!data.isEnabled;
      updateStatusText(toggleSwitch.checked);
    });
  } catch (e) {
    console.log('[Smart Menlo] 활성화 상태 로드 중 오류:', e);
  }

  toggleSwitch.addEventListener('change', () => {
    const isEnabled = toggleSwitch.checked;
    try {
      chrome.storage.local.set({ isEnabled: isEnabled });
      updateStatusText(isEnabled);
    } catch (e) {
      console.log('[Smart Menlo] 활성화 상태 저장 중 오류:', e);
    }
  });

  function updateStatusText(isEnabled) {
    switchStatus.textContent = isEnabled ? '활성화' : '비활성화';
    switchStatus.style.color = isEnabled ? '#d63328' : '#888';
  }

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
      console.log('[Smart Menlo] 강제 목록 로드 중 오류:', e);
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
      console.log('[Smart Menlo] URL 추가 중 오류:', e);
    }
  };

  const deleteUrl = (index) => {
    try {
      forceMenloList.splice(index, 1);
      chrome.storage.local.set({ forceMenloList: forceMenloList }, renderList);
    } catch(e) {
      console.log('[Smart Menlo] URL 삭제 중 오류:', e);
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
        console.log('[Smart Menlo] URL 수정 중 오류:', e);
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