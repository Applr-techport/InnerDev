const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const url = process.argv[2] || 'http://localhost:3003/quotation';
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

  // 미리보기 인풋 버튼 클릭
  try {
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text.includes('미리보기 인풋')) {
        await button.click();
        await page.waitForTimeout(5000); // PDF 생성 대기
        break;
      }
    }
  } catch (e) {
    console.log('미리보기 버튼을 찾을 수 없습니다:', e.message);
  }

  await page.screenshot({
    path: 'localhost-quotation-screenshot.png',
    fullPage: true
  });

  console.log('Screenshot saved to localhost-quotation-screenshot.png');

  await browser.close();
})();
