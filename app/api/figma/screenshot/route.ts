import { NextRequest, NextResponse } from "next/server";
import { getContext, loginToFigma } from "@/lib/figmaSession";

export async function POST(request: NextRequest) {
  let page = null;
  
  try {
    const { figmaUrl, pageId, nodeId, email, password } = await request.json();

    if (!figmaUrl) {
      return NextResponse.json(
        { error: "피그마 URL이 필요합니다." },
        { status: 400 }
      );
    }

    // 컨텍스트 가져오기
    const context = await getContext();

    // 로그인 시도 (이메일/비밀번호가 제공된 경우)
    if (email && password) {
      const loggedIn = await loginToFigma(email, password);
      if (!loggedIn) {
        return NextResponse.json(
          { error: "피그마 로그인에 실패했습니다." },
          { status: 401 }
        );
      }
    }

    // 새 페이지 생성
    page = await context.newPage();

    // 피그마 파일 페이지로 이동
    await page.goto(figmaUrl, { 
      waitUntil: "networkidle",
      timeout: 60000 
    });

    // 특정 노드로 이동 (node-id가 있는 경우)
    if (nodeId) {
      // URL에 node-id 추가
      const urlWithNode = figmaUrl.includes("?") 
        ? `${figmaUrl}&node-id=${nodeId}`
        : `${figmaUrl}?node-id=${nodeId}`;
      
      await page.goto(urlWithNode, { 
        waitUntil: "networkidle",
        timeout: 60000 
      });
    }

    // 페이지 로드 대기
    await page.waitForTimeout(3000); // 피그마 렌더링 대기

    // 특정 요소가 있는지 확인 (피그마 캔버스)
    const canvas = await page.$('[data-testid="canvas"]') || await page.$('.canvas-container');
    
    if (canvas) {
      // 캔버스 영역만 스크린샷
      const       screenshot = await canvas.screenshot({
        type: "png",
      });
      
      await page.close();
      
      return NextResponse.json({
        screenshot: screenshot.toString("base64"),
        format: "png",
      });
    } else {
      // 전체 페이지 스크린샷
      const       screenshot = await page.screenshot({
        type: "png",
      });
      
      await page.close();
      
      return NextResponse.json({
        screenshot: screenshot.toString("base64"),
        format: "png",
      });
    }
  } catch (error) {
    if (page) {
      await page.close();
    }
    
    console.error("스크린샷 캡처 오류:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : "스크린샷 캡처 중 오류가 발생했습니다." 
      },
      { status: 500 }
    );
  }
}

