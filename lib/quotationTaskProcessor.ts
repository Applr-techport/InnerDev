// 업무 단위 산정용 견적서 타입 정의

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

// 페이지 유형 정의
export interface PageTypeInfo {
  type: string;
  price: number;
  description: string;
}

// 마일스톤 항목 (페이지 단가 기준)
export interface TaskMilestoneItem {
  name: string;        // 페이지/기능명
  pageType: string;    // 페이지 유형 (드롭다운 선택)
  quantity: number;    // 수량
  unitPrice: number;   // 단가 (자동)
  amount: number;      // 금액 (자동 계산)
}

// 견적서 항목 (유형별 합계)
export interface TaskQuotationItem {
  pageType: string;     // 페이지 유형
  quantity: number;     // 총 수량
  unitPrice: number;    // 단가
  amount: number;       // 금액 (수량 × 단가)
}

// 업무 단위 견적서 전체 데이터
export interface TaskQuotationData {
  company: CompanyInfo;
  client: ClientInfo;
  project: ProjectInfo;
  history: HistoryItem[];
  milestones: TaskMilestoneItem[];
  quotationItems: TaskQuotationItem[];
  discountRate: number;
  workPeriod: number;
  notes: string;
  totalAmount: number;
  vatIncluded: boolean;
  roundingUnit?: number;
  rowsPerPage?: number;
}

// 페이지 유형별 단가 상수
export const PAGE_TYPES: PageTypeInfo[] = [
  { type: "메인페이지", price: 300000, description: "" },
  { type: "하드 코딩 페이지", price: 100000, description: "서버 연동 없이 하드 코딩으로 이뤄진 페이지" },
  { type: "서버 연동 페이지", price: 150000, description: "게시판은 아니지만 서버 연동 등 작업이 필요한 페이지" },
  { type: "템플릿 게시판", price: 150000, description: "일반 텍스트 리스트형 게시판" },
  { type: "커스텀 게시판", price: 200000, description: "신규로 제작하는 게시판" },
  { type: "플로팅", price: 50000, description: "" },
  { type: "팝업", price: 50000, description: "" },
  { type: "기타", price: 0, description: "금액 직접 입력" },
];

// 페이지 유형으로 단가 찾기
export function getPageTypePrice(type: string): number {
  const pageType = PAGE_TYPES.find(pt => pt.type === type);
  return pageType?.price || 0;
}

// 마일스톤에서 유형별 합계 계산
export function calculateQuotationItems(milestones: TaskMilestoneItem[]): TaskQuotationItem[] {
  const grouped: Record<string, { quantity: number; unitPrice: number; totalAmount: number }> = {};
  const etcItems: TaskQuotationItem[] = []; // "기타"는 개별 항목으로 유지

  milestones.forEach(item => {
    if (!item.pageType) return;

    // "기타" 유형은 개별 항목으로 추가 (각각 단가가 다를 수 있음)
    if (item.pageType === "기타") {
      etcItems.push({
        pageType: item.name || "기타", // 항목명을 유형으로 사용
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      });
      return;
    }

    if (!grouped[item.pageType]) {
      grouped[item.pageType] = {
        quantity: 0,
        unitPrice: item.unitPrice,
        totalAmount: 0,
      };
    }
    grouped[item.pageType].quantity += item.quantity;
    grouped[item.pageType].totalAmount += item.amount;
  });

  const regularItems = Object.entries(grouped).map(([pageType, data]) => ({
    pageType,
    quantity: data.quantity,
    unitPrice: data.unitPrice,
    amount: data.quantity * data.unitPrice,
  }));

  // 일반 유형 먼저, 그 다음 기타 항목들
  return [...regularItems, ...etcItems];
}

// 총액 계산 (할인 적용 전)
export function calculateTotalBeforeDiscount(quotationItems: TaskQuotationItem[]): number {
  return quotationItems.reduce((sum, item) => sum + item.amount, 0);
}

// 할인 적용 후 총액 계산
export function calculateTotalAfterDiscount(
  totalBeforeDiscount: number,
  discountRate: number,
  roundingUnit: number = 10000
): number {
  const discountedAmount = totalBeforeDiscount * (1 - discountRate / 100);
  return Math.floor(discountedAmount / roundingUnit) * roundingUnit;
}
