# 웹 배포 (Vercel)

Expo 웹 빌드를 정적 사이트로 내보내 Vercel에 올린다. 네이티브(iOS/Android) 빌드는 이 설정과 무관하게 그대로 동작한다.

- 빌드: `npx expo export --platform web` → `dist/` (git에 올리지 않음, Vercel이 매번 빌드)
- 설정 파일: `vercel.json` (빌드 명령, 출력 폴더, SPA rewrite, 캐시·보안 헤더)
- HTML 템플릿: `public/index.html` (제목, 뷰포트, 테마 색, 데스크톱 중앙 정렬)
- 로컬 확인: `npm run web` → http://localhost:8081

## 무엇이 웹에서 다르게 동작하나

| 기능 | 네이티브 | 웹 |
|---|---|---|
| Google 로그인 | `@react-native-google-signin` | Google Identity Services 버튼 (`GoogleSignInButton.web.tsx`, `google-id-token.web.ts`) |
| 세션 저장 | `expo-secure-store` (Keychain/Keystore) | `localStorage` (`secure-session-store.ts`의 웹 분기) |
| 햅틱 | `expo-haptics` | 없음 (`lib/haptics.web.ts`, no-op) |
| 세로 고정 | `orientation: portrait` | 브라우저는 회전을 막을 수 없음. 가로로 돌리면 화면이 낮아진다 |
| 넓은 화면 | — | 600px 이상이면 가운데 480px 폭 열로 표시 |

### 웹에서 원천적으로 안 되거나 달라지는 것

1. **새로고침하면 약 1시간 뒤 로그인이 풀린다.** 세션 만료 시각(`expiresAt`)이 Google ID 토큰 만료(발급 후 1시간)로 정해지는데, 네이티브는 `signInSilently`로 조용히 갱신하지만 브라우저(GIS)에는 조용한 갱신이 없다. 탭을 열어 둔 동안에는 syncToken(30일)으로 계속 동기화되지만, 1시간이 지난 뒤 새로고침하면 로그아웃 상태로 시작한다. 다시 로그인하려면 설정 → Change user → Google 버튼. (해결하려면 앱 로직이나 백엔드 정책 변경이 필요해 이번 작업 범위에서 제외했다.)
2. **다른 탭으로 가거나 창을 최소화하면 타이머가 멈춘다.** 웹에서 `AppState`는 페이지 가시성(visibilitychange)을 따른다. 앱을 나간 것과 같은 규칙이 적용되어 5분 넘게 떠나 있으면 세션이 정산된다. 다른 창을 옆에 띄워 두는 것은 괜찮다(페이지가 보이는 상태).
3. **햅틱 없음.** iOS Safari는 진동 API가 없다.
4. **Vercel 미리보기(Preview) 배포에서는 Google 로그인이 안 된다.** 미리보기마다 주소가 달라지는데, Google의 "승인된 JavaScript 원본"은 와일드카드를 받지 않는다. 로그인은 Production 주소에서만 테스트한다.
5. **비공개 브라우징·저장소 삭제**: `localStorage`가 지워지면 기기 로컬 기록(세션, 인벤토리, 프로필)도 사라진다. 로그인 사용자의 학습 세션은 시트에 남아 있어 다시 로그인하면 내려받는다. 인벤토리·프로필은 아직 동기화 대상이 아니다(`DOCs/sync-remaining-state.md`).

## syncToken 보안 메모

웹에서는 로그인 후 받는 `syncToken`(30일 유효, `SYNC_SECRET`으로 HMAC 서명)이 `localStorage`의 `study-timer.auth-session.v1`에 들어간다.

