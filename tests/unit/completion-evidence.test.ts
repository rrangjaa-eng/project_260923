import { afterEach, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/check-completion-evidence.ts', import.meta.url));
const directories: string[] = [];
afterEach(() => { directories.splice(0).forEach(path => { rmSync(path, { recursive: true, force: true }); }); });

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'completion-evidence-'));
  directories.push(directory);
  const write = (path: string, value: unknown) => { writeFileSync(join(directory, path), JSON.stringify(value)); };
  const git = (...args: string[]) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  mkdirSync(join(directory, 'src')); mkdirSync(join(directory, 'docs'));
  writeFileSync(join(directory, 'src/page.ts'), 'export const version = 1;\n');
  write('package.json', {});
  write('docs/local.json', { unit: { passed: 1, failed: 0 } });
  write('docs/reviews.json', { findings: [] });
  git('init', '-q'); git('config', 'user.name', 'Evidence Fixture'); git('config', 'user.email', 'fixture@example.invalid');
  git('add', '.'); git('commit', '-qm', 'fixture');
  const head = git('rev-parse', 'HEAD');
  write('docs/local.json', {product_commit:head,unit:{passed:1,failed:0}});
  write('docs/reviews.json', {tested_commit:head,status:'classified',findings:[]});
  const report = {
    schemaVersion: 1, productCommit: head, observedAt: new Date().toISOString(), scope: 'fixture bounded change', requiredChecks: ['unit'],
    checks: [{ name: 'unit', status: 'completed', conclusion: 'success', testedCommit: head, evidence: 'docs/local.json' }],
    reviewInventory: { status: 'classified', testedCommit: head, evidence: 'docs/reviews.json', findings: [] as { id: string; classification: string; status: string; evidence: string }[] },
    ciEvidence: 'docs/ci.json',
  };
  const ci = { product_commit: head, status: 'completed', conclusion: 'success', run_id: 123, url: 'https://github.com/example/project/actions/runs/123', completed_at_utc: new Date(Date.now() - 1000).toISOString(), unit: { passed: 1, failed: 0, total: 1 }, browser: { passed: 1, total: 1, failed: 0, flaky: 0, skipped: 0 } };
  const run = (...args: string[]) => {
    write('docs/ci.json', ci); write('docs/report.json', report);
    return spawnSync(process.execPath, ['--experimental-strip-types', script, 'docs/report.json', ...args], { cwd: directory, encoding: 'utf8' });
  };
  return { directory, git, write, head, report, ci, run };
}

it('rejects a pending CI even when the completion report says its unit check passed', () => {
  const f = fixture(); f.ci.status = 'in_progress';
  const result = f.run();
  expect(result.status).toBe(1); expect(result.stderr).toContain('CI 완료');
});

