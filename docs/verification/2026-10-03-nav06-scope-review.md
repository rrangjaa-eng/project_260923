# NAV-06 명시적 더블클릭 범위 검토

후속: 사용자가 추천 제한 계약을 “추천대로 해”로 승인했다. [구현·검증 기록](2026-10-03-explicit-doubleclick.md). 아래는 승인 전 조사 기록이다.

2026-10-03 20:42 KST. PR35 제품 `e590416bda80434390f1defbe8f3bb7aa2ab3ef2`, 최종 검증 기록 `d6b5f2a2a228513e1ec4128a72731f09a465bcd5`를 보존한 문서 전용 검토다. 제품 코드 변경 없음.

## 기존 요구와 실제 구현

- `.planning/REQUIREMENTS.md` NAV-06: 필요한 곳에서 명령판의 더블클릭으로 실행한다. 원 설계5장도 동일하며 지원 대상 판정이나 이벤트 순서는 정하지 않았다. `.planning`은 수정하지 않았다.
- `src/page/click/press.ts`는 synthetic pointer/mouse/focus/click 순서를 한 번 보낸다. CDP/확장 debugger를 쓰지 않으며 `isTrusted:false`다.
- `src/page/collector/collector.ts`는 native 태그·role·onclick·tabindex·cursor로 후보를 수집한다. 더블클릭 지원 능력이나 실행 후 부작용을 보증하는 정보는 없다. 버튼 이름이나 DOM 종류만으로 전송·구매·삭제·제출이 없다고 증명할 수 없다.
- `src/page/input/switch-controller.ts`의 선택/확인/취소와 `switch-actions.ts`의 identity 확인을 재사용할 수 있다. 새 명령을 일반 press 두 번으로 치환하는 것은 승인된 기본 동작으로 취급하지 않는다.

## 실제 Chromium 확인

기존 설치된 Playwright/Chromium에서 임시 페이지에 click/dblclick 카운터를 붙이고 읽기 조사용 probe를 실행했다. 제품 코드/연습 사이트 변경이나 외부 사이트 동작은 없었다.

| 입력 | 관찰한 이벤트 |
|---|---|
| Playwright 실제 `locator.dblclick()` | click(detail1,trusted=true), click(detail2,trusted=true), dblclick(detail2,trusted=true) |
| `dispatchEvent(new MouseEvent('dblclick',{bubbles:true,detail:2}))` | dblclick(detail2,trusted=false) 한 번; click 없음 |

둘은 동일한 동작이 아니다. dblclick-only가 지원되지 않는 페이지에서 두 click으로 fallback하거나 자동 재시도하지 않는다.

재현은 저장소에서 `source /workspace/.cloud-onboarding/workflow-env.sh` 후 기존 `@playwright/test`의 Chromium을 사용했다. 아래 두 입력을 같은 임시 button에 따로 실행했고 매번 이벤트 배열을 비웠다. 실행 종료코드는0이었다.

```js
await page.setContent('<button type="button" id="x">열기</button>');
await page.evaluate(() => {
  window.events = [];
  for (const type of ['click', 'dblclick']) {
    document.querySelector('#x').addEventListener(type, event => {
      window.events.push({ type, detail: event.detail, trusted: event.isTrusted });
    });
  }
});
await page.locator('#x').dblclick(); // 위 표 첫 행
await page.evaluate(() => {
  window.events = [];
  document.querySelector('#x').dispatchEvent(
    new MouseEvent('dblclick', { bubbles: true, detail: 2 }),
  );
}); // 위 표 둘째 행
```

## 결정이 필요한 계약

**질문:** 첫 NAV-06을 일반 클릭 없이 synthetic `dblclick` 한 번만 보내는 제한 기능으로 허용할 것인가? 아니면 click 두 번이 선행되는 표준 시퀀스까지 필요하며, 이를 허용할 실제 사이트/대상을 먼저 지정할 것인가?

**추천:** 첫 범위는 dblclick-only로 제한한다. UI에 지원 한계를 분명히 알리고 사용자가 명시적으로 고른 대상에만 보낸다. 일반 더블클릭과 동등하다고 주장하지 않는다. 대상 정책은 최상위 문서의 비민감 일반 `button[type=button]`만으로 시작하고 링크·submit/reset·입력/편집/복합·위험 판정·iframe은 제외한다. 이는 임의 JS 부작용 부재를 보증하지 않는다. 더블클릭 지원을 자동 감지했다거나 안전하다고 판정했다는 문구는 쓰지 않는다. 이 제한 자체가 기존 문서에 없는 동작 계약이므로 결정 전 제품 구현을 하지 않는다.

일반 시퀀스가 필요하다면 첫 click부터 사이트 동작이 발생할 수 있으므로, 대상 사이트/요소의 허용된 동작과 중간 실패의 의미를 먼저 정해야 한다. DOM의 `ondblclick` 존재만을 사이트 안전성/실제 지원 증명으로 쓰지 않는다.

## 추천안 승인 후 완료 기준

1. Space 명령 선택 → 대상 직접 선택 → 전체 이름/동작 설명 → 취소 우선·1초 보호 → 명시 실행. 기존 일반 선택은 그대로 단일 클릭이다. iframe/custom 고정 확대 없음.
2. 확인 전후 같은 DOM 노드·문서·identity·eligible·viewport를 확인한다. 제거/재삽입, 이름/종류 변경, hidden/disabled/inert/화면 밖 이동은 무효화한다. 다른 대상으로 치환하지 않는다.
3. 전용 명령과 정확한 제안을 승인에 묶는다. 취소·쉬기·설정 변경·페이지 이동 및 이미 처리됐지만 늦게 돌아오는 승인 응답 뒤 실행을 막는다. 실행된 action ID 중복은 재전달하지 않는다.
4. 실행 결과 `done`은 이벤트 전달 완료만 뜻하며 사이트 효과 성공을 보장하지 않는다. unknown/응답 유실은 결과 확인 상태로 두고 자동 재전송/fallback 없음.
5. RED→GREEN 단위 검증과 실제 Chromium에서 dblclick1/click0, 취소0, 지연 승인 중 대상 변경0, ack 유실 후 추가 실행0을 확인한다. 기존 press·떨림 필터·Space 상태머신·핀 기능 회귀, 타입/린트·전체 단위·자동UI·독립 검토·최종CI를 수행한다.
   click 효과 카운터가 있는 대상에서도 click0/dblclick1을 확인한다. click 선행이 필요한 handler나 handler 없음에서 fallback0, 부모에 위임된 dblclick 전달과 사이트 효과 성공을 단정하지 않는 결과 안내도 확인한다.
6. 문서/구현 커밋·push·draft PR·최종CI 원본 근거 기록까지 진행한다. main/PR31–35/기존 ZIP 보존, merge/deploy/새 권한 없음. 실제 Windows/사이트/사용자 검증은 실행하지 않았으면 미검증으로 남긴다.

## 현재 상태

읽기 조사와 로컬 이벤트 probe만 완료했다. 제품 구현·새 제품 테스트·새 PR·CI는 아직 시작하지 않았다. 결정이 필요한 것은 반복 승인 절차가 아니라, 서로 다른 두 동작 중 무엇을 제품이 제공하는지다.

독립 읽기 검토에서도 제안의 사실·범위 차단 사항은 없었고 동작 계약 결정이 필요하다고 확인했다. 현재 `synthesizePress`는 detail1 click을 보내므로 이를 두 번 호출하는 방식은 실제 click1/click2/dblclick2 시퀀스도 재현하지 않는다. 이 검토는 제품 구현 검증이나 실제 사이트 지원 검증이 아니다.
