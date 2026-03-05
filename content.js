// ==UserScript==
// @name         Novelpia EP Filter
// @namespace    https://novelpia.com
// @version      0.1.0
// @description  노벨피아 Top100 페이지에서 최소 편수 및 완결 작품을 필터링합니다.
// @match        https://novelpia.com/top100*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // 저장 키
  const STORAGE_KEY_EP = 'novelpia_min_ep';
  const STORAGE_KEY_COMPLETE = 'novelpia_exclude_complete';

  // DOM 셀렉터
  const CARD_SELECTOR = '.novelbox.mobile_hidden';
  const EP_SELECTOR = '.thumb_s2';
  const COMPLETE_SELECTOR = '.b_comp';
  const LIST_CONTAINER_SELECTOR = '#top100_page';
  const RANK_INFO_SELECTOR = 'a.s_inv[href="/faq/49/view_2977790/"]';

  // UI 식별자
  const FILTER_WRAPPER_ID = 'np-filter-ui';
  const FILTER_COUNTER_ID = 'np-filter-count';

  // UI/초기화 설정값
  const BTN_COLOR = '#7c4dff';
  const MAX_BOOT_TRIES = 20;
  const BOOT_INTERVAL_MS = 250;
  const DEFAULT_ANCHOR_HEIGHT = 30;
  const INPUT_WIDTH = 90;

  /** Observer 중복 등록 방지 플래그입니다. */
  let observerStarted = false;

  /**
   * 문자열에서 첫 번째 정수를 추출합니다.
   *
   * @param {string|null|undefined} text 원본 문자열
   * @return {number|null} 추출된 정수. 없으면 null
   */
  const parseEp = (text) => {
    if (!text) return null;
    const match = text.match(/(\d+)/);
    return match ? Number(match[1]) : null;
  };

  /**
   * 저장된 최소 편수를 읽습니다.
   *
   * @return {number} 최소 편수(유효하지 않으면 0)
   */
  const getMinEp = () => {
    const stored = localStorage.getItem(STORAGE_KEY_EP);
    const parsed = stored ? Number(stored) : 0;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  /**
   * 최소 편수를 저장합니다.
   *
   * @param {number} value 저장할 최소 편수
   */
  const setMinEp = (value) => {
    localStorage.setItem(STORAGE_KEY_EP, String(value));
  };

  /**
   * 완결작 제외 여부를 읽습니다.
   *
   * @return {boolean} 완결작 제외 여부
   */
  const getExcludeComplete = () => {
    return localStorage.getItem(STORAGE_KEY_COMPLETE) === '1';
  };

  /**
   * 완결작 제외 여부를 저장합니다.
   *
   * @param {boolean} value 저장할 제외 여부
   */
  const setExcludeComplete = (value) => {
    localStorage.setItem(STORAGE_KEY_COMPLETE, value ? '1' : '0');
  };

  /**
   * 작품 카드가 완결작인지 확인합니다.
   *
   * @param {Element} card 작품 카드 요소
   * @return {boolean} 완결작 여부
   */
  const isComplete = (card) => Boolean(card.querySelector(COMPLETE_SELECTOR));

  /**
   * 현재 필터 조건에서 카드를 숨길지 판정합니다.
   *
   * @param {Element} card 작품 카드 요소
   * @param {number} minEp 최소 편수
   * @param {boolean} excludeComplete 완결작 제외 여부
   * @return {boolean} 숨겨야 하면 true
   */
  const shouldHideCard = (card, minEp, excludeComplete) => {
    const epEl = card.querySelector(EP_SELECTOR);
    const ep = parseEp(epEl?.textContent?.trim());
    const complete = isComplete(card);

    if (excludeComplete && complete) return true;
    if (ep !== null && ep < minEp) return true;

    return false;
  };

  /**
   * 필터링 카운터 텍스트를 갱신합니다.
   *
   * @param {number} hiddenCount 숨겨진 작품 수
   */
  const updateCounter = (hiddenCount) => {
    const counter = document.getElementById(FILTER_COUNTER_ID);
    if (counter) {
      counter.textContent = `${hiddenCount}개 작품 필터링됨`;
    }
  };

  /**
   * 현재 목록에서 조건에 맞지 않는 작품을 숨김 처리합니다.
   *
   * @param {number} minEp 최소 편수
   * @param {boolean} excludeComplete 완결작 제외 여부
   */
  const applyFilter = (minEp, excludeComplete) => {
    const container = document.querySelector(LIST_CONTAINER_SELECTOR);
    if (!container) return;

    const cards = container.querySelectorAll(CARD_SELECTOR);
    let hiddenCount = 0;

    for (const card of cards) {
      const hide = shouldHideCard(card, minEp, excludeComplete);

      card.style.display = hide ? 'none' : '';

      if (hide) hiddenCount++;
    }

    updateCounter(hiddenCount);
  };

  /**
   * 입력 필드 값을 최소 편수 숫자로 변환합니다.
   *
   * @param {HTMLInputElement} input 편수 입력 요소
   * @return {number} 정규화된 최소 편수
   */
  const parseInputValue = (input) => {
    const n = Number(input.value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  /**
   * 기준 앵커의 높이를 계산합니다.
   *
   * @param {Element} anchor 기준 앵커 요소
   * @return {number} UI 높이(px)
   */
  const resolveBaseHeight = (anchor) => {
    const rect = anchor.getBoundingClientRect();
    return rect.height ? Math.round(rect.height) : DEFAULT_ANCHOR_HEIGHT;
  };

  /**
   * 최소 편수 입력 요소를 생성합니다.
   *
   * @param {number} height 높이(px)
   * @return {HTMLInputElement} 생성된 입력 요소
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
   * 완결작 제외 체크박스를 생성합니다.
   *
   * @param {number} height 높이(px)
   * @return {{label: HTMLLabelElement, checkbox: HTMLInputElement}} 라벨과 체크박스
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
    checkbox.style.cssText = ['margin:0', 'accent-color:#7c4dff'].join(';');

    label.appendChild(checkbox);
    label.append('완결작 제외');

    return {label, checkbox};
  };

  /**
   * 적용 버튼 요소를 생성합니다.
   *
   * @param {number} height 높이(px)
   * @return {HTMLButtonElement} 생성된 버튼 요소
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
   *
   * @param {number} height 높이(px)
   * @return {HTMLSpanElement} 생성된 카운터 요소
   */
  const createCounter = (height) => {
    const counter = document.createElement('span');
    counter.id = FILTER_COUNTER_ID;
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
   * 필터 UI를 앵커 뒤에 삽입합니다.
   *
   * @return {boolean} UI가 준비되었으면 true
   */
  const ensureUi = () => {
    if (document.getElementById(FILTER_WRAPPER_ID)) return true;

    const anchor = document.querySelector(RANK_INFO_SELECTOR);
    if (!anchor) return false;

    const height = resolveBaseHeight(anchor);
    const wrapper = document.createElement('span');
    wrapper.id = FILTER_WRAPPER_ID;
    wrapper.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:6px',
      'margin-left:10px',
    ].join(';');

    const input = createInput(height);
    const {label: checkboxLabel, checkbox} = createCompleteCheckbox(height);
    const btn = createButton(height);
    const counter = createCounter(height);

    const onApply = () => {
      const minEp = parseInputValue(input);
      const excludeComplete = checkbox.checked;

      setMinEp(minEp);
      setExcludeComplete(excludeComplete);
      applyFilter(minEp, excludeComplete);
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

    return true;
  };

  /**
   * 목록 컨테이너에 MutationObserver를 1회만 등록합니다.
   */
  const setupObserver = () => {
    if (observerStarted) return;

    const container = document.querySelector(LIST_CONTAINER_SELECTOR);
    if (!container) return;

    const observer = new MutationObserver((mutations) => {
      const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
      if (hasNewNodes) {
        applyFilter(getMinEp(), getExcludeComplete());
      }
    });

    observer.observe(container, {childList: true, subtree: true});
    observerStarted = true;
  };

  /**
   * 스크립트를 초기화합니다.
   */
  const boot = () => {
    let tries = 0;

    const timer = setInterval(() => {
      tries++;

      const uiReady = ensureUi();
      setupObserver();

      if (uiReady) {
        applyFilter(getMinEp(), getExcludeComplete());
      }

      if ((uiReady && observerStarted) || tries >= MAX_BOOT_TRIES) {
        clearInterval(timer);
      }
    }, BOOT_INTERVAL_MS);

    applyFilter(getMinEp(), getExcludeComplete());
    setupObserver();
  };

  boot();
})();