it('accepts coherent completed evidence without claiming actual compliance', () => {
  const f = fixture(); const result = f.run();
  expect(result.status).toBe(0); expect(result.stdout).toContain('정합성 통과');
  expect(result.stdout).toContain('증명하지 않습니다');
});
it.each(['failure', 'cancelled', 'unknown', 'pending'])('rejects CI conclusion %s', conclusion => {
  const f = fixture(); f.ci.conclusion = conclusion;
  expect(f.run().status).toBe(1);
});
it.each(['queued', 'in_progress', 'unknown'])('rejects required check status %s', status => {
  const f = fixture(); const check = f.report.checks[0]; if (!check) throw new Error('fixture missing check');
  check.status = status; expect(f.run().status).toBe(1);
});
it('rejects a missing required check and unreadable evidence', () => {
  const f = fixture(); f.report.requiredChecks.push('browser');
  const check = f.report.checks[0]; if (!check) throw new Error('fixture missing check');
  check.evidence = 'docs/missing.json';
  const result = f.run(); expect(result.status).toBe(1);
  expect(result.stderr).toContain('필수 검사 누락'); expect(result.stderr).toContain('증거를 읽을 수 없음');
});
it.each(['unclassified', 'unknown', 'pending'])('rejects review inventory %s', status => {
  const f = fixture(); f.report.reviewInventory.status = status;
  expect(f.run().status).toBe(1);
});
it.each([
  ['unknown', 'resolved'], ['actionable', 'unresolved'], ['actionable', 'unknown'],
])('rejects review classification/resolution %s/%s', (classification, status) => {
  const f = fixture(); f.report.reviewInventory.findings.push({ id: 'P2-1', classification, status, evidence: 'docs/reviews.json' });
  const result = f.run(); expect(result.status).toBe(1); expect(result.stderr).toContain('미분류·미해결 리뷰');
});
it('rejects a report target that is not the checked-out HEAD', () => {
  const f = fixture(); f.report.productCommit = 'a'.repeat(40);
  const result = f.run(); expect(result.status).toBe(1); expect(result.stderr).toContain('보고 대상 HEAD');
});
it('rejects a stale CI even if other records name the current HEAD', () => {
  const f = fixture(); f.ci.product_commit = 'a'.repeat(40);
  expect(f.run().stderr).toContain('CI HEAD 불일치');
});
it('rejects stale review evidence separately from successful CI', () => {
  const f = fixture(); f.report.reviewInventory.testedCommit = 'a'.repeat(40);
  expect(f.run().stderr).toContain('리뷰 HEAD 불일치');
});
it('rejects uncommitted source and untracked test changes', () => {
  const f = fixture(); writeFileSync(join(f.directory, 'src/page.ts'), 'export const version = 2;\n');
  expect(f.run().stderr).toContain('미커밋 변경');
  f.git('restore', 'src/page.ts'); mkdirSync(join(f.directory, 'tests')); writeFileSync(join(f.directory, 'tests/new.test.ts'), '');
  expect(f.run().stderr).toContain('미커밋 변경');
});
it('reuses an existing CI only with explicit opt-in and Git-proven docs-only changes', () => {
  const f = fixture(); f.write('docs/after.json', { note: 'docs-only commit' }); f.git('add', 'docs/after.json'); f.git('commit', '-qm', 'docs only');
  f.report.productCommit = f.git('rev-parse', 'HEAD');
  expect(f.run().status).toBe(1);
  const reused = f.run('--reuse-docs-only'); expect(reused.status).toBe(0); expect(reused.stdout).toContain('기존 근거 재사용');
});
it('refuses old evidence after committed product changes even with reuse requested', () => {
  const f = fixture(); writeFileSync(join(f.directory, 'src/page.ts'), 'export const version = 2;\n');
  f.git('add', 'src/page.ts'); f.git('commit', '-qm', 'source change'); f.report.productCommit = f.git('rev-parse', 'HEAD');
  expect(f.run('--reuse-docs-only').status).toBe(1);
});
it.each(['failed', 'flaky', 'skipped'] as const)('refuses CI browser %s count above zero', key => {
  const f = fixture(); f.ci.browser[key] = 1;
  expect(f.run().status).toBe(1);
});
it('rejects inconsistent CI totals instead of trusting a success label', () => {
  const f = fixture(); f.ci.unit.total = 2; f.ci.browser.total = 2;
  expect(f.run().status).toBe(1);
});
it.each(['not-a-date', '2099-01-01T00:00:00Z', '2000-01-01T00:00:00Z'])('rejects invalid, future or pre-completion observation %s', timestamp => {
  const f = fixture(); f.report.observedAt = timestamp;
  expect(f.run().status).toBe(1);
});
it('rejects a CI URL not bound to its actual run ID', () => {
  const f = fixture(); f.ci.url = 'https://github.com/example/project/actions/runs/999';
  expect(f.run().status).toBe(1);
});
it('rejects a future CI completion timestamp', () => {
  const f = fixture(); f.ci.completed_at_utc = '2099-01-01T00:00:00Z';
  expect(f.run().status).toBe(1);
});
it('rejects committed product CSS under docs even with reuse requested', () => {
  const f = fixture(); mkdirSync(join(f.directory, 'docs/design'));
  writeFileSync(join(f.directory, 'docs/design/tokens.css'), ':root { --accent: red; }');
  f.git('add', 'docs/design/tokens.css'); f.git('commit', '-qm', 'product CSS'); f.report.productCommit = f.git('rev-parse', 'HEAD');
  expect(f.run('--reuse-docs-only').status).toBe(1);
});
it('rejects untracked executable evidence under docs', () => {
  const f = fixture(); writeFileSync(join(f.directory, 'docs/check.ts'), 'export const changed = true;');
  expect(f.run().status).toBe(1);
});

