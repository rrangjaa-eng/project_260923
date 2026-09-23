import tokensCss from '../../../docs/design/tokens.css?inline';
import { SETTINGS_KEY, SettingsV1 } from '@/core/settings-schema';
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
`;
shadow.append(style);

const container = document.createElement('div');
container.className = 'popup';

const title = document.createElement('p');
title.className = 'title';
title.textContent = '손 떨림 도우미';

const status = document.createElement('p');
status.className = 'status';

const cards = document.createElement('div');
cards.className = 'cards';

const card = document.createElement('button');
card.type = 'button';
card.className = 'card';

const keyChip = document.createElement('span');
keyChip.className = 'key-chip';
keyChip.textContent = '1';

const actionWord = document.createElement('span');
actionWord.className = 'action-word';

card.append(keyChip, actionWord);
cards.append(card);
container.append(title, status, cards);
shadow.append(container);

let currentEnabled = true;

function render(enabled: boolean): void {
  currentEnabled = enabled;
  status.textContent = enabled ? '지금: 켜짐' : '지금: 꺼짐';
  actionWord.textContent = enabled ? '도우미 끄기' : '도우미 켜기';
}

// 초기 렌더는 기본 설정(enabled: true)을 가정한다 — 저장소를 읽어 오면 실제 값으로 다시 그린다.
render(true);

function toggle(): void {
  const next = !currentEnabled;
  render(next); // 즉시 반영 — 연타해도 이전 누름 기준으로 번갈아 계산된다(writer가 순서대로 처리).
  const message: Message = { type: 'storage/request', op: { kind: 'setEnabled', enabled: next } };
  void chrome.runtime.sendMessage(message);
}

card.addEventListener('click', () => {
  toggle();
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'Digit1' || event.code === 'Numpad1') {
    event.preventDefault();
    toggle();
  }
});

async function loadInitial(): Promise<void> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  const parsed = SettingsV1.safeParse(stored[SETTINGS_KEY]);
  if (parsed.success) {
    render(parsed.data.data.enabled);
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
    render(parsed.data.data.enabled);
  }
});

void loadInitial();
