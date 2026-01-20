import { chromium, Browser, BrowserContext, Page } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let isLoggedIn = false;

// 브라우저 초기화
export async function initBrowser(): Promise<Browser> {
  if (browser) {
    return browser;
  }

  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  return browser;
}

// 컨텍스트 생성 (세션 관리)
export async function getContext(): Promise<BrowserContext> {
  if (context && isLoggedIn) {
    return context;
  }

  const browserInstance = await initBrowser();
  
  // 기존 쿠키 로드 (있는 경우)
  const cookies = await loadCookies();
  
  context = await browserInstance.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  if (cookies && cookies.length > 0) {
    await context.addCookies(cookies);
    isLoggedIn = true;
  }

  return context;
}

// 피그마 로그인
export async function loginToFigma(email?: string, password?: string): Promise<boolean> {
  const contextInstance = await getContext();
  const page = await contextInstance.newPage();

  try {
    // 피그마 로그인 페이지로 이동
    await page.goto("https://www.figma.com/login", { waitUntil: "networkidle" });

    // 이미 로그인되어 있는지 확인
    const currentUrl = page.url();
    if (!currentUrl.includes("/login")) {
      isLoggedIn = true;
      await saveCookies(await contextInstance.cookies());
      await page.close();
      return true;
    }

    // 이메일/비밀번호가 제공되지 않으면 공개 파일만 처리
    if (!email || !password) {
      await page.close();
      return false; // 공개 파일은 로그인 불필요
    }

    // 로그인 폼 채우기
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    // 로그인 완료 대기
    await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 30000 });

    // 쿠키 저장
    const cookies = await contextInstance.cookies();
    await saveCookies(cookies);
    isLoggedIn = true;

    await page.close();
    return true;
  } catch (error) {
    console.error("피그마 로그인 실패:", error);
    await page.close();
    return false;
  }
}

// 쿠키 저장 (간단한 파일 기반, 실제로는 DB나 암호화된 저장소 사용 권장)
async function saveCookies(cookies: any[]): Promise<void> {
  // 실제 구현에서는 안전한 저장소 사용 (DB, 암호화된 파일 등)
  // 여기서는 메모리에만 저장 (서버 재시작 시 초기화)
  // TODO: Redis나 DB에 저장하는 것이 좋음
}

// 쿠키 로드
async function loadCookies(): Promise<any[]> {
  // 실제 구현에서는 저장된 쿠키 로드
  // 여기서는 빈 배열 반환
  return [];
}

// 브라우저 종료
export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
  isLoggedIn = false;
}

// 로그인 상태 확인
export function checkLoginStatus(): boolean {
  return isLoggedIn;
}



