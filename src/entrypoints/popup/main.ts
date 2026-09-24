import tokensCss from '../../../docs/design/tokens.css?inline';
import { SETTINGS_KEY, SettingsV1, SiteEntryV1, siteKey } from '@/core/settings-schema';
import type { Message } from '@/shared/messages';

const appRoot = document.getElementById('app');
if (!appRoot) {
  throw new Error('popup #app root missing');
}

const shadow = appRoot.attachShadow({ mode: 'open' });

const style = document.createElement('style');
style.textContent = `
${tokensCss}
:host { all: initial; }
.popup {
  display: block;
  width: 280px;
  padding: var(--space-4);
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  line-height: var(--leading);
  letter-spacing: var(--tracking);
}
.title {
  margin: 0 0 var(--space-2) 0;
  font-size: var(--text-title);
  font-weight: var(--weight-bold);
}
.status {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--text-sm);
  color: var(--muted);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-4);
}
.card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--target-min);
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  color: var(--fg);
  border: none;
  border-radius: var(--radius-card);
  font-family: var(--font);
  font-size: var(--text-body);
  font-weight: var(--weight-regular);
  cursor: pointer;
}
.card:focus-visible {
  outline: none;
  border: var(--border-strong) solid var(--accent);
}
.key-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2em;
  padding: var(--space-1) var(--space-2);
  border: var(--border-strong) solid var(--accent);
  border-radius: var(--radius-key);
  color: var(--accent);
  font-size: var(--text-key);
  font-weight: var(--weight-bold);
}
.action-word {
  font-size: var(--text-body);
}
.unsupported-message {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--text-body);
  color: var(--fg);
}
`;
shadow.append(style);

const container = document.createElement('div');
container.className = 'popup';

const title = document.createElement('p');
title.className = 'title';
title.textContent = '손 떨림 도우미';

const status = document.createElement('p');
status.className = 'status';

// "도울 수 없음" 안내(D-21, SYSTEM.md 카피 규칙 "원인. 다음 행동."): 대상 탭이 도울 수 없는
// 페이지면 카드 격자 위에 이 한 줄만 보여 준다(Plan 01-13 Task 2).
const unsupportedMessage = document.createElement('p');
unsupportedMessage.className = 'unsupported-message';
unsupportedMessage.textContent = '이 페이지에서는 도울 수 없어요. 다른 탭에서 쓰세요.';

// 지금 사이트에서만 끄기 상태 한 줄(Plan 01-13 Task 3, --muted — .status와 같은 스타일 재사용).
const siteStatus = document.createElement('p');
siteStatus.className = 'status';

const cards = document.createElement('div');
cards.className = 'cards';

// 번호 카드(D-26 "번호 카드", 자리는 고정): 카드마다 키 숫자·문구·저장소 요청을 넣어 두면
// 클릭·숫자 키 처리는 공통으로 처리한다. 1 도우미 끄기 · 2 이 사이트에서 끄기(Plan 01-13) ·
// 3 머무르기 클릭 · 4 끌어서 놓기 두 번 누르기 — 2는 아직 비어 있다.
interface CardConfig {
  keyLabel: string;
  digitCodes: string[];
  wordFor: (enabled: boolean) => string;
  onToggle: (next: boolean, render: (enabled: boolean) => void) => void;
}

function createCard(config: CardConfig): { element: HTMLButtonElement; render: (enabled: boolean) => void } {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';

  const keyChip = document.createElement('span');
  keyChip.className = 'key-chip';
  keyChip.textContent = config.keyLabel;

  const actionWord = document.createElement('span');
  actionWord.className = 'action-word';

  card.append(keyChip, actionWord);

  let current = false;
  function render(enabled: boolean): void {
    current = enabled;
    actionWord.textContent = config.wordFor(enabled);
  }

  function toggle(): void {
    config.onToggle(!current, render);
  }

  card.addEventListener('click', toggle);
  document.addEventListener('keydown', (event) => {
    if (config.digitCodes.includes(event.code)) {
      event.preventDefault();
      toggle();
    }
  });

  return { element: card, render };
}

const helperCard = createCard({
  keyLabel: '1',
  digitCodes: ['Digit1', 'Numpad1'],
  wordFor: (enabled) => (enabled ? '도우미 끄기' : '도우미 켜기'),
  onToggle: (next, render) => {
    render(next); // 즉시 반영 — 연타해도 이전 누름 기준으로 번갈아 계산된다(writer가 순서대로 처리).
    const message: Message = { type: 'storage/request', op: { kind: 'setEnabled', enabled: next } };
    void chrome.runtime.sendMessage(message);
  },
});

const dwellCard = createCard({
  keyLabel: '3',
  digitCodes: ['Digit3', 'Numpad3'],
  wordFor: (enabled) => (enabled ? '머무르기 클릭 끄기' : '머무르기 클릭 켜기'),
  onToggle: (next, render) => {
    render(next);
    const message: Message = {
      type: 'storage/request',
      op: { kind: 'updateSettings', patch: { dwellEnabled: next } },
    };
    void chrome.runtime.sendMessage(message);
  },
});

