import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// 평가 결과 타입
export type EvaluationResult = {
  passed: boolean; // 전체 통과 여부
  score: number; // 0-100 점수
  categories: {
    codeQuality: {
      score: number;
      passed: boolean;
      issues: string[];
      suggestions: string[];
    };
    designAccuracy: {
      score: number;
      passed: boolean;
      issues: string[];
      suggestions: string[];
    };
    functionality: {
      score: number;
      passed: boolean;
      issues: string[];
      suggestions: string[];
    };
  };
  overallFeedback: string;
};

// 프로젝트 전체 평가 결과 타입
export type ProjectEvaluationResult = {
  totalScore: number; // 0-100 점수
  blockers: string[]; // 심각한 오류 (배포 불가)
  improvements: string[]; // 개선 제안
  releaseReady: boolean; // 배포 가능 여부 (80점 이상 && blockers 없음)
  categories: {
    structure: {
      score: number;
      comment: string;
    };
    maintainability: {
      score: number;
      comment: string;
    };
    scalability: {
      score: number;
      comment: string;
    };
    productionReady: {
      score: number;
      comment: string;
    };
    figmaAlignment: {
      score: number;
      comment: string;
    };
  };
};

// 프로젝트 전체 평가 함수 (내부 함수로 변경)
async function evaluateProject(
  files: Array<{ path: string; content: string }>,
  projectType: "nextjs" | "react-vite",
  semanticAnalysis?: any
): Promise<ProjectEvaluationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  }

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `당신은 프로젝트 전체를 평가하는 AI Evaluator입니다.
다음 5가지 항목을 종합적으로 평가해주세요:

1. 구조 적절성 (Structure)
   - 프로젝트 폴더 구조가 적절한지
   - 파일 분리가 논리적인지
   - 네이밍 컨벤션 준수 여부
   - 아키텍처 패턴 적용 여부

2. 유지보수성 (Maintainability)
   - 코드 가독성
   - 주석 및 문서화
   - 타입 안정성
   - 에러 처리

3. 확장성 (Scalability)
   - 컴포넌트 재사용성
   - 상태 관리 구조
   - API 연동 구조
   - 라우팅 구조

4. 실서비스 가능성 (Production Ready)
   - 빌드 에러 없음
   - 환경변수 분리
   - 보안 고려사항
   - 성능 최적화

5. Figma 의도 반영도 (Figma Alignment)
   - 의미 기반 해석 정확도
   - 디자인 일치도
   - 사용자 플로우 구현
   - CRUD 기능 구현

평가 기준:
- 각 카테고리를 0-100점으로 평가
- blockers: 배포를 막는 심각한 오류 (빌드 실패, 보안 취약점 등)
- improvements: 개선 제안 (선택사항)
- releaseReady: totalScore >= 80 && blockers.length === 0

응답 형식:
반드시 다음 JSON 형식으로 응답하세요:
{
  "totalScore": number,
  "blockers": string[],
  "improvements": string[],
  "releaseReady": boolean,
  "categories": {
    "structure": {"score": number, "comment": string},
    "maintainability": {"score": number, "comment": string},
    "scalability": {"score": number, "comment": string},
    "productionReady": {"score": number, "comment": string},
    "figmaAlignment": {"score": number, "comment": string}
  }
}`;

  const filesSummary = files.map(f => ({
    path: f.path,
    size: f.content.length,
    type: f.path.split('.').pop(),
  }));

  const userPrompt = `다음 ${projectType === "react-vite" ? "React + Vite" : "Next.js"} 프로젝트를 평가해주세요:

프로젝트 타입: ${projectType}
파일 목록:
${JSON.stringify(filesSummary, null, 2)}

${semanticAnalysis ? `의미 분석 결과:
${JSON.stringify(semanticAnalysis, null, 2)}` : ''}

주요 파일 내용:
${files.slice(0, 10).map(f => `=== ${f.path} ===\n${f.content.substring(0, 500)}...`).join('\n\n')}

위 프로젝트를 5가지 카테고리로 평가하고, blockers와 improvements를 제공해주세요.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  
  if (!responseText) {
    throw new Error("평가 응답을 받지 못했습니다.");
  }

  // JSON 추출
  let jsonText = responseText.trim();
  if (jsonText.startsWith("```")) {
    const startIndex = jsonText.indexOf("```") + 3;
    if (jsonText.substring(startIndex).match(/^(json|javascript|typescript)\n/)) {
      jsonText = jsonText.substring(startIndex).replace(/^(json|javascript|typescript)\n/, "").trim();
    } else {
      jsonText = jsonText.substring(startIndex).trim();
    }
    const lastIndex = jsonText.lastIndexOf("```");
    if (lastIndex !== -1) {
      jsonText = jsonText.substring(0, lastIndex).trim();
    }
  }

  let result: ProjectEvaluationResult;
  try {
    result = JSON.parse(jsonText);
  } catch (parseError) {
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("평가 결과를 파싱할 수 없습니다.");
    }
  }

  // 안전장치: releaseReady 재계산
  result.releaseReady = result.totalScore >= 80 && result.blockers.length === 0;

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { code, figmaData, pageId, files, projectType, semanticAnalysis } = await request.json();

    // 프로젝트 전체 평가인 경우
    if (files && Array.isArray(files)) {
      const evaluation = await evaluateProject(files, projectType || "nextjs", semanticAnalysis);
      return NextResponse.json(evaluation);
    }

    // 단일 컴포넌트 평가 (기존 로직)
    if (!code) {
      return NextResponse.json(
        { error: "컴포넌트 코드가 필요합니다." },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "컴포넌트 코드가 필요합니다." },
        { status: 400 }
      );
    }

    // Claude API 키 확인
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // Claude 클라이언트 초기화
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // 피그마 디자인 정보 요약 (평가용)
    const figmaSummary = figmaData?.document
      ? JSON.stringify({
          type: figmaData.document.type,
          name: figmaData.document.name,
          // 주요 스타일 정보만 추출
          styles: {
            fills: figmaData.document.fills,
            effects: figmaData.document.effects,
          },
        })
      : "피그마 디자인 정보 없음";

    const systemPrompt = `당신은 React 컴포넌트 코드를 평가하는 전문가입니다.
다음 3가지 항목을 종합적으로 평가해주세요:

1. 코드 품질 (Code Quality)
   - 구문 오류, 타입 안정성
   - React/Next.js Best Practice 준수
   - 성능 최적화 (불필요한 리렌더링, 메모이제이션 등)
   - 접근성 (a11y) 준수
   - 코드 가독성 및 유지보수성

2. 디자인 정확도 (Design Accuracy)
   - 원본 피그마 디자인과의 레이아웃 일치도
   - 색상, 폰트, 간격 정확도
   - 반응형 디자인 구현 여부
   - 이미지/아이콘 처리 적절성
   - 시각적 일관성

3. 기능 완성도 (Functionality)
   - 요구사항 충족 여부
   - 인터랙션 구현 여부
   - 에러 처리
   - 사용자 경험 (UX) 품질
   - 완전성 (모든 요소가 제대로 구현되었는지)

평가 기준:
- 각 카테고리를 0-100점으로 평가
- 통과 기준: 각 카테고리 70점 이상, 전체 평균 75점 이상
- 심각한 오류 (구문 오류, 타입 오류)가 있으면 해당 카테고리 자동 실패
- 경고 사항은 점수 감점 및 suggestions에 포함

응답 형식:
반드시 다음 JSON 형식으로 응답하세요 (설명 없이 JSON만):
{
  "passed": boolean,
  "score": number,
  "categories": {
    "codeQuality": {
      "score": number,
      "passed": boolean,
      "issues": string[],
      "suggestions": string[]
    },
    "designAccuracy": {
      "score": number,
      "passed": boolean,
      "issues": string[],
      "suggestions": string[]
    },
    "functionality": {
      "score": number,
      "passed": boolean,
      "issues": string[],
      "suggestions": string[]
    }
  },
  "overallFeedback": string
}`;

    const userPrompt = `다음 React 컴포넌트 코드를 평가해주세요:

=== 컴포넌트 코드 ===
${code}

=== 원본 피그마 디자인 정보 ===
${figmaSummary}

위 코드를 3가지 카테고리(코드 품질, 디자인 정확도, 기능 완성도)로 평가하고,
각 카테고리의 점수, 통과 여부, 발견된 이슈, 개선 제안을 제공해주세요.
전체 통과 여부와 종합 피드백도 포함해주세요.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // Claude 응답에서 JSON 추출
    const responseText = message.content[0].type === "text" 
      ? message.content[0].text 
      : "";

    if (!responseText) {
      throw new Error("Claude로부터 응답을 받지 못했습니다.");
    }

    // JSON 추출 (마크다운 코드 블록 제거)
    let jsonText = responseText.trim();
    
    // ```json ... ``` 또는 ``` ... ``` 코드 블록 추출
    if (jsonText.startsWith("```")) {
      const startIndex = jsonText.indexOf("```") + 3;
      // 언어 태그 제거
      if (jsonText.substring(startIndex).match(/^(json|javascript|typescript)\n/)) {
        jsonText = jsonText.substring(startIndex).replace(/^(json|javascript|typescript)\n/, "").trim();
      } else {
        jsonText = jsonText.substring(startIndex).trim();
      }
      // 마지막 ``` 제거
      const lastIndex = jsonText.lastIndexOf("```");
      if (lastIndex !== -1) {
        jsonText = jsonText.substring(0, lastIndex).trim();
      }
    }

    // JSON 파싱
    let evaluationResult: EvaluationResult;
    try {
      evaluationResult = JSON.parse(jsonText);
    } catch (parseError) {
      // JSON 파싱 실패 시 텍스트에서 JSON 추출 시도
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("평가 결과를 파싱할 수 없습니다.");
      }
    }

    // 통과 여부 재계산 (안전장치)
    const avgScore = (
      evaluationResult.categories.codeQuality.score +
      evaluationResult.categories.designAccuracy.score +
      evaluationResult.categories.functionality.score
    ) / 3;

    const allPassed = 
      evaluationResult.categories.codeQuality.passed &&
      evaluationResult.categories.designAccuracy.passed &&
      evaluationResult.categories.functionality.passed &&
      avgScore >= 75;

    evaluationResult.passed = allPassed;
    evaluationResult.score = Math.round(avgScore);

    return NextResponse.json(evaluationResult);
  } catch (error) {
    console.error("컴포넌트 평가 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "컴포넌트 평가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

