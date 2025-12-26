"use client";

import { useState, useEffect, useRef } from "react";
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

export default function QuotationGenerator() {
  const [company, setCompany] = useState<CompanyInfo>({
    name: "APPLR",
    address: "경기도 성남시 분당구 판교역로 192번길 16, 8층 806호",
    businessNumber: "689-81-03094",
    representative: "이경희",
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
    { writer: "", version: "", date: "", note: "" },
  ]);

  const [milestones, setMilestones] = useState<MilestoneItem[]>([
    { depth1: "", depth2: "", depth3: "", planning: 0, server: 0, flutter: 0, web: 0, text: 0, pm: 0, total: 0 },
  ]);

  const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([
    { category: "", grade: "", basePrice: 0, mm: 0, mmCost: 0, discountRate: 0, discountedAmount: 0 },
  ]);

  const [discountRate, setDiscountRate] = useState<number>(35);
  const [workPeriod, setWorkPeriod] = useState<string>("5개월");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedPages, setRenderedPages] = useState<Array<{ pageNum: number; canvas: HTMLCanvasElement }>>([]);

  // Milestone Total 자동 계산
  const calculateMilestoneTotal = (item: MilestoneItem): number => {
    return item.planning + item.server + item.flutter + item.web + item.text + item.pm;
  };

  // Quotation 자동 계산
  const calculateQuotationItem = (item: QuotationItem): QuotationItem => {
    const mmCost = item.basePrice * item.mm;
    const discountedAmount = mmCost * (1 - discountRate / 100);
    const total = calculateMilestoneTotal(
      milestones.find((m) => m.depth1 === item.category) || milestones[0]
    );
    return {
      ...item,
      mmCost,
      discountedAmount,
    };
  };

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
      { depth1: "", depth2: "", depth3: "", planning: 0, server: 0, flutter: 0, web: 0, text: 0, pm: 0, total: 0 },
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

  const handleAddQuotation = () => {
    setQuotationItems([
      ...quotationItems,
      { category: "", grade: "", basePrice: 0, mm: 0, mmCost: 0, discountRate: 0, discountedAmount: 0 },
    ]);
  };

  const handleRemoveQuotation = (index: number) => {
    setQuotationItems(quotationItems.filter((_, i) => i !== index));
  };

  const handleQuotationChange = (index: number, field: keyof QuotationItem, value: string | number) => {
    const newItems = [...quotationItems];
    newItems[index] = { ...newItems[index], [field]: value };
    const calculated = calculateQuotationItem(newItems[index]);
    newItems[index] = calculated;
    setQuotationItems(newItems);
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
      gradeInfo: [],
      discountRate,
      workPeriod,
      totalAmount,
      vatIncluded: true,
    };
  };

  const updatePreview = async () => {
    try {
      setError(null);
      setIsRendering(true);
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
      if (pdfDocument && canvasRef.current) {
        try {
          console.log("Canvas에 PDF 렌더링 시작...");
          const container = canvasRef.current.parentElement;
          const containerWidth = container ? container.clientWidth - 32 : 800; // padding 고려
          
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
          
          // 렌더링된 canvas를 DOM에 추가
          pages.forEach(({ pageNum, canvas }) => {
            const container = document.getElementById(`pdf-page-${pageNum}`);
            if (container) {
              container.innerHTML = '';
              container.appendChild(canvas);
            }
          });
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
    renderedPages.forEach(({ pageNum, canvas }) => {
      const container = document.getElementById(`pdf-page-${pageNum}`);
      if (container && !container.querySelector('canvas')) {
        container.innerHTML = '';
        container.appendChild(canvas);
      }
    });
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
          <div>
            <label className="block text-sm font-medium mb-1">유효기간 (일)</label>
            <input
              type="number"
              value={project.validityDays}
              onChange={(e) => setProject({ ...project, validityDays: parseInt(e.target.value) || 14 })}
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
                      className="px-2 py-1 bg-red-500 text-white rounded text-sm"
                    >
                      삭제
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
          <button
            onClick={handleAddMilestone}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            행 추가
          </button>
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
                <th className="border p-2">Flutter</th>
                <th className="border p-2">Web</th>
                <th className="border p-2">Text</th>
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
                      value={item.flutter}
                      onChange={(e) => handleMilestoneChange(index, "flutter", parseFloat(e.target.value) || 0)}
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
                      className="px-2 py-1 bg-red-500 text-white rounded text-sm"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 견적서 테이블 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">견적서</h2>
          <div className="flex gap-4 items-center">
            <label className="text-sm">
              할인률:{" "}
              <input
                type="number"
                value={discountRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value) || 0;
                  setDiscountRate(rate);
                  // 모든 견적 항목 재계산
                  setQuotationItems(quotationItems.map((item) => calculateQuotationItem({ ...item, discountRate: rate })));
                }}
                className="w-20 px-2 py-1 border rounded"
              />
              %
            </label>
            <button
              onClick={handleAddQuotation}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              행 추가
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">업무</th>
                <th className="border p-2">등급</th>
                <th className="border p-2">기본단가</th>
                <th className="border p-2">M/M계</th>
                <th className="border p-2">M/M 비용</th>
                <th className="border p-2">할인금액</th>
                <th className="border p-2">삭제</th>
              </tr>
            </thead>
            <tbody>
              {quotationItems.map((item, index) => (
                <tr key={index}>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.category}
                      onChange={(e) => handleQuotationChange(index, "category", e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="text"
                      value={item.grade}
                      onChange={(e) => handleQuotationChange(index, "grade", e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="number"
                      value={item.basePrice}
                      onChange={(e) => handleQuotationChange(index, "basePrice", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">
                    <input
                      type="number"
                      step="0.01"
                      value={item.mm}
                      onChange={(e) => handleQuotationChange(index, "mm", parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                  <td className="border p-2">{item.mmCost.toLocaleString()}</td>
                  <td className="border p-2 font-bold">{item.discountedAmount.toLocaleString()}</td>
                  <td className="border p-2">
                    <button
                      onClick={() => handleRemoveQuotation(index)}
                      className="px-2 py-1 bg-red-500 text-white rounded text-sm"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={5} className="border p-2 text-right">합계</td>
                <td className="border p-2">{totalQuotation.toLocaleString()}</td>
                <td className="border p-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 프로젝트 제안가 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">프로젝트 제안가</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">작업기간</label>
            <input
              type="text"
              value={workPeriod}
              onChange={(e) => setWorkPeriod(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">총액</label>
            <div className="text-2xl font-bold text-red-600">
              {totalQuotation.toLocaleString()}원
            </div>
          </div>
        </div>
      </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 생성 버튼 */}
        <div className="flex justify-end sticky bottom-0 bg-white pt-4 pb-4">
          <button
            onClick={handleGenerate}
            disabled={isProcessing}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold"
          >
            {isProcessing ? "PDF 생성 중..." : "견적서 PDF 다운로드"}
          </button>
        </div>
      </div>

      {/* 우측: 미리보기 화면 */}
      <div className="bg-gray-100 rounded-lg p-4 sticky top-0 h-[calc(100vh-200px)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">PDF 미리보기</h2>
          <div className="flex gap-2">
            <button
              onClick={updatePreview}
              disabled={isRendering}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
            >
              {isRendering ? "생성 중..." : "미리보기 만들기"}
            </button>
            {previewUrl && (
              <a
                href={previewUrl}
                download="test-preview.pdf"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold no-underline"
              >
                PDF 다운로드
              </a>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-lg h-[calc(100%-60px)] overflow-auto">
          {isRendering ? (
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
    </div>
  );
}

