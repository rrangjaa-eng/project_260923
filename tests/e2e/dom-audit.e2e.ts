import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures';
import type { Page, Worker } from '@playwright/test';

// 독립 DOM 감사(Plan 01-16 Task 3, 감사 에이전트 작성). 판정 기준은 docs/design/SYSTEM.md·
// docs/design/tokens.css·docs/DESIGN.md §6(품질 바닥)뿐이다. 실제 브라우저에서 getComputedStyle·
// getBoundingClientRect로 잰다(스크린샷 없음). 각 시험은 어긋남을 모두 모아 한 번에 보여 준다
// ("장소 부품 속성: 실측 … 기준 …") — 첫 어긋남에서 멈추지 않고 전체 목록을 남기기 위해서다.
//
// 측정 규칙(감사 에이전트 가정, 보고서에도 적음):
// - "그려지는" 값만 잰다: color는 직접 글자 노드가 있는 요소만, border-*-color는 두께>0·style≠none
//   인 변만, outline-color는 두께>0·style≠none일 때만. 그려지지 않는 속성의 기본값(currentColor=검정
//   등)은 화면에 없는 값이라 판정하지 않는다.
// - radius 0(모서리 없음)은 토큰 선택이 아니므로 허용한다.
// - 오버레이가 놓인 사이트 바탕은 연습 페이지의 흰색(#fff)으로 본다(연습 페이지는 모두 흰 바탕).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = fs.readFileSync(path.resolve(__dirname, '../../docs/design/tokens.css'), 'utf8');

// ---------- tokens.css 해석 (시험 시점에 파일에서 읽는다) ----------

function parseTokens(css: string): Map<string, string> {
  // 첫 :host 블록(움직임 줄이기 @media 앞)만 기본값으로 쓴다.
  const hostBlock = css.slice(0, css.indexOf('@media'));
  const tokens = new Map<string, string>();
  for (const match of hostBlock.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) {
      tokens.set(name, value.trim());
    }
  }
  return tokens;
}

const TOKENS = parseTokens(TOKENS_CSS);

function token(name: string): string {
  const value = TOKENS.get(name);
  if (value === undefined) {
    throw new Error(`tokens.css에 --${name}이 없다`);
  }
  return value;
}

function tokenPx(name: string): number {
  return Number.parseFloat(token(name));
}

type Rgba = [number, number, number, number];

function parseColor(raw: string): Rgba | null {
  const value = raw.trim().toLowerCase();
  if (value === 'transparent') {
    return [0, 0, 0, 0];
  }
  const hex = /^#([0-9a-f]{6})$/.exec(value);
  if (hex?.[1] !== undefined) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(value);
  if (fn?.[1] !== undefined) {
    const parts = fn[1].split(/[\s,/]+/).filter((p) => p.length > 0).map(Number);
    const [r, g, b, a] = parts;
    if (r === undefined || g === undefined || b === undefined) {
      return null;
    }
    return [r, g, b, a ?? 1];
  }
  return null;
}

// tokens.css의 색 토큰 전부(이름 → rgba).
const COLOR_TOKENS = new Map<string, Rgba>();
for (const [name, value] of TOKENS) {
  const color = parseColor(value);
  if (color && (value.startsWith('#') || value.startsWith('rgb'))) {
    COLOR_TOKENS.set(name, color);
  }
}

function sameColor(a: Rgba, b: Rgba): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && Math.abs(a[3] - b[3]) < 0.01;
}

function tokenNameForColor(raw: string): string | null {
  const color = parseColor(raw);
  if (!color) {
    return null;
  }
  if (color[3] === 0) {
    return 'transparent';
  }
  for (const [name, value] of COLOR_TOKENS) {
    if (sameColor(color, value)) {
      return name;
    }
  }
  return null;
}

const RADIUS_TOKENS_PX = [...TOKENS.entries()].filter(([name]) => name.startsWith('radius-')).map(([, v]) => Number.parseFloat(v));
const WHITE: Rgba = [255, 255, 255, 1];
const ACCENT = parseColor(token('accent')) ?? WHITE;
const HALO = parseColor(token('halo')) ?? WHITE;

function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
}

// layers: 가까운 것부터(자기 자신 → 부모 → …). 사이트 바탕(흰색) 위에 먼 것부터 겹친다.
function compositeLayers(layers: string[]): Rgba {
  let result: Rgba = WHITE;
  for (const raw of [...layers].reverse()) {
    const color = parseColor(raw);
    if (color && color[3] > 0) {
      result = composite(color, result);
    }
  }
  return result;
}

function luminance(c: Rgba): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
}

