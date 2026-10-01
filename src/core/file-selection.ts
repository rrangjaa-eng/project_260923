export interface FileRequest { sessionId: string; requestId: string; documentGeneration: string; modeGeneration: number; expiresAt: number }
export interface PracticeFile { token: string; name: string; folder: string }
export interface FileProvider { files: readonly PracticeFile[]; apply(token: string): Promise<'done' | 'refused' | 'unknown'> }
export type FileSelectionState = 'idle' | 'selecting' | 'confirming' | 'executing' | 'done' | 'cancelled' | 'paused' | 'unknown' | 'stopped';

export function createPracticeFileProvider(result: 'done' | 'lost' = 'done') {
  const files: readonly PracticeFile[] = Object.freeze([
    Object.freeze({ token: 'sample-text', name: '연습문서.txt', folder: '연습 폴더' }),
    Object.freeze({ token: 'sample-picture', name: '연습그림.png', folder: '연습 폴더' }),
  ]);
  const applied: string[] = [];
  return { files, applied, apply(token: string): Promise<'done' | 'refused' | 'unknown'> {
    if (!files.some((file) => file.token === token)) return Promise.resolve('refused');
    applied.push(token);
    return result === 'lost' ? Promise.reject(new Error('연습 응답 유실')) : Promise.resolve('done');
  } };
}

export class FileSelection {
  state: FileSelectionState = 'idle';
  selected: PracticeFile | null = null;
  draft = '';
  private request: FileRequest | null = null;
  private selectedAt = 0;
  private revision = 0;
  private dispatched = false;
  private awaitingReply = false;
  private readonly usedRequests = new Set<string>();
  constructor(readonly provider: FileProvider) {}

  begin(request: FileRequest, now: number): boolean {
    const key = JSON.stringify([request.sessionId, request.requestId]);
    if (this.awaitingReply || !['idle', 'done', 'cancelled', 'unknown'].includes(this.state) || this.usedRequests.has(key) || now >= request.expiresAt) return false;
    this.usedRequests.add(key); this.request = { ...request }; this.selected = null;
    this.revision++; this.dispatched = false; this.state = 'selecting'; return true;
  }
  select(token: string, now: number): boolean {
    if (this.dispatched || this.state !== 'selecting') return false;
    const file = this.provider.files.find((item) => item.token === token);
    if (!file || !this.request || now >= this.request.expiresAt) return false;
    this.selected = { ...file }; this.selectedAt = now; this.state = 'confirming'; return true;
  }
  async confirm(context: FileRequest, now: number): Promise<'done' | 'refused' | 'unknown'> {
    if (this.dispatched || this.state !== 'confirming' || !this.selected || !this.request) return 'refused';
    const current = this.request;
    if (now >= current.expiresAt || current.sessionId !== context.sessionId || current.requestId !== context.requestId
      || current.documentGeneration !== context.documentGeneration || current.modeGeneration !== context.modeGeneration) {
      this.cancel(); return 'refused';
    }
    if (now - this.selectedAt < 1000) return 'refused';
    const token = this.selected.token;
    if (!this.provider.files.some((file) => file.token === token && file.name === this.selected?.name && file.folder === this.selected.folder)) {
      this.cancel(); return 'refused';
    }
    const revision = this.revision;
    this.dispatched = true; this.awaitingReply = true; this.state = 'executing'; this.selected = null;
    let result: 'done' | 'refused' | 'unknown';
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      result = await Promise.race([
        this.provider.apply(token),
        new Promise<'unknown'>((resolve) => { timer = setTimeout(() => { resolve('unknown'); }, 3000); }),
      ]);
    } catch { result = 'unknown'; }
    finally { this.awaitingReply = false; if (timer !== undefined) clearTimeout(timer); }
    if (revision !== this.revision) return 'unknown';
    this.state = result === 'refused' ? 'cancelled' : result; return result;
  }
  cancel() { this.interrupt('cancelled'); }
  pause() { this.interrupt('paused'); }
  resume() { if (this.state === 'paused') { this.state = 'selecting'; this.selected = null; } }
  stop() { this.interrupt('stopped'); }
  private interrupt(next: 'cancelled' | 'paused' | 'stopped') {
    if (this.state === 'stopped') return;
    this.revision++; this.selected = null;
    if (next === 'stopped') this.state = 'stopped';
    else if (this.dispatched) this.state = this.state === 'done' ? 'done' : 'unknown';
    else this.state = next;
  }
}
