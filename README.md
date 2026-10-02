# 손 떨림 브라우저 도우미

Space 스캔으로 일반 웹 페이지의 활동을 선택하는 Chromium 확장 프로그램이다. PR15–25 통합은 [PR26](https://github.com/rrangjaa-eng/project_260923/pull/26)으로 main에 병합됐다(`a0738fb`). 일반 라디오 후속 [draft PR27](https://github.com/rrangjaa-eng/project_260923/pull/27)은 미병합이며 전체 CI331단위/362브라우저를 통과했다. 현재 `codex-switch-multiple-controls`는 그 위에서 일반 다중 선택을 추가하는 개발 후속이며 배포되지 않았다.

지원하는 흐름은 페이지 항목 선택, 읽기와 세로 스크롤 영역 선택, 검색, 한글 조합·문구 관리, 양식 필드 이동과 초안 보존·명시 적용, 일반 단일/다중 select·checkbox와 라디오 명시 선택, 오류 안내, 변경된 값 재적용 확인, 뒤로·앞으로 이동, 실행 대기 정지다. 파일 전달 연습은 가짜 데이터만 사용하는 확장 내부 연습이다.

브라우저 주소창·메뉴·설치 과정·다른 프로그램까지 Space만으로 조작하는 제품은 아니다. 실제 Windows 한국어 IME, 운동 사용성, 실사이트 적합성은 미검증이다. 지원 경계와 검증 상태는 [통합 후보 설명](docs/INTEGRATION-CANDIDATE.md), 시각별 기록은 [작업 현황](docs/WORK-STATUS.md)을 확인한다.

**downloads의 ZIP은 과거 `3ae6ad2` 제품이다. PR16–25 기능과 현재 통합 후보를 포함하지 않는다.** 파일을 교체하지 않았으며 최신 후보 설치본은 아직 제공하지 않는다. [과거 ZIP 안내](downloads/README.ko.md).

## 개발 검증

Node 22 이상과 package.json의 pnpm 10.33.0을 사용한다.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
pnpm exec playwright install --with-deps chromium
CI=true pnpm test:e2e
```

`pnpm build`의 로컬 산출물은 배포 승인을 받은 설치 패키지를 의미하지 않는다. 저장소 작업 규칙은 [AGENTS.md](AGENTS.md)에 있다.
