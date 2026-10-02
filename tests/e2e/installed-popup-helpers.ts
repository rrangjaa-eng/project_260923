import { expect, type CDPSession, type Worker } from '@playwright/test';

// 실제 action popup은 Playwright context.pages()에 나타나지 않는다. 브라우저가 연
// popup target에 CDP로 붙어 실제 DOM과 trusted 키·포인터 이벤트를 사용한다.
export async function nativePopup(browserCDP: CDPSession, worker: Worker, extensionId: string) {
  await worker.evaluate(() => chrome.action.openPopup());
  let targetId = '';
  await expect.poll(async () => {
    const { targetInfos } = await browserCDP.send('Target.getTargets');
    targetId = targetInfos.find((target) => target.url === `chrome-extension://${extensionId}/popup.html`)?.targetId ?? '';
    return targetId;
  }).not.toBe('');
  const { sessionId } = await browserCDP.send('Target.attachToTarget', { targetId, flatten: false });
  let serial = 0;
  const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>();
  browserCDP.on('Target.receivedMessageFromTarget', (event) => {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message) as { id?: number; result?: unknown; error?: { message: string } };
    if (message.id === undefined) return;
    const request = pending.get(message.id); pending.delete(message.id);
    if (message.error) request?.reject(new Error(message.error.message));
    else request?.resolve(message.result);
  });
  async function send(method: string, params: Record<string, unknown> = {}) {
    const id = ++serial;
    const response = new Promise<unknown>((resolve, reject) => { pending.set(id, { resolve, reject }); });
    await browserCDP.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) });
    return response;
  }
  async function evaluate<T>(expression: string): Promise<T> {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }) as { result: { value: T }; exceptionDetails?: unknown };
    if (result.exceptionDetails) throw new Error('Popup evaluation failed');
    return result.result.value;
  }
  const selected = () => evaluate<string>(`document.querySelector('#app')?.shadowRoot?.querySelector('[data-switch-selected=true]')?.textContent ?? ''`);
  async function down(repeat=false) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32,autoRepeat:repeat });
  }
  async function up() {
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  }
  async function space() {
    await down();await up();
  }
  async function choose(label: string) {
    await expect.poll(selected, { timeout: 20000, intervals: [50] }).toContain(label);
    await space();
  }
  async function click(label: string) {
    const point = await evaluate<{ x: number; y: number }>(`(() => { const el=Array.from(document.querySelector('#app').shadowRoot.querySelectorAll('button')).find(el=>el.textContent.includes(${JSON.stringify(label)})); el.scrollIntoView({block:'nearest'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  }
  return { choose, space, down, up, click, evaluate, selected, targetId };
}
