import { NextRequest, NextResponse } from "next/server";
import { generateTaskQuotationHTML } from "@/lib/quotationTaskHTMLTemplate";
import type { TaskQuotationData } from "@/lib/quotationTaskProcessor";

// PDF 생성 함수 (재시도 로직 포함)
async function generatePDF(fullHTML: string, retryCount = 0): Promise<Uint8Array> {
  const puppeteer = (await import("puppeteer")).default;
  let browser = null;

  try {
    console.log(`[PDF-Task] 브라우저 실행 시도 (${retryCount + 1}/3)...`);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      timeout: 60000,
    });

    const page = await browser.newPage();
    await page.setContent(fullHTML, { waitUntil: 'domcontentloaded', timeout: 60000 });

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
    console.log(`[PDF-Task] PDF 생성 완료`);
    return pdfBuffer;
  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch {}
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : '';
    const shouldRetry =
      errorMsg.includes('Target closed') ||
      errorMsg.includes('TargetCloseError') ||
      errorName.includes('TargetCloseError') ||
      errorMsg.includes('timeout');

    if (shouldRetry && retryCount < 2) {
      console.log(`[PDF-Task] 재시도 중... (${retryCount + 2}/3) - 에러: ${errorName || errorMsg}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return generatePDF(fullHTML, retryCount + 1);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: TaskQuotationData = await request.json();

    // HTML 생성
    const fullHTML = generateTaskQuotationHTML(data);

    // PDF 생성 (재시도 로직 포함)
    const pdfBuffer = await generatePDF(fullHTML);

    // 파일명 인코딩 (한글 처리)
    const fileName = `견적서-${data.project.name || '견적서'}-${Date.now()}.pdf`;
    const encodedFileName = encodeURIComponent(fileName);

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
