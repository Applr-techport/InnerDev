import type { QuotationData } from "./quotationProcessor";
import fs from "fs";
import path from "path";

// 날짜 형식 변환 함수
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

// 로고 이미지를 base64로 인코딩
const getLogoBase64 = (): string => {
  try {
    const logoPath = path.join(process.cwd(), "public/images/applr_logo.png");
    const logoBuffer = fs.readFileSync(logoPath);
    const base64 = logoBuffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error("로고 이미지 로드 실패:", error);
    return "";
  }
};

// 서명 이미지를 base64로 인코딩
const getSignBase64 = (): string => {
  try {
    const signPath = path.join(process.cwd(), "public/images/applr_sign.png");
    const signBuffer = fs.readFileSync(signPath);
    const base64 = signBuffer.toString("base64");
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error("서명 이미지 로드 실패:", error);
    return "";
  }
};

// 폰트 파일을 base64로 인코딩
const getFontBase64 = (fontName: string): string => {
  try {
    const fontPath = path.join(process.cwd(), `public/fonts/${fontName}`);
    const fontBuffer = fs.readFileSync(fontPath);
    const base64 = fontBuffer.toString("base64");
    return `data:font/truetype;base64,${base64}`;
  } catch (error) {
    console.error(`폰트 로드 실패 (${fontName}):`, error);
    return "";
  }
};

