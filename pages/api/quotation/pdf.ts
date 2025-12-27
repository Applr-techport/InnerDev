import type { NextApiRequest, NextApiResponse } from "next";
import { generateQuotationHTML } from "@/lib/quotationHTMLTemplate";
import type { QuotationData } from "@/lib/quotationProcessor";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data: QuotationData = req.body;

    // HTML 생성
    const fullHTML = generateQuotationHTML(data);

    let browser;

    // @sparticuz/chromium-min 우선 사용 (Vercel/서버리스 환경)
    try {
      const chromium = (await import("@sparticuz/chromium-min")).default;
      const puppeteer = (await import("puppeteer-core")).default;

      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } catch (error) {
      // @sparticuz/chromium-min 실패 시 로컬 puppeteer 사용
      console.log('Falling back to local puppeteer:', error);
      const puppeteer = (await import("puppeteer")).default;

      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
    }

    const page = await browser.newPage();
    await page.setContent(fullHTML, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'a4',
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('PDF 생성 오류:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'PDF 생성 중 오류가 발생했습니다.',
    });
  }
}
