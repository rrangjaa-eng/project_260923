import { z } from 'zod';

export const PORTABLE_HAND_HOST = 'kr.tremor_helper.hand';
const REQUEST_TTL_MS = 2000;

const HandResponseSchema = z.object({
  version: z.literal(1),
  requestId: z.string(),
  status: z.enum(['completed', 'refused']),
  reason: z.string().optional(),
  hostVersion: z.string().optional(),
});
export type HandResponse = z.infer<typeof HandResponseSchema>;

export type PointerCommand =
  | { action: 'pointer.move' | 'pointer.click' | 'pointer.doubleClick'; x: number; y: number; button?: 'left' | 'right' | undefined }
  | { action: 'pointer.down' | 'pointer.up'; button?: 'left' | 'right' | undefined }
  | { action: 'pointer.scroll'; delta: number }
  | { action: 'emergency.stop' | 'host.ping' };

interface PendingRequest {
  resolve: (response: HandResponse) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface PortableHand {
  connected(): boolean;
  connect(): void;
  disconnect(): void;
  send(command: PointerCommand): Promise<HandResponse>;
}

function requestId(): string {
  return crypto.randomUUID().replaceAll('-', '_');
}

export function createPortableHand(): PortableHand {
  let port: chrome.runtime.Port | null = null;
  const pending = new Map<string, PendingRequest>();

  function rejectPending(reason: string): void {
    for (const [id, request] of pending) {
      clearTimeout(request.timer);
      request.resolve({ version: 1, requestId: id, status: 'refused', reason });
    }
    pending.clear();
  }

  return {
    connected: () => port !== null,
    connect() {
      if (port !== null) return;
      let nextPort: chrome.runtime.Port;
      try {
        nextPort = chrome.runtime.connectNative(PORTABLE_HAND_HOST);
      } catch {
        return;
      }
      port = nextPort;
      nextPort.onMessage.addListener((raw) => {
        const parsed = HandResponseSchema.safeParse(raw);
        if (!parsed.success) return;
        const request = pending.get(parsed.data.requestId);
        if (!request) return;
        clearTimeout(request.timer);
        pending.delete(parsed.data.requestId);
        request.resolve(parsed.data);
      });
      nextPort.onDisconnect.addListener(() => {
        if (port === nextPort) port = null;
        rejectPending('host-disconnected');
      });
    },
    disconnect() {
      port?.disconnect();
      port = null;
      rejectPending('host-disconnected');
    },
    send(command) {
      if (port === null) {
        return Promise.resolve({ version: 1, requestId: 'not_connected', status: 'refused', reason: 'host-not-connected' });
      }
      const id = requestId();
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          resolve({ version: 1, requestId: id, status: 'refused', reason: 'host-timeout' });
        }, REQUEST_TTL_MS);
        pending.set(id, { resolve, timer });
        port?.postMessage({ version: 1, requestId: id, expiresAt: Date.now() + REQUEST_TTL_MS, ...command });
      });
    },
  };
}
