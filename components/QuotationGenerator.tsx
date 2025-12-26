"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  type CompanyInfo,
  type ClientInfo,
  type ProjectInfo,
  type HistoryItem,
  type MilestoneItem,
  type QuotationItem,
  type GradeInfo,
  type QuotationData,
} from "@/lib/quotationProcessor";

// 고정된 직무 정보 (업무, 직무, 기본단가) - M/D 기준
const FIXED_GRADES = [
  { category: "기획/디자인", grade: "기획/디자인", basePrice: 326566 },
  { category: "PM", grade: "PM", basePrice: 443955 },
  { category: "Server", grade: "백엔드", basePrice: 337061 },
  { category: "App", grade: "프론트엔드", basePrice: 337061 },
  { category: "Web", grade: "프론트엔드", basePrice: 337061 },
  { category: "QA", grade: "QA", basePrice: 173328 },
];

export default function QuotationGenerator() {
  const [company, setCompany] = useState<CompanyInfo>({
    name: "APPLR",
    address: "경기도 성남시 분당구 판교역로 192번길 16, 8층 806호",
    businessNumber: "689-81-03094",
    representative: "목진욱",
    phone: "010-7278-5314",
  });

  const [client, setClient] = useState<ClientInfo>({
    name: "",
    phone: "",
  });

  const [project, setProject] = useState<ProjectInfo>({
    name: "",
    version: "1.0",
    date: new Date().toLocaleDateString("ko-KR"),
    validityDays: 14,
  });

  const [history, setHistory] = useState<HistoryItem[]>([
    {
      writer: "목진욱",
      version: "1.0",
      date: new Date().toLocaleDateString("ko-KR"),
      note: "견적서 작성"
    },
  ]);

  const [milestones, setMilestones] = useState<MilestoneItem[]>([
    { depth1: "", depth2: "", depth3: "", planning: 0, server: 0, app: 0, web: 0, text: 0, pm: 0, total: 0 },
  ]);

  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>(
    FIXED_GRADES.map(fixed => ({
      category: fixed.category,
      grade: fixed.grade,
      basePrice: fixed.basePrice,
      mm: 0,
      mmCost: 0,
      discountRate: 35,
      discountedAmount: 0,
    }))
  );

  const [gradeInfo, setGradeInfo] = useState<GradeInfo[]>([]);

  const [discountRate, setDiscountRate] = useState<number>(35);
  const [workPeriod, setWorkPeriod] = useState<number>(5);
  const [roundingUnit, setRoundingUnit] = useState<number>(10000); // 절삭 단위 (기본값: 만원)
  const [notes, setNotes] = useState<string>("2026년 1월 1일 전달받은 OOO.pdf 문서를 기준으로 산정한 견적임.\n개발 범위는 기획, 디자인, 앱 개발, 관리자 페이지(웹) 개발임.");
  const [isProcessing, setIsProcessing] = useState(false);

  // 저장/불러오기 관련 상태
  const [savedQuotations, setSavedQuotations] = useState<any[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuotationId, setCurrentQuotationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  
  // AI 분석 관련 상태
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiProjectDescription, setAIProjectDescription] = useState("");
  const [aiAnalyzing, setAIAnalyzing] = useState(false);
  const [aiResult, setAIResult] = useState<MilestoneItem[] | null>(null);
  const [aiAttachedFiles, setAIAttachedFiles] = useState<File[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // 마일스톤 표 컬럼 너비 조정 상태
  const [milestoneColumnWidths, setMilestoneColumnWidths] = useState({
    number: 3,      // #
    depth1: 15,    // Depth1
    depth2: 15,    // Depth2
    depth3: 15,    // Depth3
    planning: 7.4, // 기획/디자인
    server: 7.4,   // Server
    app: 7.4,      // App
    web: 7.4,      // Web
    qa: 7.4,       // QA
    pm: 7.4,       // PM
    total: 7.4,    // Total
  });
  
  // 한 페이지에 표시할 행 수
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);
  
  const [showColumnWidthModal, setShowColumnWidthModal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedPages, setRenderedPages] = useState<Array<{ pageNum: number; canvas: HTMLCanvasElement }>>([]);

  // Milestone Total 자동 계산
  const calculateMilestoneTotal = (item: MilestoneItem): number => {
    return item.planning + item.server + item.app + item.web + item.text + item.pm;
  };

  // Milestones에서 카테고리별 M/M 계산 (Man-months = Man-days / 20.9)
  const calculateCategoryMM = useCallback((category: string): number => {
    let totalHours = 0;

    switch(category) {
      case "기획/디자인":
        totalHours = milestones.reduce((sum, m) => sum + m.planning, 0);
        break;
      case "PM":
        totalHours = milestones.reduce((sum, m) => sum + m.pm, 0);
        break;
      case "Server":
        totalHours = milestones.reduce((sum, m) => sum + m.server, 0);
        break;
      case "App":
        totalHours = milestones.reduce((sum, m) => sum + m.app, 0);
        break;
      case "Web":
        totalHours = milestones.reduce((sum, m) => sum + m.web, 0);
        break;
      case "QA":
        totalHours = milestones.reduce((sum, m) => sum + m.text, 0);
        break;
      default:
        return 0;
    }

    // Man-days = totalHours / 8, Man-months = Man-days / 20.9
    const manDays = totalHours / 8;
    const manMonths = manDays / 20.9;
    return parseFloat(manMonths.toFixed(2));
  }, [milestones]);

  // QuotationItems 자동 계산 (Milestones, gradeInfo 변경 시마다)
  useEffect(() => {
    const calculatedItems = FIXED_GRADES.map(fixed => {
      const mm = calculateCategoryMM(fixed.category);
      
      // 직무별 단위총액(M/M) 찾기 - gradeInfo에서 해당 직무의 total 값 사용
      const gradeInfoItem = gradeInfo.find(g => g.grade === fixed.grade);
      const unitTotal = gradeInfoItem?.total || 0;
      
      // 직무기준 M/M 비용 = 직무별 단위총액(M/M) × M/M계
      const mmCost = unitTotal * mm;
      const discountedAmount = mmCost * (1 - discountRate / 100);

      return {
        category: fixed.category,
        grade: fixed.grade,
        basePrice: fixed.basePrice,
        mm: mm,
        mmCost: Math.round(mmCost),
        discountRate: discountRate,
        discountedAmount: Math.round(discountedAmount),
      };
    });

    setQuotationItems(calculatedItems);
  }, [milestones, discountRate, calculateCategoryMM, gradeInfo]);

  // GradeInfo 자동 계산 함수 (직무 기준) - FIXED_GRADES를 직접 사용
  // 이미지 참고: 직접인건비 = 노임단가 × 20.9, 제경비 = 직접인건비 × 110%, 기술료 = 직접인건비 × 20%
  const calculateGradeInfo = useCallback((): GradeInfo[] => {
    // FIXED_GRADES에서 고유한 직무들 추출
    const uniqueGrades = [...new Set(FIXED_GRADES.map(item => item.grade))].filter(g => g);

    return uniqueGrades.map(grade => {
      // 해당 직무의 FIXED_GRADE 찾기
      const fixedGrade = FIXED_GRADES.find(item => item.grade === grade);
      const dailyRate = fixedGrade?.basePrice || 0;

      // 직접인건비 = 노임단가(M/D) × 20.9일
      const directCost = dailyRate * 20.9;

      // 제경비 = 직접인건비 × 110%
      const overhead = directCost * 1.10;

      // 기술료 = 직접인건비 × 20%
      const techFee = directCost * 0.20;

      // 직무별 단위총액(M/M) = 직접인건비 + 제경비 + 기술료
      const total = directCost + overhead + techFee;

      return {
        grade: grade, // 직무명 그대로 사용
        dailyRate,
        directCost: Math.round(directCost),
        overhead: Math.round(overhead),
        techFee: Math.round(techFee),
        total: Math.round(total),
      };
    });
  }, []);

  // gradeInfo 자동 계산 (마일스톤 변경 시마다)
  useEffect(() => {
    const calculatedGradeInfo = calculateGradeInfo();
    setGradeInfo(calculatedGradeInfo);
  }, [calculateGradeInfo]);

  const handleAddHistory = () => {
    setHistory([...history, { writer: "", version: "", date: "", note: "" }]);
  };

  const handleRemoveHistory = (index: number) => {
    setHistory(history.filter((_, i) => i !== index));
  };

  const handleHistoryChange = (index: number, field: keyof HistoryItem, value: string) => {
    const newHistory = [...history];
    newHistory[index] = { ...newHistory[index], [field]: value };
    setHistory(newHistory);
  };

  const handleAddMilestone = () => {
    setMilestones([
      ...milestones,
      { depth1: "", depth2: "", depth3: "", planning: 0, server: 0, app: 0, web: 0, text: 0, pm: 0, total: 0 },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (index: number, field: keyof MilestoneItem, value: string | number) => {
    const newMilestones = [...milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };
    // Total 자동 계산
    if (field !== "total") {
      newMilestones[index].total = calculateMilestoneTotal(newMilestones[index]);
    }
    setMilestones(newMilestones);
  };


  const getQuotationData = (): QuotationData => {
    const totalAmount = quotationItems.reduce((sum, item) => sum + item.discountedAmount, 0);
    return {
      company,
      client,
      project,
      history: history.filter((h) => h.writer || h.version || h.date || h.note),
      milestones: milestones.filter((m) => m.depth1 || m.depth2 || m.depth3),
      quotationItems: quotationItems.filter((q) => q.category),
      gradeInfo: gradeInfo,
      discountRate,
      workPeriod,
      notes,
      totalAmount,
      vatIncluded: true,
      milestoneColumnWidths: milestoneColumnWidths,
      rowsPerPage: rowsPerPage,
      roundingUnit: roundingUnit,
    };
  };

  const updatePreview = async (showLoadingMessage = false) => {
    try {
      setError(null);
      // showLoadingMessage가 true일 때만 렌더링 메시지 표시
      if (showLoadingMessage) {
        setIsRendering(true);
      }
      console.log("미리보기 생성 시작...");
      const data = getQuotationData();
      
      // API Route를 통해 PDF 생성 (puppeteer 사용)
      const response = await fetch("/api/quotation/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "PDF 생성에 실패했습니다.");
      }

      const pdfBlob = await response.blob();
      console.log("PDF 생성 완료, 크기:", pdfBlob.size, "bytes");
      
      if (pdfBlob.size === 0) {
        throw new Error("PDF 파일이 비어있습니다.");
      }
      
      // 이전 URL 정리
      if (previewUrl) {
        if (previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
      }
      
      // PDF.js로 렌더링 (동적 import로 클라이언트 사이드에서만 로드)
      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        console.log("PDF ArrayBuffer 생성 완료, 크기:", arrayBuffer.byteLength);
        
        // 동적 import로 pdfjs-dist 로드
        const pdfjsLib = await import("pdfjs-dist");
        // PDF.js worker 설정
        pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        console.log("PDF.js 로드 완료, 페이지 수:", pdf.numPages);
        setPdfDocument(pdf);
        setIsRendering(false);
        setIsInitialLoad(false);
      } catch (pdfjsError) {
        console.error("PDF.js 렌더링 오류:", pdfjsError);
        setIsRendering(false);
      }
      
      // Base64 URL 생성 (다운로드 링크용)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setPreviewUrl(base64data);
      };
      reader.readAsDataURL(pdfBlob);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "미리보기 생성 중 오류가 발생했습니다.";
      console.error("미리보기 생성 오류 상세:", err);
      console.error("에러 스택:", err instanceof Error ? err.stack : "스택 없음");
      setError(errorMessage);
      setPreviewUrl(null);
      setIsRendering(false);
    }
  };

  // 초기 마운트 시 한 번만 미리보기 생성 (기본값으로)
  useEffect(() => {
    updatePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 빈 배열로 마운트 시 한 번만 실행

  // 데이터 변경 시 실시간 업데이트 (debounce 적용)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updatePreview();
    }, 1000); // 1초 디바운스

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, client, project, history, milestones, quotationItems, discountRate, workPeriod, notes]);

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // PDF 문서가 설정되면 모든 페이지를 canvas에 렌더링
  useEffect(() => {
    const renderPDF = async () => {
      if (pdfDocument) {
        try {
          console.log("Canvas에 PDF 렌더링 시작...");
          const containerWidth = 800; // 고정 너비

          const numPages = pdfDocument.numPages;
          console.log(`PDF 페이지 수: ${numPages}`);

          const pages: Array<{ pageNum: number; canvas: HTMLCanvasElement }> = [];

          // 모든 페이지 렌더링
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1 });
            const scale = containerWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale });

            // 각 페이지마다 새로운 canvas 생성
            const canvas = document.createElement("canvas");
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            canvas.style.width = "100%";
            canvas.style.height = "auto";

            const context = canvas.getContext("2d");
            if (context) {
              const renderContext = {
                canvasContext: context,
                viewport: scaledViewport,
              };
              await page.render(renderContext).promise;
              pages.push({ pageNum, canvas });
              console.log(`페이지 ${pageNum} 렌더링 완료`);
            }
          }

          setRenderedPages(pages);
          console.log("모든 페이지 렌더링 완료");
        } catch (error) {
          console.error("PDF 렌더링 오류:", error);
          setError(`PDF 렌더링 오류: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };

    if (typeof window !== "undefined") {
      renderPDF();
    }
  }, [pdfDocument]);

  // renderedPages가 변경될 때 DOM에 추가 (약간의 지연을 주어 DOM이 준비될 때까지 대기)
  useEffect(() => {
    if (renderedPages.length > 0) {
      // DOM이 준비될 때까지 짧은 지연
      const timer = setTimeout(() => {
        renderedPages.forEach(({ pageNum, canvas }) => {
          const container = document.getElementById(`pdf-page-${pageNum}`);
          if (container) {
            container.innerHTML = '';
            container.appendChild(canvas);
            console.log(`페이지 ${pageNum} DOM에 추가됨`);
          } else {
            console.warn(`컨테이너를 찾을 수 없음: pdf-page-${pageNum}`);
          }
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [renderedPages]);

  const handleGenerate = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const data = getQuotationData();
      
      // API Route를 통해 PDF 생성
      const response = await fetch("/api/quotation/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "PDF 생성에 실패했습니다.");
      }

      const pdfBlob = await response.blob();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `견적서-${project.name || "견적서"}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  // AI 분석 함수
  const handleAIAnalysis = async () => {
    if (!aiProjectDescription.trim() && aiAttachedFiles.length === 0) {
      setError("프로젝트 정보를 입력하거나 파일을 첨부해주세요.");
      return;
    }

    setAIAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("projectName", project.name);
      formData.append("projectDescription", aiProjectDescription);
      
      // 파일 첨부
      aiAttachedFiles.forEach((file, index) => {
        formData.append(`files`, file);
      });

      const response = await fetch("/api/quotation/ai-analysis", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "AI 분석에 실패했습니다.");
      }

      const result = await response.json();
      setAIResult(result.milestones || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 분석 중 오류가 발생했습니다.");
    } finally {
      setAIAnalyzing(false);
    }
  };

  // AI 분석 결과를 마일스톤에 반영
  const handleApplyAIResult = () => {
    if (aiResult && aiResult.length > 0) {
      setMilestones(aiResult);
      setShowAIModal(false);
      setAIProjectDescription("");
      setAIResult(null);
      setAIAttachedFiles([]);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAIAttachedFiles((prev) => [...prev, ...files]);
    }
  };

  // 파일 제거 핸들러
  const handleRemoveFile = (index: number) => {
    setAIAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 견적서 저장
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const data = getQuotationData();
      const url = currentQuotationId
        ? `/api/quotation/${currentQuotationId}`
        : '/api/quotation';
      const method = currentQuotationId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '견적서 저장에 실패했습니다.');
      }

      const result = await response.json();
      setCurrentQuotationId(result.id);
      alert(result.message || '견적서가 저장되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '견적서 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 견적서 목록 불러오기
  const handleLoadList = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/quotation');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '견적서 목록을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setSavedQuotations(data);
      setShowLoadModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '견적서 목록 불러오기 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 선택한 견적서 불러오기
  const handleLoadQuotation = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quotation/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '견적서를 불러오는데 실패했습니다.');
      }

      const data = await response.json();

      // 데이터를 상태에 적용
      setCompany(data.company);
      setClient(data.client);
      setProject(data.project);
      setHistory(data.history.length > 0 ? data.history : [{ writer: "", version: "", date: "", note: "" }]);
      setMilestones(data.milestones.length > 0 ? data.milestones : [{ depth1: "", depth2: "", depth3: "", planning: 0, server: 0, app: 0, web: 0, text: 0, pm: 0, total: 0 }]);
      setQuotationItems(data.quotationItems.length > 0 ? data.quotationItems : [{ category: "", grade: "", basePrice: 0, mm: 0, mmCost: 0, discountRate: 0, discountedAmount: 0 }]);
      setGradeInfo(data.gradeInfo || []);
      setDiscountRate(data.discountRate);
      setWorkPeriod(data.workPeriod);
      setNotes(data.notes || "");
      setCurrentQuotationId(data.id);
      
      // 마일스톤 간격 설정 복원
      if (data.milestoneColumnWidths) {
        setMilestoneColumnWidths(data.milestoneColumnWidths);
      }
      if (data.rowsPerPage) {
        setRowsPerPage(data.rowsPerPage);
      }
      if (data.roundingUnit) {
        setRoundingUnit(data.roundingUnit);
      }

      setShowLoadModal(false);
      alert('견적서를 불러왔습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '견적서 불러오기 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 견적서 삭제
  const handleDeleteQuotation = async (id: string) => {
    if (!confirm('정말 이 견적서를 삭제하시겠습니까?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quotation/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '견적서 삭제에 실패했습니다.');
      }

      alert('견적서가 삭제되었습니다.');
      // 목록 새로고침
      handleLoadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : '견적서 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const totalQuotation = quotationItems.reduce((sum, item) => sum + item.discountedAmount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
      {/* 좌측: 입력 화면 */}
      <div className="overflow-y-auto space-y-6 pr-4">
      {/* 회사 정보 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">회사 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">회사명</label>
            <input
              type="text"
              value={company.name}
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">대표자</label>
            <input
              type="text"
              value={company.representative}
              onChange={(e) => setCompany({ ...company, representative: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">주소</label>
            <input
              type="text"
              value={company.address}
              onChange={(e) => setCompany({ ...company, address: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">사업자등록번호</label>
            <input
              type="text"
              value={company.businessNumber}
              onChange={(e) => setCompany({ ...company, businessNumber: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">연락처</label>
            <input
              type="text"
              value={company.phone}
              onChange={(e) => setCompany({ ...company, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* 클라이언트 정보 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">클라이언트 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">클라이언트명</label>
            <input
              type="text"
              value={client.name}
              onChange={(e) => setClient({ ...client, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">연락처</label>
            <input
              type="text"
              value={client.phone}
              onChange={(e) => setClient({ ...client, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* 프로젝트 정보 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">프로젝트 정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1">프로젝트명</label>
            <input
              type="text"
              value={project.name}
              onChange={(e) => setProject({ ...project, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">버전</label>
            <input
              type="text"
              value={project.version}
              onChange={(e) => setProject({ ...project, version: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">날짜</label>
            <input
              type="text"
              value={project.date}
              onChange={(e) => setProject({ ...project, date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* History of changes */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">History of changes</h2>
          <button
            onClick={handleAddHistory}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            행 추가
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">#</th>
                <th className="border p-2">작성자</th>
                <th className="border p-2">Version</th>
                <th className="border p-2">Date</th>
                <th className="border p-2">Note</th>
                <th className="border p-2">삭제</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, index) => (
                <tr key={index}>
                  <td className="border p-2">{index + 1}</td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.writer}
                      onChange={(e) => handleHistoryChange(index, "writer", e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.version}
                      onChange={(e) => handleHistoryChange(index, "version", e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.date}
                      onChange={(e) => handleHistoryChange(index, "date", e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.note}
                      onChange={(e) => handleHistoryChange(index, "note", e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <button
                      onClick={() => handleRemoveHistory(index)}
                      className="px-2 py-1 text-red-500 hover:text-red-700 rounded text-sm flex items-center justify-center"
                      title="삭제"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Milestone List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Milestone List</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowColumnWidthModal(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              컬럼 너비 조정
            </button>
            <button
              onClick={() => setShowAIModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              AI 분석
            </button>
            <button
              onClick={handleAddMilestone}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              행 추가
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">#</th>
                <th className="border p-2">Depth1</th>
                <th className="border p-2">Depth2</th>
                <th className="border p-2">Depth3</th>
                <th className="border p-2">기획</th>
                <th className="border p-2">Server</th>
                <th className="border p-2">App</th>
                <th className="border p-2">Web</th>
                <th className="border p-2">QA</th>
                <th className="border p-2">PM</th>
                <th className="border p-2">Total</th>
                <th className="border p-2">삭제</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((item, index) => (
                <tr key={index}>
                  <td className="border p-2">{index + 1}</td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.depth1}
                      onChange={(e) => handleMilestoneChange(index, "depth1", e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.depth2}
                      onChange={(e) => handleMilestoneChange(index, "depth2", e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.depth3}
                      onChange={(e) => handleMilestoneChange(index, "depth3", e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="number"
                      value={item.planning}
                      onChange={(e) => handleMilestoneChange(index, "planning", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="number"
                      value={item.server}
                      onChange={(e) => handleMilestoneChange(index, "server", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="number"
                      value={item.app}
                      onChange={(e) => handleMilestoneChange(index, "app", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="number"
                      value={item.web}
                      onChange={(e) => handleMilestoneChange(index, "web", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="number"
                      value={item.text}
                      onChange={(e) => handleMilestoneChange(index, "text", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="number"
                      value={item.pm}
                      onChange={(e) => handleMilestoneChange(index, "pm", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2 font-bold">{item.total}</td>
                  <td className="border p-2">
                    <button
                      onClick={() => handleRemoveMilestone(index)}
                      className="px-2 py-1 text-red-500 hover:text-red-700 rounded text-sm flex items-center justify-center"
                      title="삭제"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 견적서 테이블 (자동 계산) */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">견적서 (자동 계산)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">업무</th>
                <th className="border p-2">직무</th>
                <th className="border p-2">기본단가</th>
                <th className="border p-2">M/M계</th>
                <th className="border p-2">M/M 비용</th>
                <th className="border p-2">할인금액</th>
              </tr>
            </thead>
            <tbody>
              {quotationItems.map((item, index) => (
                <tr key={index}>
                  <td className="border p-2">{item.category}</td>
                  <td className="border p-2">{item.grade}</td>
                  <td className="border p-2 text-right">{item.basePrice.toLocaleString()}</td>
                  <td className="border p-2 text-right">{item.mm.toFixed(2)}</td>
                  <td className="border p-2 text-right">{item.mmCost.toLocaleString()}</td>
                  <td className="border p-2 text-right font-bold">{item.discountedAmount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={5} className="border p-2 text-right">합계</td>
                <td className="border p-2 text-right">{totalQuotation.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          <p>* M/M계는 위의 Milestone List에서 자동으로 계산됩니다.</p>
          <p>* 기본단가와 직무는 고정값입니다.</p>
        </div>
      </div>

      {/* 프로젝트 제안가 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">프로젝트 제안가</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">작업기간 (개월)</label>
            <input
              type="number"
              min="1"
              value={workPeriod}
              onChange={(e) => setWorkPeriod(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">할인율 (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={discountRate}
              onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">절삭 단위</label>
            <select
              value={roundingUnit}
              onChange={(e) => setRoundingUnit(parseInt(e.target.value) || 10000)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value={1}>1원</option>
              <option value={10}>10원</option>
              <option value={100}>100원</option>
              <option value={1000}>1,000원</option>
              <option value={10000}>10,000원</option>
              <option value={100000}>100,000원</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">비고</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="견적서에 표시될 비고사항을 입력하세요"
            rows={3}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* 직무별 M/M 및 단위 비용 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">직무별 M/M 및 단위 비용</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">직무</th>
                <th className="border p-2">S/W기술자 직무별<br/>노임단가(M/D)</th>
                <th className="border p-2">직접인건비<br/>(20.9일)</th>
                <th className="border p-2">제경비<br/>(110%)</th>
                <th className="border p-2">기술료<br/>(20%)</th>
                <th className="border p-2">직무별<br/>단위총액(M/M)</th>
              </tr>
            </thead>
            <tbody>
              {gradeInfo.map((grade, index) => (
                <tr key={index}>
                  <td className="border p-2">{grade.grade}</td>
                  <td className="border p-2 text-right">{grade.dailyRate.toLocaleString()}</td>
                  <td className="border p-2 text-right">{grade.directCost.toLocaleString()}</td>
                  <td className="border p-2 text-right">{grade.overhead.toLocaleString()}</td>
                  <td className="border p-2 text-right">{grade.techFee.toLocaleString()}</td>
                  <td className="border p-2 text-right font-bold">{grade.total.toLocaleString()}</td>
                </tr>
              ))}
              {gradeInfo.length === 0 && (
                <tr>
                  <td colSpan={6} className="border p-4 text-center text-gray-500">
                    견적서에 직무를 입력하면 자동으로 계산됩니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          <p>* 직접인건비 = 노임단가(M/D) × 20.9일</p>
          <p>* 제경비 = 직접인건비 × 110%</p>
          <p>* 기술료 = 직접인건비 × 20%</p>
          <p>* 직무별 단위총액 = 직접인건비 + 제경비 + 기술료</p>
        </div>
      </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 생성 버튼 */}
        <div className="flex gap-2 sticky bottom-0 bg-white pt-4 pb-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
          >
            {isSaving ? "저장 중..." : "견적서 저장"}
          </button>
          <button
            onClick={handleLoadList}
            disabled={isLoading}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
          >
            {isLoading ? "불러오는 중..." : "견적서 불러오기"}
          </button>
        </div>
      </div>

      {/* 우측: 미리보기 화면 */}
      <div className="bg-gray-100 rounded-lg p-4 sticky top-0 h-[calc(100vh-200px)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">PDF 미리보기</h2>
          <div className="flex gap-2">
            <button
              onClick={() => updatePreview(true)}
              disabled={isRendering}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              {isRendering ? "생성 중..." : "미리보기 만들기"}
            </button>
            {previewUrl ? (
              <a
                href={previewUrl}
                download="test-preview.pdf"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold no-underline"
              >
                PDF 다운로드
              </a>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={isProcessing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
              >
                {isProcessing ? "PDF 생성 중..." : "PDF 다운로드"}
              </button>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-lg h-[calc(100%-60px)] overflow-auto">
          {isRendering && isInitialLoad ? (
            <div className="flex items-center justify-center h-full text-gray-500 p-8">
              <div className="text-center">
                <p className="text-lg mb-2">PDF 렌더링 중...</p>
              </div>
            </div>
          ) : renderedPages.length > 0 ? (
            <div className="p-4 overflow-y-auto overflow-x-hidden">
              <div className="space-y-4">
                {renderedPages.map(({ pageNum, canvas }) => (
                  <div key={pageNum} className="mb-4">
                    <div className="text-xs text-gray-500 mb-1 text-center">페이지 {pageNum}</div>
                    <div
                      className="border border-gray-300 rounded mx-auto"
                      style={{ display: "flex", justifyContent: "center" }}
                      id={`pdf-page-${pageNum}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : pdfDocument ? (
            <div className="p-4 overflow-y-auto overflow-x-hidden">
              <canvas
                ref={canvasRef}
                className="border border-gray-300 rounded mx-auto"
                style={{ display: "block", maxWidth: "100%", height: "auto" }}
              />
            </div>
          ) : previewUrl ? (
            <iframe
              src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full border-0 min-h-[600px]"
              title="PDF Preview"
              onLoad={() => {
                console.log("iframe 로드 완료");
              }}
              onError={(e) => {
                console.error("iframe 로드 오류:", e);
                setError("PDF 미리보기를 로드할 수 없습니다.");
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 p-8">
              <div className="text-center">
                <p className="text-lg mb-2">PDF를 생성하는 중...</p>
                {error && (
                  <p className="text-sm text-red-600 mt-2">{error}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 견적서 불러오기 모달 */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">저장된 견적서 불러오기</h2>
                <button
                  onClick={() => setShowLoadModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {savedQuotations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  저장된 견적서가 없습니다.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="p-3 text-center">프로젝트명</th>
                      <th className="p-3 text-center">고객명</th>
                      <th className="p-3 text-center">버전</th>
                      <th className="p-3 text-center">총액</th>
                      <th className="p-3 text-center">생성일</th>
                      <th className="p-3 text-center">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedQuotations.map((quotation) => (
                      <tr key={quotation.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-center">{quotation.projectName}</td>
                        <td className="p-3 text-center">{quotation.clientName}</td>
                        <td className="p-3 text-center">{quotation.version}</td>
                        <td className="p-3 text-center">{quotation.totalAmount?.toLocaleString()}원</td>
                        <td className="p-3 text-center">
                          {new Date(quotation.createdAt).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleLoadQuotation(quotation.id)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              불러오기
                            </button>
                            <button
                              onClick={() => handleDeleteQuotation(quotation.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI 분석 모달 */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">AI 공수 산정</h2>
                <button
                  onClick={() => {
                    setShowAIModal(false);
                    setAIProjectDescription("");
                    setAIResult(null);
                    setAIAttachedFiles([]);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">프로젝트 정보</label>
                <textarea
                  value={aiProjectDescription}
                  onChange={(e) => setAIProjectDescription(e.target.value)}
                  placeholder="프로젝트의 주요 기능, 요구사항, 기술 스택 등을 상세히 입력해주세요."
                  rows={8}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={aiAnalyzing}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">첨부파일 (선택사항)</label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  disabled={aiAnalyzing}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  accept=".txt,.md,.doc,.docx,.pdf,.png,.jpg,.jpeg,.gif"
                />
                {aiAttachedFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {aiAttachedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm"
                      >
                        <span className="truncate flex-1">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          disabled={aiAnalyzing}
                          className="ml-2 text-red-600 hover:text-red-800 text-xs"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {aiAnalyzing && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-700">AI가 공수를 분석 중입니다...</p>
                </div>
              )}

              {aiResult && aiResult.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-bold mb-2">분석 결과</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border p-2">Depth1</th>
                          <th className="border p-2">Depth2</th>
                          <th className="border p-2">Depth3</th>
                          <th className="border p-2">기획</th>
                          <th className="border p-2">Server</th>
                          <th className="border p-2">App</th>
                          <th className="border p-2">Web</th>
                          <th className="border p-2">QA</th>
                          <th className="border p-2">PM</th>
                          <th className="border p-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiResult.map((item, index) => (
                          <tr key={index}>
                            <td className="border p-2">{item.depth1}</td>
                            <td className="border p-2">{item.depth2}</td>
                            <td className="border p-2">{item.depth3}</td>
                            <td className="border p-2 text-right">{item.planning}</td>
                            <td className="border p-2 text-right">{item.server}</td>
                            <td className="border p-2 text-right">{item.app}</td>
                            <td className="border p-2 text-right">{item.web}</td>
                            <td className="border p-2 text-right">{item.text}</td>
                            <td className="border p-2 text-right">{item.pm}</td>
                            <td className="border p-2 text-right">{item.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAIModal(false);
                  setAIProjectDescription("");
                  setAIResult(null);
                  setAIAttachedFiles([]);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                취소
              </button>
              {!aiResult ? (
                <button
                  onClick={handleAIAnalysis}
                  disabled={aiAnalyzing || (!aiProjectDescription.trim() && aiAttachedFiles.length === 0)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {aiAnalyzing ? "분석 중..." : "분석 시작"}
                </button>
              ) : (
                <button
                  onClick={handleApplyAIResult}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  확인 (마일스톤에 반영)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 컬럼 너비 조정 모달 */}
      {showColumnWidthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">마일스톤 표 컬럼 너비 조정</h2>
                <button
                  onClick={() => setShowColumnWidthModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-4">
                {Object.entries(milestoneColumnWidths).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-sm font-medium w-32">
                      {key === 'number' ? '#' : 
                       key === 'depth1' ? 'Depth1' :
                       key === 'depth2' ? 'Depth2' :
                       key === 'depth3' ? 'Depth3' :
                       key === 'planning' ? '기획/디자인' :
                       key === 'server' ? 'Server' :
                       key === 'app' ? 'App' :
                       key === 'web' ? 'Web' :
                       key === 'qa' ? 'QA' :
                       key === 'pm' ? 'PM' :
                       key === 'total' ? 'Total' : key}
                    </label>
                    <div className="flex items-center gap-4 flex-1">
                      <input
                        type="range"
                        min="1"
                        max="30"
                        step="0.1"
                        value={value}
                        onChange={(e) => setMilestoneColumnWidths({
                          ...milestoneColumnWidths,
                          [key]: parseFloat(e.target.value)
                        })}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        min="1"
                        max="30"
                        step="0.1"
                        value={value}
                        onChange={(e) => setMilestoneColumnWidths({
                          ...milestoneColumnWidths,
                          [key]: parseFloat(e.target.value) || 0
                        })}
                        className="w-20 px-2 py-1 border rounded"
                      />
                      <span className="text-sm text-gray-500 w-8">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>합계:</strong> {Object.values(milestoneColumnWidths).reduce((sum, val) => sum + val, 0).toFixed(1)}%
                  {Object.values(milestoneColumnWidths).reduce((sum, val) => sum + val, 0) !== 100 && (
                    <span className="ml-2 text-orange-600">
                      (권장: 100%로 맞추세요)
                    </span>
                  )}
                </p>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    한 페이지에 표시할 행 수
                  </label>
                  <div className="flex items-center gap-4 flex-1 max-w-md">
                    <input
                      type="range"
                      min="10"
                      max="50"
                      step="1"
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(parseInt(e.target.value) || 20)}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min="10"
                      max="50"
                      step="1"
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(parseInt(e.target.value) || 20)}
                      className="w-20 px-2 py-1 border rounded"
                    />
                    <span className="text-sm text-gray-500">개</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setMilestoneColumnWidths({
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
                  });
                  setRowsPerPage(20);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                기본값으로 초기화
              </button>
              <button
                onClick={() => {
                  setShowColumnWidthModal(false);
                  updatePreview();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

