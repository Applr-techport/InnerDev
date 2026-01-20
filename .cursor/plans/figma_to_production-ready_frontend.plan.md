# Figma to Production-Ready Frontend 프로젝트 생성 시스템

## 목표
Figma URL 하나만으로 실제 서비스로 배포 가능한 프론트엔드 프로젝트를 완성합니다.

## 핵심 변경사항

### 1. 프로젝트 타입 선택 기능 추가
- UI에 "프로젝트 타입" 선택 옵션 추가 (Next.js / React + Vite)
- 선택된 타입에 따라 다른 프로젝트 구조 생성

### 2. Playwright 기반 Figma 분석 강화
- `app/api/figma/analyze/route.ts` 수정:
  - Figma API 대신 Playwright로 페이지 직접 접근
  - DOM 구조 분석을 통한 의미 기반 해석:
    - Frame → Page 매핑 (레이어 패널 분석)
    - Section → Feature 추출 (컴포넌트 그룹 분석)
    - Component → 재사용 컴포넌트 식별
    - Variant → State 추출
  - Vision API로 스크린샷 분석하여 의미 추출
  - 라우팅 구조 자동 생성
  - CRUD 여부 판단 (폼, 버튼, 테이블 등 분석)

### 3. React + Vite 프로젝트 구조 생성
- `lib/projectGenerator.ts`에 `getViteProjectStructure` 함수 추가
- 표준 React 프로젝트 구조:
  ```
  src/
   ├─ pages/          # 페이지 컴포넌트
   ├─ components/     # 재사용 컴포넌트
   ├─ hooks/          # 커스텀 훅
   ├─ services/       # API 호출 (api.ts 포함)
   ├─ types/          # TypeScript 타입
   ├─ utils/          # 유틸리티 함수
   ├─ styles/         # 스타일 파일
   └─ App.tsx         # 메인 앱 컴포넌트
  ```

### 4. API 연동 구조 추가
- `services/api.ts` 생성:
  - Axios 또는 Fetch 기반 API 클라이언트
  - `VITE_API_BASE_URL` 환경변수 사용
  - 백엔드 연동 가능한 구조 (Node.js + MySQL 가정)
- API 스펙 추론 및 README에 명시

### 5. 환경변수 분리
- `.env.example` 파일 생성
- `VITE_API_BASE_URL` 설정
- Vercel 환경변수 사용 전제

### 6. AI 평가 시스템 강화
- `app/api/figma/evaluate/route.ts` 수정:
  - 평가 항목: 구조 적절성, 유지보수성, 확장성, 실서비스 가능성, Figma 의도 반영도
  - 점수 기준: 80점 이상
  - `releaseReady` 필드 추가
  - `blockers`, `improvements` 배열 포함
  - 80점 미만이면 자동 수정 → 재평가 반복

### 7. README 개선
- 프로젝트 개요
- 구조 설명
- 실행 방법
- API 스펙 문서
- 환경변수 설정 가이드

### 8. Claude System Prompt 개선
- 역할 분리 인식 (Tech Lead, Frontend Engineer, Infra Engineer, Backend Integrator, AI Evaluator)
- 의미 기반 해석 강조
- API 연동 구조 생성 지시
- 평가 통과까지 반복 작업

## 구현 파일

### 수정할 파일
1. `components/FigmaToWebsite.tsx`
   - 프로젝트 타입 선택 UI 추가
   - 선택된 타입을 API에 전달

2. `app/api/figma/analyze/route.ts`
   - Playwright로 Figma 페이지 직접 접근
   - DOM 구조 분석 (레이어 패널, 컴포넌트 등)
   - Vision API로 스크린샷 분석하여 의미 추출
   - 페이지 구조, 라우팅, CRUD 여부 추출

3. `app/api/figma/generate-project/route.ts`
   - 프로젝트 타입에 따른 분기 처리
   - React + Vite 구조 생성 로직 추가
   - 의미 기반 해석 결과 반영
   - API 연동 구조 생성
   - 평가 통과까지 반복 로직

4. `lib/projectGenerator.ts`
   - `getViteProjectStructure` 함수 추가
   - React + Vite 기본 구조 템플릿

5. `app/api/figma/evaluate/route.ts`
   - 평가 기준 강화 (80점, releaseReady)
   - blockers, improvements 포함

### 새로 생성할 파일
- `lib/figmaAnalyzer.ts` (선택사항): Playwright 기반 Figma 분석 유틸리티

## 구현 순서

1. 프로젝트 타입 선택 UI 추가
2. Playwright 기반 Figma 분석 로직 구현
3. React + Vite 프로젝트 구조 생성 함수 구현
4. 의미 기반 해석 로직 강화
5. API 연동 구조 생성 로직 추가
6. AI 평가 시스템 강화
7. README 생성 로직 개선
8. 통합 테스트

## 평가 기준

```json
{
  "totalScore": 0-100,
  "blockers": ["심각한 오류 목록"],
  "improvements": ["개선 제안 목록"],
  "releaseReady": false
}
```

- `totalScore >= 80` AND `releaseReady === true` 일 때만 배포
- 그렇지 않으면 수정 후 재평가 반복

