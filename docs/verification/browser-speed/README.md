# PR39 개발본 브라우저 속도 측정

대상 제품은 `62577af2db1216bc25371dee39d94b6267a80a8c`다. main이나 기존 설치 ZIP의 성능을 측정한 것이 아니다. 별도 검증 브랜치에 측정 도구·근거만 추가하며 제품·기존 테스트·설정·의존성은 변경하지 않는다.

## 방법과 조건

- 저장소의 실제 Playwright Chromium persistent context에 `CI=true` 프로덕션 빌드를 로드한다. native gstack 브라우저 실행으로 표시하지 않는다. 외부 요청을 차단하는 기존 fixture로 `practice.test` 합성 페이지와 확장 내부 새 탭만 사용한다.
- Linux 6.18.44 x86_64 VM, Intel Xeon Platinum 8573C, 논리 CPU 5개 노출/CPU quota 4개, 메모리 제한 16GiB. pnpm10.33.0, Node24.19.0, Chromium153.0.8010.12, headless1280×800. 호스트 자원을 독점하거나 실제 이용자의 PC와 같다고 가정하지 않는다.
- 기본 Space 설정: 순환1500ms/입력 보호300ms. 빠른 설정:800ms/100ms. 첫 항목의 순환 체류는 설정의2배이며, 명시 확인에는 기존1초 보호가 적용된다. 제품 시간을 가속하거나 timer를 바꾸지 않는다.
- 경로마다3회. 직접 조작 비교는 조건별5회. 소표본이므로 중앙값·최소/최대를 사용하고 인간 집단의 분포로 일반화하지 않는다.
- Space는30ms 누르고, 메뉴의 활성 표시를 실제 rAF로 기다린다. 선택지와 보호 간격을 모두 만족할 때 정확히 누르는 자동화다. Space 뒤40ms 도구 여유 및 상태 검증 비용이 총시간에 포함된다. 오선택·인지·읽기·운동 반응·피로는 포함하지 않아 사람에게는 낙관적인 조건이다.
- 총시간은 페이지/패널 준비 뒤 paused 작업판에서 첫 Space부터 결과 검증까지다. `readyMs`는 별도로 페이지 navigation→패널 표시 시간이며 브라우저 프로세스 시작이나 네트워크 로딩 시간은 아니다. 각 phase의 첫 표본과 반복을 raw에 보존한다.
- 키 이벤트 수신과 DOM 변화/사이트 click/input/scroll 이벤트는 페이지 `performance.now()`로 잰다. 하드웨어 입력·OS 큐·화면 픽셀 표시 완료 시간은 아니다. `ui-up`은 첫 의미 있는 작업판 DOM 변화, 정지는 keydown에서 바뀌므로 `ui-down`을 쓴다. 활성 항목 표시만 바뀌는 순환 tick은 UI 반응으로 세지 않는다.
- 부하 조건: 동일 페이지에 정적 문단2000개 +100ms마다 메인 스레드20ms busy loop. 실제 사이트나 네트워크 부하를 대표하지 않는다. 부하 비교는 클릭·스크롤에 한정한다.
- 직접 비교는 같은 확장의 pointer모드다. 클릭은 Playwright locator.click, 스크롤은640px wheel, 입력은 칸 클릭+Unicode `가` 삽입+`a`/`1` 각30ms 키 입력이다. **한국어 IME 타이핑 비교가 아니며 사람의 마우스/타자 속도가 아니다.** 탭 바 클릭/일반 새 탭 키와의 직접 비교는 미측정이다.
- `가a1`은 한글1음절·영문1자·숫자1자를 새로 조합하여 빈 양식 칸에 명시 적용한다. 문구 재사용은 이미 저장된 동일 문자열의 삽입·적용이며 최초 문구 생성/저장 시간은 포함하지 않는다.
- 번호 재사용은 첫 버튼을1번에 고정한 뒤 reload한다. 고정 설정 시간과 paused 작업판에서 재사용 시간을 별도로 기록하며 재사용 시간에는 reload를 넣지 않는다. 적은 항목 페이지이므로 복잡한 페이지에서의 이득은 미측정이다.
- 자동 스크롤 정지는 키 누름→mode 변경과 이후150ms 정지 유지를 확인한다. 준비부터의 경로 총시간과 정지 반응을 혼동하지 않는다.

## 실행

```bash
source /workspace/.cloud-onboarding/workflow-env.sh
CI=true SPEED_PHASE=quick SPEED_RESULTS=/tmp/speed-quick.jsonl pnpm exec playwright test --config docs/verification/browser-speed/playwright.config.ts
```

`SPEED_PHASE`는 `quick`(클릭/스크롤), `journeys`(취소/정지/탭/새탭/직접 작성/번호), `loaded`(부하 클릭/스크롤), `fast`(빠른 클릭/직접 작성), `controls`(취소/정지), `reuse`(저장 문구), `baseline`(직접 비교)다. 결과는 JSONL에 append하므로 재실행에는 새 경로를 쓴다. 성능 측정 중 다른 빌드/린트/브라우저 측정을 병렬 실행하지 않는다. 전체 CI는 재실행하지 않는다.

## 제외와 미측정

첫 예비 quick 실행은 확장보다 늦게 설치된 키 이벤트 listener가 이벤트를 받지 못해 key count=0이었다. 측정기를 페이지 초기화 시점으로 옮겼으며 이 예비 실행은 비교에서 제외한다. 제품 결함으로 판정하지 않았다. 첫 journeys의 취소/정지 구간에는 측정 도구 lint 실행이 겹칠 가능성이 있어 해당6개 표본 대신 별도 controls 실행을 사용한다. 초기 기록도 제외 이유와 함께 보존한다. assertion이나 제품을 수정해 결과를 통과시키지 않는다.

실제 장애 사용자 작업 속도·오선택·피로·Windows IME·실사이트·회사 시스템·네트워크 속도·픽셀 paint/FPS·확장을 완전히 제거한 브라우저와의 순수 overhead는 미측정이다. 시간 단축 후보 제안은 성능 최적화 구현 승인으로 취급하지 않는다.

최종 수치는 [결과표](RESULTS.md), [실행 종료 근거](execution-results.json), [유효/제외 원본](raw-results.json)에 있다. `python3 docs/verification/browser-speed/summarize.py`로 원본을 다시 집계할 수 있다.