- 같은 출처에서 실행되는 모든 JavaScript가 읽을 수 있다. XSS 한 번이면 토큰이 새어 나간다. 그래서 `vercel.json`에 CSP를 걸어 스크립트를 자기 도메인과 `accounts.google.com/gsi/client`로만 제한했다. 새 외부 스크립트·이미지·API를 추가하면 CSP에도 넣어야 한다(안 넣으면 브라우저 콘솔에 `Refused to ...`가 뜨고 조용히 막힌다).
- 브라우저 확장 프로그램은 CSP와 무관하게 읽을 수 있다.
- 공용 PC에서는 반드시 로그아웃하게 안내할 것. 로그아웃하면 세션 키는 지워지지만, 학습 기록·프로필 이름은 그 브라우저에 남는다.
- 토큰이 유출됐을 때 한 사람만 끊는 방법은 없다. Apps Script의 `SYNC_SECRET`을 바꾸면 **모든** 사용자의 토큰이 무효화되고 모두 다시 로그인해야 한다. 특정 사용자만 막으려면 시트 `Users` 탭에서 `status`를 `active`가 아닌 값으로 바꾼다(다음 로그인부터 거부).
- 토큰은 URL이 아니라 POST 본문으로만 보낸다(서버·프록시 로그에 남지 않음). 이 방식은 유지할 것.
- 사이트 주소는 누구나 열 수 있지만, Google 로그인은 시트 `Users` 탭에 `status = active`로 등록된 이메일만 통과한다. 그 외 사용자는 게스트(기기 로컬)로만 쓴다.

## 배포 체크리스트 (손으로 할 일, 순서대로)

### 1. Vercel 프로젝트 만들기

1. https://vercel.com 에 GitHub 계정으로 로그인 (Hobby 무료 플랜)
2. **Add New → Project → Import** 에서 `Jamot32/Study-timer` 선택
3. Framework Preset은 **Other** 로 둔다. Build/Output/Install 명령은 `vercel.json`이 정하므로 비워 둔다
4. 아직 **Deploy를 누르지 말고** 아래 2번(환경변수)을 먼저 넣는다. 먼저 배포했다면 2번 후 재배포

### 2. 환경변수 입력

`EXPO_PUBLIC_*` 값은 **빌드할 때** 번들에 박힌다. 값을 바꾸면 반드시 재배포해야 반영된다. 둘 다 공개되는 값이라 비밀은 아니지만, 레포에는 넣지 않는다.

Project → **Settings → Environment Variables** 에서 Environment = **Production** (원하면 Preview도) 체크 후 추가:

| Key | Value |
|---|---|
| `EXPO_PUBLIC_AUTH_ENDPOINT` | Apps Script 배포의 `/exec` URL (`.env.local`에 쓰던 값) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | 웹 OAuth 클라이언트 ID (`….apps.googleusercontent.com`) |

`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `GOOGLE_IOS_URL_SCHEME` 은 넣지 않는다.

### 3. 첫 배포

**Deployments → Deploy** (또는 main에 push). 빌드 로그 끝에 `Exported: dist` 가 보이면 성공. 배포 주소를 확인한다(예: `https://study-timer-xxxx.vercel.app`, Settings → Domains 에서 이름 변경 가능).

빌드가 Node 버전 문제로 실패하면 Settings → General → **Node.js Version** 을 22.x 로 설정한다(로컬 검증은 Node 22에서 했다).

### 4. Google Cloud Console — 승인된 JavaScript 원본 (빠뜨리면 로그인 버튼이 조용히 실패)

1. https://console.cloud.google.com → Apps Script가 쓰는 **같은 프로젝트** 선택
2. **APIs & Services → Credentials → OAuth 2.0 Client IDs** 에서 `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` 와 같은 ID의 **Web application** 클라이언트 열기
3. **Authorized JavaScript origins** 에 추가 (경로·끝 슬래시 없이 scheme + host 만):
   - `https://<배포 도메인>` (3번에서 확인한 Production 주소. 커스텀 도메인을 붙였으면 그것도)
   - `http://localhost`
   - `http://localhost:8081`
4. Save. 반영까지 몇 분 걸릴 수 있다
5. OAuth 동의 화면이 **Testing** 상태라면 Test users 에 로그인할 Google 계정을 추가해야 한다(또는 Publish)

