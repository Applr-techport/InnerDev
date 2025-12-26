const puppeteer = require('puppeteer');
const fs = require('fs');

// QuotationProcessor import 시뮬레이션
const testData = {
  company: {
    name: "APPLR",
    address: "경기도 성남시 분당구 판교역로 192번길 16, 8층 806호",
    businessNumber: "689-81-03094",
    representative: "목진욱",
    phone: "010-7278-5314",
  },
  client: {
    name: "테스트 클라이언트",
    phone: "010-1234-5678",
  },
  project: {
    name: "오프라인 음식점의 사이렌오더 시스템 구축 앱 및 관리자 MVP 개발 견적서",
    version: "1.0",
    date: "2025. 12. 1",
    validityDays: 14,
  },
  history: [
    { writer: "목진욱", version: "1.0", date: "2025.12.01", note: "" },
  ],
  milestones: [
    { depth1: "사용자앱", depth2: "UI/UX디자인", depth3: "기본 스타일 가이드 구축·로고·아이콘", planning: 8, server: 0, flutter: 24, web: 0, text: 8, pm: 8, total: 48 },
    { depth1: "사용자앱", depth2: "회원 관리", depth3: "회원가입 및 로그인", planning: 8, server: 16, flutter: 24, web: 0, text: 16, pm: 8, total: 72 },
    { depth1: "사용자앱", depth2: "메뉴 관리", depth3: "메뉴 목록 조회", planning: 8, server: 16, flutter: 24, web: 0, text: 8, pm: 8, total: 64 },
  ],
  quotationItems: [
    { category: "PM", grade: "고급기술자", basePrice: 17609914, mm: 0.98, mmCost: 17257716, discountRate: 35, discountedAmount: 11217516 },
    { category: "기획/\n디자인", grade: "중급기술자", basePrice: 13927842, mm: 1.30, mmCost: 18106195, discountRate: 35, discountedAmount: 11769026 },
    { category: "앱 프론트 개발", grade: "중급기술자", basePrice: 13927842, mm: 2.40, mmCost: 33426821, discountRate: 35, discountedAmount: 21727433 },
    { category: "백엔드/관리자 개발", grade: "중급기술자", basePrice: 13927842, mm: 2.55, mmCost: 35515997, discountRate: 35, discountedAmount: 23085398 },
    { category: "테스트", grade: "QC", basePrice: 10944042, mm: 1.50, mmCost: 16416063, discountRate: 35, discountedAmount: 10670441 },
  ],
  gradeInfo: [
    { grade: "특급", dailyRate: 442695, directCost: 9252326, overhead: 10177558, techFee: 3885977, total: 23315860 },
    { grade: "고급", dailyRate: 334357, directCost: 6988061, overhead: 7686867, techFee: 2934986, total: 17609914 },
    { grade: "중급", dailyRate: 264446, directCost: 5526921, overhead: 6079614, techFee: 2321307, total: 13927842 },
    { grade: "초급", dailyRate: 224050, directCost: 4682645, overhead: 5150910, techFee: 1966711, total: 11800265 },
    { grade: "QA", dailyRate: 207793, directCost: 4342874, overhead: 4777161, techFee: 1824007, total: 10944042 },
  ],
  discountRate: 35.0,
  workPeriod: "5개월",
  totalAmount: 78469814,
  vatIncluded: false,
};

(async () => {
  try {
    console.log('PDF 생성 테스트 시작...');

    // HTML 템플릿 생성 (간단히 fetch로 API 호출)
    const response = await fetch('http://localhost:3000/api/quotation/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`);
    }

    const pdfBuffer = await response.arrayBuffer();
    const outputPath = './test-quotation-output.pdf';

    fs.writeFileSync(outputPath, Buffer.from(pdfBuffer));
    console.log(`✅ PDF 생성 완료: ${outputPath}`);
    console.log(`📄 파일 크기: ${Buffer.from(pdfBuffer).length} bytes`);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
})();
