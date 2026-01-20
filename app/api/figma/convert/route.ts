import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    const { pageId, screenshot, useScreenshot, figmaUrl, semanticAnalysis } = await request.json();

    // 스크린샷 기반 변환만 지원 (Playwright 사용)
    if (!screenshot) {
      return NextResponse.json(
        { error: "스크린샷이 필요합니다. Playwright를 사용하여 스크린샷을 먼저 캡처해주세요." },
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

    // 스크린샷 기반 변환만 사용 (Playwright로 캡처한 스크린샷 사용)

    const systemPrompt = `당신은 피그마 디자인을 React 컴포넌트로 변환하는 전문가입니다. 
스크린샷을 분석하여 완전한 React 컴포넌트 코드를 생성해주세요.

요구사항:
1. Next.js 14 App Router를 사용하는 React 컴포넌트
2. Tailwind CSS를 사용한 스타일링
3. TypeScript 사용
4. 반응형 디자인 적용
5. 스크린샷의 레이아웃, 색상, 폰트, 간격 등을 정확히 재현
6. 이미지가 있는 경우 적절한 placeholder 또는 이미지 URL 사용
7. 완전히 작동하는 독립적인 컴포넌트

응답 형식:
- 코드만 반환하세요 (설명 없이)
- "use client" 지시어 포함
- export default function으로 컴포넌트 내보내기
- 모든 스타일은 Tailwind CSS 클래스로 적용`;

    // semanticAnalysis가 있으면 추가 컨텍스트로 사용
    const semanticContext = semanticAnalysis 
      ? `\n\n추가 컨텍스트 (의미 분석 결과):\n${JSON.stringify(semanticAnalysis, null, 2)}`
      : '';

    const userPrompt = `다음 Figma 디자인 스크린샷을 React 컴포넌트로 변환해주세요.

스크린샷을 분석하여:
- 레이아웃 구조 파악
- 색상, 폰트, 간격 등 스타일 정보 추출
- 컴포넌트 구조 설계
- 반응형 디자인 적용

위 스크린샷을 정확히 재현하는 React 컴포넌트 코드를 생성해주세요.${semanticContext}`;

    // 스크린샷을 Vision API로 전송
    const screenshotBase64 = typeof screenshot === 'string' ? screenshot : screenshot.toString('base64');
    
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 16384,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshotBase64,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
    });

    // Claude 응답에서 코드 추출
    const responseText = message.content[0].type === "text" 
      ? message.content[0].text 
      : "";

    if (!responseText) {
      throw new Error("Claude로부터 응답을 받지 못했습니다.");
    }

    // 코드 블록에서 코드 추출
    let code = responseText.trim();
    
    // ```tsx ... ``` 또는 ```ts ... ``` 또는 ```jsx ... ``` 코드 블록 추출
    if (code.startsWith("```")) {
      const startIndex = code.indexOf("```") + 3;
      // 언어 태그 제거
      if (code.substring(startIndex).match(/^(tsx|ts|jsx|javascript|typescript)\n/)) {
        code = code.substring(startIndex).replace(/^(tsx|ts|jsx|javascript|typescript)\n/, "").trim();
      } else {
        code = code.substring(startIndex).trim();
      }
      // 마지막 ``` 제거
      const lastIndex = code.lastIndexOf("```");
      if (lastIndex !== -1) {
        code = code.substring(0, lastIndex).trim();
      }
    }

    // 자동 평가 수행
    let evaluation = null;
    try {
      // 내부 평가 API 호출
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                     (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      
      const evaluateResponse = await fetch(`${baseUrl}/api/figma/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          pageId,
          figmaUrl,
        }),
      });

      if (evaluateResponse.ok) {
        evaluation = await evaluateResponse.json();
      } else {
        console.warn("평가 API 호출 실패:", await evaluateResponse.text());
      }
    } catch (evalError) {
      console.warn("평가 중 오류 발생 (계속 진행):", evalError);
      // 평가 실패해도 변환 결과는 반환
    }

    return NextResponse.json({ 
      code,
      evaluation, // 평가 결과 포함
    });
  } catch (error) {
    console.error("React 컴포넌트 생성 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "React 컴포넌트 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

