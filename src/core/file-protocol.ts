import { z } from 'zod';
export interface FileContext { sessionId: string; documentGeneration: string; modeGeneration: number; handoffGeneration: number }
const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const generation = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const identity = { version: z.literal(1), sessionId: id, requestId: id, documentGeneration: id, modeGeneration: generation, handoffGeneration: generation };
const base = { ...identity, expiresAt: generation };
const commands = ['list-files', 'select-file', 'confirm-file', 'cancel', 'pause', 'resume', 'stop', 'status'] as const;
const token = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const Request = z.discriminatedUnion('command', [
  z.object({ ...base, command: z.literal('select-file'), fileToken: token }).strict(),
  z.object({ ...base, command: z.literal('confirm-file'), fileToken: token }).strict(),
  ...(['list-files', 'cancel', 'pause', 'resume', 'stop', 'status'] as const).map((command) => z.object({ ...base, command: z.literal(command) }).strict()),
]);
const Reply = z.object({ ...identity, command: z.enum(commands), result: z.enum(['done', 'refused', 'unknown']) }).strict();
export type FileProtocolRequest = z.infer<typeof Request>;
export type FileProtocolReply = z.infer<typeof Reply>;
function sameContext(a: FileContext, b: FileContext) {
  return a.sessionId === b.sessionId && a.documentGeneration === b.documentGeneration && a.modeGeneration === b.modeGeneration && a.handoffGeneration === b.handoffGeneration;
}
export function parseFileRequest(input: unknown, now: number, context: FileContext): FileProtocolRequest | null {
  if (!Number.isFinite(now)) return null;
  const parsed = Request.safeParse(input);
  if (!parsed.success || !sameContext(parsed.data, context)) return null;
  if (parsed.data.expiresAt > now + 60000 || (parsed.data.command !== 'stop' && parsed.data.expiresAt <= now)) return null;
  return parsed.data;
}
export class FileReplyGate {
  status: 'idle' | 'waiting' | 'unknown' = 'idle';
  private context: FileContext;
  private expected: FileProtocolRequest | null = null;
  private replyDeadline = 0;
  private readonly used = new Set<string>();
  constructor(context: FileContext) { this.context = { ...context }; }
  arm(payload: unknown, now: number): boolean {
    this.expire(now);
    const request = parseFileRequest(payload, now, this.context);
    if (!request || (this.expected && request.command !== 'stop')) return false;
    const key = JSON.stringify([request.sessionId, request.requestId]);
    if (this.used.has(key)) return false;
    this.used.add(key); this.expected = request;
    this.replyDeadline = request.command === 'stop' ? now + 3000 : Math.min(request.expiresAt, now + 3000);
    this.status = 'waiting'; return true;
  }
  take(payload: unknown, now: number): FileProtocolReply | null {
    if (!Number.isFinite(now)) return null;
    this.expire(now);
    const expected = this.expected; if (!expected) return null;
    const parsed = Reply.safeParse(payload);
    if (!parsed.success || !sameContext(parsed.data, expected) || parsed.data.requestId !== expected.requestId || parsed.data.command !== expected.command) return null;
    this.expected = null; this.status = parsed.data.result === 'unknown' ? 'unknown' : 'idle'; return parsed.data;
  }
  changeContext(context: FileContext) {
    if (!sameContext(this.context, context)) { this.status = this.expected ? 'unknown' : 'idle'; this.expected = null; }
    this.context = { ...context };
  }
  expire(now: number): boolean {
    if (this.expected && Number.isFinite(now) && now >= this.replyDeadline) { this.expected = null; this.status = 'unknown'; return true; }
    return false;
  }
}