function contrast(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function fmt(c: Rgba): string {
  return `rgb(${c.slice(0, 3).map((v) => Math.round(v)).join(',')})`;
}

// ---------- 브라우저 안 측정 ----------

interface Side {
  width: number;
  style: string;
  color: string;
}

interface PseudoSample {
  content: string;
  borderWidth: number;
  borderStyle: string;
  borderColor: string;
}

interface Sample {
  where: string;
  name: string;
  text: string;
  hasText: boolean;
  hasHangul: boolean;
  rect: { x: number; y: number; width: number; height: number };
  color: string;
  backgroundColor: string;
  borders: Side[];
  outline: { width: number; style: string; color: string; offset: number };
  radii: number[];
  boxShadow: string;
  fontFamily: string;
  wordBreak: string;
  transitionProperty: string;
  transitionDuration: string;
  opacity: number;
  isSvg: boolean;
  fill: string;
  stroke: string;
  selfAndAncestorBgs: string[];
  ancestorBgs: string[];
  before: PseudoSample;
  after: PseudoSample;
}

type RootKind = 'overlay' | 'popup';

// page.evaluate 안에서 도는 함수 — 바깥 변수를 쓰지 않는다.
function collectInPage(kind: RootKind): Omit<Sample, 'where'>[] {
  const root =
    kind === 'overlay'
      ? document.querySelector('tremor-helper-root')?.shadowRoot
      : document.getElementById('app')?.shadowRoot;
  if (!root) {
    return [];
  }
  const hangul = /[ㄱ-힝]/;
  const px = (v: string): number => Number.parseFloat(v) || 0;
  const pseudo = (el: Element, which: '::before' | '::after'): PseudoSample => {
    const s = getComputedStyle(el, which);
    return { content: s.content, borderWidth: px(s.borderTopWidth), borderStyle: s.borderTopStyle, borderColor: s.borderTopColor };
  };
  const counts = new Map<string, number>();
  const out: Omit<Sample, 'where'>[] = [];
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.tagName === 'STYLE') {
      continue;
    }
    const s = getComputedStyle(el);
    if (el.getClientRects().length === 0 || s.visibility === 'hidden') {
      continue;
    }
    const partAttr = el.getAttribute('data-part');
    const firstClass = el.getAttribute('class')?.split(' ')[0];
    const base = partAttr ? `[data-part=${partAttr}]` : firstClass ? `.${firstClass}` : el.tagName.toLowerCase();
    const index = counts.get(base) ?? 0;
    counts.set(base, index + 1);
    const directText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    const ancestorBgs: string[] = [];
    let parent = el.parentElement;
    while (parent) {
      ancestorBgs.push(getComputedStyle(parent).backgroundColor);
      parent = parent.parentElement;
    }
    const rect = el.getBoundingClientRect();
    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
    out.push({
      name: `${base}#${String(index)}`,
      text: directText,
      hasText: directText.length > 0,
      hasHangul: hangul.test(directText),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      color: s.color,
      backgroundColor: s.backgroundColor,
      borders: sides.map((side) => ({
        width: px(s.getPropertyValue(`border-${side.toLowerCase()}-width`)),
        style: s.getPropertyValue(`border-${side.toLowerCase()}-style`),
        color: s.getPropertyValue(`border-${side.toLowerCase()}-color`),
      })),
      outline: { width: px(s.outlineWidth), style: s.outlineStyle, color: s.outlineColor, offset: px(s.outlineOffset) },
      radii: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map(px),
      boxShadow: s.boxShadow,
      fontFamily: s.fontFamily,
      wordBreak: s.wordBreak,
      transitionProperty: s.transitionProperty,
      transitionDuration: s.transitionDuration,
      opacity: Number.parseFloat(s.opacity),
      // SVG는 도형(rect 등)만 fill·stroke를 그린다 — <svg> 뿌리의 상속용 기본값은 그려지지 않는다.
      isSvg: el instanceof SVGGeometryElement,
      fill: s.fill,
      stroke: s.stroke,
      selfAndAncestorBgs: [s.backgroundColor, ...ancestorBgs],
      ancestorBgs,
      before: pseudo(el, '::before'),
      after: pseudo(el, '::after'),
    });
  }
  return out;
}

async function collect(page: Page, kind: RootKind, where: string): Promise<Sample[]> {
  const raw = await page.evaluate(collectInPage, kind);
  return raw.map((s) => ({ ...s, where }));
}

// ---------- 장면 준비 ----------

async function indicatorText(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator')?.textContent ?? '');
}

async function waitForHelperReady(page: Page): Promise<void> {
  await expect.poll(() => indicatorText(page)).toBe('도우미');
}

async function patchSettings(serviceWorker: Worker, patch: Record<string, unknown>): Promise<void> {
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings)).toBeDefined();
  await serviceWorker.evaluate(async (p) => {
    const stored = await chrome.storage.sync.get('settings');
    const settings = stored.settings as { schemaVersion: number; data: Record<string, unknown> };
    await chrome.storage.sync.set({ settings: { ...settings, data: { ...settings.data, ...p } } });
  }, patch);
}

async function seedMigrationFailure(serviceWorker: Worker): Promise<void> {
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings)).toBeDefined();
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.set({
      'notice:migration-failed': { schemaVersion: 1, data: { key: 'settings', reason: 'newer-version', at: Date.now() } },
    });
  });
}

async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`요소를 찾지 못했다: ${selector}`);
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function labelCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelectorAll('.hint-label').length ?? 0);
}

// 떨림 간격(300ms, D-07)보다 넉넉히 띄워 F를 다시 눌러 본다(frames.e2e.ts와 같은 방식).
async function pressFUntilLabels(page: Page, minCount: number): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(150);
    if ((await labelCount(page)) >= minCount) {
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
  throw new Error(`번호표가 ${String(minCount)}개 이상 뜨지 않았다`);
}

// CR-05가 danger.html에 요소 3개를 더해(맨 위 8→11개 + 자식 1개 = 12개) 한 장(최대 9개)에 다
// 안 들어간다 — btn-delete-solo가 첫 장에 없을 수 있다(재현 확인). "0"으로 다음 장까지 넘겨 가며
// 실제로 그 요소 자리에 번호표가 있는(20px 안) 장을 찾는다. 단순 최근접(어느 장이든 가장 가까운
// 번호표를 돌려주는 방식)이면 엉뚱한 장의 다른 요소 번호를 돌려줘, 그 번호를 누르면 확인 화면이
// 아예 안 뜬다(재현 확인 — 8건의 dom-audit 실패 원인).
async function numberForElementAcrossChapters(page: Page, selector: string): Promise<string> {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`요소를 찾지 못했다: ${selector}`);
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await page.evaluate(
      ({ x, y }) => {
        const labels = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelectorAll('.hint-label');
        let best = '';
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const label of Array.from(labels ?? [])) {
          const r = label.getBoundingClientRect();
          const d = Math.hypot(r.x - (x - 14), r.y - (y - 14));
          if (d < bestDistance) {
            bestDistance = d;
            best = label.textContent;
          }
        }
        return { best, bestDistance };
      },
      { x: box.x, y: box.y },
    );
    if (result.bestDistance < 20) {
      return result.best;
    }
    const hasNext = await page.evaluate(
      () => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.hint-next-card') !== null,
    );
    if (!hasNext) {
      break;
    }
    await page.keyboard.press('Digit0');
    await page.waitForTimeout(100);
  }
  throw new Error(`번호표에서 ${selector}를 찾지 못했다(모든 장을 넘겨 봄)`);
}

async function dialogOpacity(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('[data-part="confirm-dialog"]');
    return el ? Number.parseFloat(getComputedStyle(el).opacity) : -1;
  });
}

