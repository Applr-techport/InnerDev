# InnerDev - 개발 내부용 도구

개발 내부에서 사용할 수 있는 유틸리티 도구 모음입니다.

## 기능

### 앱 아이콘 생성기

1024x1024 이미지를 업로드하면 iOS와 Android용 앱 아이콘 이미지셋을 자동으로 생성합니다.

- **iOS**: 모든 포인트 사이즈별 @2x, @3x 이미지 생성
- **Android**: 모든 밀도별 (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi) 이미지 생성
- 바로 사용 가능한 폴더 구조로 ZIP 파일 다운로드

## 기술 스택

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- JSZip

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 환경 변수 설정

`.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# Anthropic API (AI 분석용)
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Figma API (피그마 웹사이트 변환기용)
FIGMA_API_TOKEN="your-figma-api-token"

# Vercel API (자동 배포용, 선택사항)
VERCEL_API_TOKEN="your-vercel-api-token"
VERCEL_TEAM_ID="your-vercel-team-id"  # 선택사항

# GitHub API (자동 배포용, 선택사항)
GITHUB_TOKEN="your-github-personal-access-token"  # repo 권한 필요

# Webhook 시크릿 (선택사항, 보안 강화용)
GITHUB_WEBHOOK_SECRET="your-github-webhook-secret"  # GitHub webhook 설정 시
VERCEL_WEBHOOK_SECRET="your-vercel-webhook-secret"  # Vercel webhook 설정 시

# Base URL (배포 환경에서 필요)
NEXT_PUBLIC_BASE_URL="https://your-domain.com"  # Vercel 배포 시 자동 설정됨
```

### 환경 변수 획득 방법

- **ANTHROPIC_API_KEY**: [Anthropic Console](https://console.anthropic.com/)에서 API 키 생성
- **FIGMA_API_TOKEN**: [Figma Settings > Personal Access Tokens](https://www.figma.com/settings)에서 토큰 생성
- **VERCEL_API_TOKEN**: [Vercel Dashboard > Settings > Tokens](https://vercel.com/account/tokens)에서 토큰 생성
- **GITHUB_TOKEN**: [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)에서 생성 (repo 권한 필요)

## 배포

이 프로젝트는 Vercel에 배포할 수 있습니다.

1. GitHub에 저장소를 푸시합니다.
2. Vercel에서 프로젝트를 import합니다.
3. 환경 변수를 설정합니다.
4. 자동으로 배포됩니다.

## 클로드2 자동 감지 및 평가 시스템 설정

클로드1이 GitHub에 푸시하면 자동으로 감지하고, Vercel 배포 완료 후 클로드2가 자동으로 평가하는 시스템을 사용하려면 다음 설정이 필요합니다.

### 필수 환경 변수

- `ANTHROPIC_API_KEY`: Claude API 키 (필수)
- `GITHUB_TOKEN`: GitHub Personal Access Token (repo 권한 필요)
- `VERCEL_API_TOKEN`: Vercel API 토큰
- `VERCEL_TEAM_ID`: Vercel 팀 ID (선택사항, 팀 계정 사용 시)

### 선택사항: Webhook 설정 (더 빠른 감지)

Webhook을 설정하면 GitHub 푸시나 Vercel 배포를 즉시 감지할 수 있습니다. 설정하지 않아도 polling 방식으로 자동 감지됩니다.

#### GitHub Webhook 설정

1. GitHub 저장소로 이동
2. Settings > Webhooks > Add webhook
3. Payload URL: `https://your-domain.com/api/webhooks/github`
4. Content type: `application/json`
5. Events: `push` 선택
6. Secret: 원하는 시크릿 값 입력 (`.env.local`에 `GITHUB_WEBHOOK_SECRET` 설정)
7. Active 체크 후 Add webhook

#### Vercel Webhook 설정

1. Vercel Dashboard > Project Settings > Git
2. Webhooks 섹션에서 Add Webhook
3. URL: `https://your-domain.com/api/webhooks/vercel`
4. Events: `deployment.created`, `deployment.succeeded` 선택
5. Secret: 원하는 시크릿 값 입력 (`.env.local`에 `VERCEL_WEBHOOK_SECRET` 설정)

### 사용 방법

1. **자동 생성 모드**: 새 세션 시작 시 GitHub URL과 Figma URL을 함께 입력하면 자동으로 생성 및 평가됩니다.
2. **수동 모드**: 
   - 클로드1이 GitHub에 푸시하면 자동으로 배포 상태 확인 시작
   - Vercel 배포 완료 시 클로드2가 자동으로 평가
   - 90점 미만: 보완사항이 클로드1에게 자동 전달
   - 90점 이상: 작업 완료 처리

### 세션에 Figma URL 저장

자동 생성 모드를 사용하면 Figma URL이 자동으로 세션에 저장됩니다. 수동으로 세션을 생성한 경우, 세션 생성 시 Figma URL을 함께 제공하거나 나중에 업데이트할 수 있습니다.

