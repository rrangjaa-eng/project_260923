# 완료 보고 근거의 가벼운 정합성 검사

설명 전에 실제 실행·현재 HEAD·검토 결과를 확인한 뒤 사용한다. 이 도구는 보고 기록의 정합성을 검사하며 실제 실행, 지침 준수, 리뷰 누락 없음, 제품 무결함을 증명하지 않는다. 필수 검사 선정과 리뷰 목록의 완전성은 사람이 원 요구·실제 PR 리뷰와 대조해야 한다. 검사 통과를 전체 제품·실제 기기 합격으로 확대하지 않는다.

새 의존성·서비스·CI 단계가 없고 Git·Node와 기존 zod만 사용한다. 원격 조회·재실행·쓰기·push를 하지 않는다. 현재 저장소의 기존 CI108/109 형식처럼 `product_commit`, `status`, `conclusion`, `run_id`, `url`, `completed_at_utc`, `unit`, `browser`가 있는 CI JSON을 그대로 연결한다. 과거 다른 형식은 추측해 성공으로 해석하지 않는다.

## 사용

완료 주장 범위에 필요한 실제 검사 결과와 리뷰 분류를 작은 보고 JSON으로 연결한다. 아래 값은 형식 예시이며 실행 증거가 아니다. HEAD와 시각·범위·파일·리뷰는 직접 확인한 값으로 바꾼다. `observedAt`은 CI의 최종 결과를 실제 확인한 ISO 시각이다. 모르면 `success`나 빈 리뷰 목록을 만들지 않고 완료 보고를 보류한다.

```json
{
  "schemaVersion": 1,
  "productCommit": "현재 Git HEAD의 40자 SHA",
  "observedAt": "실제로 최종 상태를 확인한 ISO 시각",
  "scope": "완료를 주장할 구체적 변경 범위",
  "requiredChecks": ["typecheck", "lint", "unit", "browser", "ui"],
  "checks": [
    {
      "name": "unit",
      "status": "completed",
      "conclusion": "success",
      "testedCommit": "실제 검사 대상 40자 SHA",
      "evidence": "docs/verification/기존-검증-결과.json"
    }
  ],
  "reviewInventory": {
    "status": "classified",
    "testedCommit": "실제 검토 대상 40자 SHA",
    "evidence": "docs/verification/기존-검토-기록.md",
    "findings": [
      {
        "id": "실제 리뷰 링크나 안정적인 식별자",
        "classification": "actionable",
        "status": "resolved",
        "evidence": "docs/verification/실제-수정-재현-근거.json"
      }
    ]
  },
  "ciEvidence": "docs/verification/ci109-final-results.json"
}
```

위 예시는 필수 검사 다섯 개 중 하나만 넣었으므로 그대로는 거절된다. 실제 필요한 모든 검사 항목을 넣는다. 리뷰가 없다고 실제 확인한 경우에만 `findings: []`를 쓴다. 비결함으로 분류한 리뷰는 `classification: "non-actionable"`, `status: "resolved"`와 판단 근거를 기록한다. 알려진 미해결 결함은 제한 문구만 붙여 해결된 것으로 표시하지 않는다.

```bash
node --experimental-strip-types scripts/check-completion-evidence.ts docs/verification/완료-보고.json
```

exit0은 입력 기록 정합성 통과, exit1은 완료 근거로 사용할 수 없음이다. pending/failure/unknown, 누락된 필수 검사, 미분류·미해결 리뷰, 다른 HEAD, 제품·시험·설정의 미커밋 변경, 읽을 수 없는 증거, CI 시험 실패/flaky/skip·합계 모순, 잘못된 시각과 run URL을 거절한다. 증거 경로는 저장소 내부 상대 경로다. CI의 실패 산출물 업로드 단계가 skipped인 것과 브라우저 시험 skip 수는 구분한다.

## 기존 근거 재사용

현재 HEAD가 문서만 바뀐 커밋인 경우에는 다음 옵션으로 과거 CI·검토를 재사용할 수 있다. 도구가 실제 Git diff를 읽어 `docs/` 안의 문서·증거 확장자(md/json/png/jpg/jpeg/webp/svg/txt), 루트 `README.md`, `AGENTS.md` 이외의 변경이 없는지 확인한다. 제품에서 실제 사용하는 `docs/design/tokens.css`나 docs 안의 실행 스크립트는 문서 변경으로 취급하지 않는다. 보고의 `productCommit`은 여전히 현재 HEAD여야 하고 각 근거의 `testedCommit`은 원래 검사 SHA를 유지한다. 새 제품·시험·설정·스크립트 변경에는 재사용을 허용하지 않는다. 이 엄격한 조건 밖에서 같은 소스라고 추측해 SHA를 바꾸지 않는다. 허용한 문서 파일을 제품이나 시험이 새로 소비하도록 바꾸는 경우에는 이 목록을 다시 검토해야 한다.

```bash
node --experimental-strip-types scripts/check-completion-evidence.ts docs/verification/완료-보고.json --reuse-docs-only
```

문서만 바뀌어도 새 리뷰가 생길 수 있으므로 재사용 전에 현재 리뷰 목록을 다시 확인한다. 새 원격 리뷰를 자동으로 발견하는 도구는 아니며, 오래된 기록 파일의 존재만으로 현재 결과를 직접 관측했다고 주장할 수 없다. 모르는 상태는 완료로 통과시키지 않는다.

## 검사 자체의 검증

```bash
pnpm exec vitest run tests/unit/completion-evidence.test.ts
pnpm exec eslint scripts/check-completion-evidence.ts tests/unit/completion-evidence.test.ts
```

단위 검사는 임시 Git 저장소와 실제 CLI를 사용한다. 현재 프로젝트를 checkout·commit·push하지 않으며 임시 저장소를 검사 뒤 삭제한다. 전체 제품 CI의 대체 검사가 아니다.
