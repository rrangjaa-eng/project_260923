#!/usr/bin/env bash
# PreToolUse(Bash) 훅 — git push 전에 lint·typecheck를 강제한다.
# 2026-09-21: `pnpm lint`을 grep에 파이프해 exit code가 가려진 채 `&&` 체인이
# 계속 진행됐고, 린트 에러가 그대로 푸시돼 CI가 실패했다. 파이프로는 이 훅을
# 가릴 수 없다(exit 2 = 차단, stderr가 모델에 전달). 실행 시간 약 45초.
set -uo pipefail

payload="$(cat)"
command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
[ -n "$command" ] || exit 0

case "$command" in
  *"git push"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0

# package.json에 해당 스크립트가 정의돼 있을 때만 검사한다(새 저장소는 스크립트가
# 생기기 전까지 push가 막히지 않도록).
has_script() {
  [ -f package.json ] && jq -e --arg s "$1" '.scripts[$s] // empty' package.json >/dev/null 2>&1
}

run_gate() {
  local name="$1"
  local output
  has_script "$name" || return 0
  if ! output="$(pnpm "$name" 2>&1)"; then
    echo "차단됨: pnpm ${name} 실패 — 푸시 전 게이트다. 고치고 다시 푸시해라. 훅을 우회하지 마라." >&2
    printf '%s\n' "$output" | tail -30 >&2
    exit 2
  fi
}

run_gate lint
run_gate typecheck
exit 0
