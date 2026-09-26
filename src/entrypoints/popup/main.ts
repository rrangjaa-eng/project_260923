import tokensCss from '../../../docs/design/tokens.css?inline';
// 오버레이·메뉴 서체(D-26, Plan 01-16): document.fonts.add()는 Document 전체에 등록되고 Shadow
// DOM 경계와 무관하다(A4는 <style> 안 @font-face 규칙에만 해당) — 팝업도 오버레이와 같은 등록
// 함수를 그대로 쓴다.
import { ensureHelperFontsRegistered } from '@/page/overlay/mode-indicator';
import {
  defaultSettings,
  MIGRATION_FAILED_MESSAGE,
  MIGRATION_NOTICE_KEY,
  MigrationNoticeV1,
  SETTINGS_KEY,
  SettingsV1,
  SiteEntryV1,
  siteKey,
} from '@/core/settings-schema';
import { createTremorFilter, type TremorFilter } from '@/core/tremor-filter';
import type { Message } from '@/shared/messages';

// 형식 변환 실패 경고(D-25, SYSTEM.md "막힘·확인 필요 = --warning 테두리 카드 + 이유"): 저장
// 응답이 preserved-original이면(원본을 지키려고 쓰지 않았다는 뜻) 문구를 이걸로 바꾼다.
const PRESERVED_ORIGINAL_MESSAGE = '원래 설정을 지키려고 저장하지 않았어요.';
// WR-03(01-REVIEW.md): preserved-original 말고 다른 실패(무응답·거부·item-too-large 등)에는
// 안내가 아예 없었다 — 되돌아간 이유를 한 줄로 알린다(§7).
const HELPER_TOGGLE_FAILED_MESSAGE = '도우미 상태를 바꾸지 못했어요. 다시 눌러 보세요.';
const SITE_TOGGLE_OFF_FAILED_MESSAGE = '이 사이트를 끄지 못했어요. 1을 눌러 도우미를 끄세요.';
// DOM 감사 경고 2: "이 사이트에서 켜기"가 실패해도 지금까지는 끄기 실패용 문구가 그대로 떴다 —
// 켜기 실패는 원인이 다르니(끌 필요가 없다) 다음 행동도 다른 문구를 둔다(§7).
const SITE_TOGGLE_ON_FAILED_MESSAGE = '이 사이트를 켜지 못했어요. 다시 눌러 보세요.';
// WR-03: SW가 응답 없이 멈추면(무응답) 낙관적 렌더가 무기한 남는다 — 이 시간이 지나면 되돌린다.
const STORAGE_REQUEST_TIMEOUT_MS = 3000;

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
  word-break: keep-all;
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
  outline: var(--border-strong) solid var(--accent);
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
.warning-card {
  margin: 0 0 var(--space-4) 0;
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  color: var(--fg);
  border: var(--border-strong) solid var(--warning);
  border-radius: var(--radius-card);
  font-size: var(--text-body);
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

// 형식 변환 실패 경고 카드(D-25, Plan 01-14): notice:migration-failed가 있으면 카드 격자
// 위에 보여 준다. 저장 시도가 preserved-original로 거절되면 문구를 바꾼다(showWarningCard).
const warningCard = document.createElement('p');
warningCard.className = 'warning-card';
// DOM 감사 경고 1: 실패 안내는 시각으로만 전달돼 스크린리더 이용자에게는 뜨는지 알 방법이
// 없었다 — 오류 알림이니 role="alert"(암묵적 aria-live=assertive)를 준다.
warningCard.setAttribute('role', 'alert');

// 지금 사이트에서만 끄기 상태 한 줄(Plan 01-13 Task 3, --muted — .status와 같은 스타일 재사용).
const siteStatus = document.createElement('p');
siteStatus.className = 'status';

const cards = document.createElement('div');
cards.className = 'cards';

// WR-03(01-REVIEW.md): 카드 onToggle이 이제까지 각자 sendMessage(...).then(...)만 썼다 —
// 응답이 거부되면(SW 종료로 포트가 닫히는 등) unhandled rejection이 나며 되돌리지 않았고, 두
// 경로 모두 응답이 계속 오지 않으면 낙관적 렌더가 무기한 남았다. 공통 도우미로 시간 제한·거부
// 처리를 한 곳에 모은다.
function sendWithRevert(message: Message, revert: () => void, onFail: (reason?: string) => void): void {
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) {
      return;
    }
    settled = true;
    revert();
    onFail('timeout');
  }, STORAGE_REQUEST_TIMEOUT_MS);
  chrome.runtime.sendMessage(message).then(
    (response) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const result = response as { ok?: boolean; reason?: string } | undefined;
      if (result?.ok !== true) {
        revert();
        onFail(result?.reason);
      } else {
        hideWarningCard();
      }
    },
    () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      revert();
      onFail('rejected');
    },
  );
}

