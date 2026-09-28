# TremorHand 휴대형 실행기 — 실제 사용 방법

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

## 처음 한 번 준비

1. Windows PC에 .NET 8 SDK를 설치한 **개발용 PC 한 대**에서 위 `publish.ps1`을 실행한다.
2. 만들어진 `portable-hand\dist` 폴더 전체를 USB/외장 SSD에 복사한다.
3. 사용할 Chrome·Edge·Whale에 이 저장소에서 빌드한 확장을 설치한다.
4. `chrome://extensions`에서 확장의 32자 ID를 확인한다. `publish.ps1`에 넣은 ID와 같아야 한다.

개발용 PC에서 한 번 실행 파일을 만든 뒤에는, 사용하는 다른 PC마다 .NET SDK를 설치할 필요가 없다.

## 다른 PC에서 매번 사용하는 순서

1. USB/외장 SSD를 연결한다.
2. USB의 `시작하기.cmd`를 더블클릭한다.
3. "휴대형 손 연결을 등록했습니다"가 보이면 창을 닫는다.
4. Chrome·Edge·Whale에서 확장 아이콘을 누른다.
5. `휴대형 손: 연결됨`이 보이는지 확인한다.
6. canvas 안에서 누를 곳에 마우스를 올린다.
7. **Alt+Shift+Space**를 누른다.
8. `휴대형 손으로 눌렀어요`가 보이면 Windows 실제 클릭이 전달된 것이다.

마우스를 canvas에 올린 뒤 1.5초가 지나면 낡은 좌표를 거부한다. 다시 마우스를 조금 움직인 뒤 단축키를 누른다. 연결되지 않았으면 화면에 `USB의 시작하기를 먼저 실행해 주세요`가 표시된다.

마우스 버튼이 눌린 채 남는 등 문제가 생기면 확장 아이콘을 열어 **긴급 정지 — 눌린 마우스 버튼 놓기**를 누른다.

## 사용을 마치는 순서

1. 진행 중인 자동화가 없는지 확인한다.
2. USB의 `안전하게 종료.cmd`를 더블클릭한다.
3. "휴대형 손 연결을 안전하게 해제했습니다"가 보이면 브라우저를 닫는다.
4. Windows의 하드웨어 안전 제거 후 USB/외장 SSD를 뺀다.

## 명령줄로 직접 연결하거나 종료하기

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
- 다음 구현: canvas 위치 저장·번호표 실행, Windows 접근성 기반 주소창·탭·파일 창 명령, PIN 암호화 USB 저장소, USB 제거 감지와 시작/종료 GUI

보안 키패드나 CAPTCHA 우회에는 사용하지 않는다.
