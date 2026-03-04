// ==UserScript==
// @name         Novelpia EP Filter
// @namespace    https://novelpia.com
// @version      0.1.0
// @description  노벨피아 Top100 페이지에서 최소 편수 및 완결 작품을 필터링합니다.
// @match        https://novelpia.com/top100*
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // 최소 편수 저장 키
  /** @type {string} */
  const STORAGE_KEY_EP = 'novelpia_min_ep';

  // 완결 제외 저장 키
  /** @type {string} */
  const STORAGE_KEY_COMPLETE = 'novelpia_exclude_complete';

  // 작품 카드 셀렉터
  /** @type {string} */
  const CARD_SELECTOR = '.novelbox.mobile_hidden';

  // 편수 표시 셀렉터
  /** @type {string} */
  const EP_SELECTOR = '.thumb_s2';

  // 완결 표시 셀렉터
  /** @type {string} */
  const COMPLETE_SELECTOR = '.b_comp';

  // 작품 목록 컨테이너 셀렉터
  /** @type {string} */
  const LIST_CONTAINER_SELECTOR = '#top100_page';

  // 랭킹기준 앵커 셀렉터
  /** @type {string} */
  const RANK_INFO_SELECTOR = 'a.s_inv[href="/faq/49/view_2977790/"]';

  // 버튼 색상
  /** @type {string} */
  const BTN_COLOR = '#7c4dff';

  // UI 초기화 최대 시도 횟수
  /** @type {number} */
  const MAX_BOOT_TRIES = 20;

  // UI 초기화 폴링 간격 (ms)
  /** @type {number} */
  const BOOT_INTERVAL_MS = 250;

  // 앵커 높이를 구할 수 없을 때의 기본값 (px)
  /** @type {number} */
  const DEFAULT_ANCHOR_HEIGHT = 30;

  // 편수 입력창 너비 (px)
  /** @type {number} */
  const INPUT_WIDTH = 90;

  /** @type {number} 필터링된 작품 수 */
  let removedTotal = 0;

  /**
   * 텍스트에서 첫 번째 정수를 추출합니다.
   * @param {string|null|undefined} text
   * @returns {number|null}
   */
  const parseEp = (text) => {
    if (!text) return null;
    const match = text.match(/(\d+)/);
    return match ? Number(match[1]) : null;
  };

  /**
   * 저장된 최소 편수를 반환합니다.
   * @returns {number}
   */
  const getMinEp = () => {
    const stored = localStorage.getItem(STORAGE_KEY_EP);
    const parsed = stored ? Number(stored) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  /**
   * 최소 편수를 저장합니다.
   * @param {number} value
   */
  const setMinEp = (value) => {
    localStorage.setItem(STORAGE_KEY_EP, String(value));
  };

  /**
   * 완결 제외 여부를 반환합니다.
   * @returns {boolean}
   */
  const getExcludeComplete = () => {
    return localStorage.getItem(STORAGE_KEY_COMPLETE) === '1';
  };

  /**
   * 완결 제외 여부를 저장합니다.
   * @param {boolean} value
   */
  const setExcludeComplete = (value) => {
    localStorage.setItem(STORAGE_KEY_COMPLETE, value ? '1' : '0');
  };

  /**
   * 카드가 완결 작품인지 확인합니다.
   * @param {Element} card
   * @returns {boolean}
   */
  const isComplete = (card) => {
    return Boolean(card.querySelector(COMPLETE_SELECTOR));
  };

  /** 필터링 카운터를 갱신합니다. */
  const updateCounter = () => {
    const counter = document.getElementById('np-filter-count');
    if (counter) {
      counter.textContent = `${removedTotal}개 작품 필터링됨`;
    }
  };

  /**
   * 현재 목록에서 조건에 맞지 않는 작품을 제거합니다.
   * @param {number} minEp
   * @param {boolean} excludeComplete
   */
  const applyFilter = (minEp, excludeComplete) => {
    const container = document.querySelector(LIST_CONTAINER_SELECTOR);
    if (!container) return;

    const cards = container.querySelectorAll(CARD_SELECTOR);

    for (const card of cards) {
      if (card.dataset.epChecked === '1') continue;

      const epEl = card.querySelector(EP_SELECTOR);
      const ep = parseEp(epEl?.textContent?.trim());
      const complete = isComplete(card);

      if (excludeComplete && complete) {
        card.remove();
        removedTotal++;
        continue;
      }

      if (ep !== null && ep < minEp) {
        card.remove();
        removedTotal++;
        continue;
      }

      card.dataset.epChecked = '1';
    }

    updateCounter();
  };

  /**
   * 입력값을 최소 편수로 변환합니다.
   * @param {HTMLInputElement} input
   * @returns {number}
   */
  const parseInputValue = (input) => {
    const n = Number(input.value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  /**
   * 기준 UI 높이를 계산합니다.
   * @param {Element} anchor
   * @returns {number}
   */
  const resolveBaseHeight = (anchor) => {
    const rect = anchor.getBoundingClientRect();
    return rect.height ? Math.round(rect.height) : DEFAULT_ANCHOR_HEIGHT;
  };

  /**
   * 편수 입력 요소를 생성합니다.
   * @param {number} height
   * @returns {HTMLInputElement}
   */
  const createInput = (height) => {
    const input = document.createElement('input');

    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.placeholder = '최소 편수';
    input.value = String(getMinEp() || '');
    input.className = 'form-control';

    input.style.cssText = [
      `width:${INPUT_WIDTH}px`,
      'padding:4px 6px',
      `height:${height}px`,
      'font-size:13px',
      'box-sizing:border-box',
    ].join(';');

    return input;
  };

  /**
   * 완결 제외 체크박스를 생성합니다.
   * @param {number} height
   * @returns {HTMLLabelElement}
   */
  const createCompleteCheckbox = (height) => {
    const label = document.createElement('label');

    label.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:4px',
      `height:${height}px`,
      'color:#777',
      'font-size:13px',
      'cursor:pointer',
      'margin-top:8px',
    ].join(';');

    const checkbox = document.createElement('input');

    checkbox.type = 'checkbox';
    checkbox.checked = getExcludeComplete();

    checkbox.style.cssText = [
      'margin:0',
      'accent-color:#7c4dff',
    ].join(';');

    label.appendChild(checkbox);
    label.append('완결작 제외');

    return label;
  };

  /**
   * 적용 버튼을 생성합니다.
   * @param {number} height
   * @returns {HTMLButtonElement}
   */
  const createButton = (height) => {
    const btn = document.createElement('button');

    btn.type = 'button';
    btn.textContent = '적용';

    btn.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      `height:${height}px`,
      'padding:0 12px',
      'border:0',
      'border-radius:4px',
      `background:${BTN_COLOR}`,
      'color:#fff',
      'font-weight:600',
      'font-size:13px',
      'cursor:pointer',
      'box-sizing:border-box',
    ].join(';');

    return btn;
  };

  /**
   * 필터링 카운터 요소를 생성합니다.
   * @param {number} height
   * @returns {HTMLSpanElement}
   */
  const createCounter = (height) => {
    const counter = document.createElement('span');

    counter.id = 'np-filter-count';

    counter.style.cssText = [
      'color:#777',
      'font-size:12px',
      `line-height:${height}px`,
      'white-space:nowrap',
      'margin-top:-2px',
    ].join(';');

    return counter;
  };

  /**
   * UI를 삽입합니다.
   * @returns {boolean}
   */
  const ensureUi = () => {
    if (document.getElementById('np-filter-count')) return true;

    const anchor = document.querySelector(RANK_INFO_SELECTOR);
    if (!anchor) return false;

    const height = resolveBaseHeight(anchor);

    const wrapper = document.createElement('span');

    wrapper.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:6px',
      'margin-left:10px',
    ].join(';');

    const input = createInput(height);
    const checkboxLabel = createCompleteCheckbox(height);
    const checkbox = checkboxLabel.querySelector('input');
    const btn = createButton(height);
    const counter = createCounter(height);

    const onApply = () => {
      const minEp = parseInputValue(input);
      const excludeComplete = checkbox.checked;

      setMinEp(minEp);
      setExcludeComplete(excludeComplete);

      window.location.reload();
    };

    btn.addEventListener('click', onApply);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onApply();
    });

    wrapper.appendChild(input);
    wrapper.appendChild(checkboxLabel);
    wrapper.appendChild(btn);
    wrapper.appendChild(counter);

    anchor.insertAdjacentElement('afterend', wrapper);

    updateCounter();

    return true;
  };

  /**
   * MutationObserver를 설정합니다.
   */
  const setupObserver = () => {
    const container = document.querySelector(LIST_CONTAINER_SELECTOR);
    if (!container) return;

    const observer = new MutationObserver((mutations) => {
      const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);

      if (hasNewNodes) {
        applyFilter(getMinEp(), getExcludeComplete());
      }
    });

    observer.observe(container, {childList: true, subtree: true});
  };

  /**
   * 스크립트 초기화.
   */
  const boot = () => {
    let tries = 0;

    const timer = setInterval(() => {
      tries++;

      const ok = ensureUi();

      if (ok || tries >= MAX_BOOT_TRIES) {
        clearInterval(timer);
      }
    }, BOOT_INTERVAL_MS);

    applyFilter(getMinEp(), getExcludeComplete());

    setupObserver();
  };

  boot();

})();