function showWarningCard(text: string): void {
  warningCard.textContent = text;
  if (!warningCard.isConnected) {
    container.insertBefore(warningCard, cards);
  }
}

// DOM 감사 경고 3: 실패 안내가 뜬 뒤 같은(또는 다른) 토글이 성공해도 안내가 화면에 그대로
// 남아 있었다 — 더는 맞지 않는 안내가 계속 보이지 않도록 성공하면 숨긴다(sendWithRevert 성공
// 경로에서 부른다).
function hideWarningCard(): void {
  if (warningCard.isConnected) {
    warningCard.remove();
  }
}

// 번호 카드(D-26 "번호 카드", 자리는 고정): 카드마다 키 숫자·문구·저장소 요청을 넣어 두면
// 클릭·숫자 키 처리는 공통으로 처리한다. 1 도우미 끄기 · 2 이 사이트에서 끄기(Plan 01-13) ·
// 3 머무르기 클릭 · 4 끌어서 놓기 두 번 누르기 — 2는 아직 비어 있다.
interface CardConfig {
  keyLabel: string;
  digitCodes: string[];
  wordFor: (enabled: boolean) => string;
  // revert: 낙관적 렌더(render(next))가 실제로는 저장되지 않았을 때(D-25 preserved-original)
  // 누르기 전 상태로 되돌린다 — 안 그러면 화면이 실제와 다른 상태를 계속 보여 준다(Rule 1).
  onToggle: (next: boolean, render: (enabled: boolean) => void, revert: () => void) => void;
}

// WR-06: 팝업 카드는 이제까지 떨림 필터를 전혀 거치지 않았다 — 떨림으로 인한 두 번 탭이나 살짝
// 눌린 채 남은 키가 도우미를 껐다 곧바로 다시 켜는(또는 그 반대) 사고로 이어질 수 있다. 페이지
// 쪽과 같은 core/tremor-filter.ts를 그대로 쓴다 — "press" 입력의 자리(x,y)는 카드 자신의 화면
// 위치를 쓴다: 같은 카드를 간격 안에 다시 누르면(키든 클릭이든) 자리가 같아 걸러지고, 다른
// 카드를 누르면 자리가 달라 걸러지지 않는다.
//
// 기본값(defaultSettings().data)으로 한 번만 만들고 이후 다시 만들지 않는다 — Phase 1에는 이
// 값을 바꾸는 화면이 없어 저장된 값은 사실상 늘 기본값과 같고, 저장소를 읽어 "실제 값"으로
// 다시 만드는 방식은 시도해 봤으나(그 응답이 두 탭 사이에 막 도착하면 필터가 기억하던 "방금
// 누른 자리·시각"이 통째로 사라져 떨림 거르기가 새로 시작돼 버리는 경합이 재현됨) 만들지 않는
// 쪽이 더 단순하고 이 경합 자체가 없다.
const tremorFilter: TremorFilter = createTremorFilter({
  intervalMs: defaultSettings().data.tremorIntervalMs,
  sameSpotPx: defaultSettings().data.sameSpotPx,
});

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

  function toggle(t: number): void {
    const rect = card.getBoundingClientRect();
    if (!tremorFilter.accept({ kind: 'press', x: rect.x, y: rect.y, t })) {
      return;
    }
    const previous = current;
    config.onToggle(!current, render, () => {
      render(previous);
    });
  }

  card.addEventListener('click', (event) => {
    toggle(event.timeStamp);
  });
  document.addEventListener('keydown', (event) => {
    if (event.repeat) {
      // WR-06: 키를 계속 눌러 생기는 자동 반복 — 떨림 필터의 key kind도 repeat을 거절하지만,
      // 여기서는 카드 자리를 쓰는 press kind를 쓰므로 repeat은 따로 먼저 걸러야 한다.
      return;
    }
    if (config.digitCodes.includes(event.code)) {
      event.preventDefault();
      toggle(event.timeStamp);
    }
  });

  return { element: card, render };
}

