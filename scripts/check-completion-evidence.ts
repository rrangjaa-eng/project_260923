import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';

// 보고 기록의 정합성만 검사한다. 실제 실행·리뷰 완전성·지침 준수의 증명이 아니다.
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const text = z.string().trim().min(1);
const check = z.object({ name: text, status: text, conclusion: text, testedCommit: commit, evidence: text }).strict();
const reportSchema = z.object({
  schemaVersion: z.literal(1), productCommit: commit, observedAt: z.iso.datetime({ offset: true }), scope: text,
  requiredChecks: z.array(text).min(1), checks: z.array(check).min(1),
  reviewInventory: z.object({
    status: text, testedCommit: commit, evidence: text,
    findings: z.array(z.object({ id: text, classification: text, status: text, evidence: text }).strict()),
  }).strict(), ciEvidence: text,
}).strict();
const ciSchema = z.object({
  product_commit: commit, status: text, conclusion: text,
  run_id: z.number().int().positive(), url: z.url(), completed_at_utc: z.iso.datetime(),
  unit: z.object({ passed: z.number().int().positive(), failed: z.number().int().nonnegative().optional(), total: z.number().int().positive().optional() }),
  browser: z.object({ passed: z.number().int().positive(), total: z.number().int().positive().optional(), failed: z.number().int().nonnegative(), flaky: z.number().int().nonnegative(), skipped: z.number().int().nonnegative() }),
});
const note = '기록 정합성 검사이며 실제 실행·리뷰 누락 없음·지침 준수·제품 무결함을 증명하지 않습니다.';
// 제품에서 tokens.css를 읽으며 docs 안에도 실행 가능한 시험 파일이 있다.
const docsOnly = (path: string) => path.startsWith('docs/') && /\.(md|json|png|jpe?g|webp|svg|txt)$/i.test(path)
  || path === 'README.md' || path === 'AGENTS.md';

function main() {
  const [file, option, ...extra] = process.argv.slice(2);
  if (!file || extra.length || option !== undefined && option !== '--reuse-docs-only') {
    console.error('사용법: node --experimental-strip-types scripts/check-completion-evidence.ts <보고.json> [--reuse-docs-only]');
    process.exitCode = 1; return;
  }
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const errors: string[] = [];
  const readEvidence = (path: string) => {
    if (isAbsolute(path)) throw new Error('증거 경로는 저장소 상대 경로여야 합니다');
    const actual = realpathSync(resolve(root, path));
    const inside = relative(root, actual);
    if (inside.startsWith('../') || isAbsolute(inside)) throw new Error('저장소 밖 증거는 사용할 수 없습니다');
    const content = readFileSync(actual, 'utf8');
    if (!content.trim()) throw new Error('비어 있는 증거입니다');
    return content;
  };
  const evidence = (path: string) => { try { readEvidence(path); } catch { errors.push(`증거를 읽을 수 없음: ${path}`); } };
  const report = reportSchema.parse(JSON.parse(readEvidence(file)) as unknown);
  if (report.productCommit !== head) errors.push('보고 대상 HEAD가 현재 Git HEAD와 다릅니다');
  const dirty = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter(Boolean).map(line => line.slice(3)).filter(path => !docsOnly(path));
  if (dirty.length) errors.push('제품·시험·설정의 미커밋 변경이 있습니다');
  const reused = new Set<string>();
  const bound = (tested: string) => {
    if (tested === head) return true;
    if (option !== '--reuse-docs-only') return false;
    try {
      const paths = execFileSync('git', ['diff', '--name-only', tested, head], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      if (!paths.every(docsOnly)) return false;
      reused.add(tested); return true;
    } catch { return false; }
  };
  const names = report.checks.map(entry => entry.name);
  if (new Set(names).size !== names.length || new Set(report.requiredChecks).size !== report.requiredChecks.length) errors.push('검사 이름이 중복됐습니다');
  for (const name of report.requiredChecks) if (!names.includes(name)) errors.push(`필수 검사 누락: ${name}`);
  for (const entry of report.checks) {
    if (entry.status !== 'completed' || entry.conclusion !== 'success') errors.push(`검사 완료·성공 아님: ${entry.name}`);
    if (!bound(entry.testedCommit)) errors.push(`검사 HEAD 불일치: ${entry.name}`);
    evidence(entry.evidence);
  }
  const reviews = report.reviewInventory;
  if (reviews.status !== 'classified') errors.push('리뷰 목록이 미분류 또는 불명입니다');
  if (!bound(reviews.testedCommit)) errors.push('리뷰 HEAD 불일치');
  evidence(reviews.evidence);
  if (new Set(reviews.findings.map(entry => entry.id)).size !== reviews.findings.length) errors.push('리뷰 ID가 중복됐습니다');
  for (const finding of reviews.findings) {
    if (!['actionable', 'non-actionable'].includes(finding.classification) || finding.status !== 'resolved') errors.push(`미분류·미해결 리뷰: ${finding.id}`);
    evidence(finding.evidence);
  }
  const ci = ciSchema.parse(JSON.parse(readEvidence(report.ciEvidence)) as unknown);
  if (ci.status !== 'completed' || ci.conclusion !== 'success') errors.push('CI 완료·성공 아님');
  const url = new URL(ci.url);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !/^\/[^/]+\/[^/]+\/actions\/runs\/\d+$/.test(url.pathname)
      || !url.pathname.endsWith(`/actions/runs/${String(ci.run_id)}`) || url.search || url.hash) errors.push('CI URL과 run_id 연결을 확인할 수 없습니다');
  const observed = Date.parse(report.observedAt), completed = Date.parse(ci.completed_at_utc), currentTime = Date.now();
  if (observed > currentTime || completed > currentTime || observed < completed) errors.push('관측 시각·CI 완료 시각이 미래이거나 완료 전 관측입니다');
  if (!bound(ci.product_commit)) errors.push('CI HEAD 불일치');
  if ((ci.unit.failed ?? (ci.unit.total === undefined ? undefined : ci.unit.total - ci.unit.passed)) !== 0
      || ci.browser.failed !== 0 || ci.browser.flaky !== 0 || ci.browser.skipped !== 0) errors.push('CI 시험 실패·불명·flaky·skip 수치가 있습니다');
  if (ci.unit.total !== undefined && ci.unit.total !== ci.unit.passed + (ci.unit.failed ?? 0)
      || ci.browser.total !== undefined && ci.browser.total !== ci.browser.passed + ci.browser.failed + ci.browser.skipped) errors.push('CI 시험 합계가 일치하지 않습니다');
  if (errors.length) { console.error(errors.join('\n')); console.error(note); process.exitCode = 1; return; }
  console.log(`보고 근거 정합성 통과: ${report.scope}\nHEAD: ${head}`);
  if (reused.size) console.log(`문서만 변경된 기존 근거 재사용: ${[...reused].join(', ')}`);
  console.log(note);
}
try { main(); } catch { console.error('보고 형식·Git 상태·CI 증거를 확인하지 못했습니다. 완료 근거로 사용할 수 없습니다.'); console.error(note); process.exitCode = 1; }
