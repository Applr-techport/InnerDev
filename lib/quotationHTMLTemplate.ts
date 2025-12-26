import type { QuotationData } from "./quotationProcessor";

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

export function generateQuotationHTML(data: QuotationData): string {
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
      flutter: acc.flutter + item.flutter,
      web: acc.web + item.web,
      text: acc.text + item.text,
      pm: acc.pm + item.pm,
      total: acc.total + item.total,
    }),
    { planning: 0, server: 0, flutter: 0, web: 0, text: 0, pm: 0, total: 0 }
  );

  // Man-days 계산 (8시간 기준)
  const manDays = {
    planning: (totalMilestone.planning / 8).toFixed(1),
    server: (totalMilestone.server / 8).toFixed(1),
    flutter: (totalMilestone.flutter / 8).toFixed(1),
    web: (totalMilestone.web / 8).toFixed(1),
    text: (totalMilestone.text / 8).toFixed(1),
    pm: (totalMilestone.pm / 8).toFixed(1),
    total: (totalMilestone.total / 8).toFixed(1),
  };

  // Man-months 계산 (20.9일 기준)
  const manMonths = {
    planning: (parseFloat(manDays.planning) / 20.9).toFixed(2),
    server: (parseFloat(manDays.server) / 20.9).toFixed(2),
    flutter: (parseFloat(manDays.flutter) / 20.9).toFixed(2),
    web: (parseFloat(manDays.web) / 20.9).toFixed(2),
    text: (parseFloat(manDays.text) / 20.9).toFixed(2),
    pm: (parseFloat(manDays.pm) / 20.9).toFixed(2),
    total: (parseFloat(manDays.total) / 20.9).toFixed(2),
  };

  // History 테이블 HTML 생성
  const historyRows = data.history
    .map(
      (item, index) => `
    <tr>
      <td class="text-center">${index + 1}</td>
      <td class="text-left">${item.writer || ""}</td>
      <td class="text-left">${item.version || ""}</td>
      <td class="text-left">${item.date || ""}</td>
      <td class="text-left">${item.note || ""}</td>
    </tr>
  `
    )
    .join("");

  // Milestone 테이블 HTML 생성
  const milestoneRows = data.milestones
    .map(
      (item, index) => `
    <tr>
      <td class="text-center">${index + 1}</td>
      <td class="text-left">${item.depth1 || ""}</td>
      <td class="text-left">${item.depth2 || ""}</td>
      <td class="text-left">${item.depth3 || ""}</td>
      <td class="text-right">${item.planning}</td>
      <td class="text-right">${item.server}</td>
      <td class="text-right">${item.flutter}</td>
      <td class="text-right">${item.web}</td>
      <td class="text-right">${item.text}</td>
      <td class="text-right">${item.pm}</td>
      <td class="text-right">${item.total}</td>
    </tr>
  `
    )
    .join("");

  // 견적서 테이블 HTML 생성
  const quotationRows = Object.entries(groupedByCategory)
    .map(([category, items]) => {
      const itemRows = items
        .map(
          (item) => `
      <tr>
        <td class="text-left">${item.category}</td>
        <td class="text-left">${item.grade || ""}</td>
        <td class="text-right">${item.basePrice > 0 ? item.basePrice.toLocaleString() : "-"}</td>
        <td class="text-right">${item.mm > 0 ? item.mm.toFixed(2) : "-"}</td>
        <td class="text-right">${item.mmCost > 0 ? item.mmCost.toLocaleString() : "-"}</td>
        <td class="text-right">${item.discountedAmount > 0 ? item.discountedAmount.toLocaleString() : "-"}</td>
      </tr>
    `
        )
        .join("");

      const subtotal = items.reduce((sum, item) => sum + item.discountedAmount, 0);
      const subtotalMM = items.reduce((sum, item) => sum + item.mm, 0);
      const subtotalMMCost = items.reduce((sum, item) => sum + item.mmCost, 0);

      return `
    ${itemRows}
    <tr class="subtotal-row">
      <td class="text-left">${category}</td>
      <td class="text-center">소계</td>
      <td class="text-right">-</td>
      <td class="text-right">${subtotalMM > 0 ? subtotalMM.toFixed(2) : "-"}</td>
      <td class="text-right">${subtotalMMCost > 0 ? subtotalMMCost.toLocaleString() : "-"}</td>
      <td class="text-right">${subtotal > 0 ? subtotal.toLocaleString() : "-"}</td>
    </tr>
  `;
    })
    .join("");

  const totalQuotation = data.quotationItems.reduce((sum, item) => sum + item.discountedAmount, 0);
  const totalMM = data.quotationItems.reduce((sum, item) => sum + item.mm, 0);
  const totalMMCost = data.quotationItems.reduce((sum, item) => sum + item.mmCost, 0);

  // 등급별 M/M 테이블 HTML 생성
  const gradeRows = data.gradeInfo
    .map(
      (grade) => `
    <tr>
      <td class="text-left">${grade.grade}</td>
      <td class="text-right">${grade.dailyRate > 0 ? grade.dailyRate.toLocaleString() : "-"}</td>
      <td class="text-right">${grade.directCost > 0 ? grade.directCost.toLocaleString() : "-"}</td>
      <td class="text-right">${grade.overhead > 0 ? grade.overhead.toLocaleString() : "-"}</td>
      <td class="text-right">${grade.techFee > 0 ? grade.techFee.toLocaleString() : "-"}</td>
      <td class="text-right">${grade.total > 0 ? grade.total.toLocaleString() : "-"}</td>
    </tr>
  `
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @page {
        size: A4;
        margin: 0;
      }
      
      body {
        font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 0;
        padding: 0;
        font-size: 10pt;
        color: #000;
      }
      
      .page {
        width: 210mm;
        min-height: 297mm;
        padding: 20mm;
        page-break-after: always;
        box-sizing: border-box;
      }
      
      .page:last-child {
        page-break-after: auto;
      }
      
      .header {
        position: relative;
        margin-bottom: 30px;
      }
      
      .applr-logo {
        position: absolute;
        top: 0;
        right: 0;
        font-size: 16pt;
        font-weight: bold;
      }
      
      .project-title {
        font-size: 16pt;
        font-weight: bold;
        margin-bottom: 5px;
      }
      
      .subtitle {
        font-size: 12pt;
        margin-bottom: 5px;
      }
      
      .version-date {
        font-size: 10pt;
        margin-bottom: 3px;
      }
      
      .section-title {
        font-size: 14pt;
        font-weight: bold;
        margin: 30px 0 15px 0;
      }
      
      .project-info {
        font-size: 10pt;
        margin-bottom: 10px;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
        font-size: 8pt;
      }
      
      table thead {
        background-color: #e5e5e5;
      }
      
      table th {
        padding: 8px 5px;
        text-align: center;
        font-weight: bold;
        border: 1px solid #ccc;
      }
      
      table td {
        padding: 6px 5px;
        border: 1px solid #ccc;
      }
      
      .text-left {
        text-align: left;
        padding-left: 8px;
      }
      
      .text-right {
        text-align: right;
        padding-right: 8px;
      }
      
      .text-center {
        text-align: center;
      }
      
      .divider {
        border-top: 1px solid #000;
        margin: 20px 0;
      }
      
      .company-info {
        font-size: 9pt;
        margin-bottom: 15px;
        line-height: 1.5;
      }
      
      .total-row {
        font-weight: bold;
        background-color: #f5f5f5;
      }
      
      .subtotal-row {
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <!-- 첫 페이지: 헤더 -->
    <div class="page">
      <div class="header">
        <div class="applr-logo">APPLR</div>
        <div class="project-title">${data.project.name || "프로젝트명"}</div>
        <div class="subtitle">Estimation & Proposal</div>
        <div class="version-date">Version ${data.project.version}</div>
        <div class="version-date">${data.project.date}</div>
      </div>
    </div>

    <!-- History of changes 페이지 -->
    <div class="page">
      <div class="header">
        <div class="applr-logo">APPLR</div>
      </div>
      <div class="section-title">History of changes</div>
      <div class="project-info">프로젝트명: ${data.project.name || ""}</div>
      <div class="project-info">${formatDate(data.project.date)}</div>
      
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
        </tbody>
      </table>
      
      <div class="divider"></div>
    </div>

    <!-- Milestone List 페이지 -->
    <div class="page">
      <div class="header">
        <div class="applr-logo">APPLR</div>
      </div>
      <div class="section-title">Milestone List</div>
      <div class="project-info">프로젝트명: ${data.project.name || ""}</div>
      <div class="project-info">${formatDate(data.project.date)}</div>
      
      <table>
        <thead>
          <tr>
            <th rowspan="2" style="width: 4%">#</th>
            <th colspan="3" style="width: 30%">Features</th>
            <th colspan="7" style="width: 66%">Effort (man-hours)</th>
          </tr>
          <tr>
            <th style="width: 10%">Depth1</th>
            <th style="width: 10%">Depth2</th>
            <th style="width: 10%">Depth3</th>
            <th style="width: 9%">기획/디자인</th>
            <th style="width: 9%">Server</th>
            <th style="width: 9%">Flutter</th>
            <th style="width: 9%">Web</th>
            <th style="width: 9%">Text</th>
            <th style="width: 9%">PM</th>
            <th style="width: 9%">Total</th>
          </tr>
        </thead>
        <tbody>
          ${milestoneRows}
          <tr class="total-row">
            <td colspan="4" class="text-center">합계(Man-days)</td>
            <td class="text-right">${manDays.planning}</td>
            <td class="text-right">${manDays.server}</td>
            <td class="text-right">${manDays.flutter}</td>
            <td class="text-right">${manDays.web}</td>
            <td class="text-right">${manDays.text}</td>
            <td class="text-right">${manDays.pm}</td>
            <td class="text-right">${manDays.total}</td>
          </tr>
          <tr class="total-row">
            <td colspan="4" class="text-center">합계(Man-months)</td>
            <td class="text-right">${manMonths.planning}</td>
            <td class="text-right">${manMonths.server}</td>
            <td class="text-right">${manMonths.flutter}</td>
            <td class="text-right">${manMonths.web}</td>
            <td class="text-right">${manMonths.text}</td>
            <td class="text-right">${manMonths.pm}</td>
            <td class="text-right">${manMonths.total}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="divider"></div>
    </div>

    <!-- 견적서 페이지 -->
    <div class="page">
      <div class="header">
        <div class="applr-logo">APPLR</div>
      </div>
      <div class="section-title">견적서</div>
      
      <div class="company-info">
        <div>${data.company.address || ""}</div>
        <div>업태(정보통신업), 종목(소프트웨어개발/공급) / 사업자등록번호 / ${data.company.businessNumber}</div>
        <div>상호. 대표자 / ${data.company.name}: ${data.company.representative}</div>
        <div>연락처 ${data.company.phone}</div>
      </div>
      
      <div class="company-info">
        <div>클라이언트 ${data.client.name || "님"} 귀중</div>
        <div>${data.client.phone || ""}</div>
      </div>
      
      <div class="company-info" style="font-weight: bold; font-size: 11pt;">
        프로젝트 제안가 ${data.discountRate}% 할인률 (작업기간 ${data.workPeriod}) ${data.totalAmount.toLocaleString()} 부가세 별도
      </div>
      
      <div class="project-info">${formatDate(data.project.date)}</div>
      <div class="project-info">프로젝트명: ${data.project.name || ""}</div>
      <div class="project-info">단위:원</div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 15%">업무</th>
            <th style="width: 13%">등급</th>
            <th style="width: 16%">등급별 기본단가</th>
            <th style="width: 12%">M/M계</th>
            <th style="width: 18%">등급기준 M/M 비용</th>
            <th style="width: 18%">할인적용금액</th>
          </tr>
        </thead>
        <tbody>
          ${quotationRows}
          <tr class="total-row">
            <td colspan="3" class="text-center">합계</td>
            <td class="text-right">${totalMM > 0 ? totalMM.toFixed(2) : "-"}</td>
            <td class="text-right">${totalMMCost > 0 ? totalMMCost.toLocaleString() : "-"}</td>
            <td class="text-right">${totalQuotation > 0 ? totalQuotation.toLocaleString() : "-"}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="font-size: 8pt; margin-top: 20px; line-height: 1.5;">
        <div>* 2025년 11월 27일 송고 플랫폼과 유선으로 전달받은 요구사항 내용을 기준으로 산정한 견적임.</div>
        <div>* MVP 버전 개발이며, 개발 범위는 기획, 디자인, Flutter(iOS/AOS) 앱 개발, 관리자 페이지(웹) 개발임.</div>
      </div>
    </div>

    <!-- 등급별 M/M 및 단위 비용 페이지 -->
    ${data.gradeInfo.length > 0 ? `
    <div class="page">
      <div class="header">
        <div class="applr-logo">APPLR</div>
      </div>
      <div class="section-title">등급별 M/M 및 단위 비용</div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 10%">등급</th>
            <th style="width: 20%">S/W기술자 등급별 노임단가</th>
            <th style="width: 18%">직접인건비</th>
            <th style="width: 15%">제경비</th>
            <th style="width: 15%">기술료</th>
            <th style="width: 18%">등급별 단위총액</th>
          </tr>
          <tr>
            <th></th>
            <th>(M/D)</th>
            <th>20.9</th>
            <th>110%</th>
            <th>20%</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${gradeRows}
        </tbody>
      </table>
      
      <div style="font-size: 8pt; margin-top: 20px; line-height: 1.5;">
        <div>* 유효기간 : 견적일로 부터 ${data.project.validityDays}주이내</div>
        <div>* 본 견적은 디자인 및 프로그램의 제작 범위, 제작 수량이 최종 결정됨에 따라 변동될 수 있음.</div>
        <div>* 산출방식 : 제경비 = 직접인건비 x 제경비율 / 기술료 = (직접인건비 + 제경비) x 기술료율 / 단위총액 = 직접인건비 * 제경비 * 기술료</div>
        <div>* 특급기술자 : 기사1급 10년이상, * 고급기술자 : 기사 1급 7년이상, * 중급기술자 : 기사1급 4년이상 * 초급기술자: 기사 1급, 기사 2급 외 준하는 학력</div>
        <div>* SW기술자 평균임금은 소프트웨어산업진흥법 제22조(소프트웨어사업의 대가지급) 4항 '소프트웨어기술자의 노임단가'를 지칭함.</div>
        <div>* 월평균 근무일수는 20.9일, 일/8시간 기준</div>
      </div>
    </div>
    ` : ""}
  </body>
</html>`;
}

