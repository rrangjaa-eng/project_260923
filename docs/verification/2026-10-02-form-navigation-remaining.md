# PR28 이정표 이후 남은 양식·탐색 범위

기준: PR28 `0422cdeaeba7c87aa144f4593360fbdb5b415c56`, CI95 unit352/전체E2E369 success. PR27/28은 draft·미병합이며 PR26-only 병합 승인을 확대하지 않는다. 아래는 다음 작업 판단을 위한 분류이며 새 구현을 시작하거나 전체 제품 완료를 선언하지 않는다.

## 이번에 닫힌 범위

일반 text/search/email/tel/url 및 textarea의 양식 이동·초안·명시 적용, 단일 select/checkbox/radio/multiple, 일반 validity 안내, 변경값 재적용 확인이 구현돼 있다. 탐색은 지원 페이지의 뒤로/앞으로·열린 탭 전환과 페이지/세로 영역 스크롤을 지원한다. 모든 사이트 위젯이나 브라우저 자체 UI의 지원을 뜻하지 않는다.

## 클라우드에서 이어갈 수 있는 일

- **우선 권장: 프레임 안 radio/multiple의 실제 Chromium 회귀.** 이번 새 브라우저 검사는 최상위 문서다. 기존 frame 승인 경로를 사용하지만 해당 새 컨트롤의 프레임 안 실행은 아직 별도 검증하지 않았다. 지원되는 iframe에서 명시 적용, 프레임 교체·가림·취소/쉬기·unknown 시 재시도 금지, 다른 프레임 값 불변을 자동검사하고 재현된 결함만 수정한다. 기존 기능의 확인된 검증 공백을 닫는 일이므로 새 제품 기능·권한·수집 범위를 만들 필요가 없다.
- NAV-02의 새로고침·새 탭·탭 닫기는 원 요구에 있으나 현재 `Navigation` schema/worker는 tabs/back/forward/activate만 구현한다. 각각 초안·실행 중 상태와 명시 확인 계약을 정한 뒤 분리된 증분으로 구현·브라우저 회귀가 가능하다. 한꺼번에 구현하거나 이번 완료에 포함하지 않는다. native beforeunload 등 브라우저 UI 경계는 별도다.
- custom/ARIA 선택 위젯과 contenteditable는 일반 HTML 컨트롤로 자동 대체하지 않는다. 실제 대상 위젯의 계약/fixture가 정해지면 클라우드 재현과 제한된 구현 검토는 가능하지만, 모든 사이트 지원으로 묶지 않는다.

근거: `.planning/REQUIREMENTS.md` NAV-02/INPT-03, `src/shared/switch-messages.ts` Navigation, `src/worker/switch-relay.ts` navigation, `src/page/input/text-target.ts` typingElement. 원 `.planning` 체크박스는 수동 변경하지 않았다.

## Windows·이용자·실사이트 검증이 필요한 일

- 실제 MS 한국어 IME와 설치된 Chrome/Edge/Whale 프로필에서의 키/조합/포커스 경계.
- 실제 손 떨림·피로·한 번 누르기/놓기의 성공률과 순환 속도·휴식 간격의 적합성.
- 이용자가 쓰는 실제 사이트의 입력 이벤트·검증·프레임·편집기 부작용. 허가된 fixture/접근이 생기면 가능한 부분은 자동화하되 현재 통과했다고 하지 않는다.
- 주소창·브라우저 메뉴·OS 파일 창·설치/권한 UI까지 Space만으로 조작하는 범위는 현재 확장 내 지원과 구분한다.

## 개인정보·native 또는 별도 결정이 필요한 일

- 임의 사이트 오류 원문 읽기는 현재 generic validity/aria-invalid 안내와 다르다. 연결된 오류 요소만 읽을지, 민감 값이 섞인 안내를 어떻게 제외할지 범위를 정해야 하며 무작위 페이지 텍스트 수집으로 진행하지 않는다.
- INPT-01 최근값 자동 수집, PRIV-01 전체 판별 및 보호 저장, native 파일 전달·C# 휴대 실행기·USB·host 등록/새 권한은 이번 양식 개선 승인으로 확대하지 않는다.
- PR27/28 merge 및 배포·설치 ZIP 교체는 별도 승인 대상이다. 기존 ZIP은 과거3ae6ad2 그대로다.

현재 개발 차단 결함은 발견되지 않았지만 실제 기기·이용자 적합성 확인은 남아 있다. 다음 명확한 작업은 위 **iframe 안 새 컨트롤 회귀 검증**이다. 이 문서 작성 시점에는 착수하지 않았다.
