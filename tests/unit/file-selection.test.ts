import { describe, expect, it, vi } from 'vitest';
import { FileSelection, createPracticeFileProvider, type FileRequest } from '../../src/core/file-selection';

const request = (): FileRequest => ({ sessionId: 's1', requestId: 'r1', documentGeneration: 'doc1', modeGeneration: 1, expiresAt: 10000 });
function setup() { const provider = createPracticeFileProvider(); return { provider, flow: new FileSelection(provider), context: request() }; }

describe('file selection safety', () => {
  it('requires a selected token and one second before a single explicit confirmation', async () => {
    const { flow, provider, context } = setup();
    expect(flow.begin(context, 0)).toBe(true);
    expect(provider.applied).toEqual([]);
    expect(await flow.confirm(context, 1500)).toBe('refused');
    flow.select('sample-text', 1600);
    expect(await flow.confirm(context, 2599)).toBe('refused');
    expect(provider.applied).toEqual([]);
    expect(await flow.confirm(context, 2600)).toBe('done');
    expect(provider.applied).toEqual(['sample-text']);
    expect(await flow.confirm(context, 3000)).toBe('refused');
    expect(flow.begin(context, 3000)).toBe(false);
    expect(provider.applied).toEqual(['sample-text']);
  });
  it('rejects invented tokens and exposes only the fixed name/folder', () => {
    const { flow, context } = setup(); flow.begin(context, 0);
    expect(flow.select('/etc/passwd', 1)).toBe(false);
    expect(flow.select('sample-text', 1)).toBe(true);
    expect(flow.selected).toEqual({ token: 'sample-text', name: '연습문서.txt', folder: '연습 폴더' });
  });
  it.each(['documentGeneration', 'modeGeneration', 'sessionId', 'requestId'] as const)('rejects changed %s immediately before execute', async (key) => {
    const { flow, provider, context } = setup(); flow.begin(context, 0); flow.select('sample-text', 0);
    const changed = { ...context, [key]: key === 'modeGeneration' ? 2 : 'other' };
    expect(await flow.confirm(changed, 1500)).toBe('refused');
    expect(provider.applied).toEqual([]); expect(flow.selected).toBeNull();
  });
  it('expiry discards approval', async () => {
    const { flow, provider, context } = setup(); flow.begin(context, 0); flow.select('sample-text', 0);
    expect(await flow.confirm(context, 10000)).toBe('refused'); expect(provider.applied).toEqual([]);
  });
  it.each(['cancel', 'pause', 'stop'] as const)('%s discards approval and preserves the draft', async (event) => {
    const { flow, provider, context } = setup(); flow.draft = '내 문장'; flow.begin(context, 0); flow.select('sample-text', 0); flow[event]();
    expect(await flow.confirm(context, 1500)).toBe('refused'); expect(provider.applied).toEqual([]);
    expect(flow.selected).toBeNull(); expect(flow.draft).toBe('내 문장');
    if (event === 'pause') { flow.resume(); expect(flow.state).toBe('selecting'); expect(await flow.confirm(context, 1600)).toBe('refused'); }
    if (event === 'stop') expect(flow.begin({ ...context, requestId: 'r2' }, 1600)).toBe(false);
  });
  it('lost acknowledgement after dispatch is unknown and never retries', async () => {
    const provider = createPracticeFileProvider('lost'); const flow = new FileSelection(provider); const context = request();
    flow.begin(context, 0); flow.select('sample-text', 0);
    expect(await flow.confirm(context, 1500)).toBe('unknown'); expect(flow.state).toBe('unknown');
    expect(await flow.confirm(context, 2000)).toBe('refused'); expect(provider.applied).toEqual(['sample-text']);
  });
  it('late success cannot undo stop or start another request', async () => {
    let release: (() => void) | undefined;
    const applied: string[] = [];
    const flow = new FileSelection({ files: createPracticeFileProvider().files, apply: (token) => { applied.push(token); return new Promise<'done'>((resolve) => { release = () => { resolve('done'); }; }); } });
    const context = request(); flow.begin(context, 0); flow.select('sample-text', 0);
    const pending = flow.confirm(context, 1500); expect(flow.state).toBe('executing'); flow.stop(); release?.();
    expect(await pending).toBe('unknown'); expect(flow.state).toBe('stopped'); expect(applied).toEqual(['sample-text']);
    expect(flow.begin({ ...context, requestId: 'r2' }, 2000)).toBe(false);
  });
});

it('reply deadline is unknown; a late result cannot complete or retry it', async () => {
  vi.useFakeTimers();
  try {
    let release: (() => void) | undefined;
    const applied: string[] = [];
    const flow = new FileSelection({ files: createPracticeFileProvider().files, apply: (token) => { applied.push(token); return new Promise<'done'>((resolve) => { release = () => { resolve('done'); }; }); } });
    const context = request(); flow.begin(context, 0); flow.select('sample-text', 0);
    const pending = flow.confirm(context, 1500);
    await vi.advanceTimersByTimeAsync(3000);
    expect(flow.state).toBe('unknown');
    expect(await pending).toBe('unknown');
    release?.(); await Promise.resolve();
    expect(flow.state).toBe('unknown'); expect(applied).toEqual(['sample-text']);
  } finally { vi.useRealTimers(); }
});

it.each(['done', 'lost'] as const)('a dispatched %s request cannot replay through repeated pause/resume', async (result) => {
  const provider = createPracticeFileProvider(result); const flow = new FileSelection(provider); const context = request();
  flow.begin(context, 0); flow.select('sample-text', 0); await flow.confirm(context, 1500);
  flow.pause(); flow.pause(); flow.resume();
  expect(flow.select('sample-text', 2000)).toBe(false);
  expect(await flow.confirm(context, 3500)).toBe('refused'); expect(provider.applied).toEqual(['sample-text']);
  expect(flow.begin({ ...context, requestId: 'r2' }, 4000)).toBe(true);
});
it('an interrupted pending dispatch blocks a second request and cannot replay', async () => {
  let release: (() => void) | undefined; const applied: string[] = [];
  const flow = new FileSelection({ files: createPracticeFileProvider().files, apply: (token) => { applied.push(token); return new Promise<'done'>((resolve) => { release = () => { resolve('done'); }; }); } });
  const context = request(); flow.begin(context, 0); flow.select('sample-text', 0); const pending = flow.confirm(context, 1500);
  flow.pause(); flow.pause(); flow.resume();
  expect(flow.select('sample-text', 2000)).toBe(false);
  expect(flow.begin({ ...context, requestId: 'r2' }, 2000)).toBe(false);
  release?.(); expect(await pending).toBe('unknown'); expect(applied).toEqual(['sample-text']);
  expect(flow.begin({ ...context, requestId: 'r2' }, 3000)).toBe(true);
});