**Authorized redirect URIs 는 필요 없다** (팝업 방식).

### 5. Apps Script — 변경 없음

Apps Script 코드는 수정하지 않았고 **재배포도 필요 없다**. 웹 GIS가 발급하는 ID 토큰의 audience는 웹 클라이언트 ID이며, `Code.gs`가 이미 `GOOGLE_WEB_CLIENT_ID`로 검사한다. 확인만 할 것:

- 배포가 Web app / Execute as **Me** / Who has access **Anyone**
- Script properties 에 `GOOGLE_WEB_CLIENT_ID`(위와 같은 값), `SYNC_SECRET` 이 있음
- 시트 `Users` 탭에 테스트할 이메일이 `status = active` 로 있음

### 6. 이후 배포

main 에 push 하면 Vercel이 자동으로 빌드·배포한다. 다른 브랜치·PR은 Preview 배포가 된다(로그인은 안 됨, 위 "웹에서 다른 것" 4번).

## 배포 후 동작 확인

시크릿 창(깨끗한 localStorage)에서 Production 주소로 연다. 개발자 도구 콘솔을 열어 두고 `Refused to`(CSP 차단)나 빨간 에러가 없는지 같이 본다.

1. **첫 화면**: 게스트로 배틀 화면이 바로 뜬다. 하단 탭 Roll/Stats/Battle/Rank/Shop 이 모두 보이고, 폰에서는 주소창에 가려지지 않는다
2. **로그인**: 오른쪽 위 톱니 → Settings → **Change user** → 로그인 카드에 Google 버튼이 그려지는지 확인 → 눌러서 허용된 계정으로 로그인
   - 버튼 대신 "Could not load Google sign-in." → 광고 차단기 또는 CSP 문제. 콘솔 확인
   - 팝업에 "origin_mismatch"/"The given origin is not allowed" 또는 아무 반응 없음 → 4번(JavaScript 원본) 누락
   - "Google login has not been configured for this build." → 2번 환경변수 누락이거나 넣은 뒤 재배포 안 함
   - "The login server returned an invalid response." → `/exec` URL이 틀렸거나 배포가 Anyone이 아님
   - "Access for this account has been disabled." / 허용 목록 오류 → 시트 `Users` 탭
3. 로그인 후 Settings 의 Profile 카드에 `Signed in with Google as <이메일> (<role>)` 이 보이면 성공
4. **타이머**: Battle 탭 → **Solo** → 시계가 올라가는지 확인. **1분 이상** 둔 뒤 **Finish**
5. **동기화**: 판이 끝나면(Finish 후 결과 화면) 자동으로 동기화가 돈다. 로그인 직후와 세션 복원 직후에도 한 번 돈다. **Stats** 탭 Today 에 방금 세션이 보이고, Settings → Profile 카드 아래에 `Synced just now` 류의 줄이 뜨는지 확인. `Sync failed — tap to retry` 가 뜨면 그 줄을 눌러 재시도하고 콘솔/네트워크 탭에서 `/exec` 응답을 본다 (웹에는 Stats 의 당겨서 새로고침이 없다)
6. **서버 확인**: 스프레드시트의 `Sessions` 탭에 내 이메일로 새 행이 생겼는지 확인
7. **다른 기기에서 내려받기**: 다른 브라우저(또는 휴대폰 앱)에서 같은 계정으로 로그인 → Stats 를 열면 같은 세션이 보여야 한다
8. **새로고침**: 1시간 안에 새로고침하면 로그인 유지. 그 이후에는 로그아웃 상태로 시작하는 것이 현재 정상 동작이다
9. **로그아웃**: Settings → **Sign out** → 개발자 도구 Application → Local Storage 에서 `study-timer.auth-session.v1` 이 사라졌는지 확인
10. **새 경로 직접 열기**: `https://<도메인>/anything` 이 404 대신 앱을 띄우는지(SPA rewrite) 확인
