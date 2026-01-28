import type { TaskQuotationData } from "./quotationTaskProcessor";
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

export function generateTaskQuotationHTML(data: TaskQuotationData): string {
  // 로고 이미지 base64 인코딩
  const logoBase64 = getLogoBase64();
  // 서명 이미지 base64 인코딩
  const signBase64 = getSignBase64();

  // 폰트 파일 base64 인코딩
  const fontRegular = getFontBase64("NotoSansKR-Regular.ttf");
  const fontBold = getFontBase64("NotoSansKR-Bold.ttf");
  const fontMedium = getFontBase64("NotoSansKR-Medium.ttf");

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
    <tr style="height: 20px;">
      <td class="text-center">${index + 1}</td>
      <td class="text-left">${item.name || ""}</td>
      <td class="text-center">${item.pageType || ""}</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${item.unitPrice.toLocaleString()}</td>
      <td class="text-right">${item.amount.toLocaleString()}</td>
    </tr>
  `;

  // 마일스톤 데이터를 페이지별로 나누기
  const rowsPerPage = data.rowsPerPage || 15;
  const milestonePages: any[][] = [];
  for (let i = 0; i < data.milestones.length; i += rowsPerPage) {
    milestonePages.push(data.milestones.slice(i, i + rowsPerPage));
  }

  // 마일스톤이 없을 때도 빈 페이지 하나 생성
  if (milestonePages.length === 0) {
    milestonePages.push([]);
  }

  // 마일스톤 합계 계산
  const totalMilestone = data.milestones.reduce(
    (acc, item) => ({
      quantity: acc.quantity + item.quantity,
      amount: acc.amount + item.amount,
    }),
    { quantity: 0, amount: 0 }
  );

  // 견적서 테이블 HTML 생성 (유형별 합계)
  const quotationRows = data.quotationItems
    .map(
      (item) => `
    <tr>
      <td class="text-center">${item.pageType}</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${item.unitPrice.toLocaleString()}</td>
      <td class="text-right">${item.amount.toLocaleString()}</td>
    </tr>
  `
    )
    .join("");

  const totalBeforeDiscount = data.quotationItems.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = Math.round(totalBeforeDiscount * (data.discountRate / 100));
  const totalAfterDiscount = totalBeforeDiscount - discountAmount;

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
        font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
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
        margin: 0px auto 150px;
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
        font-size: 9pt;
        margin-bottom: 10px;
      }

      .cover-date {
        font-size: 9pt;
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
        font-size: 8pt;
      }

      table thead {
        background-color: #D9D9D9;
        display: table-header-group;
      }

      table th {
        padding: 8px 4px;
        text-align: center;
        vertical-align: middle;
        font-weight: bold;
        border: 0.5px solid #666;
        font-size: 8pt;
      }

      table td {
        padding: 6px 4px;
        border: 0.5px solid #999;
        font-size: 8pt;
        vertical-align: middle;
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

      /* 견적서 페이지 스타일 */
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

      /* 단가표 스타일 */
      .price-table {
        margin-top: 20px;
      }

      .price-table th, .price-table td {
        font-size: 8pt;
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

    <!-- 작업 항목 목록 페이지들 -->
    ${milestonePages.map((pageMilestones, pageIndex) => {
      const startIndex = pageIndex * rowsPerPage;
      const isLastPage = pageIndex === milestonePages.length - 1;
      const pageNumber = 3 + pageIndex;

      return `
    <div class="page milestone-page">
      <div class="page-number">- ${pageNumber} -</div>
      <div class="page-header">
        <div class="header-logo">
          ${logoBase64 ? `<img src="${logoBase64}" alt="APPLR" class="logo-icon" />` : ''}
        </div>
        <div class="page-title">작업 항목 목록</div>
      </div>

      <div class="section-title"></div>
      <div style="position: relative;">
        <div class="project-info" style="position: relative; top: -3px; margin-bottom: 0;"><strong>프로젝트명: ${data.project.name || ""}</strong></div>
        <div style="border-top: 1px solid #999; margin: 5px 0;"></div>
        <div class="project-info" style="font-size: 8pt; margin-top: 0;">${formatDate(data.project.date)}</div>
      </div>

      <table style="margin-top: 10px;">
        <thead>
          <tr>
            <th style="width: 5%">#</th>
            <th style="width: 35%">페이지/기능명</th>
            <th style="width: 20%">유형</th>
            <th style="width: 10%">수량</th>
            <th style="width: 15%">단가</th>
            <th style="width: 15%">금액</th>
          </tr>
        </thead>
        <tbody>
          ${pageMilestones.length > 0
            ? pageMilestones.map((item, idx) => createMilestoneRow(item, startIndex + idx)).join('')
            : Array.from({ length: rowsPerPage }, (_, i) => `
          <tr style="height: 20px;">
            <td class="text-center"></td>
            <td class="text-left"></td>
            <td class="text-center"></td>
            <td class="text-right"></td>
            <td class="text-right"></td>
            <td class="text-right"></td>
          </tr>
          `).join('')}
          ${isLastPage ? `
          <tr class="total-row">
            <td colspan="3" class="text-center">합계</td>
            <td class="text-right">${totalMilestone.quantity}</td>
            <td class="text-right">-</td>
            <td class="text-right">${totalMilestone.amount.toLocaleString()}</td>
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
        <div style="font-size: 9pt; margin-bottom: 0px;">${data.client.name || ""} 님 귀중</div>
        <div style="font-size: 8pt; color: #666;">${data.client.phone || ""}</div>
      </div>

      <div style="border-top: 1px solid #999; margin: 5px 0;"></div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0;">
        <div style="font-size: 10pt; display: flex; align-items: center; gap: 10px;">
          <strong>프로젝트 제안가</strong>${data.discountRate > 0 ? ` <span>${data.discountRate.toFixed(1)} %</span> <span>할인률</span>` : ''}${data.workPeriod && data.workPeriod > 0 ? `<span style="font-size: 9pt;">(작업기간 ${data.workPeriod}개월)</span>` : ''}
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
            <th style="width: 35%">유형</th>
            <th style="width: 15%">수량</th>
            <th style="width: 25%">단가</th>
            <th style="width: 25%">금액</th>
          </tr>
        </thead>
        <tbody>
          ${quotationRows}
          <tr class="total-row">
            <td colspan="3" class="text-center">소계</td>
            <td class="text-right">${totalBeforeDiscount.toLocaleString()}</td>
          </tr>
          ${data.discountRate > 0 ? `
          <tr>
            <td colspan="3" class="text-center">할인 (${data.discountRate}%)</td>
            <td class="text-right">-${discountAmount.toLocaleString()}</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td colspan="3" class="text-center">합계</td>
            <td class="text-right">${data.totalAmount.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      ${data.notes ? `
      <div class="notes" style="margin-top: 15px;">
        ${data.notes.split('\n').map(line => `<div>* ${line}</div>`).join('')}
      </div>
      ` : ''}

      <!-- 단가 기준표 -->
      <div class="section-title" style="margin-top: 30px; font-size: 9pt;">페이지 유형별 단가 기준</div>
      <table class="price-table" style="margin-top: 5px;">
        <thead>
          <tr>
            <th style="width: 25%">유형</th>
            <th style="width: 20%">단가</th>
            <th style="width: 55%">비고</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="text-center">메인페이지</td>
            <td class="text-right">300,000</td>
            <td class="text-left"></td>
          </tr>
          <tr>
            <td class="text-center">하드 코딩 페이지</td>
            <td class="text-right">100,000</td>
            <td class="text-left">서버 연동 없이 하드 코딩으로 이뤄진 페이지</td>
          </tr>
          <tr>
            <td class="text-center">서버 연동 페이지</td>
            <td class="text-right">150,000</td>
            <td class="text-left">게시판은 아니지만 서버 연동 등 작업이 필요한 페이지</td>
          </tr>
          <tr>
            <td class="text-center">템플릿 게시판</td>
            <td class="text-right">150,000</td>
            <td class="text-left">일반 텍스트 리스트형 게시판</td>
          </tr>
          <tr>
            <td class="text-center">커스텀 게시판</td>
            <td class="text-right">200,000</td>
            <td class="text-left">신규로 제작하는 게시판</td>
          </tr>
          <tr>
            <td class="text-center">플로팅</td>
            <td class="text-right">50,000</td>
            <td class="text-left"></td>
          </tr>
          <tr>
            <td class="text-center">팝업</td>
            <td class="text-right">50,000</td>
            <td class="text-left"></td>
          </tr>
        </tbody>
      </table>

      <div class="notes" style="margin-top: 20px;">
        <div>* 유효기간 : 견적일로 부터 ${data.project.validityDays || 14}일 이내</div>
        <div>* 본 견적은 디자인 및 프로그램의 제작 범위, 제작 수량이 최종 결정됨에 따라 변동될 수 있음.</div>
        <div>* 위 단가는 표준 작업 범위 기준이며, 복잡도에 따라 조정될 수 있습니다.</div>
      </div>
    </div>
  </body>
</html>`;
}
