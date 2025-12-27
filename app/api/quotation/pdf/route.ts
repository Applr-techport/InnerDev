import { NextRequest, NextResponse } from "next/server";
import { generateQuotationHTML } from "@/lib/quotationHTMLTemplate";
import type { QuotationData } from "@/lib/quotationProcessor";

export async function POST(request: NextRequest) {
  try {
    const data: QuotationData = await request.json();

    // HTML 생성
    const fullHTML = generateQuotationHTML(data);

    // 환경에 따라 Puppeteer 설정
    const isVercel = process.env.VERCEL === "1";
    
    let browser;
    if (isVercel) {
      // Vercel 프로덕션 환경
      const puppeteer = (await import("puppeteer-core")).default;
      
      let executablePath: string | undefined;
      let chromiumArgs: string[] = [];
      
      try {
        // @sparticuz/chromium-min 시도
        const chromiumMin = (await import("@sparticuz/chromium-min")).default;
        chromiumMin.setGraphicsMode = false;
        executablePath = await chromiumMin.executablePath();
        chromiumArgs = chromiumMin.args;
      } catch (error) {
        // chromium-min 실패 시 chromium 사용
        console.warn('chromium-min 실패, chromium으로 전환:', error);
        const chromium = (await import("@sparticuz/chromium")).default;
        chromium.setGraphicsMode = false;
        executablePath = await chromium.executablePath();
        chromiumArgs = chromium.args;
      }
      
      browser = await puppeteer.launch({
        args: [
          ...chromiumArgs,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--single-process',
        ],
        executablePath,
        headless: true,
      });
    } else {
      // 로컬 개발 환경
      const puppeteer = (await import("puppeteer")).default;
      
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    await page.setContent(fullHTML, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    });

    await browser.close();

    // 파일명 인코딩 (한글 처리)
    const fileName = `견적서-${data.project.name || '견적서'}-${Date.now()}.pdf`;
    const encodedFileName = encodeURIComponent(fileName);
    
    // Buffer를 Uint8Array로 변환
    const pdfArray = new Uint8Array(pdfBuffer);
    
    return new NextResponse(pdfArray, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
      },
    });
  } catch (error) {
    console.error('PDF 생성 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PDF 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

