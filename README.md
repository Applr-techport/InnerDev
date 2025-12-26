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

## 배포

이 프로젝트는 Vercel에 배포할 수 있습니다.

1. GitHub에 저장소를 푸시합니다.
2. Vercel에서 프로젝트를 import합니다.
3. 자동으로 배포됩니다.

