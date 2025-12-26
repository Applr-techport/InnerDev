import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export interface CompanyInfo {
  name: string;
  address: string;
  businessNumber: string;
  representative: string;
  phone: string;
}

export interface ClientInfo {
  name: string;
  phone: string;
}

export interface ProjectInfo {
  name: string;
  version: string;
  date: string;
  validityDays: number;
}

export interface HistoryItem {
  writer: string;
  version: string;
  date: string;
  note: string;
}

export interface MilestoneItem {
  depth1: string;
  depth2: string;
  depth3: string;
  planning: number;
  server: number;
  app: number;
  web: number;
  text: number;
  pm: number;
  total: number;
}

export interface QuotationItem {
  category: string;
  grade: string;
  basePrice: number;
  mm: number;
  mmCost: number;
  discountRate: number;
  discountedAmount: number;
}

export interface GradeInfo {
  grade: string;
  dailyRate: number;
  directCost: number;
  overhead: number;
  techFee: number;
  total: number;
}

export interface MilestoneColumnWidths {
  number: number;
  depth1: number;
  depth2: number;
  depth3: number;
  planning: number;
  server: number;
  app: number;
  web: number;
  qa: number;
  pm: number;
  total: number;
}

export interface QuotationData {
  company: CompanyInfo;
  client: ClientInfo;
  project: ProjectInfo;
  history: HistoryItem[];
  milestones: MilestoneItem[];
  quotationItems: QuotationItem[];
  gradeInfo: GradeInfo[];
  discountRate: number;
  workPeriod: number;
  notes: string;
  totalAmount: number;
  vatIncluded: boolean;
  milestoneColumnWidths?: MilestoneColumnWidths;
  rowsPerPage?: number;
  roundingUnit?: number; // 절삭 단위 (기본값: 10000)
}

// 폰트 캐싱 (매번 로드하지 않도록)
let cachedKoreanFont: ArrayBuffer | null = null;
let cachedBoldFont: ArrayBuffer | null = null;