export function generateQuotationHTML(data: QuotationData): string {
  // 로고 이미지 base64 인코딩
  const logoBase64 = getLogoBase64();
  // 서명 이미지 base64 인코딩
  const signBase64 = getSignBase64();
  
  // 마일스톤 컬럼 너비 (기본값 또는 사용자 설정값)
  const columnWidths = data.milestoneColumnWidths || {
    number: 3,
    depth1: 15,
    depth2: 15,
    depth3: 15,
    planning: 7.4,
    server: 7.4,
    app: 7.4,
    web: 7.4,
    qa: 7.4,
    pm: 7.4,
    total: 7.4,
  };
  
  // Features와 Effort의 총 너비 계산
  const featuresWidth = columnWidths.depth1 + columnWidths.depth2 + columnWidths.depth3;
  const effortWidth = columnWidths.planning + columnWidths.server + columnWidths.app + 
                      columnWidths.web + columnWidths.qa + columnWidths.pm + columnWidths.total;

  // 폰트 파일 base64 인코딩
  const fontRegular = getFontBase64("NotoSansKR-Regular.ttf");
  const fontBold = getFontBase64("NotoSansKR-Bold.ttf");
  const fontMedium = getFontBase64("NotoSansKR-Medium.ttf");

  // 업무별로 그룹화
  const groupedByCategory = data.quotationItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof data.quotationItems>);

  // Milestone 합계 계산
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

  // 직무명 표시 함수 (변환 없이 그대로 표시)
  const formatGradeName = (grade: string): string => {
    return grade;
  };

  // History 테이블 HTML 생성
  const historyRows = data.history
    .map(
      (item, index) => `
    <tr>
      <td class="text-center">${index + 1}</td>
      <td class="text-center">${item.writer || ""}</td>
      <td class="text-center">${item.version || ""}</td>
      <td class="text-center">${item.date || ""}</td>
      <td class="text-center">${item.note || ""}</td>
    </tr>
  `
    )
    .join("");

  // Milestone 테이블 행 HTML 생성 함수
  const createMilestoneRow = (item: any, index: number) => `
    <tr style="height: 15px;">
      <td class="text-center">${index + 1}</td>
      <td class="text-left">${item.depth1 || ""}</td>
      <td class="text-left">${item.depth2 || ""}</td>
      <td class="text-left">${item.depth3 || ""}</td>
      <td class="text-right">${item.planning}</td>
      <td class="text-right">${item.server}</td>
      <td class="text-right">${item.app}</td>
      <td class="text-right">${item.web}</td>
      <td class="text-right">${item.text}</td>
      <td class="text-right">${item.pm}</td>
      <td class="text-right">${item.total}</td>
    </tr>
  `;

  // 마일스톤 데이터를 페이지별로 나누기 (사용자 설정값 또는 기본값 20)
  const rowsPerPage = data.rowsPerPage || 20;
  const milestonePages: any[][] = [];
  for (let i = 0; i < data.milestones.length; i += rowsPerPage) {
    milestonePages.push(data.milestones.slice(i, i + rowsPerPage));
  }
  
  // 마일스톤이 없을 때도 빈 페이지 하나 생성
  if (milestonePages.length === 0) {
    milestonePages.push([]);
  }

  // 견적서 테이블 HTML 생성
  const quotationRows = Object.entries(groupedByCategory)
    .map(([category, items]) => {
      const itemRows = items
        .map(
          (item) => {
            // 직무별 단위총액(M/M) 찾기 - gradeInfo에서 해당 직무의 total 값 사용
            const gradeInfo = data.gradeInfo.find(g => g.grade === item.grade);
            const unitTotal = gradeInfo?.total || 0;
            return `
      <tr>
        <td class="text-center">${item.category}</td>
        <td class="text-center">${formatGradeName(item.grade || "")}</td>
        <td class="text-right">${unitTotal > 0 ? Math.round(unitTotal).toLocaleString() : "-"}</td>
        <td class="text-right">${item.mm > 0 ? item.mm.toFixed(2) : "-"}</td>
        <td class="text-right">${item.mmCost > 0 ? item.mmCost.toLocaleString() : "-"}</td>
        <td class="text-right">${item.discountedAmount > 0 ? item.discountedAmount.toLocaleString() : "-"}</td>
      </tr>
    `;
          }
        )
        .join("");

      return `
    ${itemRows}
  `;
    })
    .join("");

  const totalQuotation = data.quotationItems.reduce((sum, item) => sum + item.discountedAmount, 0);
  const totalMM = data.quotationItems.reduce((sum, item) => sum + item.mm, 0);
  const totalMMCost = data.quotationItems.reduce((sum, item) => sum + item.mmCost, 0);

  // 등급별 M/M 테이블 HTML 생성 (각 등급별 M/M 사용량 계산)
  const gradeRows = data.gradeInfo
    .map(
      (grade) => {
        return `
    <tr>
      <td class="text-center">${formatGradeName(grade.grade)}</td>
      <td class="text-right">${grade.dailyRate > 0 ? grade.dailyRate.toLocaleString() : "-"}</td>
      <td class="text-right">${grade.directCost > 0 ? grade.directCost.toLocaleString() : "-"}</td>
      <td class="text-right">${grade.overhead > 0 ? grade.overhead.toLocaleString() : "-"}</td>
      <td class="text-right">${grade.techFee > 0 ? grade.techFee.toLocaleString() : "-"}</td>
      <td class="text-right">${grade.total > 0 ? grade.total.toLocaleString() : "-"}</td>
    </tr>
  `;
      }
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @font-face {
        font-family: 'Noto Sans KR';
        font-weight: 400;
        font-style: normal;
        src: url('${fontRegular}') format('truetype');
      }

      @font-face {
        font-family: 'Noto Sans KR';
        font-weight: 500;
        font-style: normal;
        src: url('${fontMedium}') format('truetype');
      }

      @font-face {
        font-family: 'Noto Sans KR';
        font-weight: 700;
        font-style: normal;
        src: url('${fontBold}') format('truetype');
      }

      @page {
        size: A4;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      body {
        font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 0;
        padding: 0;
        font-size: 9pt;
        color: #000;
        line-height: 1.4;
      }

      .page {
        width: 210mm;
        min-height: 297mm;
        padding: 15mm 20mm;
        page-break-after: always;
        box-sizing: border-box;
        position: relative;
        border: 1px solid #ddd;
        margin-bottom: 10mm;
      }

      .page:last-child {
        page-break-after: auto;
        margin-bottom: 0;
      }

      /* 첫 페이지 스타일 */
      .cover-page {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
      }

      .cover-title-box {
        border: 2px solid #333;
        padding: 40px 60px;
        margin: 100px auto 150px;
        max-width: 600px;
      }

      .cover-title {
        font-size: 18pt;
        font-weight: bold;
        color: #1e5fa9;
        margin-bottom: 15px;
        line-height: 1.6;
      }

      .cover-subtitle {
        font-size: 14pt;
        font-style: italic;
        color: #333;
        margin-top: 15px;
      }

      .cover-bottom {
        position: absolute;
        bottom: 40mm;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
      }

      .cover-version {
        font-size: 11pt;
        margin-bottom: 10px;
      }

      .cover-date {
        font-size: 11pt;
        margin-bottom: 40px;
      }

      .cover-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 24pt;
        font-weight: bold;
        color: #333;
      }

      .logo-icon {
        width: 120px;
        height: auto;
        object-fit: contain;
      }

      /* 헤더 스타일 */
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
        padding-bottom: 10px;
      }

      /* 마일스톤 페이지 헤더 - 각 페이지에 반복 */
      .milestone-page .page-header,
      .milestone-page .section-title,
      .milestone-page .project-info {
        page-break-after: avoid;
        page-break-inside: avoid;
      }

      /* 마일스톤 페이지에서 테이블이 페이지를 넘어갈 때 헤더 반복 */
      .milestone-page table {
        page-break-inside: auto;
      }

      .milestone-page table thead {
        display: table-header-group;
      }

      .milestone-page table tbody tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }

      /* 페이지 간격 */
      .milestone-page {
        margin-bottom: 10mm;
      }

      .header-logo {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 18pt;
        font-weight: bold;
        color: #333;
      }

      .header-logo .logo-icon {
        width: 90px;
        height: auto;
        object-fit: contain;
      }

      .page-title {
        font-size: 11pt;
        font-weight: normal;
        font-style: italic;
        color: #666;
      }

      .section-title {
        font-size: 11pt;
        font-weight: bold;
        margin: 15px 0 10px 0;
        padding-bottom: 5px;
        border-bottom: 2px solid #000;
      }

      .project-info {
        font-size: 9pt;
        margin-bottom: 5px;
        color: #333;
      }

      /* 테이블 스타일 */
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
        font-size: 7pt;
      }

      table thead {
        background-color: #D9D9D9;
        display: table-header-group;
      }

      table tbody {
        display: table-row-group;
      }

      table tfoot {
        display: table-footer-group;
      }

      table th {
        padding: 8px 4px;
        text-align: center;
        vertical-align: middle;
        font-weight: bold;
        border: 0.5px solid #666;
        font-size: 7pt;
      }

      table td {
        padding: 6px 4px;
        border: 0.5px solid #999;
        font-size: 7pt;
        vertical-align: middle;
      }

      /* 마일스톤 테이블 행 높이 고정 */
      .milestone-page table tbody tr {
        height: 15px;
        min-height: 15px;
        max-height: 15px;
      }

      /* 페이지 넘김 시 행 분리 방지 및 헤더 반복 */
      table tbody tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }

      table thead tr {
        page-break-inside: avoid;
        page-break-after: avoid;
      }

      .text-left {
        text-align: left;
        padding-left: 6px;
      }

      .text-right {
        text-align: right;
        padding-right: 6px;
      }

      .text-center {
        text-align: center;
      }

      .total-row {
        font-weight: bold;
        background-color: #E7E6E6;
      }

      .subtotal-row {
        background-color: #F2F2F2;
      }

      .gray-bg {
        background-color: #D9D9D9;
      }

      /* 견적서 페이지 스타일 */
      .quotation-header {
        text-align: right;
        margin-bottom: 20px;
      }

      .quotation-title {
        font-size: 15pt;
        font-weight: bold;
        margin-bottom: 20px;
      }

      .company-info {
        font-size: 8.5pt;
        line-height: 1.6;
        margin-bottom: 10px;
      }

      .company-stamp {
        text-align: right;
        margin: 10px 0;
      }

      .company-stamp img {
        width: 50px;
        height: auto;
        margin-top: 5px;
        opacity: 0.8;
      }

      .client-info {
        font-size: 9pt;
        margin: 15px 0;
        line-height: 1.6;
      }

      .proposal-box {
        background-color: #f8f8f8;
        border: 1px solid #ccc;
        padding: 15px;
        margin: 15px 0;
        text-align: center;
      }

      .proposal-title {
        font-size: 10pt;
        font-weight: bold;
        margin-bottom: 10px;
      }

      .proposal-amount {
        font-size: 17pt;
        font-weight: bold;
        color: #000;
      }

      .notes {
        font-size: 7.5pt;
        margin-top: 15px;
        line-height: 1.8;
        color: #333;
      }

      .notes div {
        margin-bottom: 2px;
      }

      /* 페이지 번호 스타일 */
      .page-number {
        position: absolute;
        bottom: 10mm;
        left: 50%;
        transform: translateX(-50%);
        font-size: 8pt;
        color: #666;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <!-- 첫 페이지: 커버 -->
    <div class="page cover-page">
      <div class="cover-title-box">
        <div class="cover-title">${data.project.name || "프로젝트명"}</div>
        <div class="cover-subtitle">Estimation & Proposal</div>
      </div>

      <div class="cover-bottom">
        <div class="cover-version">Version ${data.project.version}</div>
        <div class="cover-date">${data.project.date}</div>
        <div class="cover-logo">
          ${logoBase64 ? `<img src="${logoBase64}" alt="APPLR" class="logo-icon" />` : ''}
        </div>
      </div>
    </div>

    <!-- History of changes 페이지 -->
    <div class="page">
      <div class="page-number">- 2 -</div>
      <div class="page-header">
        <div class="header-logo">
          ${logoBase64 ? `<img src="${logoBase64}" alt="APPLR" class="logo-icon" />` : ''}
        </div>
        <div class="page-title">History of changes</div>
      </div>

      <div class="section-title"></div>
      <div style="position: relative;">
        <div class="project-info" style="position: relative; top: -3px; margin-bottom: 0;"><strong>프로젝트명: ${data.project.name || ""}</strong></div>
        <div style="border-top: 1px solid #999; margin: 5px 0;"></div>
        <div class="project-info" style="font-size: 8pt; margin-top: 0;">${formatDate(data.project.date)}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 15%">작성자</th>
            <th style="width: 12%">Version</th>
            <th style="width: 18%">Date</th>
            <th style="width: 50%">Note</th>
          </tr>
        </thead>
        <tbody>
          ${historyRows}
          ${Array.from({ length: Math.max(0, 7 - data.history.length) }, (_, i) => `
          <tr>
            <td class="text-center">${data.history.length + i + 1}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Milestone List 페이지들 -->
    ${milestonePages.map((pageMilestones, pageIndex) => {
      const startIndex = pageIndex * rowsPerPage;
      const isLastPage = pageIndex === milestonePages.length - 1;
      const pageNumber = 3 + pageIndex; // 커버(1) + History(2) + Milestone 페이지들
      
      return `
    <div class="page milestone-page">
      <div class="page-number">- ${pageNumber} -</div>
      <div class="page-header">
        <div class="header-logo">
          ${logoBase64 ? `<img src="${logoBase64}" alt="APPLR" class="logo-icon" />` : ''}
        </div>
        <div class="page-title">Milestone List</div>
      </div>

      <div class="section-title"></div>
      <div style="position: relative;">
        <div class="project-info" style="position: relative; top: -3px; margin-bottom: 0;"><strong>프로젝트명: ${data.project.name || ""}</strong></div>
        <div style="border-top: 1px solid #999; margin: 5px 0;"></div>
        <div class="project-info" style="font-size: 8pt; margin-top: 0;">${formatDate(data.project.date)}</div>
      </div>

      <table style="margin-top: 10px; border-collapse: collapse;">
        <thead style="display: table-header-group;">
          <tr>
            <th rowspan="2" style="width: ${columnWidths.number}%">#</th>
            <th colspan="3" style="width: ${featuresWidth}%">Features</th>
            <th colspan="7" style="width: ${effortWidth}%">Effort (man-hours)</th>
          </tr>
          <tr>
            <th style="width: ${columnWidths.depth1}%">Depth1</th>
            <th style="width: ${columnWidths.depth2}%">Depth2</th>
            <th style="width: ${columnWidths.depth3}%">Depth3</th>
            <th style="width: ${columnWidths.planning}%">기획/<br/>디자인</th>
            <th style="width: ${columnWidths.server}%">Server</th>
            <th style="width: ${columnWidths.app}%">App</th>
            <th style="width: ${columnWidths.web}%">Web</th>
            <th style="width: ${columnWidths.qa}%">QA</th>
            <th style="width: ${columnWidths.pm}%">PM</th>
            <th style="width: ${columnWidths.total}%">Total</th>
          </tr>
        </thead>
        <tbody>
          ${pageMilestones.length > 0 
            ? pageMilestones.map((item, idx) => createMilestoneRow(item, startIndex + idx)).join('')
            : Array.from({ length: rowsPerPage }, (_, i) => `
          <tr style="height: 15px;">
            <td class="text-center"></td>
            <td class="text-left"></td>
            <td class="text-left"></td>
            <td class="text-left"></td>
            <td class="text-right"></td>
            <td class="text-right"></td>
            <td class="text-right"></td>
            <td class="text-right"></td>
            <td class="text-right"></td>
            <td class="text-right"></td>
            <td class="text-right"></td>
          </tr>
          `).join('')}
          ${isLastPage ? `
          <tr class="total-row">
            <td colspan="4" class="text-center">합계(Man-days)</td>
            <td class="text-right">${manDays.planning}</td>
            <td class="text-right">${manDays.server}</td>
            <td class="text-right">${manDays.app}</td>
            <td class="text-right">${manDays.web}</td>
            <td class="text-right">${manDays.text}</td>
            <td class="text-right">${manDays.pm}</td>
            <td class="text-right">${manDays.total}</td>
          </tr>
          <tr class="total-row">
            <td colspan="4" class="text-center">합계(Man-months)</td>
            <td class="text-right">${manMonths.planning}</td>
            <td class="text-right">${manMonths.server}</td>
            <td class="text-right">${manMonths.app}</td>
            <td class="text-right">${manMonths.web}</td>
            <td class="text-right">${manMonths.text}</td>
            <td class="text-right">${manMonths.pm}</td>
            <td class="text-right">${manMonths.total}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>
    </div>
    `;
    }).join('')}

    <!-- 견적서 페이지 -->
    <div class="page">
      <div class="page-number">- ${3 + milestonePages.length} -</div>
      <div class="page-header" style="margin-bottom: 10px;">
        <div class="header-logo">
          ${logoBase64 ? `<img src="${logoBase64}" alt="APPLR" class="logo-icon" />` : ''}
        </div>
        <div class="quotation-title" style="margin-bottom: 0;">견적서</div>
      </div>

      <div style="position: relative; margin-bottom: 8px; text-align: right;">
        <div class="company-stamp" style="position: absolute; right: 0; top: 0; z-index: 10;">
          ${signBase64 ? `<img src="${signBase64}" alt="서명" />` : ''}
        </div>
        <div class="company-info" style="position: relative; z-index: 1; padding-top: 5px;">
          <div>${data.company.address || ""} D463(삼평동, 판교타워)</div>
          <div>업태(정보통신업), 종목(소프트웨어개발/공급) / 사업자등록번호 / ${data.company.businessNumber}</div>
          <div>상호. 대표자 / ${data.company.name} ${data.company.representative}</div>
          <div style="margin-top: 0px;">연락처 ${data.company.phone}</div>
        </div>
      </div>

      <div style="border-top: 1px solid #999; margin: 0px 0;"></div>

      <div class="client-info" style="margin-top: 3px; margin-bottom: 0px; text-align: right;">
        <div style="font-size: 9pt; margin-bottom: 0px; display: flex; align-items: center; justify-content: flex-end;">${data.client.name || ""} 님 귀중</div>
        <div style="font-size: 8pt; color: #666; display: flex; align-items: center; justify-content: flex-end;">${data.client.phone || ""}</div>
      </div>

      <div style="border-top: 1px solid #999; margin: 5px 0;"></div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0;">
        <div style="font-size: 10pt; display: flex; align-items: center; gap: 10px;">
          <strong>프로젝트 제안가</strong> <span>${data.discountRate.toFixed(1)} %</span> <span>할인률</span>${data.workPeriod && data.workPeriod > 0 ? `<span style="font-size: 9pt;">(작업기간 ${data.workPeriod}개월)</span>` : ''}
        </div>
        <div style="font-size: 12pt; font-weight: bold; text-align: right; display: flex; align-items: center; justify-content: flex-end; gap: 10px; line-height: 1; margin-bottom: 5px;">
          <span style="display: inline-flex; align-items: center; line-height: 1;">${(Math.floor(data.totalAmount / (data.roundingUnit || 10000)) * (data.roundingUnit || 10000)).toLocaleString()}원</span> <span style="font-size: 8pt; font-weight: normal; display: inline-flex; align-items: center; line-height: 1; margin-top: 3px;">부가세 별도</span>
        </div>
      </div>

      <div style="border-top: 1px solid #999; margin: 5px 0;"></div>

      <div class="project-info" style="margin: 3px 0; font-size: 8pt;">${formatDate(data.project.date)}</div>

      <div style="border-top: 1px solid #999; margin: 5px 0;"></div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div class="project-info"><strong>프로젝트명: ${data.project.name || ""}</strong></div>
        <div class="project-info" style="text-align: right;">단위:원</div>
      </div>

      <table style="margin-top: 0px;">
        <thead>
          <tr>
            <th style="width: 12%">업무</th>
            <th style="width: 12%">직무</th>
            <th style="width: 16%">직무별 기본단가</th>
            <th style="width: 10%">M/M계</th>
            <th style="width: 18%">직무기준 M/M 비용</th>
            <th style="width: 18%">할인적용금액</th>
          </tr>
        </thead>
        <tbody>
          ${quotationRows}
          <tr class="total-row">
            <td colspan="3" class="text-center">합계</td>
            <td class="text-right">${manMonths.total}</td>
            <td class="text-right">${totalMMCost > 0 ? totalMMCost.toLocaleString() : "-"}</td>
            <td class="text-right">${totalQuotation > 0 ? totalQuotation.toLocaleString() : "-"}</td>
          </tr>
        </tbody>
      </table>

      ${data.notes ? `
      <div class="notes" style="margin-top: 5px;">
        ${data.notes.split('\n').map(line => `<div>* ${line}</div>`).join('')}
      </div>
      ` : ''}

      ${data.gradeInfo.length > 0 ? `
      <div class="section-title" style="margin-top: 30px; font-size: 9pt;">직무별 M/M 및 단위 비용</div>

      <table style="margin-top: 5px;">
        <thead>
          <tr>
            <th style="width: 12%">직무</th>
            <th style="width: 15%">S/W기술자 직무별<br/>노임단가(M/D)</th>
            <th style="width: 15%">직접인건비<br/>(20.9일)</th>
            <th style="width: 15%">제경비<br/>(110%)</th>
            <th style="width: 15%">기술료<br/>(20%)</th>
            <th style="width: 28%">직무별<br/>단위총액(M/M)</th>
          </tr>
        </thead>
        <tbody>
          ${gradeRows}
        </tbody>
      </table>

      <div class="notes" style="margin-top: 20px;">
        <div>* 유효기간 : 견적일로 부터 14일 이내</div>
        <div>* 본 견적은 디자인 및 프로그램의 제작 범위, 제작 수량이 최종 결정됨에 따라 변동될 수 있음.</div>
        <div>* 산출방식 : 제경비 = 직접인건비 x 제경비율 / 기술료 = (직접인건비 + 제경비) x 기술료율 / 단위총액 = 직접인건비 + 제경비 + 기술료</div>
        <div>* SW기술자 평균임금은 소프트웨어산업진흥법 제22조(소프트웨어사업의 대가지급) 4항 '소프트웨어기술자의 노임단가'를 지칭함.</div>
        <div>* 월평균 근무일수는 20.9일, 일/8시간 기준</div>
      </div>
      ` : ''}
    </div>
  </body>
</html>`;
}