it('rejects old evidence after a source file is renamed into a documentation extension', () => {
  const f = fixture(); f.git('mv', 'src/page.ts', 'docs/page.md'); f.git('commit', '-qm', 'rename source');
  f.report.productCommit = f.git('rev-parse', 'HEAD');
  const result = f.run('--reuse-docs-only'); expect(result.status).toBe(1); expect(result.stderr).toContain('CI HEAD 불일치');
});
it('rejects a staged product CSS rename into a documentation extension', () => {
  const f = fixture(); writeFileSync(join(f.directory, 'docs/tokens.css'), ':root { --accent: red; }');
  f.git('add', 'docs/tokens.css'); f.git('commit', '-qm', 'product CSS'); const head = f.git('rev-parse', 'HEAD');
  f.report.productCommit = head; f.ci.product_commit = head; f.report.reviewInventory.testedCommit = head;
  const check = f.report.checks[0]; if (!check) throw new Error('fixture missing check'); check.testedCommit = head;
  f.git('mv', 'docs/tokens.css', 'docs/foo.md');
  const result = f.run(); expect(result.status).toBe(1); expect(result.stderr).toContain('미커밋 변경');
});
it.each(['failure', 'stale', 'unparseable'])('rejects contradictory unit evidence: %s', state => {
  const f = fixture();
  f.write('docs/local.json', state === 'unparseable' ? 'unit passed' : {product_commit: state === 'stale' ? 'a'.repeat(40) : f.head, unit:{passed:1,failed:state === 'failure' ? 1 : 0}});
  expect(f.run().status).toBe(1);
});
it.each(['typecheck','lint','browser','ui'])('rejects failed original %s evidence despite a successful report', name => {
  const f = fixture();const check = f.report.checks[0]; if (!check) throw new Error('fixture missing check');
  check.name = name; f.report.requiredChecks = [name];
  f.write('docs/local.json', {product_commit:f.head,[name]:name === 'typecheck'||name === 'lint' ? 'failure' : {passed:1,failed:1,flaky:0,skipped:0}});
  expect(f.run().status).toBe(1);
});
it.each(['stale','unclassified','missing'])('rejects contradictory review inventory evidence: %s', state => {
  const f = fixture();f.write('docs/reviews.json', state === 'missing' ? {findings:[]} : {tested_commit:state === 'stale' ? 'a'.repeat(40) : f.head,status:state === 'unclassified' ? 'unclassified' : 'classified',findings:[]});
  expect(f.run().status).toBe(1);
});
it('rejects an unresolved original review omitted from the completion report', () => {
  const f = fixture();f.write('docs/reviews.json', {tested_commit:f.head,status:'classified',findings:[{id:'P2-1',classification:'actionable',status:'unresolved'}]});
  expect(f.run().status).toBe(1);
});
it('rejects a separate finding evidence whose disposition contradicts the report', () => {
  const f = fixture();const finding={id:'P2-1',classification:'actionable',status:'resolved'};
  f.report.reviewInventory.findings.push({...finding,evidence:'docs/finding.json'});
  f.write('docs/reviews.json',{tested_commit:f.head,status:'classified',findings:[finding]});
  f.write('docs/finding.json',{tested_commit:f.head,status:'classified',findings:[{...finding,status:'unresolved'}]});
  expect(f.run().status).toBe(1);
});
it.each(['typecheck','lint','browser','ui'])('accepts parsed successful original %s evidence', name => {
  const f = fixture();const check = f.report.checks[0]; if (!check) throw new Error('fixture missing check');
  check.name=name;f.report.requiredChecks=[name];
  f.write('docs/local.json',{product_commit:f.head,[name]:name==='typecheck'||name==='lint'?'success':{passed:1,failed:0,total:1,flaky:0,skipped:0}});
  expect(f.run().status).toBe(0);
});
it('accepts a classified resolved finding matched in its separate original evidence', () => {
  const f = fixture();const finding={id:'P2-1',classification:'actionable',status:'resolved'};
  f.report.reviewInventory.findings.push({...finding,evidence:'docs/finding.json'});
  const inventory={tested_commit:f.head,status:'classified',findings:[finding]};
  f.write('docs/reviews.json',inventory);f.write('docs/finding.json',inventory);
  expect(f.run().status).toBe(0);
});
it.each(['stale','missing'])('rejects a separate original finding with %s authority', state => {
  const f = fixture();const finding={id:'P2-1',classification:'actionable',status:'resolved'};
  f.report.reviewInventory.findings.push({...finding,evidence:'docs/finding.json'});
  f.write('docs/reviews.json',{tested_commit:f.head,status:'classified',findings:[finding]});
  f.write('docs/finding.json',{tested_commit:state==='stale'?'a'.repeat(40):f.head,status:'classified',findings:state==='missing'?[]:[finding]});
  expect(f.run().status).toBe(1);
});
it('rejects a still-pending original check whose counters already show passes', () => {
  const f=fixture();f.write('docs/local.json',{product_commit:f.head,status:'in_progress',unit:{passed:1,failed:0}});
  expect(f.run().status).toBe(1);
});
it.each([['status','in_progress'],['conclusion','failure']])('rejects contradictory nested result %s=%s', (key,value) => {
  const f=fixture();f.write('docs/local.json',{product_commit:f.head,unit:{passed:1,failed:0,[key]:value}});
  expect(f.run().status).toBe(1);
});