// 한글 폰트 로드 함수 (캐싱 적용)
async function loadKoreanFont(): Promise<ArrayBuffer> {
  if (cachedKoreanFont) {
    return cachedKoreanFont;
  }
  
  try {
    // 로컬 폰트 파일 직접 로드 (public/fonts/NotoSansKR-Regular.ttf)
    const response = await fetch("/fonts/NotoSansKR-Regular.ttf");
    if (!response.ok) {
      throw new Error(`폰트 파일을 로드할 수 없습니다. (${response.status} ${response.statusText})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error("폰트 파일이 비어있습니다.");
    }
    cachedKoreanFont = arrayBuffer; // 캐시에 저장
    return arrayBuffer;
  } catch (error) {
    console.error("폰트 로드 오류:", error);
    throw error;
  }
}

// 볼드 폰트 로드 함수 (캐싱 적용)
async function loadBoldFont(): Promise<ArrayBuffer | null> {
  if (cachedBoldFont) {
    return cachedBoldFont;
  }
  
  try {
    const response = await fetch("/fonts/NotoSansKR-Bold.ttf");
    if (!response.ok) {
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return null;
    }
    cachedBoldFont = arrayBuffer; // 캐시에 저장
    return arrayBuffer;
  } catch (error) {
    console.warn("볼드 폰트 로드 실패:", error);
    return null;
  }
}

// PDF 생성 함수
export async function generateQuotationPDF(data: QuotationData): Promise<Blob> {
  console.log("PDF 생성 시작, 데이터:", JSON.stringify(data, null, 2));
  try {
    const pdfDoc = await PDFDocument.create();
    console.log("PDF 문서 생성 완료");
    
    // FontKit 등록 (한글 폰트 임베딩에 필요)
    if (fontkit) {
      try {
        pdfDoc.registerFontkit(fontkit);
        console.log("FontKit 등록 완료");
      } catch (fontkitError) {
        console.warn("FontKit 등록 실패:", fontkitError);
      }
    } else {
      console.warn("FontKit이 없습니다. 한글 폰트 임베딩이 불가능합니다.");
    }
  
  // 한글 폰트 로드 및 임베드
  let font: PDFFont;
  let boldFont: PDFFont;
  
  try {
    console.log("한글 폰트 로드 시작...");
    const koreanFontBytes = await loadKoreanFont();
    console.log("폰트 바이트 로드 완료, 크기:", koreanFontBytes.byteLength);
    
    if (fontkit) {
      font = await pdfDoc.embedFont(koreanFontBytes);
      console.log("폰트 임베드 완료");
      
      // 볼드 폰트도 로드 시도 (캐싱된 함수 사용)
      const boldFontBytes = await loadBoldFont();
      if (boldFontBytes) {
        boldFont = await pdfDoc.embedFont(boldFontBytes);
        console.log("볼드 폰트 임베드 완료");
      } else {
        boldFont = font; // 볼드 폰트가 없으면 일반 폰트 사용
        console.log("볼드 폰트 없음, 일반 폰트 사용");
      }
    } else {
      throw new Error("FontKit이 없어 폰트를 임베드할 수 없습니다.");
    }
  } catch (error) {
    // 폰트 로드 실패 시 기본 폰트 사용 (한글은 표시되지 않음)
    console.error("한글 폰트 로드 실패, 기본 폰트 사용:", error);
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    console.warn("기본 폰트로 대체 (한글 미지원)");
    // 폰트 로드 실패해도 PDF는 생성해야 하므로 에러를 throw하지 않음
  }

  // 날짜 형식 변환 함수 (전역으로 사용)
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
      const weekday = weekdays[date.getDay()];
      const month = date.getMonth() + 1;
      const day = date.getDate().toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${weekday}, ${month}월 ${day}, ${year}`;
    } catch {
      return dateStr;
    }
  };

  let yPosition = 820;
  let page = pdfDoc.addPage([595, 842]); // 첫 페이지

  // 헤더 섹션 재구성
  // APPLR을 오른쪽 상단에 배치
  const applrWidth = boldFont.widthOfTextAtSize("APPLR", 16);
  page.drawText("APPLR", {
    x: 595 - 50 - applrWidth,
    y: yPosition,
    size: 16,
    font: boldFont,
  });

  // 프로젝트명을 큰 제목으로 상단 중앙/왼쪽 배치
  yPosition = 820;
  page.drawText(data.project.name || "프로젝트명", {
    x: 50,
    y: yPosition,
    size: 16,
    font: boldFont,
  });

  yPosition -= 25;
  // "Estimation & Proposal" 부제목
  page.drawText("Estimation & Proposal", {
    x: 50,
    y: yPosition,
    size: 12,
    font: font,
  });

  yPosition -= 20;
  // Version
  page.drawText(`Version ${data.project.version}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });

  yPosition -= 15;
  // Date (날짜 형식 변환 필요 - 원본은 "2025.12.1" 형식)
  const dateText = data.project.date || new Date().toLocaleDateString("ko-KR");
  page.drawText(dateText, {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });

  yPosition -= 50;

  // History of changes 섹션 (새 페이지)
  page = pdfDoc.addPage([595, 842]);
  yPosition = 820;
  
  page.drawText("APPLR", {
    x: 595 - 50 - applrWidth,
    y: yPosition,
    size: 16,
    font: boldFont,
  });

  yPosition = 820;
  page.drawText("History of changes", {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont,
  });

  yPosition -= 25;
  
  // 프로젝트명과 날짜를 테이블 위에 표시
  page.drawText(`프로젝트명: ${data.project.name || ""}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });

  yPosition -= 15;
  page.drawText(formatDate(data.project.date), {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });

  yPosition -= 20;

  // History 테이블 헤더 (배경색 및 테두리 추가)
  const historyHeaders = ["#", "작성자", "Version", "Date", "Note"];
  const historyColWidths = [30, 100, 80, 120, 240];
  const historyTableWidth = historyColWidths.reduce((sum, w) => sum + w, 0);
  const historyTableHeight = 18;
  let xPos = 50;

  // 헤더 배경
  page.drawRectangle({
    x: 50,
    y: yPosition - historyTableHeight,
    width: historyTableWidth,
    height: historyTableHeight,
    color: rgb(0.9, 0.9, 0.9),
  });

  // 헤더 텍스트 (중앙 정렬)
  historyHeaders.forEach((header, index) => {
    const textWidth = boldFont.widthOfTextAtSize(header, 9);
    const colCenter = xPos + historyColWidths[index] / 2;
    page.drawText(header, {
      x: colCenter - textWidth / 2,
      y: yPosition - 12,
      size: 9,
      font: boldFont,
    });
    xPos += historyColWidths[index];
  });

  yPosition -= 20;

  // History 데이터
  data.history.forEach((item, index) => {
    if (yPosition < 100) {
      // 새 페이지 추가
      page = pdfDoc.addPage([595, 842]);
      yPosition = 820;
    }

    xPos = 50;
    // # 열 중앙 정렬
    const numText = String(index + 1);
    const numWidth = font.widthOfTextAtSize(numText, 8);
    page.drawText(numText, { x: xPos + historyColWidths[0] / 2 - numWidth / 2, y: yPosition, size: 8, font: font });
    xPos += historyColWidths[0];
    page.drawText(item.writer || "", { x: xPos + 5, y: yPosition, size: 8, font: font });
    xPos += historyColWidths[1];
    page.drawText(item.version || "", { x: xPos + 5, y: yPosition, size: 8, font: font });
    xPos += historyColWidths[2];
    page.drawText(item.date || "", { x: xPos + 5, y: yPosition, size: 8, font: font });
    xPos += historyColWidths[3];
    page.drawText(item.note || "", { x: xPos + 5, y: yPosition, size: 8, font: font });
    yPosition -= 15;
  });

  yPosition -= 20;
  
  // 구분선 추가
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: 545, y: yPosition },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 30;

  // Milestone List 섹션 (새 페이지)
  page = pdfDoc.addPage([595, 842]);
  yPosition = 820;
  
  page.drawText("APPLR", {
    x: 595 - 50 - applrWidth,
    y: yPosition,
    size: 16,
    font: boldFont,
  });

  yPosition = 820;
  page.drawText("Milestone List", {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont,
  });

  yPosition -= 25;
  
  // 프로젝트명과 날짜를 테이블 위에 표시
  page.drawText(`프로젝트명: ${data.project.name || ""}`, {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });

  yPosition -= 15;
  page.drawText(formatDate(data.project.date), {
    x: 50,
    y: yPosition,
    size: 10,
    font: font,
  });

  yPosition -= 20;

  // Milestone 테이블 헤더 (Features 통합 구조)
  // 헤더 구조: #, Features (Depth1, Depth2, Depth3), Effort (기획/디자인, Server, App, Web, Text, PM, Total)
  const milestoneColWidths = [30, 70, 70, 90, 50, 50, 50, 50, 50, 50, 50];
  const milestoneTableWidth = milestoneColWidths.reduce((sum, w) => sum + w, 0);
  const milestoneTableHeight = 18;
  xPos = 50;

  // 헤더 배경 (첫 번째 행)
  page.drawRectangle({
    x: 50,
    y: yPosition - milestoneTableHeight,
    width: milestoneTableWidth,
    height: milestoneTableHeight,
    color: rgb(0.9, 0.9, 0.9),
  });

  // 첫 번째 행: #, Features, Effort
  const numWidth = boldFont.widthOfTextAtSize("#", 7);
  page.drawText("#", { x: xPos + milestoneColWidths[0] / 2 - numWidth / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[0];
  const featuresWidth = boldFont.widthOfTextAtSize("Features", 7);
  const featuresSpan = milestoneColWidths[1] + milestoneColWidths[2] + milestoneColWidths[3];
  page.drawText("Features", { x: xPos + featuresSpan / 2 - featuresWidth / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += featuresSpan;
  const effortWidth = boldFont.widthOfTextAtSize("Effort (man-hours)", 7);
  const effortSpan = milestoneColWidths[4] + milestoneColWidths[5] + milestoneColWidths[6] + milestoneColWidths[7] + milestoneColWidths[8] + milestoneColWidths[9] + milestoneColWidths[10];
  page.drawText("Effort (man-hours)", { x: xPos + effortSpan / 2 - effortWidth / 2, y: yPosition - 12, size: 7, font: boldFont });
  
  yPosition -= 15;
  xPos = 50;
  
  // 두 번째 헤더 행 배경
  page.drawRectangle({
    x: 50,
    y: yPosition - milestoneTableHeight,
    width: milestoneTableWidth,
    height: milestoneTableHeight,
    color: rgb(0.9, 0.9, 0.9),
  });
  
  // 두 번째 행: Depth1, Depth2, Depth3, 기획/디자인, Server, App, Web, Text, PM, Total
  xPos += milestoneColWidths[0];
  const depth1Width = boldFont.widthOfTextAtSize("Depth1", 7);
  page.drawText("Depth1", { x: xPos + milestoneColWidths[1] / 2 - depth1Width / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[1];
  const depth2Width = boldFont.widthOfTextAtSize("Depth2", 7);
  page.drawText("Depth2", { x: xPos + milestoneColWidths[2] / 2 - depth2Width / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[2];
  const depth3Width = boldFont.widthOfTextAtSize("Depth3", 7);
  page.drawText("Depth3", { x: xPos + milestoneColWidths[3] / 2 - depth3Width / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[3];
  const planningWidth = boldFont.widthOfTextAtSize("기획/\n디자인", 7);
  page.drawText("기획/\n디자인", { x: xPos + milestoneColWidths[4] / 2 - planningWidth / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[4];
  const serverWidth = boldFont.widthOfTextAtSize("Server", 7);
  page.drawText("Server", { x: xPos + milestoneColWidths[5] / 2 - serverWidth / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[5];
  const appWidth = boldFont.widthOfTextAtSize("App", 7);
  page.drawText("App", { x: xPos + milestoneColWidths[6] / 2 - appWidth / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[6];
  const webWidth = boldFont.widthOfTextAtSize("Web", 7);
  page.drawText("Web", { x: xPos + milestoneColWidths[7] / 2 - webWidth / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[7];
  const textWidth = boldFont.widthOfTextAtSize("Text", 7);
  page.drawText("Text", { x: xPos + milestoneColWidths[8] / 2 - textWidth / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[8];
  const pmWidth = boldFont.widthOfTextAtSize("PM", 7);
  page.drawText("PM", { x: xPos + milestoneColWidths[9] / 2 - pmWidth / 2, y: yPosition - 12, size: 7, font: boldFont });
  xPos += milestoneColWidths[9];
  const totalWidth = boldFont.widthOfTextAtSize("Total", 7);
  page.drawText("Total", { x: xPos + milestoneColWidths[10] / 2 - totalWidth / 2, y: yPosition - 12, size: 7, font: boldFont });

  yPosition -= 20;

  // Milestone 데이터
  data.milestones.forEach((item, index) => {
    if (yPosition < 100) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = 820;
    }

    xPos = 50;
    // # 열 중앙 정렬
    const numText = String(index + 1);
    const numTextWidth = font.widthOfTextAtSize(numText, 7);
    page.drawText(numText, { x: xPos + milestoneColWidths[0] / 2 - numTextWidth / 2, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[0];
    page.drawText(item.depth1 || "", { x: xPos + 3, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[1];
    page.drawText(item.depth2 || "", { x: xPos + 3, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[2];
    page.drawText(item.depth3 || "", { x: xPos + 3, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[3];
    // 숫자 열은 오른쪽 정렬
    const planningText = String(item.planning);
    const planningTextWidth = font.widthOfTextAtSize(planningText, 7);
    page.drawText(planningText, { x: xPos + milestoneColWidths[4] - planningTextWidth - 3, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[4];
    const serverText = String(item.server);
    const serverTextWidth = font.widthOfTextAtSize(serverText, 7);
    page.drawText(serverText, { x: xPos + milestoneColWidths[5] - serverTextWidth - 3, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[5];
    const appText = String(item.app);
    const appTextWidth = font.widthOfTextAtSize(appText, 7);
    page.drawText(appText, { x: xPos + milestoneColWidths[6] - appTextWidth - 3, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[6];
    const webText = String(item.web);
    const webTextWidth = font.widthOfTextAtSize(webText, 7);
    page.drawText(webText, { x: xPos + milestoneColWidths[7] - webTextWidth - 3, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[7];
    const textText = String(item.text);
    const textTextWidth = font.widthOfTextAtSize(textText, 7);
    page.drawText(textText, { x: xPos + milestoneColWidths[8] - textTextWidth - 3, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[8];
    const pmText = String(item.pm);
    const pmTextWidth = font.widthOfTextAtSize(pmText, 7);
    page.drawText(pmText, { x: xPos + milestoneColWidths[9] - pmTextWidth - 3, y: yPosition, size: 7, font: font });
    xPos += milestoneColWidths[9];
    const totalText = String(item.total);
    const totalTextWidth = boldFont.widthOfTextAtSize(totalText, 7);
    page.drawText(totalText, { x: xPos + milestoneColWidths[10] - totalTextWidth - 3, y: yPosition, size: 7, font: boldFont });
    yPosition -= 15;
  });

  // 합계 행 (Man-days와 Man-months로 표시)
  if (yPosition < 100) {
    page = pdfDoc.addPage([595, 842]);
    yPosition = 820;
  }

  const totalMilestone = data.milestones.reduce(
    (acc, item) => ({
      planning: acc.planning + item.planning,
      server: acc.server + item.server,
      app: acc.app + item.app,
      web: acc.web + item.web,
      text: acc.text + item.text,
      pm: acc.pm + item.pm,
      total: acc.total + item.total,
    }),
    { planning: 0, server: 0, app: 0, web: 0, text: 0, pm: 0, total: 0 }
  );

  // Man-days 계산 (8시간 기준)
  const manDays = {
    planning: (totalMilestone.planning / 8).toFixed(1),
    server: (totalMilestone.server / 8).toFixed(1),
    app: (totalMilestone.app / 8).toFixed(1),
    web: (totalMilestone.web / 8).toFixed(1),
    text: (totalMilestone.text / 8).toFixed(1),
    pm: (totalMilestone.pm / 8).toFixed(1),
    total: (totalMilestone.total / 8).toFixed(1),
  };

  // Man-months 계산 (20.9일 기준)
  const manMonths = {
    planning: (parseFloat(manDays.planning) / 20.9).toFixed(2),
    server: (parseFloat(manDays.server) / 20.9).toFixed(2),
    app: (parseFloat(manDays.app) / 20.9).toFixed(2),
    web: (parseFloat(manDays.web) / 20.9).toFixed(2),
    text: (parseFloat(manDays.text) / 20.9).toFixed(2),
    pm: (parseFloat(manDays.pm) / 20.9).toFixed(2),
    total: (parseFloat(manDays.total) / 20.9).toFixed(2),
  };

  yPosition -= 10;
  xPos = 50;
  const manDaysLabelWidth = boldFont.widthOfTextAtSize("합계(Man-days)", 8);
  page.drawText("합계(Man-days)", { x: xPos + (milestoneColWidths[0] + milestoneColWidths[1] + milestoneColWidths[2] + milestoneColWidths[3]) / 2 - manDaysLabelWidth / 2, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[0] + milestoneColWidths[1] + milestoneColWidths[2] + milestoneColWidths[3];
  const planningDaysWidth = boldFont.widthOfTextAtSize(manDays.planning, 8);
  page.drawText(manDays.planning, { x: xPos + milestoneColWidths[4] - planningDaysWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[4];
  const serverDaysWidth = boldFont.widthOfTextAtSize(manDays.server, 8);
  page.drawText(manDays.server, { x: xPos + milestoneColWidths[5] - serverDaysWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[5];
  const appDaysWidth = boldFont.widthOfTextAtSize(manDays.app, 8);
  page.drawText(manDays.app, { x: xPos + milestoneColWidths[6] - appDaysWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[6];
  const webDaysWidth = boldFont.widthOfTextAtSize(manDays.web, 8);
  page.drawText(manDays.web, { x: xPos + milestoneColWidths[7] - webDaysWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[7];
  const textDaysWidth = boldFont.widthOfTextAtSize(manDays.text, 8);
  page.drawText(manDays.text, { x: xPos + milestoneColWidths[8] - textDaysWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[8];
  const pmDaysWidth = boldFont.widthOfTextAtSize(manDays.pm, 8);
  page.drawText(manDays.pm, { x: xPos + milestoneColWidths[9] - pmDaysWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[9];
  const totalDaysWidth = boldFont.widthOfTextAtSize(manDays.total, 8);
  page.drawText(manDays.total, { x: xPos + milestoneColWidths[10] - totalDaysWidth - 3, y: yPosition, size: 8, font: boldFont });

  yPosition -= 15;
  xPos = 50;
  const manMonthsLabelWidth = boldFont.widthOfTextAtSize("합계(Man-months)", 8);
  page.drawText("합계(Man-months)", { x: xPos + (milestoneColWidths[0] + milestoneColWidths[1] + milestoneColWidths[2] + milestoneColWidths[3]) / 2 - manMonthsLabelWidth / 2, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[0] + milestoneColWidths[1] + milestoneColWidths[2] + milestoneColWidths[3];
  const planningMonthsWidth = boldFont.widthOfTextAtSize(manMonths.planning, 8);
  page.drawText(manMonths.planning, { x: xPos + milestoneColWidths[4] - planningMonthsWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[4];
  const serverMonthsWidth = boldFont.widthOfTextAtSize(manMonths.server, 8);
  page.drawText(manMonths.server, { x: xPos + milestoneColWidths[5] - serverMonthsWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[5];
  const appMonthsWidth = boldFont.widthOfTextAtSize(manMonths.app, 8);
  page.drawText(manMonths.app, { x: xPos + milestoneColWidths[6] - appMonthsWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[6];
  const webMonthsWidth = boldFont.widthOfTextAtSize(manMonths.web, 8);
  page.drawText(manMonths.web, { x: xPos + milestoneColWidths[7] - webMonthsWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[7];
  const textMonthsWidth = boldFont.widthOfTextAtSize(manMonths.text, 8);
  page.drawText(manMonths.text, { x: xPos + milestoneColWidths[8] - textMonthsWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[8];
  const pmMonthsWidth = boldFont.widthOfTextAtSize(manMonths.pm, 8);
  page.drawText(manMonths.pm, { x: xPos + milestoneColWidths[9] - pmMonthsWidth - 3, y: yPosition, size: 8, font: boldFont });
  xPos += milestoneColWidths[9];
  const totalMonthsWidth = boldFont.widthOfTextAtSize(manMonths.total, 8);
  page.drawText(manMonths.total, { x: xPos + milestoneColWidths[10] - totalMonthsWidth - 3, y: yPosition, size: 8, font: boldFont });

  yPosition -= 20;
  
  // 구분선 추가
  page.drawLine({
    start: { x: 50, y: yPosition },
    end: { x: 545, y: yPosition },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  
  yPosition -= 30;

  // 견적서 섹션 재구성 (새 페이지)
  page = pdfDoc.addPage([595, 842]);
  yPosition = 820;
  
  page.drawText("APPLR", {
    x: 595 - 50 - applrWidth,
    y: yPosition,
    size: 16,
    font: boldFont,
  });

  yPosition = 820;
  page.drawText("견적서", {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont,
  });

  yPosition -= 25;

  // 회사 정보를 섹션 상단으로 이동
  page.drawText(data.company.address || "", {
    x: 50,
    y: yPosition,
    size: 9,
    font: font,
  });

  yPosition -= 12;
  page.drawText(`업태(정보통신업), 종목(소프트웨어개발/공급) / 사업자등록번호 / ${data.company.businessNumber}`, {
    x: 50,
    y: yPosition,
    size: 9,
    font: font,
  });

  yPosition -= 12;
  page.drawText(`상호. 대표자 / ${data.company.name}: ${data.company.representative}`, {
    x: 50,
    y: yPosition,
    size: 9,
    font: font,
  });

  yPosition -= 12;
  page.drawText(`연락처 ${data.company.phone}`, {
    x: 50,
    y: yPosition,
    size: 9,
    font: font,
  });

  yPosition -= 20;
  page.drawText(`클라이언트 ${data.client.name || "님"} 귀중`, {
    x: 50,
    y: yPosition,
    size: 9,
    font: font,
  });

  yPosition -= 12;
  page.drawText(data.client.phone || "", {
    x: 50,
    y: yPosition,
    size: 9,
    font: font,
  });

  yPosition -= 20;
  // 프로젝트 제안가 강조 스타일
  page.drawText(`프로젝트 제안가 ${data.discountRate}% 할인률 (작업기간 ${data.workPeriod}) ${data.totalAmount.toLocaleString()} 부가세 별도`, {
    x: 50,
    y: yPosition,
    size: 11,
    font: boldFont,
  });

  yPosition -= 20;
  // 날짜 형식: "월요일, 12월 01, 2025"
  page.drawText(formatDate(data.project.date), {
    x: 50,
    y: yPosition,
    size: 9,
    font: font,
  });

  yPosition -= 15;
  // 프로젝트명과 단위 표시
  page.drawText(`프로젝트명: ${data.project.name || ""}`, {
    x: 50,
    y: yPosition,
    size: 9,
    font: font,
  });

  yPosition -= 12;
  page.drawText("단위:원", {
    x: 50,
    y: yPosition,
    size: 9,
    font: font,
  });

  yPosition -= 20;

  // 견적서 테이블 헤더 (배경색 및 테두리 추가)
  const quotationHeaders = ["업무", "등급", "등급별 기본단가", "M/M계", "등급기준 M/M 비용", "할인적용금액"];
  const quotationColWidths = [90, 80, 100, 70, 110, 110];
  const quotationTableWidth = quotationColWidths.reduce((sum, w) => sum + w, 0);
  const quotationTableHeight = 18;
  xPos = 50;

  // 헤더 배경
  page.drawRectangle({
    x: 50,
    y: yPosition - quotationTableHeight,
    width: quotationTableWidth,
    height: quotationTableHeight,
    color: rgb(0.9, 0.9, 0.9),
  });

  // 헤더 텍스트 (중앙 정렬)
  quotationHeaders.forEach((header, index) => {
    const headerWidth = boldFont.widthOfTextAtSize(header, 8);
    const colCenter = xPos + quotationColWidths[index] / 2;
    page.drawText(header, {
      x: colCenter - headerWidth / 2,
      y: yPosition - 12,
      size: 8,
      font: boldFont,
    });
    xPos += quotationColWidths[index];
  });

  yPosition -= 15;

  // 견적서 데이터 (계층적 구조: 업무별 등급 행 + 소계 행)
  // 업무별로 그룹화
  const groupedByCategory = data.quotationItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof data.quotationItems>);

  Object.entries(groupedByCategory).forEach(([category, items]) => {
    if (yPosition < 100) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = 820;
    }

    // 각 등급별 행
    items.forEach((item) => {
      if (yPosition < 100) {
        page = pdfDoc.addPage([595, 842]);
        yPosition = 820;
      }

      xPos = 50;
      page.drawText(item.category, { x: xPos + 3, y: yPosition, size: 8, font: font });
      xPos += quotationColWidths[0];
      page.drawText(item.grade || "", { x: xPos + 3, y: yPosition, size: 8, font: font });
      xPos += quotationColWidths[1];
      // 숫자는 오른쪽 정렬
      const basePriceText = item.basePrice > 0 ? item.basePrice.toLocaleString() : "-";
      const basePriceWidth = font.widthOfTextAtSize(basePriceText, 8);
      page.drawText(basePriceText, { x: xPos + quotationColWidths[2] - basePriceWidth - 3, y: yPosition, size: 8, font: font });
      xPos += quotationColWidths[2];
      const mmText = item.mm > 0 ? item.mm.toFixed(2) : "-";
      const mmWidth = font.widthOfTextAtSize(mmText, 8);
      page.drawText(mmText, { x: xPos + quotationColWidths[3] - mmWidth - 3, y: yPosition, size: 8, font: font });
      xPos += quotationColWidths[3];
      const mmCostText = item.mmCost > 0 ? item.mmCost.toLocaleString() : "-";
      const mmCostWidth = font.widthOfTextAtSize(mmCostText, 8);
      page.drawText(mmCostText, { x: xPos + quotationColWidths[4] - mmCostWidth - 3, y: yPosition, size: 8, font: font });
      xPos += quotationColWidths[4];
      const discountedText = item.discountedAmount > 0 ? item.discountedAmount.toLocaleString() : "-";
      const discountedWidth = font.widthOfTextAtSize(discountedText, 8);
      page.drawText(discountedText, { x: xPos + quotationColWidths[5] - discountedWidth - 3, y: yPosition, size: 8, font: font });
      yPosition -= 12;
    });

    // 소계 행
    if (yPosition < 100) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = 820;
    }

    const subtotal = items.reduce((sum, item) => sum + item.discountedAmount, 0);
    const subtotalMM = items.reduce((sum, item) => sum + item.mm, 0);
    const subtotalMMCost = items.reduce((sum, item) => sum + item.mmCost, 0);

    xPos = 50;
    page.drawText(category, { x: xPos + 3, y: yPosition, size: 8, font: boldFont });
    xPos += quotationColWidths[0];
    const subtotalLabelWidth = boldFont.widthOfTextAtSize("소계", 8);
    page.drawText("소계", { x: xPos + quotationColWidths[1] / 2 - subtotalLabelWidth / 2, y: yPosition, size: 8, font: boldFont });
    xPos += quotationColWidths[1];
    xPos += quotationColWidths[2];
    // 숫자는 오른쪽 정렬
    const subtotalMMText = subtotalMM > 0 ? subtotalMM.toFixed(2) : "-";
    const subtotalMMTextWidth = boldFont.widthOfTextAtSize(subtotalMMText, 8);
    page.drawText(subtotalMMText, { x: xPos + quotationColWidths[3] - subtotalMMTextWidth - 3, y: yPosition, size: 8, font: boldFont });
    xPos += quotationColWidths[3];
    const subtotalMMCostText = subtotalMMCost > 0 ? subtotalMMCost.toLocaleString() : "-";
    const subtotalMMCostTextWidth = boldFont.widthOfTextAtSize(subtotalMMCostText, 8);
    page.drawText(subtotalMMCostText, { x: xPos + quotationColWidths[4] - subtotalMMCostTextWidth - 3, y: yPosition, size: 8, font: boldFont });
    xPos += quotationColWidths[4];
    const subtotalText = subtotal > 0 ? subtotal.toLocaleString() : "-";
    const subtotalTextWidth = boldFont.widthOfTextAtSize(subtotalText, 8);
    page.drawText(subtotalText, { x: xPos + quotationColWidths[5] - subtotalTextWidth - 3, y: yPosition, size: 8, font: boldFont });
    yPosition -= 15;
  });

  // 합계 행
  if (yPosition < 100) {
    page = pdfDoc.addPage([595, 842]);
    yPosition = 820;
  }

  yPosition -= 10;
  const totalQuotation = data.quotationItems.reduce((sum, item) => sum + item.discountedAmount, 0);
  const totalMM = data.quotationItems.reduce((sum, item) => sum + item.mm, 0);
  const totalMMCost = data.quotationItems.reduce((sum, item) => sum + item.mmCost, 0);

  xPos = 50;
  const totalLabelWidth = boldFont.widthOfTextAtSize("합계", 9);
  const totalLabelSpan = quotationColWidths[0] + quotationColWidths[1] + quotationColWidths[2];
  page.drawText("합계", { x: xPos + totalLabelSpan / 2 - totalLabelWidth / 2, y: yPosition, size: 9, font: boldFont });
  xPos += totalLabelSpan;
  // 숫자는 오른쪽 정렬
  const totalMMText = totalMM > 0 ? totalMM.toFixed(2) : "-";
  const totalMMTextWidth = boldFont.widthOfTextAtSize(totalMMText, 9);
  page.drawText(totalMMText, { x: xPos + quotationColWidths[3] - totalMMTextWidth - 3, y: yPosition, size: 9, font: boldFont });
  xPos += quotationColWidths[3];
  const totalMMCostText = totalMMCost > 0 ? totalMMCost.toLocaleString() : "-";
  const totalMMCostTextWidth = boldFont.widthOfTextAtSize(totalMMCostText, 9);
  page.drawText(totalMMCostText, { x: xPos + quotationColWidths[4] - totalMMCostTextWidth - 3, y: yPosition, size: 9, font: boldFont });
  xPos += quotationColWidths[4];
  const totalQuotationText = totalQuotation > 0 ? totalQuotation.toLocaleString() : "-";
  const totalQuotationTextWidth = boldFont.widthOfTextAtSize(totalQuotationText, 9);
  page.drawText(totalQuotationText, { x: xPos + quotationColWidths[5] - totalQuotationTextWidth - 3, y: yPosition, size: 9, font: boldFont });

  yPosition -= 20;
  
  // 주석 추가
  page.drawText("* 2025년 11월 27일 송고 플랫폼과 유선으로 전달받은 요구사항 내용을 기준으로 산정한 견적임.", {
    x: 50,
    y: yPosition,
    size: 8,
    font: font,
  });

  yPosition -= 12;
  page.drawText("* MVP 버전 개발이며, 개발 범위는 기획, 디자인, App 개발, 관리자 페이지(웹) 개발임.", {
    x: 50,
    y: yPosition,
    size: 8,
    font: font,
  });

  yPosition -= 30;

  // 등급별 M/M 및 단위 비용 테이블 추가
  if (yPosition < 100) {
    page = pdfDoc.addPage([595, 842]);
    yPosition = 820;
  }

  page.drawText("등급별 M/M 및 단위 비용", {
    x: 50,
    y: yPosition,
    size: 14,
    font: boldFont,
  });

  yPosition -= 25;

  // 등급별 M/M 테이블 헤더 (배경색 및 테두리 추가)
  const gradeHeaders = ["등급", "S/W기술자 등급별 노임단가", "직접인건비", "제경비", "기술료", "등급별 단위총액"];
  const gradeColWidths = [60, 100, 80, 70, 70, 100];
  const gradeTableWidth = gradeColWidths.reduce((sum, w) => sum + w, 0);
  const gradeTableHeight = 18;
  xPos = 50;

  // 헤더 배경
  page.drawRectangle({
    x: 50,
    y: yPosition - gradeTableHeight,
    width: gradeTableWidth,
    height: gradeTableHeight,
    color: rgb(0.9, 0.9, 0.9),
  });

  // 헤더 텍스트 (중앙 정렬)
  gradeHeaders.forEach((header, index) => {
    const headerWidth = boldFont.widthOfTextAtSize(header, 8);
    const colCenter = xPos + gradeColWidths[index] / 2;
    page.drawText(header, {
      x: colCenter - headerWidth / 2,
      y: yPosition - 12,
      size: 8,
      font: boldFont,
    });
    xPos += gradeColWidths[index];
  });

  yPosition -= 15;
  
  // 두 번째 헤더 행 (비율 정보)
  xPos = 50 + gradeColWidths[0];
  page.drawText("(M/D)", { x: xPos, y: yPosition, size: 7, font: boldFont });
  xPos += gradeColWidths[1];
  page.drawText("20.9", { x: xPos, y: yPosition, size: 7, font: boldFont });
  xPos += gradeColWidths[2];
  page.drawText("110%", { x: xPos, y: yPosition, size: 7, font: boldFont });
  xPos += gradeColWidths[3];
  page.drawText("20%", { x: xPos, y: yPosition, size: 7, font: boldFont });
  xPos += gradeColWidths[4];
  page.drawText("", { x: xPos, y: yPosition, size: 7, font: font });

  yPosition -= 15;

  // 등급별 데이터
  data.gradeInfo.forEach((grade) => {
    if (yPosition < 100) {
      page = pdfDoc.addPage([595, 842]);
      yPosition = 820;
    }

    xPos = 50;
    page.drawText(grade.grade, { x: xPos + 3, y: yPosition, size: 8, font: font });
    xPos += gradeColWidths[0];
    // 숫자는 오른쪽 정렬
    const dailyRateText = grade.dailyRate > 0 ? grade.dailyRate.toLocaleString() : "-";
    const dailyRateWidth = font.widthOfTextAtSize(dailyRateText, 8);
    page.drawText(dailyRateText, { x: xPos + gradeColWidths[1] - dailyRateWidth - 3, y: yPosition, size: 8, font: font });
    xPos += gradeColWidths[1];
    const directCostText = grade.directCost > 0 ? grade.directCost.toLocaleString() : "-";
    const directCostWidth = font.widthOfTextAtSize(directCostText, 8);
    page.drawText(directCostText, { x: xPos + gradeColWidths[2] - directCostWidth - 3, y: yPosition, size: 8, font: font });
    xPos += gradeColWidths[2];
    const overheadText = grade.overhead > 0 ? grade.overhead.toLocaleString() : "-";
    const overheadWidth = font.widthOfTextAtSize(overheadText, 8);
    page.drawText(overheadText, { x: xPos + gradeColWidths[3] - overheadWidth - 3, y: yPosition, size: 8, font: font });
    xPos += gradeColWidths[3];
    const techFeeText = grade.techFee > 0 ? grade.techFee.toLocaleString() : "-";
    const techFeeWidth = font.widthOfTextAtSize(techFeeText, 8);
    page.drawText(techFeeText, { x: xPos + gradeColWidths[4] - techFeeWidth - 3, y: yPosition, size: 8, font: font });
    xPos += gradeColWidths[4];
    const totalText = grade.total > 0 ? grade.total.toLocaleString() : "-";
    const totalGradeWidth = font.widthOfTextAtSize(totalText, 8);
    page.drawText(totalText, { x: xPos + gradeColWidths[5] - totalGradeWidth - 3, y: yPosition, size: 8, font: font });
    yPosition -= 12;
  });

  yPosition -= 20;

  // 주석 추가
  page.drawText(`* 유효기간 : 견적일로 부터 14일 이내`, {
    x: 50,
    y: yPosition,
    size: 8,
    font: font,
  });

  yPosition -= 12;
  page.drawText("* 본 견적은 디자인 및 프로그램의 제작 범위, 제작 수량이 최종 결정됨에 따라 변동될 수 있음.", {
    x: 50,
    y: yPosition,
    size: 8,
    font: font,
  });

  yPosition -= 12;
  page.drawText("* 산출방식 : 제경비 = 직접인건비 x 제경비율 / 기술료 = (직접인건비 + 제경비) x 기술료율 / 단위총액 = 직접인건비 * 제경비 * 기술료", {
    x: 50,
    y: yPosition,
    size: 8,
    font: font,
  });

  yPosition -= 12;
  page.drawText("* 특급기술자 : 기사1급 10년이상, * 고급기술자 : 기사 1급 7년이상, * 중급기술자 : 기사1급 4년이상 * 초급기술자: 기사 1급, 기사 2급 외 준하는 학력", {
    x: 50,
    y: yPosition,
    size: 8,
    font: font,
  });

  yPosition -= 12;
  page.drawText("* SW기술자 평균임금은 소프트웨어산업진흥법 제22조(소프트웨어사업의 대가지급) 4항 '소프트웨어기술자의 노임단가'를 지칭함.", {
    x: 50,
    y: yPosition,
    size: 8,
    font: font,
  });

  yPosition -= 12;
  page.drawText("* 월평균 근무일수는 20.9일, 일/8시간 기준", {
    x: 50,
    y: yPosition,
    size: 8,
    font: font,
  });

    const pdfBytes = await pdfDoc.save();
    console.log("PDF 저장 완료, 크기:", pdfBytes.length, "bytes");
    
    if (pdfBytes.length === 0) {
      throw new Error("PDF 파일이 비어있습니다.");
    }
    
    const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    console.log("PDF Blob 생성 완료, 크기:", blob.size, "bytes");
    
    return blob;
  } catch (error) {
    console.error("PDF 생성 전체 오류:", error);
    throw error;
  }
}