const MANY_BUTTONS_HTML = `<!doctype html><html lang="ko"><body style="margin:0">
<script>
  for (var i = 0; i < 12; i += 1) {
    var b = document.createElement('button');
    b.textContent = '버튼 ' + i;
    b.style.cssText = 'position:absolute;left:' + (60 + (i % 4) * 120) + 'px;top:' + (80 + Math.floor(i / 4) * 90) + 'px;width:80px;height:30px';
    document.body.appendChild(b);
  }
</script></body></html>`;

interface AuditDeps {
  page: Page;
  serviceWorker: Worker;
  openPopup: (target?: Page) => Promise<Page>;
  servePage: (routePath: string, html: string) => void;
}

// 모든 오버레이 부품(모드 표시 도우미·입력 중, 알림, 강조 테두리 보통·위험, "! 위험" 글자,
// 머무르기 진행, 번호표 보통·위험, "다음 번호" 카드, 확인 화면)과 확장 아이콘 메뉴를 한 번씩 띄워
// 계산된 스타일을 모은다. 연습 페이지: targets·danger·frames·input(+ "다음 번호" 카드를 띄우려고
// 버튼 12개 페이지 하나).
async function gatherAll(deps: AuditDeps): Promise<Sample[]> {
  const { page, serviceWorker, openPopup, servePage } = deps;
  const samples: Sample[] = [];

  // targets.html: 알림(토스트) + 테두리 + 머무르기 진행 + 번호표
  await seedMigrationFailure(serviceWorker);
  await patchSettings(serviceWorker, { dwellEnabled: true });
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.toast[data-visible="true"]') !== null)).toBe(true);
  await page.waitForTimeout(200); // 나타남(120ms) 끝난 뒤
  samples.push(...(await collect(page, 'overlay', 'targets.html(토스트)')));

  const tiny = await centerOf(page, '#btn-tiny');
  await page.mouse.move(tiny.x, tiny.y);
  await page.waitForTimeout(350);
  samples.push(...(await collect(page, 'overlay', 'targets.html(테두리+머무르기)')));
  await page.mouse.move(900, 600);
  await page.waitForTimeout(350);
  await pressFUntilLabels(page, 2);
  samples.push(...(await collect(page, 'overlay', 'targets.html(번호표)')));

  // danger.html: 위험 테두리 + "! 위험", 위험 번호표, 확인 화면
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);
  const del = await centerOf(page, '#btn-delete-solo');
  await page.mouse.move(del.x, del.y);
  await page.waitForTimeout(200);
  samples.push(...(await collect(page, 'overlay', 'danger.html(위험 테두리)')));
  await page.mouse.move(900, 600);
  await page.waitForTimeout(350);
  await pressFUntilLabels(page, 2);
  samples.push(...(await collect(page, 'overlay', 'danger.html(번호표)')));
  const number = await numberForElementAcrossChapters(page, '#btn-delete-solo');
  await page.waitForTimeout(350);
  await page.keyboard.press(`Digit${number}`);
  await expect.poll(() => dialogOpacity(page)).toBe(1);
  samples.push(...(await collect(page, 'overlay', 'danger.html(확인 화면)')));

  // frames.html: 프레임 요소 번호표(맨 위 오버레이)
  await page.goto('http://practice.test/frames.html');
  await waitForHelperReady(page);
  await pressFUntilLabels(page, 7);
  samples.push(...(await collect(page, 'overlay', 'frames.html(번호표)')));

  // input.html: 입력 중 모드 표시
  await page.goto('http://practice.test/input.html');
  await waitForHelperReady(page);
  await page.locator('#name').click();
  await expect.poll(() => indicatorText(page)).toContain('입력 중');
  await page.waitForTimeout(200);
  samples.push(...(await collect(page, 'overlay', 'input.html(입력 중)')));

  // "다음 번호" 카드(9개 넘는 페이지)
  servePage('http://practice.test/audit-many.html', MANY_BUTTONS_HTML);
  await page.goto('http://practice.test/audit-many.html');
  await waitForHelperReady(page);
  await pressFUntilLabels(page, 9);
  samples.push(...(await collect(page, 'overlay', 'audit-many.html(다음 번호 카드)')));

  // 확장 아이콘 메뉴(팝업) — 형식 변환 경고 카드도 함께 뜬다(seedMigrationFailure).
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  const popup = await openPopup(page);
  await expect.poll(() => popup.evaluate(() => document.getElementById('app')?.shadowRoot?.querySelectorAll('.card').length ?? 0)).toBeGreaterThan(0);
  await popup.waitForTimeout(200);
  samples.push(...(await collect(popup, 'popup', 'popup')));
  await popup.keyboard.press('Tab');
  await popup.waitForTimeout(100);
  samples.push(...(await collect(popup, 'popup', 'popup(:focus-visible)')));
  await popup.close();

  return samples;
}

// 이 부품들이 적어도 한 번은 측정돼야 감사가 "모든 부품"을 봤다고 할 수 있다.
const REQUIRED_PARTS = [
  '.mode-indicator',
  '.toast',
  '[data-part=ring]',
  '.ring-danger-label',
  '.dwell-progress',
  '.hint-label',
  '.hint-label-danger-tag',
  '.hint-next-card',
  '[data-part=confirm-dialog]',
  '[data-part=confirm-scrim]',
  '[data-part=confirm-button-confirm]',
  '[data-part=confirm-button-cancel]',
  '[data-part=confirm-guard-bar]',
  '.card',
  '.key-chip',
];

function assertCoverage(samples: Sample[]): void {
  const missing = REQUIRED_PARTS.filter((part) => !samples.some((s) => s.name.startsWith(`${part}#`)));
  expect(missing, '감사 장면에서 측정되지 않은 부품').toEqual([]);
}

function label(s: Sample): string {
  return `${s.where} ${s.name}${s.text ? ` "${s.text}"` : ''}`;
}

function visibleBorders(s: Sample): Side[] {
  return s.borders.filter((b) => b.width > 0 && b.style !== 'none' && b.style !== 'hidden');
}

function hasVisibleOutline(s: Sample): boolean {
  return s.outline.width > 0 && s.outline.style !== 'none';
}

