import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getContext } from "@/lib/figmaSession";

// POST: 클로드1의 작업물 확인 및 피드백 생성
export async function POST(request: NextRequest) {
  let page = null;

  try {
    const { githubUrl, deploymentUrl, sessionId } = await request.json();

    if (!githubUrl && !deploymentUrl) {
      return NextResponse.json(
        { error: "GitHub URL 또는 배포 URL이 필요합니다." },
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

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // 배포 URL 우선 사용, 없으면 GitHub URL 사용
    const checkUrl = deploymentUrl || githubUrl;

    // Playwright로 작업물 확인
    const context = await getContext();
    page = await context.newPage();

    await page.goto(checkUrl, {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    await page.waitForTimeout(2000); // 페이지 로드 대기

    // 스크린샷 캡처
    const screenshot = await page.screenshot({
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
        bodyText: document.body.textContent?.trim().substring(0, 500),
      };
    });

    await page.close();

    // Vision API로 분석
    const screenshotBase64 = screenshot.toString("base64");

    const systemPrompt = `당신은 클로드2 (감독자)입니다. 클로드1의 작업물을 확인하고 피드백을 제공합니다.

주요 역할:
- 클로드1의 작업물을 Playwright로 확인
- 스크린샷 및 DOM 구조 분석
- Figma 디자인과 비교하여 평가
- 문제점 및 개선사항 발견
- 클로드1에게 구체적인 지시 제공

평가 기준 (0-100점):
- 디자인 정확도 (40점): Figma 디자인과의 일치도
- 기능 완성도 (30점): 모든 기능이 정상 작동하는지
- 사용자 경험 (20점): 사용하기 편리한지, 반응형 디자인
- 코드 품질 (10점): 구조, 성능, 유지보수성

평가 점수:
- 90점 이상: 작업 완료
- 90점 미만: 보완사항 전달

피드백 형식:
- 평가 점수 (0-100점)
- 발견된 문제점
- 개선 제안
- 구체적인 수정 지시`;

    const analysisPrompt = `클로드1이 생성한 작업물을 확인했습니다.

URL: ${checkUrl}
GitHub: ${githubUrl || "N/A"}
배포 URL: ${deploymentUrl || "N/A"}

DOM 분석 결과:
${JSON.stringify(domAnalysis, null, 2)}

위 스크린샷과 DOM 분석 결과를 바탕으로 다음을 수행해주세요:
1. 작업물의 품질 평가
2. 발견된 문제점 나열
3. 개선 제안 제공
4. 클로드1에게 구체적인 수정 지시 생성

클로드1에게 전달할 지시는 명확하고 실행 가능해야 합니다.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
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
              text: analysisPrompt,
            },
          ],
        },
      ],
    });

    const feedbackText = response.content[0].type === "text" ? response.content[0].text : "";

    // 클로드1에게 피드백 전달 (세션이 있는 경우)
    let feedbackDelivered = false;
    if (sessionId && feedbackText) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                       (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        
        await fetch(`${baseUrl}/api/claude/worker`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            message: `[클로드2 피드백]\n\n${feedbackText}`,
          }),
        });
        feedbackDelivered = true;
      } catch (error) {
        console.warn("피드백 전달 실패:", error);
      }
    }

    return NextResponse.json({
      success: true,
      feedback: feedbackText,
      domAnalysis,
      screenshot: screenshot.toString("base64"),
      feedbackDelivered,
    });
  } catch (error) {
    if (page) {
      await page.close();
    }

    console.error("클로드2 감독 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "작업물 확인 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

