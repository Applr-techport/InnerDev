import { NextRequest, NextResponse } from "next/server";
import { generateQuotationHTML } from "@/lib/quotationHTMLTemplate";
import type { QuotationData } from "@/lib/quotationProcessor";

export async function POST(request: NextRequest) {
  try {
    const data: QuotationData = await request.json();

    // HTML 생성
    const fullHTML = generateQuotationHTML(data);

    // 환경에 따라 Puppeteer 설정
    const isProduction = process.env.NODE_ENV === "production";
    console.log(`[PDF] NODE_ENV: ${process.env.NODE_ENV}, isProduction: ${isProduction}`);
    console.log(`[PDF] CHROMIUM_PATH: ${process.env.CHROMIUM_PATH}`);

    let browser;
    const puppeteer = (await import("puppeteer-core")).default;

    if (isProduction) {
      // Railway/프로덕션 환경 - 시스템 Chromium 사용
      const chromiumPath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
      console.log(`[PDF] Using production chromium at: ${chromiumPath}`);

      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
        ],
        executablePath: chromiumPath,
        headless: true,
      });
    } else {
      // 로컬 개발 환경 - 시스템 Chrome 사용
      const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      console.log(`[PDF] Using local Chrome at: ${chromePath}`);

      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    await page.setContent(fullHTML, { waitUntil: 'domcontentloaded', timeout: 30000 });

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

    // Buffer를 직접 사용 (NextResponse가 Buffer를 자동으로 처리)
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': pdfBuffer.length.toString(),
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

