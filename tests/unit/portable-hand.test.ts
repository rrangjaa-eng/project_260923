import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPortableHand, PORTABLE_HAND_HOST } from '../../src/worker/portable-hand';

interface FakePort {
  name: string;
  onMessage: { addListener(callback: (message: unknown) => void): void };
  onDisconnect: { addListener(callback: () => void): void };
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  emitMessage(message: unknown): void;
  emitDisconnect(): void;
}

function fakePort(): FakePort {
  let messageListener: (message: unknown) => void = () => undefined;
  let disconnectListener: () => void = () => undefined;
  return {
    name: PORTABLE_HAND_HOST,
    onMessage: { addListener(callback) { messageListener = callback; } },
    onDisconnect: { addListener(callback) { disconnectListener = callback; } },
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    emitMessage(message) { messageListener(message); },
    emitDisconnect() { disconnectListener(); },
  };
}

describe('portable hand client', () => {
  let port: FakePort;

  beforeEach(() => {
    vi.useFakeTimers();
    port = fakePort();
    vi.stubGlobal('chrome', { runtime: { connectNative: vi.fn(() => port) } });
    vi.stubGlobal('crypto', { randomUUID: () => '12345678-1234-1234-1234-123456789abc' });
  });

  it('connects to the fixed native host and sends a short-lived versioned request', async () => {
    const hand = createPortableHand();
    hand.connect();
    const result = hand.send({ action: 'pointer.click', x: 120, y: 240 });

    expect(chrome.runtime.connectNative).toHaveBeenCalledWith(PORTABLE_HAND_HOST);
    const sent = port.postMessage.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({ version: 1, requestId: '12345678_1234_1234_1234_123456789abc', action: 'pointer.click', x: 120, y: 240 });
    expect((sent.expiresAt as number) - Date.now()).toBe(2000);

    port.emitMessage({ version: 1, requestId: sent.requestId, status: 'completed', hostVersion: '0.1.0' });
    await expect(result).resolves.toMatchObject({ status: 'completed' });
  });

  it('refuses locally when the native host is not connected', async () => {
    await expect(createPortableHand().send({ action: 'emergency.stop' })).resolves.toMatchObject({ status: 'refused', reason: 'host-not-connected' });
  });

  it('keeps the extension usable when native connection creation throws', () => {
    vi.mocked(chrome.runtime.connectNative).mockImplementation(() => {
      throw new Error('host missing');
    });
    const hand = createPortableHand();
    expect(() => {
      hand.connect();
    }).not.toThrow();
    expect(hand.connected()).toBe(false);
  });

  it('times out an unanswered request and rejects pending requests on disconnect', async () => {
    const hand = createPortableHand();
    hand.connect();
    const timedOut = hand.send({ action: 'host.ping' });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(timedOut).resolves.toMatchObject({ status: 'refused', reason: 'host-timeout' });

    const disconnected = hand.send({ action: 'pointer.scroll', delta: -120 });
    port.emitDisconnect();
    await expect(disconnected).resolves.toMatchObject({ status: 'refused', reason: 'host-disconnected' });
    expect(hand.connected()).toBe(false);
  });

  it('ignores malformed and unknown responses', async () => {
    const hand = createPortableHand();
    hand.connect();
    const result = hand.send({ action: 'host.ping' });
    port.emitMessage({ status: 'completed' });
    port.emitMessage({ version: 1, requestId: 'someone_else', status: 'completed' });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toMatchObject({ status: 'refused', reason: 'host-timeout' });
  });
});
