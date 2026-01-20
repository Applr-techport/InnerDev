import { NextRequest, NextResponse } from "next/server";
import { getContext, loginToFigma } from "@/lib/figmaSession";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  let page = null;
  
  try {
    const { figmaUrl, fileId, nodeId, email, password } = await request.json();

    if (!figmaUrl && !fileId) {
      return NextResponse.json(
        { error: "피그마 URL 또는 파일 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // Figma URL 구성
    const url = figmaUrl || `https://www.figma.com/file/${fileId}`;

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
    await page.goto(url, { 
      waitUntil: "networkidle",
      timeout: 60000 
    });

    // 특정 노드로 이동 (node-id가 있는 경우)
    if (nodeId) {
      const urlWithNode = url.includes("?") 
        ? `${url}&node-id=${nodeId}`
        : `${url}?node-id=${nodeId}`;
      
      await page.goto(urlWithNode, { 
        waitUntil: "networkidle",
        timeout: 60000 
      });
    }

    // 페이지 로드 대기
    await page.waitForTimeout(3000);

    // DOM 구조 분석 - 레이어 패널에서 페이지 목록 추출
    const pages = await page.evaluate(() => {
      const pageList: any[] = [];
      
      // 레이어 패널에서 CANVAS 타입 노드 찾기
      const layerItems = document.querySelectorAll('[data-testid="layer-item"]');
      
      layerItems.forEach((item) => {
        const text = item.textContent?.trim();
        if (text && item.getAttribute('data-type') === 'CANVAS') {
          // 페이지 이름과 ID 추출 시도
          const pageId = item.getAttribute('data-node-id') || '';
          if (pageId) {
            pageList.push({
              id: pageId,
              name: text,
              type: 'CANVAS',
            });
          }
        }
      });

      // 대안: 페이지 탭에서 추출
      if (pageList.length === 0) {
        const pageTabs = document.querySelectorAll('[data-testid="page-tab"]');
        pageTabs.forEach((tab, index) => {
          const name = tab.textContent?.trim() || `Page ${index + 1}`;
          const pageId = tab.getAttribute('data-page-id') || `page-${index}`;
          pageList.push({
            id: pageId,
            name,
            type: 'CANVAS',
          });
        });
      }

      return pageList;
    });

    // 스크린샷 캡처
    const canvas = await page.$('[data-testid="canvas"]') || await page.$('.canvas-container');
    let screenshot: Buffer | null = null;
    
    if (canvas) {
      screenshot = await canvas.screenshot({
        type: "png",
      });
    } else {
      screenshot = await page.screenshot({
        type: "png",
      });
    }

    // Vision API로 의미 기반 분석
    let semanticAnalysis = null;
    if (screenshot) {
      try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (apiKey) {
          const anthropic = new Anthropic({ apiKey });
          
          const screenshotBase64 = screenshot.toString("base64");
          
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            messages: [{
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
                  text: `이 Figma 디자인을 분석하여 다음 정보를 추출해주세요:
1. 페이지 구조 (Frame → Page 매핑)
2. 주요 섹션 (Section → Feature 추출)
3. 재사용 가능한 컴포넌트 식별
4. 라우팅 구조 추론
5. CRUD 기능 여부 (폼, 버튼, 테이블 등)

JSON 형식으로 응답해주세요:
{
  "pages": [{"id": "...", "name": "...", "route": "..."}],
  "sections": [{"name": "...", "type": "feature|component|..."}],
  "components": [{"name": "...", "reusable": true/false}],
  "routing": {"structure": "...", "routes": [...]},
  "crud": {"hasCreate": true/false, "hasRead": true/false, "hasUpdate": true/false, "hasDelete": true/false}
}`
                },
              ],
            }],
          });

          const textContent = response.content.find(c => c.type === "text");
          if (textContent && textContent.type === "text") {
            try {
              semanticAnalysis = JSON.parse(textContent.text);
            } catch (e) {
              console.warn("의미 분석 JSON 파싱 실패:", e);
            }
          }
        }
      } catch (error) {
        console.warn("Vision API 분석 실패:", error);
      }
    }

    await page.close();

    return NextResponse.json({
      name: semanticAnalysis?.name || "Figma Design",
      pages: pages.length > 0 ? pages : (semanticAnalysis?.pages || []),
      semanticAnalysis,
      screenshot: screenshot ? screenshot.toString("base64") : null,
      fileId: fileId || extractFileIdFromUrl(url),
    });
  } catch (error) {
    if (page) {
      await page.close();
    }
    
    console.error("피그마 분석 오류:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : "피그마 디자인 분석 중 오류가 발생했습니다." 
      },
      { status: 500 }
    );
  }
}

// URL에서 파일 ID 추출
// 지원하는 URL 형식:
// - https://www.figma.com/file/abc123/Project-Name
// - https://figma.com/file/abc123/Project-Name
// - https://www.figma.com/design/abc123/Project-Name
// - https://www.figma.com/file/abc123/Project-Name?node-id=123%3A456
// 
// 검증을 완화하여 다양한 길이의 fileId를 지원합니다.
// 실제 유효성은 Figma 접근 시 확인됩니다.
function extractFileIdFromUrl(url: string): string | null {
  try {
    // URL 정규화 (공백 제거, www 추가 등)
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    // file 또는 design 경로에서 fileId 추출
    // Figma file ID는 다양한 길이를 가질 수 있으므로 길이 제한을 완화
    const patterns = [
      /(?:www\.)?figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/i,  // 표준 형식 (길이 제한 없음)
      /\/file\/([a-zA-Z0-9]+)/i,  // file 경로
      /\/design\/([a-zA-Z0-9]+)/i,  // design 경로
    ];
    
    for (const pattern of patterns) {
      const match = normalizedUrl.match(pattern);
      if (match && match[1]) {
        const fileId = match[1];
        // 쿼리 파라미터나 슬래시 전까지만 추출
        const cleanFileId = fileId.split('/')[0].split('?')[0];
        // 최소 10자리 이상이면 유효한 것으로 간주 (실제로는 Figma 접근 시 확인)
        if (cleanFileId.length >= 10) {
          return cleanFileId;
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