test.describe.configure({ timeout: 120_000 });

test.afterEach(({ blockedRequests }) => {
  // 13: 연습 사이트·확장 밖으로 나간 요청이 하나도 없어야 한다(D-14, D-31).
  expect(blockedRequests, '외부로 나간 요청').toEqual([]);
});

test('감사 1: 모든 오버레이 부품·메뉴 카드의 color·background-color·border-*-color·outline-color가 tokens.css 색 안이다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  const page = await context.newPage();
  const samples = await gatherAll({ page, serviceWorker, openPopup, servePage });
  assertCoverage(samples);

  const violations: string[] = [];
  const check = (s: Sample, prop: string, value: string): void => {
    if (tokenNameForColor(value) === null) {
      violations.push(`${label(s)} ${prop}: 실측 ${value} · 기준 tokens.css 색(또는 transparent)`);
    }
  };
  for (const s of samples) {
    if (s.hasText) check(s, 'color', s.color);
    check(s, 'background-color', s.backgroundColor);
    s.borders.forEach((b, i) => {
      if (b.width > 0 && b.style !== 'none') check(s, `border-${['top', 'right', 'bottom', 'left'][i] ?? ''}-color`, b.color);
    });
    if (hasVisibleOutline(s)) check(s, 'outline-color', s.outline.color);
    if (s.isSvg && s.fill !== 'none') check(s, 'fill', s.fill);
    if (s.isSvg && s.stroke !== 'none') check(s, 'stroke', s.stroke);
  }
  expect(violations).toEqual([]);
});

test('감사 2a: border-radius가 radius 토큰(6·8·10·12·14px) 안이다', async ({ context, serviceWorker, openPopup, servePage }) => {
  const page = await context.newPage();
  const samples = await gatherAll({ page, serviceWorker, openPopup, servePage });
  assertCoverage(samples);

  const violations: string[] = [];
  for (const s of samples) {
    for (const r of s.radii) {
      if (r !== 0 && !RADIUS_TOKENS_PX.some((t) => Math.abs(t - r) < 0.01)) {
        violations.push(`${label(s)} border-radius: 실측 ${String(r)}px · 기준 ${RADIUS_TOKENS_PX.join('/')}px`);
        break;
      }
    }
  }
  expect(violations).toEqual([]);
});

test('감사 2b: box-shadow가 모든 부품에서 none이다(SYSTEM.md "그림자는 쓰지 않는다")', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  const page = await context.newPage();
  const samples = await gatherAll({ page, serviceWorker, openPopup, servePage });
  assertCoverage(samples);

  // 부품별로 묶어 어느 장면에서 나왔는지 함께 적는다.
  const byPart = new Map<string, Set<string>>();
  for (const s of samples.filter((x) => x.boxShadow !== 'none')) {
    const key = `${s.name.replace(/#\d+$/, '')} box-shadow: 실측 ${s.boxShadow} · 기준 none`;
    const pages = byPart.get(key) ?? new Set<string>();
    pages.add(s.where);
    byPart.set(key, pages);
  }
  const violations = [...byPart].map(([key, pages]) => `${key} [${[...pages].join(', ')}]`);
  expect(violations).toEqual([]);
});

test('감사 3: 글자가 있는 모든 부품의 font-family가 "IBM Plex Sans KR"로 시작하고 그 서체가 실제로 올라와 있다', async ({
  context,
  serviceWorker,
  openPopup,
  servePage,
}) => {
  const page = await context.newPage();
  const samples = await gatherAll({ page, serviceWorker, openPopup, servePage });
  assertCoverage(samples);

  const violations = samples
    .filter((s) => s.hasText && !/^["']?IBM Plex Sans KR["']?(,|$)/.test(s.fontFamily))
    .map((s) => `${label(s)} font-family: 실측 ${s.fontFamily} · 기준 "IBM Plex Sans KR", …`);

  // SYSTEM.md "글자": 확장 안에 파일로 넣는다 — 실제로 불러온 서체 면이 있어야 한다.
  const loadedFaces = async (p: Page): Promise<number> =>
    p.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts).filter((f) => f.family.replace(/["']/g, '') === 'IBM Plex Sans KR' && f.status === 'loaded').length;
    });
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  await expect.poll(() => loadedFaces(page), { message: '연습 페이지에 불러온 IBM Plex Sans KR 면' }).toBeGreaterThan(0);
  const popup = await openPopup(page);
  await expect.poll(() => loadedFaces(popup), { message: '메뉴에 불러온 IBM Plex Sans KR 면' }).toBeGreaterThan(0);

  expect(violations).toEqual([]);
});

interface RingMeasure {
  ring: Sample;
  target: { x: number; y: number; width: number; height: number };
}

async function measureRing(page: Page, url: string, selector: string): Promise<RingMeasure> {
  await page.goto(url);
  await waitForHelperReady(page);
  const c = await centerOf(page, selector);
  await page.mouse.move(c.x, c.y);
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('[data-part="ring"]')?.getAttribute('data-visible')))
    .toBe('true');
  await page.waitForTimeout(200); // 이동 모션(80ms)이 끝난 뒤
  const ring = (await collect(page, 'overlay', url)).find((s) => s.name.startsWith('[data-part=ring]#'));
  const target = await page.locator(selector).boundingBox();
  if (!ring || !target) {
    throw new Error('테두리 또는 대상 요소를 찾지 못했다');
  }
  return { ring, target };
}

