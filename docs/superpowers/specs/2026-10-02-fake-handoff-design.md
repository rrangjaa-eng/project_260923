# 가짜 연결·입력 소유권 계약

2026-10-02 KST · 기준PR16/c608d00 · 새후속브랜치 codex/phase2-fake-handoff. 부모가CI70관찰을맡으므로 조회/재실행하지 않는다. 기존2차설계의 연결경계후속을 최신사용자승인으로 직접수행한다.

범위: 외부수신/네트워크/OS/권한없이 unknown payload를 검증하는 순수함수와 두 역할의 가짜handoff를 구현한다. 기존zod와Space엔진·토큰·작업판을 재사용한다. 선택한브라우저설정/PR15·PR16코드를재구현하지 않는다.

요청v1은 sessionId/requestId/documentGeneration/modeGeneration/handoffGeneration/expiresAt와 허용command를 가진다. list-files/select-file/confirm-file/cancel/pause/resume/stop/status만허용한다. 선택/확인은fileToken필수,다른명령의token·추가필드·경로/쉘/프로그램/URL/임의문자열 거절. opaque ID/token은길이1~64/128 ASCII문자·숫자·_·-만허용한다. 이것을인증토큰으로표시하지않는다. expiresAt은동일한가짜시계의Unix-ms 정수이며미래60초이내다. expired요청은거절하되현재context의stop은만료로막지않는다. 다른session/document/mode/handoff는stop도거절한다. 실제다른프로세스시계/인증/OS등록은미구현이다.

응답은v1·원command·같은모든identity와done/refused/unknown만허용한다. gate는pending1개·ID재사용0·응답수락1회다. 문서/모드/세션/소유권변경은pending폐기. 옛응답은현재pending을변경하지않는다. 만료는unknown이며재전송0. 이gate는실제IO를실행하지않는다.

입력소유자는page/practice 중하나이며 handoff세대는단조증가한다. owner만기존reduceSwitch를실행한다. transfer/cancel/pause/change-context/stop은양쪽눌림·pending을폐기하고초안을보존한다. 누르는도중전환됐으면trustedSpace up을정리에만소비한다. 새down/up은재개에만소비하고그다음새선택이필요하다. oldactionResult는소유자·handoff세대·pendingID가모두맞을때만적용한다. stop은latch되며같은객체에서입력재개0.

독립handoff-practice 확장페이지에페이지역할/연습역할과각연습동작횟수·문장을표시한다. 실제페이지/OS로옮겼다고표시하지않는다. 실제key이벤트로시작→전환→새입력재개→상태확인→취소복귀→새입력재개→페이지연습동작→정지를검증한다. 통신은함수호출로가짜request/reply만순환하며message/runtime/native/서버listener를추가하지않는다. 실제파일선택/OS/전역정지를검증했다는문구를쓰지않는다.
