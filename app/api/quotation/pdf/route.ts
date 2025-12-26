import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { generateQuotationHTML } from "@/lib/quotationHTMLTemplate";
import type { QuotationData } from "@/lib/quotationProcessor";

export async function POST(request: NextRequest) {
  try {
    const data: QuotationData = await request.json();

    // HTML 생성
    const fullHTML = generateQuotationHTML(data);

    // Puppeteer로 PDF 생성
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

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

    // Buffer를 Uint8Array로 변환하여 NextResponse에 전달
    return new NextResponse(new Uint8Array(pdfBuffer), {
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

