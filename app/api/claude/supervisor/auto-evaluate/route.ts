import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getContext } from "@/lib/figmaSession";
import { getSession, updateSessionEvaluation, updateSessionVercel } from "@/lib/claudeSession";

/**
 * Figma 디자인 스크린샷 가져오기
 */
async function getFigmaScreenshot(figmaUrl: string): Promise<string | null> {
  try {
    // Figma screenshot API 사용
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    
    const response = await fetch(`${baseUrl}/api/figma/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ figmaUrl }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.screenshot || null;
    }
    return null;
  } catch (error) {
    console.error("Figma 스크린샷 가져오기 오류:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  let page = null;

  try {
    const { sessionId, deploymentUrl, figmaUrl } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId가 필요합니다." },
        { status: 400 }
      );
    }

    if (!deploymentUrl) {
      return NextResponse.json(
        { error: "deploymentUrl이 필요합니다." },
        { status: 400 }
      );
    }

    // 세션 가져오기
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Vercel URL 업데이트
    if (deploymentUrl) {
      updateSessionVercel(sessionId, deploymentUrl);
    }

    const figmaUrlToUse = figmaUrl || session.figmaUrl;
    if (!figmaUrlToUse) {
      return NextResponse.json(
        { error: "Figma URL이 필요합니다." },
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

    const anthropic = new Anthropic({ apiKey });

    // Playwright로 배포된 웹사이트 확인
    const context = await getContext();
    page = await context.newPage();

    await page.goto(deploymentUrl, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForTimeout(3000); // 페이지 로드 대기

    // 배포된 웹사이트 스크린샷 캡처
    const deploymentScreenshot = await page.screenshot({
      type: "png",
    });

    // DOM 구조 분석
    const domAnalysis = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        elements: {
          headings: Array.from(document.querySelectorAll("h1, h2, h3")).map((el) => ({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 100),
          })),
          links: Array.from(document.querySelectorAll("a")).length,
          buttons: Array.from(document.querySelectorAll("button")).length,
          forms: Array.from(document.querySelectorAll("form")).length,
          images: Array.from(document.querySelectorAll("img")).length,
        },
        bodyText: document.body.textContent?.trim().substring(0, 1000),
      };
    });

    await page.close();

    // Figma 디자인 스크린샷 가져오기
    const figmaScreenshot = await getFigmaScreenshot(figmaUrlToUse);

    // Vision API로 비교 분석 및 평가
    const deploymentScreenshotBase64 = deploymentScreenshot.toString("base64");
    const images: any[] = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: deploymentScreenshotBase64,
        },
      },
    ];

    if (figmaScreenshot) {
      images.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: figmaScreenshot,
        },
      });
    }

    const systemPrompt = `당신은 클로드2 (감독자)입니다. 클로드1의 작업물을 Figma 디자인과 비교하여 평가합니다.

평가 기준:
1. 디자인 정확도 (40점): 레이아웃, 색상, 폰트, 간격 등이 Figma 디자인과 일치하는지
2. 기능 완성도 (30점): 모든 기능이 정상 작동하는지, 인터랙션이 올바른지
3. 사용자 경험 (20점): 사용하기 편리한지, 반응형 디자인이 적절한지
4. 코드 품질 (10점): 구조가 깔끔한지, 성능이 좋은지

평가 점수는 0-100점으로 계산하며, 90점 이상이면 작업 완료로 처리합니다.

응답 형식 (JSON):
{
  "score": 85,
  "categories": {
    "designAccuracy": { "score": 35, "maxScore": 40, "comment": "..." },
    "functionality": { "score": 28, "maxScore": 30, "comment": "..." },
    "userExperience": { "score": 18, "maxScore": 20, "comment": "..." },
    "codeQuality": { "score": 9, "maxScore": 10, "comment": "..." }
  },
  "overallFeedback": "전체적인 평가 의견",
  "improvements": ["개선사항1", "개선사항2"],
  "isCompleted": false
}`;

    const analysisPrompt = `배포된 웹사이트와 Figma 디자인을 비교하여 평가해주세요.

배포 URL: ${deploymentUrl}
Figma URL: ${figmaUrlToUse}

DOM 분석 결과:
${JSON.stringify(domAnalysis, null, 2)}

${figmaScreenshot ? "첫 번째 이미지는 배포된 웹사이트, 두 번째 이미지는 Figma 디자인입니다." : "이미지는 배포된 웹사이트입니다. Figma 디자인과 비교하여 평가해주세요."}

위 정보를 바탕으로 JSON 형식으로 평가 결과를 제공해주세요.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            ...images,
            {
              type: "text",
              text: analysisPrompt,
            },
          ],
        },
      ],
    });

    const responseText = response.content[0].type === "text" ? response.content[0].text : "";

    // JSON 파싱 시도
    let evaluationResult: any = null;
    try {
      // JSON 코드 블록 추출
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       responseText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        evaluationResult = JSON.parse(jsonMatch[1]);
      } else {
        // JSON 코드 블록이 없으면 전체 텍스트를 JSON으로 파싱 시도
        evaluationResult = JSON.parse(responseText);
      }
    } catch (e) {
      // JSON 파싱 실패 시 기본값 사용
      console.warn("평가 결과 JSON 파싱 실패:", e);
      evaluationResult = {
        score: 0,
        overallFeedback: responseText,
        improvements: ["평가 결과를 파싱할 수 없습니다."],
        isCompleted: false,
      };
    }

    const score = evaluationResult.score || 0;
    const isCompleted = score >= 90;

    // 세션에 평가 결과 저장
    updateSessionEvaluation(sessionId, score, isCompleted);

    // 90점 미만인 경우 클로드1에게 피드백 전달
    let feedbackDelivered = false;
    if (!isCompleted && evaluationResult.improvements && evaluationResult.improvements.length > 0) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                       (request.headers.get("origin") || "http://localhost:3000");

        const feedbackMessage = `[클로드2 자동 평가 결과]

평가 점수: ${score}/100점
작업 완료 기준: 90점 이상

전체 평가:
${evaluationResult.overallFeedback || "평가 완료"}

보완이 필요한 사항:
${evaluationResult.improvements.map((imp: string, idx: number) => `${idx + 1}. ${imp}`).join('\n')}

위 보완사항을 반영하여 코드를 수정하고 다시 GitHub에 푸시해주세요.`;

        await fetch(`${baseUrl}/api/claude/worker`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: feedbackMessage,
          }),
        });
        feedbackDelivered = true;
      } catch (error) {
        console.warn("피드백 전달 실패:", error);
      }
    }

    return NextResponse.json({
      success: true,
      score,
      isCompleted,
      evaluation: evaluationResult,
      feedbackDelivered,
      deploymentUrl,
      figmaUrl: figmaUrlToUse,
    });
  } catch (error) {
    if (page) {
      await page.close();
    }

    console.error("자동 평가 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "자동 평가 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