test('감사 4a: 강조 테두리 — 남색 5px, 요소보다 바깥 8px, 안팎 흰 후광 2px, radius 8(보통·위험)', async ({ context }) => {
  const page = await context.newPage();
  const violations: string[] = [];
  const cases = [
    { url: 'http://practice.test/targets.html', selector: '#btn-tiny', danger: false },
    { url: 'http://practice.test/danger.html', selector: '#btn-delete-solo', danger: true },
  ];
  for (const { url, selector, danger } of cases) {
    const { ring, target } = await measureRing(page, url, selector);
    const where = `${url} ${selector} 테두리`;
    ring.borders.forEach((b, i) => {
      const side = ['top', 'right', 'bottom', 'left'][i] ?? '';
      if (Math.abs(b.width - tokenPx('ring-width')) > 0.01) violations.push(`${where} border-${side}-width: 실측 ${String(b.width)}px · 기준 5px(--ring-width)`);
      const want = danger ? 'danger' : 'accent';
      if (tokenNameForColor(b.color) !== want) violations.push(`${where} border-${side}-color: 실측 ${b.color} · 기준 --${want}`);
      const wantStyle = danger ? 'dashed' : 'solid';
      if (b.style !== wantStyle) violations.push(`${where} border-${side}-style: 실측 ${b.style} · 기준 ${wantStyle}`);
    });
    // 바깥 8px: 테두리 바깥 모서리가 요소 사각형보다 8px 바깥(--ring-offset).
    const offsets = {
      left: target.x - ring.rect.x,
      top: target.y - ring.rect.y,
      right: ring.rect.x + ring.rect.width - (target.x + target.width),
      bottom: ring.rect.y + ring.rect.height - (target.y + target.height),
    };
    for (const [side, value] of Object.entries(offsets)) {
      if (Math.abs(value - tokenPx('ring-offset')) > 0.5) violations.push(`${where} 바깥 간격 ${side}: 실측 ${value.toFixed(2)}px · 기준 8px(--ring-offset)`);
    }
    // 바깥 후광: outline 2px 흰색, 테두리에 바로 붙음(offset 0).
    if (!hasVisibleOutline(ring) || Math.abs(ring.outline.width - tokenPx('halo-width')) > 0.01 || tokenNameForColor(ring.outline.color) === null || !sameColor(parseColor(ring.outline.color) ?? WHITE, HALO)) {
      violations.push(`${where} 바깥 후광(outline): 실측 ${String(ring.outline.width)}px ${ring.outline.style} ${ring.outline.color} · 기준 2px solid --halo`);
    }
    if (ring.outline.offset !== 0) violations.push(`${where} outline-offset: 실측 ${String(ring.outline.offset)}px · 기준 0(테두리에 붙은 후광)`);
    // 안쪽 후광: SYSTEM.md "형태" 강조 테두리 = 남색 5px + 안팎 흰 후광 2px. 테두리 안쪽에 붙은
    // 흰 2px 선(::before/::after 테두리)이 있어야 한다.
    const innerHalo = [ring.before, ring.after].some(
      (p) => p.content !== 'none' && p.content !== 'normal' && Math.abs(p.borderWidth - tokenPx('halo-width')) < 0.01 && p.borderStyle !== 'none' && sameColor(parseColor(p.borderColor) ?? ACCENT, HALO),
    );
    if (!innerHalo) {
      violations.push(`${where} 안쪽 후광: 실측 없음(::before/::after에 2px 흰 테두리 없음) · 기준 테두리 안쪽 흰 후광 2px(SYSTEM.md 형태)`);
    }
    for (const r of ring.radii) {
      if (Math.abs(r - tokenPx('radius-ring')) > 0.01) {
        violations.push(`${where} border-radius: 실측 ${String(r)}px · 기준 8px(--radius-ring)`);
        break;
      }
    }
  }
  expect(violations).toEqual([]);
});

test('감사 4b: 사이트 위에 뜬 표시(번호표·모드 표시)가 흰 후광 2px을 두른다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);
  await pressFUntilLabels(page, 2);
  const samples = await collect(page, 'overlay', 'danger.html');
  const markers = samples.filter((s) => s.name.startsWith('.hint-label#') || s.name.startsWith('.mode-indicator#'));
  expect(markers.length).toBeGreaterThan(1);

  const haloPx = tokenPx('halo-width');
  const violations: string[] = [];
  for (const s of markers) {
    const outlineHalo = hasVisibleOutline(s) && Math.abs(s.outline.width - haloPx) < 0.01 && sameColor(parseColor(s.outline.color) ?? ACCENT, HALO);
    const spread = /^rgb\(255, 255, 255\) 0px 0px 0px (\d+(?:\.\d+)?)px$/.exec(s.boxShadow);
    const shadowHalo = spread?.[1] !== undefined && Math.abs(Number(spread[1]) - haloPx) < 0.01;
    if (!outlineHalo && !shadowHalo) {
      violations.push(`${label(s)} 흰 후광: 실측 outline ${String(s.outline.width)}px ${s.outline.color}, box-shadow ${s.boxShadow} · 기준 흰 2px`);
    }
  }
  expect(violations).toEqual([]);
});

test('감사 5: 번호표가 28×28px 이상이다(targets·danger·frames)', async ({ context }) => {
  const page = await context.newPage();
  const min = tokenPx('label-size');
  const violations: string[] = [];
  for (const [url, count] of [
    ['http://practice.test/targets.html', 2],
    ['http://practice.test/danger.html', 2],
    ['http://practice.test/frames.html', 7],
  ] as const) {
    await page.goto(url);
    await waitForHelperReady(page);
    await pressFUntilLabels(page, count);
    const labels = (await collect(page, 'overlay', url)).filter((s) => s.name.startsWith('.hint-label#'));
    expect(labels.length, `${url} 번호표 수`).toBeGreaterThanOrEqual(count);
    for (const s of labels) {
      if (s.rect.width < min - 0.01 || s.rect.height < min - 0.01) {
        violations.push(`${label(s)} 크기: 실측 ${s.rect.width.toFixed(1)}×${s.rect.height.toFixed(1)} · 기준 ≥28×28(--label-size)`);
      }
    }
  }
  expect(violations).toEqual([]);
});

