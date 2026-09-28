# TremorHand 휴대형 실행기

브라우저 확장이 판단한 동작을 Windows 실제 입력으로 수행하는 선택적 실행기다. 현재 첫 세로 조각은 Native Messaging 연결, 실제 포인터 이동·클릭·더블클릭·누르기·놓기·휠, 전역 긴급 정지, 활성 브라우저·만료·중복 요청 검사를 제공한다.

## 빌드

Windows의 .NET 8 SDK에서 실행한다.

```powershell
dotnet publish .\portable-hand\TremorHand\TremorHand.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

출력된 `TremorHand.exe`를 USB/외장 SSD에 복사한다.

확장 ID를 넣어 `시작하기.cmd`와 `안전하게 종료.cmd`까지 한 번에 만들려면 저장소 루트에서 실행한다.

```powershell
.\portable-hand\publish.ps1 -ExtensionId <확장-ID>
```

완성된 `portable-hand\dist` 폴더 전체를 USB/외장 SSD에 복사한다.

## 연결 등록과 안전 종료

웹스토어 또는 `chrome://extensions`에 표시된 확장 ID를 사용한다.

```powershell
.\TremorHand.exe register <확장-ID>
```

사용을 마친 뒤에는 다음 명령으로 Chrome·Edge·Whale의 현재 사용자 연결과 로컬 manifest를 제거한다.

```powershell
.\TremorHand.exe unregister
```

관리자 권한은 요구하지 않는다. 회사 정책이 이동식 실행 파일 또는 현재 사용자 레지스트리 변경을 막으면 등록이 실패할 수 있으며, 이때 확장 단독 기능은 계속 사용할 수 있다.

## 현재 구현 범위

- 구현: 실제 포인터 이동·클릭·더블클릭·좌우 버튼 누르기/놓기·휠, 긴급 정지, Chrome/Edge/Whale 활성 창 제한, 요청 만료·중복 방지, 연결 등록·해제
- 다음 구현: canvas 내부 좌표를 화면 좌표로 안전하게 변환하는 확장 UI, Windows 접근성 기반 주소창·탭·파일 창 명령, PIN 암호화 USB 저장소, USB 제거 감지와 시작/종료 GUI

보안 키패드나 CAPTCHA 우회에는 사용하지 않는다.