const helperCard = createCard({
  keyLabel: '1',
  digitCodes: ['Digit1', 'Numpad1'],
  wordFor: (enabled) => (enabled ? '도우미 끄기' : '도우미 켜기'),
  onToggle: (next, render, revert) => {
    render(next); // 즉시 반영 — 연타해도 이전 누름 기준으로 번갈아 계산된다(writer가 순서대로 처리).
    const message: Message = { type: 'storage/request', op: { kind: 'setEnabled', enabled: next } };
    // WR-05: preserved-original뿐 아니라 ok !== true인 모든 거절(item-too-large 등)에서 화면을
    // 실제 상태로 되돌린다. WR-03: 무응답(시간 제한)·거부(reject)도 같은 방식으로 되돌리고,
    // 이유별로 안내한다(preserved-original만 특별 문구, 나머지는 공통 실패 문구).
    sendWithRevert(message, revert, (reason) => {
      showWarningCard(reason === 'preserved-original' ? PRESERVED_ORIGINAL_MESSAGE : HELPER_TOGGLE_FAILED_MESSAGE);
    });
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
    onToggle: (next, render, revert) => {
      render(next);
      const message: Message = {
        type: 'storage/request',
        op: { kind: 'setSiteDisabled', origin, disabled: !next, tabId },
      };
      // WR-05: SW 거절(origin-mismatch·write-failed 등)을 보지 않으면 카드가 실제로는 켜져
      // 있는데 꺼졌다고 계속 보여 준다 — 즉시 끌 수 있음이 핵심 안전 요구다. WR-03: 무응답(시간
      // 제한)도 같은 방식으로 되돌리고, 왜 되돌아갔는지 한 줄로 알린다. DOM 감사 경고 2: 실패한
      // 쪽이 켜기인지 끄기인지에 따라 원인이 다르니 문구도 다르게 한다(next=true면 켜기 시도).
      sendWithRevert(message, revert, () => {
        showWarningCard(next ? SITE_TOGGLE_ON_FAILED_MESSAGE : SITE_TOGGLE_OFF_FAILED_MESSAGE);
      });
    },
  });
}

function renderSiteStatus(disabled: boolean): void {
  siteStatus.textContent = disabled ? '이 사이트: 꺼짐' : '이 사이트: 켜짐';
}

// 주소 없는 새 창(01-19 Task 2, tab.url이 about:)의 사이트 출처는 URL로 계산할 수 없다 — 맨 위
// content script의 site/ping 응답(origin, cachedTopOrigin)으로 얻는다. 표시용일 뿐이고 최종
// 대조는 background.ts의 siteOriginOfTab(Chrome sender.origin)이 한다.
async function resolveSiteOrigin(tabUrl: string, tabId: number): Promise<string | undefined> {
  if (!tabUrl.startsWith('about:')) {
    return new URL(tabUrl).origin;
  }
  const response = await chrome.tabs.sendMessage(tabId, { type: 'site/ping' }, { frameId: 0 }).catch(() => undefined);
  const origin = (response as { ok?: boolean; origin?: string } | undefined)?.origin;
  if (!origin) {
    return undefined;
  }
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
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
  const origin = await resolveSiteOrigin(tab.url, tabId);
  if (!origin) {
    return;
  }
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

// 형식 변환 실패 경고(D-25, Plan 01-14): notice:migration-failed가 있으면 카드 격자 위에
// 경고 카드를 보여 준다. 토스트와 같은 문구(MIGRATION_FAILED_MESSAGE)로 시작한다.
async function loadMigrationNotice(): Promise<void> {
  const stored = await chrome.storage.local.get(MIGRATION_NOTICE_KEY);
  const parsed = MigrationNoticeV1.safeParse(stored[MIGRATION_NOTICE_KEY]);
  if (parsed.success) {
    showWarningCard(MIGRATION_FAILED_MESSAGE);
  }
}

void loadInitial();
void loadMigrationNotice();
void renderForTargetTab();
void ensureHelperFontsRegistered();