test('감사 6: 메뉴 카드 높이 56px 이상, :focus-visible 외곽선이 남색 3px이다', async ({ context, openPopup }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  const popup = await openPopup(page);
  await expect.poll(() => popup.evaluate(() => document.getElementById('app')?.shadowRoot?.querySelectorAll('.card').length ?? 0)).toBeGreaterThan(0);

  const violations: string[] = [];
  const cards = (await collect(popup, 'popup', 'popup')).filter((s) => s.name.startsWith('.card#'));
  expect(cards.length).toBeGreaterThan(0);
  for (const s of cards) {
    if (s.rect.height < tokenPx('target-min') - 0.01) violations.push(`${label(s)} 높이: 실측 ${s.rect.height.toFixed(1)}px · 기준 ≥56px(--target-min)`);
  }

  await popup.keyboard.press('Tab');
  const focus = await popup.evaluate(() => {
    const shadow = document.getElementById('app')?.shadowRoot;
    const el = shadow?.activeElement;
    if (!el) {
      return null;
    }
    const s = getComputedStyle(el);
    return {
      isCard: el.classList.contains('card'),
      focusVisible: el.matches(':focus-visible'),
      width: Number.parseFloat(s.outlineWidth) || 0,
      style: s.outlineStyle,
      color: s.outlineColor,
    };
  });
  expect(focus?.isCard, 'Tab 한 번으로 메뉴 카드에 초점').toBe(true);
  expect(focus?.focusVisible, '키보드 초점이 :focus-visible').toBe(true);
  if (focus) {
    if (focus.style === 'none' || Math.abs(focus.width - tokenPx('border-strong')) > 0.01 || tokenNameForColor(focus.color) !== 'accent') {
      violations.push(`popup .card:focus-visible outline: 실측 ${String(focus.width)}px ${focus.style} ${focus.color} · 기준 3px(--border-strong) --accent`);
    }
  }
  expect(violations).toEqual([]);
});

async function openDangerConfirm(page: Page): Promise<Sample[]> {
  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);
  await pressFUntilLabels(page, 2);
  const number = await numberForElementAcrossChapters(page, '#btn-delete-solo');
  await page.waitForTimeout(350);
  await page.keyboard.press(`Digit${number}`);
  await expect.poll(() => dialogOpacity(page)).toBe(1);
  return collect(page, 'overlay', 'danger.html(확인 화면)');
}

test('감사 7a: 확인 화면 버튼 높이 64px 이상, 확인 카드 폭 600px', async ({ context }) => {
  const page = await context.newPage();
  const samples = await openDangerConfirm(page);
  const find = (part: string): Sample | undefined => samples.find((s) => s.name.startsWith(`[data-part=${part}]#`));
  const dialog = find('confirm-dialog');
  const buttons = [find('confirm-button-confirm'), find('confirm-button-cancel')];
  expect(dialog).toBeDefined();
  const violations: string[] = [];
  if (dialog && Math.abs(dialog.rect.width - tokenPx('dialog-width')) > 0.5) {
    violations.push(`${label(dialog)} 폭: 실측 ${dialog.rect.width.toFixed(1)}px · 기준 600px(--dialog-width)`);
  }
  for (const b of buttons) {
    expect(b).toBeDefined();
    if (b && b.rect.height < tokenPx('target-confirm') - 0.01) violations.push(`${label(b)} 높이: 실측 ${b.rect.height.toFixed(1)}px · 기준 ≥64px(--target-confirm)`);
  }
  expect(violations).toEqual([]);
});

test('감사 7b: 확인 카드 형태 — radius 14, 남색 3px 테두리, 안쪽 여백 36px 40px(SYSTEM.md 형태·간격)', async ({ context }) => {
  const page = await context.newPage();
  await openDangerConfirm(page);
  const dialog = await page.evaluate(() => {
    const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('[data-part="confirm-dialog"]');
    if (!el) {
      return null;
    }
    const s = getComputedStyle(el);
    return {
      radius: s.borderTopLeftRadius,
      borderWidth: s.borderTopWidth,
      borderColor: s.borderTopColor,
      padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
    };
  });
  expect(dialog).not.toBeNull();
  const violations: string[] = [];
  if (dialog) {
    if (dialog.radius !== token('radius-dialog')) violations.push(`확인 카드 border-radius: 실측 ${dialog.radius} · 기준 ${token('radius-dialog')}(--radius-dialog)`);
    if (dialog.borderWidth !== token('border-strong')) violations.push(`확인 카드 border-width: 실측 ${dialog.borderWidth} · 기준 3px`);
    if (tokenNameForColor(dialog.borderColor) !== 'accent') violations.push(`확인 카드 border-color: 실측 ${dialog.borderColor}(--${tokenNameForColor(dialog.borderColor) ?? '?'}) · 기준 --accent(SYSTEM.md 형태 "확인 카드 14 | 남색 3px")`);
    if (dialog.padding !== '36px 40px 36px 40px') violations.push(`확인 카드 padding: 실측 ${dialog.padding} · 기준 36px 40px(SYSTEM.md 간격)`);
  }
  expect(violations).toEqual([]);
});

test('감사 8: 모드 표시의 기본 자리가 화면 왼쪽 아래다', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  const m = await page.evaluate(() => {
    const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator');
    const r = el?.getBoundingClientRect();
    return r ? { left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight } : null;
  });
  expect(m).not.toBeNull();
  if (m) {
    // 왼쪽 아래 모서리에서 --space-6(32px) 안에 붙어 있고, 화면 왼쪽 절반에 있다.
    const corner = tokenPx('space-6');
    expect(m.left, '왼쪽 여백').toBeGreaterThanOrEqual(0);
    expect(m.left, '왼쪽 여백').toBeLessThanOrEqual(corner);
    expect(m.vh - m.bottom, '아래 여백').toBeGreaterThanOrEqual(0);
    expect(m.vh - m.bottom, '아래 여백').toBeLessThanOrEqual(corner);
    expect(m.right, '화면 왼쪽 절반').toBeLessThan(m.vw / 2);
  }
});

test('감사 9a: 글자 대비가 4.5:1 이상이다(실측 글자색 대 실측 바탕)', async ({ context, serviceWorker, openPopup, servePage }) => {
  const page = await context.newPage();
  const samples = await gatherAll({ page, serviceWorker, openPopup, servePage });
  assertCoverage(samples);
  const violations: string[] = [];
  for (const s of samples.filter((x) => x.hasText)) {
    const bg = compositeLayers(s.selfAndAncestorBgs);
    const fgRaw = parseColor(s.color);
    if (!fgRaw) continue;
    const fg = composite(fgRaw, bg);
    const ratio = contrast(fg, bg);
    if (ratio < 4.5) violations.push(`${label(s)} 글자 대비: 실측 ${ratio.toFixed(2)}:1 (${fmt(fg)} / ${fmt(bg)}) · 기준 ≥4.5:1`);
  }
  expect(violations).toEqual([]);
});

