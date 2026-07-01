# PSE 단어장

> I hope everyone gets a perfect score. 🎯

월별 · 일별로 영단어를 정리하고 **퀴즈 형식**으로 외우는 웹사이트입니다.
GitHub Pages로 호스팅됩니다 → **https://kyw0615.github.io/PSE/**

깔끔한 월/일 네비게이션, 통일된 UI(라이트·다크), 진행 상황 저장 기능을 갖춘
단일 페이지 앱(SPA)으로, 단어 데이터만 추가하면 자동으로 목록에 반영됩니다.

---

## ✨ 주요 기능

- **월/일 네비게이션** — 왼쪽 사이드바에서 월(AM1·AM3·AM4)과 날짜를 클릭. 검색창으로 주제·번호 검색.
- **URL 즐겨찾기** — 주소가 `#/AM1/day05` 처럼 바뀌어서 뒤로가기·북마크·새로고침이 그대로 동작.
- **통일된 퀴즈 엔진** (기존 AM1 최신 버전 기준)
  - 단어장 미리보기 → 퀴즈 시작
  - **셔플**, **한→영 / 영→한 방향 전환**
  - 오답이면 흔들림 애니메이션 + 정답 맞힐 때까지 재시도 (모르면 Skip)
  - 대소문자·공백·문장부호 무시하고 채점
  - 진행률·점수 표시, 끝나면 **틀린 단어만 다시 풀기**
- **진행 상황 저장** — 완료한 단어장에 ✓ 표시, 최고 점수 기록 (브라우저 localStorage).
- **라이트/다크 테마**, 모바일 반응형.
- **전체(모든 날) 복습 덱** — 각 월마다 자동 생성.

---

## 📁 폴더 구조

```
PSE/
├─ docs/                     ← GitHub Pages가 서비스하는 실제 사이트
│  ├─ index.html             ← 페이지 뼈대
│  ├─ assets/
│  │  ├─ styles.css          ← 전체 디자인(테마·레이아웃)
│  │  └─ app.js              ← 네비게이션 + 퀴즈 로직
│  └─ data/
│     ├─ config.json         ← 월 목록/이름/순서  (직접 수정)
│     ├─ AM1/  AM3/  AM4/     ← 월별 폴더, 하루당 JSON 하나  (직접 수정)
│     │   └─ day05.json ...
│     ├─ manifest.json       ← 자동 생성 (build.py)
│     └─ bundle.js           ← 자동 생성 (build.py) — 앱이 읽는 파일
├─ build.py                  ← 데이터 → bundle.js/manifest.json 빌드 스크립트
├─ legacy/original-html/     ← 개편 전 원본 HTML 백업 (사이트에는 안 나옴)
└─ .github/workflows/        ← (선택) 자동 빌드·배포
```

### 단어 데이터 형식 (`docs/data/<월>/dayNN.json`)

```json
{
  "label": "Day 5",
  "topic": "집 구하기",
  "words": [
    { "korean": "집 구하기", "english": "Finding a Home" },
    { "korean": "공공요금", "english": "utilities" }
  ]
}
```
- `label` : 목록에 표시되는 이름 (예: `Day 5`)
- `topic` : 부제/주제. 없으면 `null`
- `words` : 단어 목록 (`korean` / `english`)

---

## ➕ 단어 추가·수정하는 법

### 1) 기존 날짜의 단어 고치기
`docs/data/<월>/dayNN.json` 을 열어 `words` 를 수정 → `python build.py` → 커밋/푸시.

### 2) 새로운 날(day) 추가
1. `docs/data/AM1/day14.json` 같은 파일을 위 형식으로 만든다.
2. 터미널에서 빌드:
   ```bash
   python build.py
   ```
3. 커밋 & 푸시. 사이드바에 자동으로 나타납니다. (파일명 `dayNN` 의 숫자 순으로 정렬)

### 3) 새로운 월(月) 추가
1. `docs/data/AM2/` 폴더를 만들고 day 파일들을 넣는다.
2. `docs/data/config.json` 의 `months` 배열에 한 줄 추가:
   ```json
   { "id": "AM2", "name": "AM2" }
   ```
   (`name` 은 화면에 보이는 이름 — 원하면 "2월", "Unit 2" 등으로 바꿔도 됨)
3. `python build.py` → 커밋 & 푸시.

> 💡 `build.py` 를 실행하면 `manifest.json` 과 `bundle.js` 가 다시 만들어집니다.
> **이 두 파일은 직접 수정하지 마세요.** (자동 생성 파일)

---

## 🖥 로컬에서 미리보기

브라우저로 바로 열어도(`docs/index.html` 더블클릭) 동작하지만,
정식으로 확인하려면 간단한 로컬 서버를 띄우는 걸 권장합니다:

```bash
python -m http.server 4173 --directory docs
```
→ 브라우저에서 http://localhost:4173 접속.

---

## 🚀 GitHub Pages 배포

이 저장소는 **`main` 브랜치의 `/docs` 폴더**를 그대로 서비스하도록 설정하면 됩니다.

**설정 방법** (한 번만): GitHub 저장소 → **Settings → Pages** →
*Build and deployment* → **Source: Deploy from a branch** →
Branch: **main** / 폴더: **/docs** → Save.

`bundle.js` 와 `manifest.json` 을 커밋에 포함하므로, 푸시만 하면 바로 반영됩니다.
(단어를 바꿨다면 푸시 전에 `python build.py` 실행을 잊지 마세요.)

### (선택) 자동 빌드·배포
`python build.py` 를 매번 돌리기 귀찮다면 GitHub Actions로 자동화할 수 있습니다.
`.github/workflows/deploy.yml` 이 포함되어 있습니다. 사용하려면:
Settings → Pages → Source 를 **GitHub Actions** 로 바꾸면 됩니다.
그러면 푸시할 때마다 CI가 `build.py` 를 돌려서 배포합니다. (JSON만 고치고 푸시하면 끝)
