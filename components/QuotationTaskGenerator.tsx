"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  type CompanyInfo,
  type ClientInfo,
  type ProjectInfo,
  type HistoryItem,
  type TaskMilestoneItem,
  type TaskQuotationItem,
  type TaskQuotationData,
  PAGE_TYPES,
  getPageTypePrice,
  calculateQuotationItems,
} from "@/lib/quotationTaskProcessor";

export default function QuotationTaskGenerator() {
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

  const [milestones, setMilestones] = useState<TaskMilestoneItem[]>([
    { name: "", pageType: "", quantity: 1, unitPrice: 0, amount: 0 },
  ]);

  const [quotationItems, setQuotationItems] = useState<TaskQuotationItem[]>([]);

  const [discountRate, setDiscountRate] = useState<number>(0);
  const [workPeriod, setWorkPeriod] = useState<number>(1);
  const [roundingUnit, setRoundingUnit] = useState<number>(10000);
  const [notes, setNotes] = useState<string>("본 견적서는 페이지 유형별 단가 기준으로 산정되었습니다.");
  const [isProcessing, setIsProcessing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const isGeneratingRef = useRef(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [rowsPerPage, setRowsPerPage] = useState<number>(15);

  // 저장/불러오기 관련 상태
  const [savedQuotations, setSavedQuotations] = useState<any[]>([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuotationId, setCurrentQuotationId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedPages, setRenderedPages] = useState<Array<{ pageNum: number; canvas: HTMLCanvasElement }>>([]);

  // AI 분석 관련 상태
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiProjectDescription, setAiProjectDescription] = useState("");
  const [aiClientBudget, setAiClientBudget] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<TaskMilestoneItem[] | null>(null);
  const [aiAttachedFiles, setAiAttachedFiles] = useState<File[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);

  // 마일스톤 변경 시 단가와 금액 자동 계산
  const handleMilestoneChange = (
    index: number,
    field: keyof TaskMilestoneItem,
    value: string | number
  ) => {
    const newMilestones = [...milestones];
    newMilestones[index] = { ...newMilestones[index], [field]: value };

    // 페이지 유형이 변경되면 단가 자동 설정 (기타는 0원으로 설정)
    if (field === "pageType") {
      const price = getPageTypePrice(value as string);
      newMilestones[index].unitPrice = price;
      newMilestones[index].amount = price * newMilestones[index].quantity;
    }

    // 수량이 변경되면 금액 재계산
    if (field === "quantity") {
      newMilestones[index].amount = newMilestones[index].unitPrice * (value as number);
    }

    // 단가가 변경되면 금액 재계산 (기타 유형용)
    if (field === "unitPrice") {
      newMilestones[index].amount = (value as number) * newMilestones[index].quantity;
    }

    setMilestones(newMilestones);
  };

  // 견적서 항목 자동 계산 (마일스톤 변경 시)
  useEffect(() => {
    const items = calculateQuotationItems(milestones);
    setQuotationItems(items);
  }, [milestones]);

  // 총액 계산
  const totalBeforeDiscount = quotationItems.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = Math.round(totalBeforeDiscount * (discountRate / 100));
  const totalAfterDiscount = totalBeforeDiscount - discountAmount;
  const finalAmount = Math.floor(totalAfterDiscount / roundingUnit) * roundingUnit;

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
      { name: "", pageType: "", quantity: 1, unitPrice: 0, amount: 0 },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  // AI 분석 파일 첨부 핸들러
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAiAttachedFiles((prev) => [...prev, ...files]);
    }
  };

  // AI 분석 파일 제거 핸들러
  const handleRemoveFile = (index: number) => {
    setAiAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // AI 분석 실행
  const handleAIAnalysis = async () => {
    if (!aiProjectDescription.trim() && aiAttachedFiles.length === 0) {
      setAiError("프로젝트 설명을 입력하거나 파일을 첨부해주세요.");
      return;
    }

    setAiAnalyzing(true);
    setAiError(null);
    setAiWarning(null);
    setAiResult(null);

    try {
      const formData = new FormData();
      formData.append("projectName", project.name || "미지정");
      formData.append("projectDescription", aiProjectDescription);
      formData.append("clientBudget", aiClientBudget);

      aiAttachedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/quotation-task/ai-analysis", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI 분석에 실패했습니다.");
      }

      if (data.warning) {
        setAiWarning(data.warning);
      }

      if (data.milestones) {
        setAiResult(data.milestones);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI 분석 중 오류가 발생했습니다.");
    } finally {
      setAiAnalyzing(false);
    }
  };

  // AI 분석 결과 적용
  const handleApplyAIResult = () => {
    if (aiResult && aiResult.length > 0) {
      setMilestones(aiResult);
      setShowAIModal(false);
      setAiResult(null);
      setAiProjectDescription("");
      setAiClientBudget("");
      setAiAttachedFiles([]);
      setAiError(null);
      setAiWarning(null);
    }
  };

  // AI 모달 닫기
  const handleCloseAIModal = () => {
    setShowAIModal(false);
    setAiResult(null);
    setAiError(null);
    setAiWarning(null);
  };

  // 견적서 저장 (항상 새로 추가)
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const data = getQuotationData();

      // 항상 POST로 새 견적서 추가
      const response = await fetch("/api/quotation-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "견적서 저장에 실패했습니다.");
      }

      const result = await response.json();
      setCurrentQuotationId(result.id);
      alert(result.message || "견적서가 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "견적서 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  // 저장된 견적서 목록 불러오기
  const handleLoadList = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/quotation-task");
      if (!response.ok) {
        throw new Error("목록을 불러오는데 실패했습니다.");
      }

      const data = await response.json();
      setSavedQuotations(data);
      setShowLoadModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 선택된 견적서 불러오기
  const handleLoadQuotation = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quotation-task/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "견적서를 불러오는데 실패했습니다.");
      }

      const data = await response.json();

      // 데이터를 상태에 적용
      setCompany(data.company);
      setClient(data.client);
      setProject(data.project);
      setHistory(data.history && data.history.length > 0 ? data.history : [{ writer: "", version: "", date: "", note: "" }]);
      setMilestones(data.milestones && data.milestones.length > 0 ? data.milestones : [{ name: "", pageType: "", quantity: 1, unitPrice: 0, amount: 0 }]);
      setDiscountRate(data.discountRate || 0);
      setWorkPeriod(data.workPeriod || 1);
      setNotes(data.notes || "");
      setCurrentQuotationId(data.id);

      if (data.rowsPerPage) {
        setRowsPerPage(data.rowsPerPage);
      }
      if (data.roundingUnit) {
        setRoundingUnit(data.roundingUnit);
      }

      setShowLoadModal(false);
      alert("견적서를 불러왔습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "견적서 불러오기 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 견적서 삭제
  const handleDeleteQuotation = async (id: string) => {
    if (!confirm("정말 이 견적서를 삭제하시겠습니까?")) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quotation-task/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "견적서 삭제에 실패했습니다.");
      }

      alert("견적서가 삭제되었습니다.");
      // 목록 새로고침
      handleLoadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "견적서 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 새 견적서 작성
  const handleNewQuotation = () => {
    setCompany({
      name: "APPLR",
      address: "경기도 성남시 분당구 판교역로 192번길 16, 8층 806호",
      businessNumber: "689-81-03094",
      representative: "목진욱",
      phone: "010-7278-5314",
    });
    setClient({ name: "", phone: "" });
    setProject({
      name: "",
      version: "1.0",
      date: new Date().toLocaleDateString("ko-KR"),
      validityDays: 14,
    });
    setHistory([{
      writer: "목진욱",
      version: "1.0",
      date: new Date().toLocaleDateString("ko-KR"),
      note: "견적서 작성"
    }]);
    setMilestones([{ name: "", pageType: "", quantity: 1, unitPrice: 0, amount: 0 }]);
    setDiscountRate(0);
    setWorkPeriod(1);
    setNotes("본 견적서는 페이지 유형별 단가 기준으로 산정되었습니다.");
    setRoundingUnit(10000);
    setCurrentQuotationId(null);
    setShowLoadModal(false);
  };

  const getQuotationData = (): TaskQuotationData => {
    return {
      company,
      client,
      project,
      history: history.filter((h) => h.writer || h.version || h.date || h.note),
      milestones: milestones.filter((m) => m.name || m.pageType),
      quotationItems: quotationItems,
      discountRate,
      workPeriod,
      notes,
      totalAmount: finalAmount,
      vatIncluded: true,
      roundingUnit,
      rowsPerPage,
    };
  };

  const downloadPDF = useCallback((blob: Blob, projectName: string) => {
    const fileName = `견적서-${projectName || "견적서"}.pdf`;
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  }, []);

  const updatePreview = async (showLoadingMessage = false) => {
    if (isGeneratingRef.current) {
      console.log("PDF 생성 중... 중복 요청 무시");
      return;
    }

    try {
      isGeneratingRef.current = true;
      setIsGeneratingPdf(true);
      setError(null);
      if (showLoadingMessage) {
        setIsRendering(true);
      }
      console.log("미리보기 생성 시작...");
      const data = getQuotationData();

      const response = await fetch("/api/quotation-task/pdf", {
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

      setPdfBlob(pdfBlob);

      const renderPdfWithRetry = async (retryCount = 0): Promise<void> => {
        try {
          const arrayBuffer = await pdfBlob.arrayBuffer();
          console.log("PDF ArrayBuffer 생성 완료, 크기:", arrayBuffer.byteLength);

          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
          pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          console.log("PDF.js 로드 완료, 페이지 수:", pdf.numPages);
          setPdfDocument(pdf);
          setIsRendering(false);
          setIsInitialLoad(false);
        } catch (pdfjsError: unknown) {
          const errorMsg = pdfjsError instanceof Error ? pdfjsError.message : String(pdfjsError);
          if (errorMsg.includes('Target closed') && retryCount < 2) {
            console.log(`PDF.js 재시도 (${retryCount + 1}/2)...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            return renderPdfWithRetry(retryCount + 1);
          }
          console.warn("PDF.js 렌더링 경고:", pdfjsError);
          setIsRendering(false);
        }
      };

      await renderPdfWithRetry();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "미리보기 생성 중 오류가 발생했습니다.";
      if (!errorMessage.includes('Target closed')) {
        console.error("미리보기 생성 오류 상세:", err);
        setError(errorMessage);
      }
      setPdfBlob(null);
      setIsRendering(false);
    } finally {
      isGeneratingRef.current = false;
      setIsGeneratingPdf(false);
    }
  };

  // 초기 마운트 시 한 번만 미리보기 생성
  useEffect(() => {
    updatePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 데이터 변경 시 실시간 업데이트 (debounce 적용)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updatePreview();
    }, 1000);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, client, project, history, milestones, discountRate, workPeriod, notes]);

  // PDF 문서가 설정되면 모든 페이지를 canvas에 렌더링
  useEffect(() => {
    const renderPDF = async () => {
      if (pdfDocument) {
        try {
          console.log("Canvas에 PDF 렌더링 시작...");
          const containerWidth = 800;

          const numPages = pdfDocument.numPages;
          console.log(`PDF 페이지 수: ${numPages}`);

          const pages: Array<{ pageNum: number; canvas: HTMLCanvasElement }> = [];

          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1 });
            const scale = containerWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale });

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

  // renderedPages가 변경될 때 DOM에 추가
  useEffect(() => {
    if (renderedPages.length > 0) {
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
    if (pdfBlob) {
      downloadPDF(pdfBlob, project.name);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const data = getQuotationData();

      const response = await fetch("/api/quotation-task/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || "PDF 생성에 실패했습니다.");
        } else {
          const errorText = await response.text();
          throw new Error(errorText || "PDF 생성에 실패했습니다.");
        }
      }

      if (!contentType?.includes('application/pdf')) {
        const errorText = await response.text();
        throw new Error(`예상치 못한 응답 형식: ${contentType}. ${errorText}`);
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error("PDF 파일이 비어있습니다.");
      }

      setPdfBlob(blob);
      downloadPDF(blob, project.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6 h-[calc(100vh-200px)]">
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

        {/* 작업 항목 목록 (페이지 단가 기준) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">작업 항목 목록</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAIModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
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
                  <th className="border p-2 w-10">#</th>
                  <th className="border p-2">페이지/기능명</th>
                  <th className="border p-2 w-40">유형</th>
                  <th className="border p-2 w-20">수량</th>
                  <th className="border p-2 w-28">단가</th>
                  <th className="border p-2 w-28">금액</th>
                  <th className="border p-2 w-12">삭제</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((item, index) => (
                  <tr key={index}>
                    <td className="border p-2 text-center">{index + 1}</td>
                    <td className="border p-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleMilestoneChange(index, "name", e.target.value)}
                        className="w-full px-2 py-1 border rounded"
                        placeholder="페이지명 입력"
                      />
                    </td>
                    <td className="border p-2">
                      <select
                        value={item.pageType}
                        onChange={(e) => handleMilestoneChange(index, "pageType", e.target.value)}
                        className="w-full px-2 py-1 border rounded"
                      >
                        <option value="">유형 선택</option>
                        {PAGE_TYPES.map((pt) => (
                          <option key={pt.type} value={pt.type}>
                            {pt.type === "기타"
                              ? "기타 (금액 직접 입력)"
                              : `${pt.type} (${pt.price.toLocaleString()}원)`}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border p-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleMilestoneChange(index, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 border rounded text-right"
                      />
                    </td>
                    <td className="border p-2">
                      {item.pageType === "기타" ? (
                        <input
                          type="number"
                          min="0"
                          step="10000"
                          value={item.unitPrice}
                          onChange={(e) => handleMilestoneChange(index, "unitPrice", parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border rounded text-right"
                          placeholder="단가 입력"
                        />
                      ) : (
                        <span className="block text-right">{item.unitPrice.toLocaleString()}원</span>
                      )}
                    </td>
                    <td className="border p-2 text-right font-bold">
                      {item.amount.toLocaleString()}원
                    </td>
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

        {/* 견적서 테이블 (유형별 합계) */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">견적서 (유형별 합계)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">유형</th>
                  <th className="border p-2">수량</th>
                  <th className="border p-2">단가</th>
                  <th className="border p-2">금액</th>
                </tr>
              </thead>
              <tbody>
                {quotationItems.map((item, index) => (
                  <tr key={index}>
                    <td className="border p-2">{item.pageType}</td>
                    <td className="border p-2 text-right">{item.quantity}</td>
                    <td className="border p-2 text-right">
                      {`${item.unitPrice.toLocaleString()}원`}
                    </td>
                    <td className="border p-2 text-right font-bold">{item.amount.toLocaleString()}원</td>
                  </tr>
                ))}
                {quotationItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="border p-4 text-center text-gray-500">
                      작업 항목을 추가하면 자동으로 계산됩니다.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="border p-2 text-right">소계</td>
                  <td className="border p-2 text-right font-bold">{totalBeforeDiscount.toLocaleString()}원</td>
                </tr>
                {discountRate > 0 && (
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="border p-2 text-right">할인 ({discountRate}%)</td>
                    <td className="border p-2 text-right text-red-600">-{discountAmount.toLocaleString()}원</td>
                  </tr>
                )}
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={3} className="border p-2 text-right">합계</td>
                  <td className="border p-2 text-right">{finalAmount.toLocaleString()}원</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 프로젝트 제안가 설정 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">프로젝트 제안가 설정</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">작업기간 (개월)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={workPeriod}
                onChange={(e) => setWorkPeriod(parseFloat(e.target.value) || 0)}
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
                <option value={1000000}>1,000,000원</option>
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

        {/* 페이지 유형별 단가 기준표 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">페이지 유형별 단가 기준</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">유형</th>
                  <th className="border p-2">단가</th>
                  <th className="border p-2">비고</th>
                </tr>
              </thead>
              <tbody>
                {PAGE_TYPES.map((pt, index) => (
                  <tr key={index}>
                    <td className="border p-2">{pt.type}</td>
                    <td className="border p-2 text-right">
                      {pt.type === "기타" ? "직접 입력" : `${pt.price.toLocaleString()}원`}
                    </td>
                    <td className="border p-2 text-gray-600">{pt.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 버튼 영역 */}
        <div className="flex gap-2 sticky bottom-0 bg-white pt-4 pb-4 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
          >
            {isSaving ? "저장 중..." : currentQuotationId ? "견적서 수정" : "견적서 저장"}
          </button>
          <button
            type="button"
            onClick={handleLoadList}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
          >
            {isLoading ? "불러오는 중..." : "견적서 불러오기"}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isProcessing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
          >
            {isProcessing ? "PDF 생성 중..." : "PDF 다운로드"}
          </button>
          {currentQuotationId && (
            <span className="flex items-center text-sm text-gray-500 ml-2">
              (편집 중인 견적서 ID: {currentQuotationId.slice(0, 8)}...)
            </span>
          )}
        </div>
      </div>

      {/* 우측: 미리보기 화면 */}
      <div className="bg-gray-100 rounded-lg p-4 sticky top-0 h-[calc(100vh-200px)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            PDF 미리보기
            {isGeneratingPdf && (
              <span className="inline-flex items-center gap-1 text-sm font-normal text-gray-500">
                <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            )}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => updatePreview(true)}
              disabled={isRendering}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              {isRendering ? "생성 중..." : "미리보기 만들기"}
            </button>
            {pdfBlob ? (
              <button
                onClick={() => downloadPDF(pdfBlob, project.name)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
              >
                PDF 다운로드
              </button>
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
                {renderedPages.map(({ pageNum }) => (
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

      {/* AI 분석 모달 */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI 페이지 분석
              </h3>
              <button
                onClick={handleCloseAIModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* 프로젝트 설명 입력 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">프로젝트 설명</label>
                <textarea
                  value={aiProjectDescription}
                  onChange={(e) => setAiProjectDescription(e.target.value)}
                  placeholder="프로젝트의 목적, 주요 기능, 필요한 페이지 등을 자세히 설명해주세요..."
                  rows={6}
                  className="w-full px-3 py-2 border rounded-lg resize-none"
                />
              </div>

              {/* 예산 입력 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">예산 (선택)</label>
                <input
                  type="text"
                  value={aiClientBudget}
                  onChange={(e) => setAiClientBudget(e.target.value)}
                  placeholder="예: 5000000"
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">예산을 입력하면 AI가 예산 내에서 페이지를 산정합니다.</p>
              </div>

              {/* 파일 첨부 */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">첨부파일 (선택사항)</label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileAttach}
                  disabled={aiAnalyzing}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
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

              {/* 에러 메시지 */}
              {aiError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {aiError}
                </div>
              )}

              {/* 경고 메시지 */}
              {aiWarning && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                  {aiWarning}
                </div>
              )}

              {/* 분석 결과 */}
              {aiResult && aiResult.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2">분석 결과 ({aiResult.length}개 항목)</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border-b p-2 text-left">#</th>
                          <th className="border-b p-2 text-left">페이지/기능명</th>
                          <th className="border-b p-2 text-left">유형</th>
                          <th className="border-b p-2 text-right">수량</th>
                          <th className="border-b p-2 text-right">단가</th>
                          <th className="border-b p-2 text-right">금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiResult.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border-b p-2">{index + 1}</td>
                            <td className="border-b p-2">{item.name}</td>
                            <td className="border-b p-2">{item.pageType}</td>
                            <td className="border-b p-2 text-right">{item.quantity}</td>
                            <td className="border-b p-2 text-right">{item.unitPrice.toLocaleString()}원</td>
                            <td className="border-b p-2 text-right font-medium">{item.amount.toLocaleString()}원</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-bold">
                        <tr>
                          <td colSpan={5} className="p-2 text-right">합계</td>
                          <td className="p-2 text-right">
                            {aiResult.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}원
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end gap-2">
              <button
                onClick={handleCloseAIModal}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              {aiResult && aiResult.length > 0 ? (
                <button
                  onClick={handleApplyAIResult}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  결과 적용
                </button>
              ) : (
                <button
                  onClick={handleAIAnalysis}
                  disabled={aiAnalyzing}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {aiAnalyzing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      분석 중...
                    </>
                  ) : (
                    "AI 분석 시작"
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 견적서 불러오기 모달 */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">저장된 견적서 목록</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {savedQuotations.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  저장된 견적서가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border p-3 text-left">프로젝트명</th>
                        <th className="border p-3 text-left">클라이언트</th>
                        <th className="border p-3 text-left">버전</th>
                        <th className="border p-3 text-right">금액</th>
                        <th className="border p-3 text-left">생성일</th>
                        <th className="border p-3 text-center">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedQuotations.map((q) => (
                        <tr key={q.id} className="hover:bg-gray-50">
                          <td className="border p-3">{q.projectName}</td>
                          <td className="border p-3">{q.clientName}</td>
                          <td className="border p-3">{q.version}</td>
                          <td className="border p-3 text-right">{q.totalAmount?.toLocaleString() || 0}원</td>
                          <td className="border p-3">
                            {new Date(q.createdAt).toLocaleDateString("ko-KR")}
                          </td>
                          <td className="border p-3">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleLoadQuotation(q.id)}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                              >
                                불러오기
                              </button>
                              <button
                                onClick={() => handleDeleteQuotation(q.id)}
                                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-between">
              <button
                onClick={handleNewQuotation}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                새 견적서 작성
              </button>
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
