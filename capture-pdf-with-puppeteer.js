const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const pdfPath = path.resolve(__dirname, 'test-quotation-output.pdf');
  await page.goto(`file://${pdfPath}#page=4`, { waitUntil: 'networkidle0', timeout: 60000 });

  await page.setViewport({ width: 1200, height: 1600 });
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: 'page-4-screenshot.png',
    fullPage: false
  });

  console.log('Page 4 screenshot saved to page-4-screenshot.png');

  await browser.close();
})();
