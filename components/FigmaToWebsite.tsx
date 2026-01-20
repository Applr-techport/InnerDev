"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

// Claude Agent를 동적으로 임포트 (클라이언트 사이드만)
const ClaudeAgentEmbedded = dynamic(() => import("./ClaudeAgentEmbedded"), {
  ssr: false,
});

type Project = {
  id: string;
  name: string;
  figmaUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectDetail = {
  id: string;
  name: string;
  figmaUrl: string;
  fileId: string;
  pages: any[];
  selectedPages: string[];
  convertedPages: Record<string, { code: string; convertedAt: string; evaluation?: any }>;
  status: string;
  lastSavedData: any;
};

type Page = {
  id: string;
  name: string;
  type: string;
};

export default function FigmaToWebsite() {
  // 화면 모드: 'list' | 'project'
  const [mode, setMode] = useState<"list" | "project">("list");
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectDetail | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  
  // 프로젝트 생성/편집 관련
  const [projectName, setProjectName] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  
  // 변환 관련
  const [isConverting, setIsConverting] = useState(false);
  const [convertingPageId, setConvertingPageId] = useState<string | null>(null);
  const [convertedPages, setConvertedPages] = useState<Record<string, { code: string; convertedAt: string; evaluation?: any }>>({});
  const [useScreenshot, setUseScreenshot] = useState<boolean>(true); // 기본값: 스크린샷 방식
  const [figmaEmail, setFigmaEmail] = useState<string>("");
  const [figmaPassword, setFigmaPassword] = useState<string>("");
  const [isGeneratingProject, setIsGeneratingProject] = useState(false);
  const [projectType, setProjectType] = useState<"nextjs" | "react-vite">("nextjs"); // 프로젝트 타입
  
  // 클로드 에이전트 관련
  const [activeTab, setActiveTab] = useState<"convert" | "agent">("convert");
  
  const [error, setError] = useState<string | null>(null);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // 프로젝트 목록 불러오기
  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const response = await fetch("/api/figma/project");
      if (!response.ok) {
        throw new Error("프로젝트 목록을 불러오는데 실패했습니다.");
      }
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로젝트 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // 피그마 URL에서 파일 ID 추출
  const parseFigmaUrl = (url: string) => {
    try {
      // URL 정규화
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http')) {
        normalizedUrl = 'https://' + normalizedUrl;
      }
      
      const urlObj = new URL(normalizedUrl);
      
      // file 또는 design 경로에서 fileId 추출
      const pathParts = urlObj.pathname.split("/").filter(p => p);
      
      // /file/ 또는 /design/ 다음의 fileId 찾기
      const fileIndex = pathParts.findIndex(p => p === 'file' || p === 'design');
      if (fileIndex !== -1 && pathParts[fileIndex + 1]) {
        const fileId = pathParts[fileIndex + 1];
        // 쿼리 파라미터나 슬래시 전까지만 추출
        const cleanFileId = fileId.split('/')[0].split('?')[0];
        // 최소 10자리 이상이면 유효한 것으로 간주 (실제로는 Figma 접근 시 확인)
        if (cleanFileId.length >= 10 && /^[a-zA-Z0-9]+$/.test(cleanFileId)) {
          return { fileId: cleanFileId };
        }
      }
      
      // 대안: 정규식으로 직접 추출
      const match = normalizedUrl.match(/(?:www\.)?figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/i);
      if (match && match[1]) {
        const cleanFileId = match[1].split('/')[0].split('?')[0];
        if (cleanFileId.length >= 10) {
          return { fileId: cleanFileId };
        }
      }
      
      throw new Error("유효하지 않은 피그마 URL입니다. Figma 파일 URL 형식: https://www.figma.com/file/파일ID/프로젝트명 또는 https://www.figma.com/design/파일ID/프로젝트명");
    } catch (e) {
      if (e instanceof Error && e.message.includes("유효하지 않은")) {
        throw e;
      }
      throw new Error("유효하지 않은 피그마 URL입니다. Figma 파일 URL 형식: https://www.figma.com/file/파일ID/프로젝트명 또는 https://www.figma.com/design/파일ID/프로젝트명");
    }
  };

  // 프로젝트 생성
  const handleCreateProject = async () => {
    if (!projectName.trim() || !figmaUrl.trim()) {
      setError("프로젝트 이름과 피그마 링크를 입력해주세요.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { fileId } = parseFigmaUrl(figmaUrl);
      if (!fileId) {
        throw new Error("피그마 파일 ID를 찾을 수 없습니다.");
      }

      // 피그마 분석 (Playwright 사용)
      const analyzeResponse = await fetch("/api/figma/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          figmaUrl,
          fileId,
          email: figmaEmail || undefined,
          password: figmaPassword || undefined,
        }),
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || "피그마 디자인 분석에 실패했습니다.");
      }

      const analyzeData = await analyzeResponse.json();
      const pagesList = analyzeData.pages || [];

      // 프로젝트 생성
      const createResponse = await fetch("/api/figma/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          figmaUrl,
          fileId,
          pages: pagesList,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "프로젝트 생성에 실패했습니다.");
      }

      const { id } = await createResponse.json();
      
      // 프로젝트 상세 불러오기
      await loadProjectDetail(id);
      
      setProjectName("");
      setFigmaUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로젝트 생성 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 프로젝트 상세 불러오기
  const loadProjectDetail = async (projectId: string) => {
    try {
      const response = await fetch(`/api/figma/project/${projectId}`);
      if (!response.ok) {
        throw new Error("프로젝트를 불러오는데 실패했습니다.");
      }
      const data = await response.json();
      setCurrentProject(data);
      setPages(data.pages || []);
      setSelectedPages(data.selectedPages || []);
      setConvertedPages(data.convertedPages || {});
      setFigmaUrl(data.figmaUrl);
      setMode("project");
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로젝트를 불러오는 중 오류가 발생했습니다.");
    }
  };

  // 자동 저장
  const autoSave = useCallback(async () => {
    if (!currentProject) return;

    try {
      await fetch(`/api/figma/project/${currentProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedPages,
          convertedPages,
          lastSavedData: {
            selectedPages,
            convertedPages,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    } catch (err) {
      console.error("자동 저장 실패:", err);
    }
  }, [currentProject, selectedPages, convertedPages]);

  // 자동 저장 트리거 (debounce)
  useEffect(() => {
    if (!currentProject) return;

    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    const timer = setTimeout(() => {
      autoSave();
    }, 2000); // 2초 후 저장

    setAutoSaveTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [selectedPages, convertedPages, currentProject, autoSave]);

  // 페이지 선택 토글
  const togglePageSelection = (pageId: string) => {
    setSelectedPages((prev) => {
      if (prev.includes(pageId)) {
        return prev.filter((id) => id !== pageId);
      } else {
        return [...prev, pageId];
      }
    });
  };

  // 페이지 변환
  const handleConvertPage = async (pageId: string) => {
    if (!currentProject) return;

    setIsConverting(true);
    setConvertingPageId(pageId);
    setError(null);

    try {
      let convertResponse;

      if (useScreenshot) {
        // 스크린샷 방식
        // 1. 스크린샷 캡처
        const screenshotResponse = await fetch("/api/figma/screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            figmaUrl: currentProject.figmaUrl,
            pageId,
            nodeId: pageId,
            email: figmaEmail || undefined,
            password: figmaPassword || undefined,
          }),
        });

        if (!screenshotResponse.ok) {
          const errorData = await screenshotResponse.json();
          throw new Error(errorData.error || "스크린샷 캡처에 실패했습니다.");
        }

        const { screenshot } = await screenshotResponse.json();

        // 2. 스크린샷으로 변환
        convertResponse = await fetch("/api/figma/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            useScreenshot: true,
            screenshot,
            pageId,
          }),
        });
      } else {
        // 기존 JSON 방식
        // 선택한 페이지의 노드만 가져오기
        const analyzeResponse = await fetch("/api/figma/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: currentProject.fileId,
            nodeId: pageId,
          }),
        });

        if (!analyzeResponse.ok) {
          const errorData = await analyzeResponse.json();
          throw new Error(errorData.error || "피그마 디자인 분석에 실패했습니다.");
        }

        const analyzeData = await analyzeResponse.json();

        // 변환 API 호출
        convertResponse = await fetch("/api/figma/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            figmaData: analyzeData,
            pageId,
            useScreenshot: false,
          }),
        });
      }

      if (!convertResponse.ok) {
        const errorData = await convertResponse.json();
        throw new Error(errorData.error || "React 컴포넌트 생성에 실패했습니다.");
      }

      const { code, evaluation } = await convertResponse.json();

      // 변환 결과 저장 (평가 결과 포함)
      const newConvertedPages = {
        ...convertedPages,
        [pageId]: {
          code,
          convertedAt: new Date().toISOString(),
          evaluation: evaluation || null,
        },
      };
      setConvertedPages(newConvertedPages);

      // 프로젝트 업데이트
      await fetch(`/api/figma/project/${currentProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convertedPages: newConvertedPages,
          status: "converting",
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "페이지 변환 중 오류가 발생했습니다.");
    } finally {
      setIsConverting(false);
      setConvertingPageId(null);
    }
  };

  // 프로젝트 삭제
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("정말 이 프로젝트를 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(`/api/figma/project/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("프로젝트 삭제에 실패했습니다.");
      }

      await loadProjects();
      if (currentProject?.id === projectId) {
        setMode("list");
        setCurrentProject(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로젝트 삭제 중 오류가 발생했습니다.");
    }
  };

  // 완전한 프로젝트 생성 및 배포
  const handleGenerateProject = async () => {
    if (!currentProject || Object.keys(convertedPages).length === 0) {
      setError("변환된 페이지가 없습니다.");
      return;
    }

    setIsGeneratingProject(true);
    setError(null);

    try {
      const response = await fetch("/api/figma/generate-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: currentProject.name,
          convertedPages,
          projectType, // 프로젝트 타입 전달
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "프로젝트 생성에 실패했습니다.");
      }

      const { deploymentUrl, githubUrl, files, zipBase64, message, evaluation } = await response.json();

      // 평가 결과 표시
      let evaluationMessage = "";
      if (evaluation) {
        evaluationMessage = `\n\n평가 결과:\n- 총점: ${evaluation.totalScore}/100\n- 배포 가능: ${evaluation.releaseReady ? "예" : "아니오"}`;
        if (evaluation.blockers && evaluation.blockers.length > 0) {
          evaluationMessage += `\n- 심각한 오류: ${evaluation.blockers.length}개`;
        }
        if (evaluation.improvements && evaluation.improvements.length > 0) {
          evaluationMessage += `\n- 개선 제안: ${evaluation.improvements.length}개`;
        }
      }

      if (deploymentUrl) {
        // Vercel 배포 성공
        alert(`프로젝트가 생성되고 Vercel에 배포되었습니다!${evaluationMessage}\n\n배포 URL: ${deploymentUrl}\nGitHub: ${githubUrl || "N/A"}`);
        
        // 배포 URL을 새 창에서 열기
        window.open(deploymentUrl, "_blank");
      } else if (zipBase64) {
        // ZIP 파일 다운로드 (배포 실패 시)
        const zipBlob = new Blob(
          [Uint8Array.from(atob(zipBase64), (c) => c.charCodeAt(0))],
          { type: "application/zip" }
        );
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentProject.name.replace(/[^a-z0-9-]/gi, "-")}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`프로젝트가 생성되었습니다! ${files.length}개의 파일이 포함되어 있습니다.${evaluationMessage}\n\n배포에 실패하여 ZIP 파일로 다운로드됩니다.`);
      } else {
        alert((message || `프로젝트가 생성되었습니다! ${files?.length || 0}개의 파일이 포함되어 있습니다.`) + evaluationMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로젝트 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingProject(false);
    }
  };

  // 프로젝트 목록 화면
  if (mode === "list") {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">피그마 웹사이트 변환기</h1>
          <button
            onClick={() => {
              setMode("project");
              setCurrentProject(null);
              setProjectName("");
              setFigmaUrl("");
              setPages([]);
              setSelectedPages([]);
              setConvertedPages({});
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            새 프로젝트
          </button>
        </div>

        {isLoadingProjects ? (
          <div className="text-center py-8">로딩 중...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            프로젝트가 없습니다. 새 프로젝트를 생성해주세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => loadProjectDetail(project.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold">{project.name}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    삭제
                  </button>
                </div>
                <p className="text-sm text-gray-500 mb-2 truncate">{project.figmaUrl}</p>
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span>상태: {project.status}</span>
                  <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  // 프로젝트 작업 화면
  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => {
              setMode("list");
              setCurrentProject(null);
            }}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← 프로젝트 목록
          </button>
          <h1 className="text-3xl font-bold">
            {currentProject ? currentProject.name : "새 프로젝트"}
          </h1>
        </div>
      </div>

      {/* 탭 메뉴 (프로젝트가 있을 때만 표시) */}
      {currentProject && (
        <div className="mb-4 border-b">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("convert")}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === "convert"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              페이지 변환
            </button>
            <button
              onClick={() => setActiveTab("agent")}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === "agent"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Claude Agent
            </button>
          </div>
        </div>
      )}

      {/* Claude Agent 탭 */}
      {currentProject && activeTab === "agent" && (
        <div className="bg-white rounded-lg shadow">
          <ClaudeAgentEmbedded 
            figmaUrl={figmaUrl}
            projectName={currentProject.name}
          />
        </div>
      )}

      {/* 페이지 변환 탭 */}
      {(activeTab === "convert" || !currentProject) && (
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        {!currentProject ? (
          // 새 프로젝트 생성
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">프로젝트 이름</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="프로젝트 이름을 입력하세요"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">피그마 링크</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  placeholder="https://www.figma.com/file/..."
                  className="flex-1 px-3 py-2 border rounded-lg"
                  disabled={isAnalyzing}
                />
                <button
                  onClick={handleCreateProject}
                  disabled={isAnalyzing || !projectName.trim() || !figmaUrl.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? "분석 중..." : "프로젝트 생성"}
                </button>
              </div>
            </div>
          </>
        ) : (
          // 기존 프로젝트 작업
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">피그마 링크</label>
              <input
                type="text"
                value={figmaUrl}
                readOnly
                className="w-full px-3 py-2 border rounded-lg bg-gray-50"
              />
            </div>

            {pages.length > 0 && (
              <div className="mb-4">
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium mb-2">변환 방식 선택</label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="convertMode"
                        checked={useScreenshot}
                        onChange={() => setUseScreenshot(true)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        스크린샷 방식 (권장) - 비용 절감, Rate Limit 안전
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="convertMode"
                        checked={!useScreenshot}
                        onChange={() => setUseScreenshot(false)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        JSON 방식 - 구조 정보 활용
                      </span>
                    </label>
                  </div>
                  {useScreenshot && (
                    <div className="mt-3 space-y-2 text-xs text-gray-600">
                      <p>스크린샷 방식은 비공개 파일의 경우 로그인이 필요할 수 있습니다.</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={figmaEmail}
                          onChange={(e) => setFigmaEmail(e.target.value)}
                          placeholder="피그마 이메일 (선택사항)"
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        />
                        <input
                          type="password"
                          value={figmaPassword}
                          onChange={(e) => setFigmaPassword(e.target.value)}
                          placeholder="피그마 비밀번호 (선택사항)"
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        공개 파일은 로그인 없이 사용 가능합니다.
                      </p>
                    </div>
                  )}
                </div>
                <label className="block text-sm font-medium mb-2">
                  작업할 페이지 선택 ({selectedPages.length}개 선택됨)
                </label>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                  {pages.map((page) => (
                    <div key={page.id} className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id={page.id}
                        checked={selectedPages.includes(page.id)}
                        onChange={() => togglePageSelection(page.id)}
                        className="w-4 h-4"
                      />
                      <label htmlFor={page.id} className="flex-1 cursor-pointer">
                        {page.name}
                      </label>
                      {convertedPages[page.id] && (
                        <div className="flex items-center gap-2">
                          {convertedPages[page.id].evaluation ? (
                            <>
                              {convertedPages[page.id].evaluation.passed ? (
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                  ✓ 통과 ({convertedPages[page.id].evaluation.score}점)
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                  ✗ 미통과 ({convertedPages[page.id].evaluation.score}점)
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-green-600">✓ 변환 완료</span>
                          )}
                        </div>
                      )}
                      {selectedPages.includes(page.id) && !convertedPages[page.id] && (
                        <button
                          onClick={() => handleConvertPage(page.id)}
                          disabled={isConverting && convertingPageId === page.id}
                          className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                        >
                          {isConverting && convertingPageId === page.id ? "변환 중..." : "변환"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(convertedPages).length > 0 && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">변환된 페이지</label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">프로젝트 타입:</label>
                      <select
                        value={projectType}
                        onChange={(e) => setProjectType(e.target.value as "nextjs" | "react-vite")}
                        className="px-3 py-1 border rounded-lg text-sm"
                        disabled={isGeneratingProject}
                      >
                        <option value="nextjs">Next.js</option>
                        <option value="react-vite">React + Vite</option>
                      </select>
                    </div>
                    <button
                      onClick={handleGenerateProject}
                      disabled={isGeneratingProject}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {isGeneratingProject ? "프로젝트 생성 중..." : "완전한 프로젝트 생성"}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(convertedPages).map(([pageId, pageData]: [string, any]) => {
                    const page = pages.find((p) => p.id === pageId);
                    const evaluation = pageData.evaluation;
                    return (
                      <div key={pageId} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{page?.name || pageId}</h4>
                              {evaluation && (
                                <>
                                  {evaluation.passed ? (
                                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-semibold">
                                      ✓ 통과
                                    </span>
                                  ) : (
                                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">
                                      ✗ 미통과
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    총점: {evaluation.score}점
                                  </span>
                                </>
                              )}
                            </div>
                            {evaluation && (
                              <div className="mt-2 space-y-1 text-xs">
                                <div className="flex gap-4">
                                  <span className={evaluation.categories.codeQuality.passed ? "text-green-600" : "text-red-600"}>
                                    코드 품질: {evaluation.categories.codeQuality.score}점
                                  </span>
                                  <span className={evaluation.categories.designAccuracy.passed ? "text-green-600" : "text-red-600"}>
                                    디자인 정확도: {evaluation.categories.designAccuracy.score}점
                                  </span>
                                  <span className={evaluation.categories.functionality.passed ? "text-green-600" : "text-red-600"}>
                                    기능 완성도: {evaluation.categories.functionality.score}점
                                  </span>
                                </div>
                                {evaluation.overallFeedback && (
                                  <p className="text-gray-600 mt-1">{evaluation.overallFeedback}</p>
                                )}
                                {(evaluation.categories.codeQuality.issues.length > 0 ||
                                  evaluation.categories.designAccuracy.issues.length > 0 ||
                                  evaluation.categories.functionality.issues.length > 0) && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                      이슈 및 제안 보기
                                    </summary>
                                    <div className="mt-2 pl-4 space-y-2">
                                      {evaluation.categories.codeQuality.issues.length > 0 && (
                                        <div>
                                          <strong className="text-red-600">코드 품질 이슈:</strong>
                                          <ul className="list-disc list-inside ml-2">
                                            {evaluation.categories.codeQuality.issues.map((issue: string, idx: number) => (
                                              <li key={idx}>{issue}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {evaluation.categories.designAccuracy.issues.length > 0 && (
                                        <div>
                                          <strong className="text-red-600">디자인 정확도 이슈:</strong>
                                          <ul className="list-disc list-inside ml-2">
                                            {evaluation.categories.designAccuracy.issues.map((issue: string, idx: number) => (
                                              <li key={idx}>{issue}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {evaluation.categories.functionality.issues.length > 0 && (
                                        <div>
                                          <strong className="text-red-600">기능 완성도 이슈:</strong>
                                          <ul className="list-disc list-inside ml-2">
                                            {evaluation.categories.functionality.issues.map((issue: string, idx: number) => (
                                              <li key={idx}>{issue}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      {(evaluation.categories.codeQuality.suggestions.length > 0 ||
                                        evaluation.categories.designAccuracy.suggestions.length > 0 ||
                                        evaluation.categories.functionality.suggestions.length > 0) && (
                                        <div className="mt-2">
                                          <strong className="text-blue-600">개선 제안:</strong>
                                          <ul className="list-disc list-inside ml-2">
                                            {[
                                              ...evaluation.categories.codeQuality.suggestions,
                                              ...evaluation.categories.designAccuracy.suggestions,
                                              ...evaluation.categories.functionality.suggestions,
                                            ].map((suggestion: string, idx: number) => (
                                              <li key={idx}>{suggestion}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {evaluation && (
                              <button
                                onClick={async () => {
                                  // 재평가 기능 (다음 단계에서 구현)
                                  setIsConverting(true);
                                  setConvertingPageId(pageId);
                                  try {
                                    const evaluateResponse = await fetch("/api/figma/evaluate", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        code: pageData.code,
                                        figmaData: { document: {} }, // 필요시 원본 데이터 전달
                                        pageId,
                                      }),
                                    });
                                    if (evaluateResponse.ok) {
                                      const newEvaluation = await evaluateResponse.json();
                                      const updatedPages = {
                                        ...convertedPages,
                                        [pageId]: {
                                          ...pageData,
                                          evaluation: newEvaluation,
                                        },
                                      };
                                      setConvertedPages(updatedPages);
                                      await fetch(`/api/figma/project/${currentProject?.id}`, {
                                        method: "PUT",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ convertedPages: updatedPages }),
                                      });
                                    }
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : "재평가 중 오류가 발생했습니다.");
                                  } finally {
                                    setIsConverting(false);
                                    setConvertingPageId(null);
                                  }
                                }}
                                disabled={isConverting && convertingPageId === pageId}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                재평가
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const blob = new Blob([pageData.code], { type: "text/javascript" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `${page?.name || "component"}.tsx`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                            >
                              다운로드
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={pageData.code}
                          readOnly
                          rows={10}
                          className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
