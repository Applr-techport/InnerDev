const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // 콘솔 메시지 수집
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[CONSOLE ${type}]`, text);
  });

  // 에러 수집
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
  });

  // 네트워크 요청 실패 확인
  page.on('requestfailed', request => {
    console.log('[REQUEST FAILED]', request.url(), request.failure().errorText);
  });

  await page.goto('http://localhost:3000/quotation', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // 10초 대기하며 로그 관찰
  await new Promise(resolve => setTimeout(resolve, 10000));

  await browser.close();
})();