// UI 대비: 보이는 테두리·외곽선은 안쪽 바탕과 바깥 바탕 모두에 3:1. 흰 후광(--halo) 색 외곽선은
// 어두운 사이트용 분리선이라(SYSTEM.md 바탕 규칙) 흰 바탕 대비에서 뺀다. 테두리가 없는 채움
// 표시(번호표·모드 표시·보호 막대·머무르기 선)는 채움색이 바깥 바탕에 3:1.
const FILLED_INDICATORS = ['.hint-label#', '.mode-indicator#', '[data-part=confirm-guard-bar]#'];

test('감사 9b: UI(테두리·표시) 대비가 3:1 이상이다', async ({ context, serviceWorker, openPopup, servePage }) => {
  const page = await context.newPage();
  const samples = await gatherAll({ page, serviceWorker, openPopup, servePage });
  assertCoverage(samples);
  const violations = new Set<string>();
  for (const s of samples) {
    const outside = compositeLayers(s.ancestorBgs);
    const inside = compositeLayers(s.selfAndAncestorBgs);
    const checkLine = (what: string, raw: string): void => {
      const c = parseColor(raw);
      if (!c || c[3] === 0 || sameColor(c, HALO)) return;
      for (const [side, bg] of [
        ['안쪽', inside],
        ['바깥', outside],
      ] as const) {
        const ratio = contrast(composite(c, bg), bg);
        if (ratio < 3) violations.add(`${label(s).replace(/#\d+/, '#n')} ${what} 대 ${side} 바탕: 실측 ${ratio.toFixed(2)}:1 (${fmt(c)} / ${fmt(bg)}) · 기준 ≥3:1`);
      }
    };
    for (const b of visibleBorders(s)) checkLine('테두리', b.color);
    if (hasVisibleOutline(s)) checkLine('외곽선', s.outline.color);
    if (s.isSvg && s.stroke !== 'none') checkLine('선(stroke)', s.stroke);
    if (FILLED_INDICATORS.some((p) => s.name.startsWith(p)) && visibleBorders(s).length === 0) {
      const fill = parseColor(s.backgroundColor);
      if (fill && fill[3] > 0) {
        const ratio = contrast(composite(fill, outside), outside);
        if (ratio < 3) violations.add(`${label(s).replace(/#\d+/, '#n')} 채움 대 바깥 바탕: 실측 ${ratio.toFixed(2)}:1 · 기준 ≥3:1`);
      }
    }
  }
  expect([...violations]).toEqual([]);
});

test('감사 10: 한글 글자가 있는 모든 부품이 word-break: keep-all이다', async ({ context, serviceWorker, openPopup, servePage }) => {
  const page = await context.newPage();
  const samples = await gatherAll({ page, serviceWorker, openPopup, servePage });
  assertCoverage(samples);
  const violations = [
    ...new Set(
      samples
        .filter((s) => s.hasHangul && s.wordBreak !== 'keep-all')
        .map((s) => `${s.name.replace(/#\d+/, '')} (${s.where.replace(/\(.*\)/, '')}) word-break: 실측 ${s.wordBreak} · 기준 keep-all`),
    ),
  ];
  expect(violations).toEqual([]);
});

interface MotionMeasure {
  part: string;
  durations: number[];
}