const dragTwoPressCard = createCard({
  keyLabel: '4',
  digitCodes: ['Digit4', 'Numpad4'],
  wordFor: (enabled) => (enabled ? '끌어서 놓기 두 번 누르기 끄기' : '끌어서 놓기 두 번 누르기 켜기'),
  onToggle: (next, render) => {
    render(next);
    const message: Message = {
      type: 'storage/request',
      op: { kind: 'updateSettings', patch: { dragTwoPress: next } },
    };
    void chrome.runtime.sendMessage(message);
  },
});

cards.append(helperCard.element, dwellCard.element, dragTwoPressCard.element);
container.append(title, status, cards);
shadow.append(container);

// 대상 탭 결정(Plan 01-13 Task 2): 쿼리 tabId가 있으면 그 탭, 없으면 현재 활성 탭. 쿼리는 시험
// 전용(popup.html이 시험에서는 실제 탭으로 열려 스스로 활성 탭이 되기 때문 — fixtures.ts openPopup).
async function resolveTargetTabId(): Promise<number | undefined> {
  const fromQuery = new URLSearchParams(location.search).get('tabId');
  if (fromQuery !== null) {
    const parsed = Number(fromQuery);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

// 지금 사이트에서만 끄기 카드(D-20, Plan 01-13 Task 3) — 대상 탭이 도울 수 있는 페이지일 때만
// 만들어 카드 1과 3 사이에 끼운다. 카드마다 기존 factory(createCard)를 그대로 쓴다.
function createSiteCard(origin: string, tabId: number): { element: HTMLButtonElement; render: (enabled: boolean) => void } {
  return createCard({
    keyLabel: '2',
    digitCodes: ['Digit2', 'Numpad2'],
    wordFor: (enabled) => (enabled ? '이 사이트에서 끄기' : '이 사이트에서 켜기'),
    onToggle: (next, render) => {
      render(next);
      const message: Message = {
        type: 'storage/request',
        op: { kind: 'setSiteDisabled', origin, disabled: !next, tabId },
      };
      void chrome.runtime.sendMessage(message);
    },
  });
}

function renderSiteStatus(disabled: boolean): void {
  siteStatus.textContent = disabled ? '이 사이트: 꺼짐' : '이 사이트: 켜짐';
}

// 대상 탭이 "도울 수 없음"인지는 background.ts가 이미 계산해 둔 아이콘 제목으로 판단한다(단일
// 판정 소스 — Task 3의 content script 응답 없음 판정도 background.ts 쪽에서만 더해진다).
async function renderForTargetTab(): Promise<void> {
  const tabId = await resolveTargetTabId();
  if (tabId === undefined) {
    return;
  }
  const title = await chrome.action.getTitle({ tabId });
  if (title === '도울 수 없음') {
    container.insertBefore(unsupportedMessage, cards);
    return;
  }
  unsupportedMessage.remove();

  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) {
    return;
  }
  const origin = new URL(tab.url).origin;
  const key = siteKey(origin);

  const siteCard = createSiteCard(origin, tabId);
  cards.insertBefore(siteCard.element, dwellCard.element);
  container.insertBefore(siteStatus, cards);

  async function refreshSiteState(): Promise<void> {
    const stored = await chrome.storage.sync.get(key);
    const parsed = SiteEntryV1.safeParse(stored[key]);
    const disabled = parsed.success ? parsed.data.data.disabled : false;
    siteCard.render(!disabled);
    renderSiteStatus(disabled);
  }
  await refreshSiteState();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') {
      return;
    }
    if (!changes[key]) {
      return;
    }
    void refreshSiteState();
  });
}

function renderStatus(enabled: boolean): void {
  status.textContent = enabled ? '지금: 켜짐' : '지금: 꺼짐';
}

// 초기 렌더는 기본 설정(enabled: true, dwellEnabled: false, dragTwoPress: false)을 가정한다 —
// 저장소를 읽어 오면 실제 값으로 다시 그린다.
renderStatus(true);
helperCard.render(true);
dwellCard.render(false);
dragTwoPressCard.render(false);

async function loadInitial(): Promise<void> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  const parsed = SettingsV1.safeParse(stored[SETTINGS_KEY]);
  if (parsed.success) {
    renderStatus(parsed.data.data.enabled);
    helperCard.render(parsed.data.data.enabled);
    dwellCard.render(parsed.data.data.dwellEnabled);
    dragTwoPressCard.render(parsed.data.data.dragTwoPress);
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') {
    return;
  }
  const change = changes[SETTINGS_KEY];
  if (!change) {
    return;
  }
  const parsed = SettingsV1.safeParse(change.newValue);
  if (parsed.success) {
    renderStatus(parsed.data.data.enabled);
    helperCard.render(parsed.data.data.enabled);
    dwellCard.render(parsed.data.data.dwellEnabled);
    dragTwoPressCard.render(parsed.data.data.dragTwoPress);
  }
});

void loadInitial();
void renderForTargetTab();