async function measureMotion(page: Page, serviceWorker: Worker, reduce: boolean): Promise<{ parts: MotionMeasure[]; dwellMid: number | null }> {
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await seedMigrationFailure(serviceWorker);
  await patchSettings(serviceWorker, { dwellEnabled: true });
  const parts: MotionMeasure[] = [];
  const read = async (): Promise<void> => {
    const samples = await collect(page, 'overlay', 'motion');
    for (const s of samples) {
      const part = s.name.replace(/#\d+$/, '');
      if (!parts.some((p) => p.part === part)) {
        parts.push({ part, durations: s.transitionDuration.split(',').map((d) => Number.parseFloat(d)) });
      }
    }
  };

  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  await expect.poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.toast[data-visible="true"]') !== null)).toBe(true);
  await read();
  const tiny = await centerOf(page, '#btn-tiny');
  await page.mouse.move(tiny.x, tiny.y);
  await page.waitForTimeout(400);
  const dwellMid = await page.evaluate(() => {
    const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.dwell-progress');
    return el?.getAttribute('data-visible') === 'true' ? Number(el.getAttribute('data-progress')) : null;
  });
  await read();
  await page.mouse.move(900, 600);
  await page.waitForTimeout(350);
  await pressFUntilLabels(page, 2);
  await read();

  await page.goto('http://practice.test/danger.html');
  await waitForHelperReady(page);
  const del = await centerOf(page, '#btn-delete-solo');
  await page.mouse.move(del.x, del.y);
  await page.waitForTimeout(200);
  await read();
  await page.mouse.move(900, 600);
  await page.waitForTimeout(350);
  await openDangerConfirm(page);
  await read();
  return { parts, dwellMid };
}

test('감사 11: reducedMotion reduce에서 이동·나타남 transition이 0이고, 머무르기 진행·보호 막대는 남는다', async ({
  context,
  serviceWorker,
}) => {
  const page = await context.newPage();
  const violations: string[] = [];
  const kept = ['[data-part=confirm-guard-bar]'];
  const moving = ['[data-part=ring]', '.ring-danger-label', '.mode-indicator', '.hint-label', '.toast', '[data-part=confirm-dialog]'];

  // 기준선(움직임 줄이기 아님): SYSTEM.md 모션 표 — 테두리 이동 80ms, 나타남·모드 표시 옮김 120ms.
  const normal = await measureMotion(page, serviceWorker, false);
  const expectNormal: Record<string, number> = {
    '[data-part=ring]': 0.08,
    '.ring-danger-label': 0.08,
    '.mode-indicator': 0.12,
    '.hint-label': 0.12,
    '.toast': 0.12,
    '[data-part=confirm-dialog]': 0.12,
    '[data-part=confirm-guard-bar]': 1,
  };
  for (const [part, want] of Object.entries(expectNormal)) {
    const m = normal.parts.find((p) => p.part === part);
    if (!m) violations.push(`보통 ${part}: 측정되지 않음`);
    else if (!m.durations.every((d) => Math.abs(d - want) < 0.001)) violations.push(`보통 ${part} transition-duration: 실측 ${m.durations.join(',')}s · 기준 ${String(want)}s(SYSTEM.md 모션)`);
  }

  const reduced = await measureMotion(page, serviceWorker, true);
  for (const part of moving) {
    const m = reduced.parts.find((p) => p.part === part);
    if (!m) violations.push(`reduce ${part}: 측정되지 않음`);
    else if (!m.durations.every((d) => d === 0)) violations.push(`reduce ${part} transition-duration: 실측 ${m.durations.join(',')}s · 기준 0s`);
  }
  for (const part of kept) {
    const m = reduced.parts.find((p) => p.part === part);
    if (!m) violations.push(`reduce ${part}: 측정되지 않음`);
    else if (!m.durations.every((d) => Math.abs(d - 1) < 0.001)) violations.push(`reduce ${part} transition-duration: 실측 ${m.durations.join(',')}s · 기준 1s 유지`);
  }
  // 머무르기 진행은 CSS 전환이 아니라 매 프레임 값으로 차오른다 — reduce에서도 중간값(0~1 사이)이 보여야 한다.
  if (reduced.dwellMid === null || reduced.dwellMid <= 0.1 || reduced.dwellMid >= 0.95) {
    violations.push(`reduce 머무르기 진행: 400ms 시점 실측 ${String(reduced.dwellMid)} · 기준 0.1~0.95 사이(차오름 유지)`);
  }
  expect(violations).toEqual([]);
});

async function getTabId(serviceWorker: Worker, page: Page): Promise<number> {
  const tabs = await serviceWorker.evaluate((url) => chrome.tabs.query({ url }), page.url());
  const tabId = tabs[0]?.id;
  if (tabId === undefined) {
    throw new Error('탭을 찾지 못했다');
  }
  return tabId;
}

interface SizeSet {
  [key: string]: number;
}

// 화면 px(= CSS px × 확대 비율)로 부품 크기를 잰다.
async function measureSizes(page: Page, serviceWorker: Worker, factor: number): Promise<SizeSet> {
  await page.goto('http://practice.test/targets.html');
  await waitForHelperReady(page);
  const tiny = await centerOf(page, '#btn-tiny');
  await page.mouse.move(tiny.x, tiny.y);
  await expect
    .poll(() => page.evaluate(() => document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('[data-part="ring"]')?.getAttribute('data-visible')))
    .toBe('true');
  await serviceWorker.evaluate(({ id, f }) => chrome.tabs.setZoom(id, f), { id: await getTabId(serviceWorker, page), f: factor });
  // 배율이 반영될 때까지(모드 표시 글자가 화면에서 18px).
  await expect
    .poll(async () => {
      const fs = await page.evaluate(() => {
        const el = document.querySelector('tremor-helper-root')?.shadowRoot?.querySelector('.mode-indicator');
        return el ? Number.parseFloat(getComputedStyle(el).fontSize) : 0;
      });
      return Math.abs(fs * factor - tokenPx('text-label')) < 0.5;
    })
    .toBe(true);
  await page.waitForTimeout(250);
  await pressFUntilLabels(page, 2);
  const a = await collect(page, 'overlay', `zoom ${String(factor)}`);
  const one = (prefix: string): Sample => {
    const s = a.find((x) => x.name.startsWith(prefix));
    if (!s) throw new Error(`${prefix} 없음`);
    return s;
  };
  const indicator = one('.mode-indicator#');
  const ring = one('[data-part=ring]#');
  const hint = one('.hint-label#');

  // 확대는 출처별로 기억된다 — 같은 탭에서 danger.html도 같은 배율로 열린다.
  const b = await openDangerConfirm(page);
  const two = (prefix: string): Sample => {
    const s = b.find((x) => x.name.startsWith(prefix));
    if (!s) throw new Error(`${prefix} 없음`);
    return s;
  };
  const dialog = two('[data-part=confirm-dialog]#');
  const confirmBtn = two('[data-part=confirm-button-confirm]#');
  const f = factor;
  return {
    '모드 표시 높이': indicator.rect.height * f,
    '모드 표시 폭': indicator.rect.width * f,
    '테두리 두께': (ring.borders[0]?.width ?? 0) * f,
    '테두리 후광 두께': ring.outline.width * f,
    '테두리 radius': (ring.radii[0] ?? 0) * f,
    '번호표 폭': hint.rect.width * f,
    '번호표 높이': hint.rect.height * f,
    '확인 카드 폭': dialog.rect.width * f,
    '확인 버튼 높이': confirmBtn.rect.height * f,
  };
}

test('감사 12: 브라우저 확대 110%·200%에서 오버레이 부품의 화면 크기가 100%와 같다', async ({ context, serviceWorker }) => {
  const violations: string[] = [];
  const basePage = await context.newPage();
  const base = await measureSizes(basePage, serviceWorker, 1);
  await basePage.close();
  for (const factor of [1.1, 2]) {
    const page = await context.newPage();
    const sizes = await measureSizes(page, serviceWorker, factor);
    for (const [name, value] of Object.entries(sizes)) {
      const want = base[name] ?? Number.NaN;
      // 글자에 따라 폭이 정해지는 모드 표시 폭만 반올림 오차 1.5px, 나머지 1px.
      const tolerance = name === '모드 표시 폭' ? 1.5 : 1;
      if (!(Math.abs(value - want) <= tolerance)) {
        violations.push(`확대 ${String(factor * 100)}% ${name}: 실측(화면) ${value.toFixed(2)}px · 기준 100%와 같음 ${want.toFixed(2)}px`);
      }
    }
    // 이 탭의 확대를 되돌려 다음 배율 측정이 1배에서 시작하게 한다.
    await serviceWorker.evaluate(({ id }) => chrome.tabs.setZoom(id, 1), { id: await getTabId(serviceWorker, page) });
    await page.close();
  }
  expect(violations).toEqual([]);
});
