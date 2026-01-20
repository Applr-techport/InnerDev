"use client";

import { useState, useRef, useEffect } from "react";

export default function ClaudeAgent() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [githubUrl, setGithubUrl] = useState<string | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [supervisorStatus, setSupervisorStatus] = useState<string | null>(null);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaEmail, setFigmaEmail] = useState("");
  const [figmaPassword, setFigmaPassword] = useState("");
  const [projectType, setProjectType] = useState<"nextjs" | "react-vite">("nextjs");
  const [useScreenshot, setUseScreenshot] = useState(true);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [autoGenerateStatus, setAutoGenerateStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // localStorage에서 저장된 값 불러오기
  useEffect(() => {
    const savedGithubUrl = localStorage.getItem("claude_agent_github_url");
    const savedFigmaUrl = localStorage.getItem("claude_agent_figma_url");
    const savedFigmaEmail = localStorage.getItem("claude_agent_figma_email");
    const savedProjectType = localStorage.getItem("claude_agent_project_type") as "nextjs" | "react-vite" | null;

    if (savedGithubUrl) setGithubRepoUrl(savedGithubUrl);
    if (savedFigmaUrl) setFigmaUrl(savedFigmaUrl);
    if (savedFigmaEmail) setFigmaEmail(savedFigmaEmail);
    if (savedProjectType && (savedProjectType === "nextjs" || savedProjectType === "react-vite")) {
      setProjectType(savedProjectType);
    }
  }, []);

  // 값이 변경될 때마다 localStorage에 저장
  useEffect(() => {
    if (githubRepoUrl) {
      localStorage.setItem("claude_agent_github_url", githubRepoUrl);
    } else {
      localStorage.removeItem("claude_agent_github_url");
    }
  }, [githubRepoUrl]);

  useEffect(() => {
    if (figmaUrl) {
      localStorage.setItem("claude_agent_figma_url", figmaUrl);
    } else {
      localStorage.removeItem("claude_agent_figma_url");
    }
  }, [figmaUrl]);

  useEffect(() => {
    if (figmaEmail) {
      localStorage.setItem("claude_agent_figma_email", figmaEmail);
    } else {
      localStorage.removeItem("claude_agent_figma_email");
    }
  }, [figmaEmail]);

  useEffect(() => {
    localStorage.setItem("claude_agent_project_type", projectType);
  }, [projectType]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 새 세션 시작
  const startNewSession = async () => {
    setShowNewSessionModal(true);
  };

  // 자동 웹사이트 생성
  const handleAutoGenerate = async () => {
    if (!githubRepoUrl.trim() || !figmaUrl.trim()) {
      alert("GitHub URL과 Figma URL을 모두 입력해주세요.");
      return;
    }

    setIsAutoGenerating(true);
    setAutoGenerateStatus("Figma 디자인 분석 중...");
    setShowNewSessionModal(false);

    try {
      const response = await fetch("/api/claude/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUrl: githubRepoUrl.trim(),
          figmaUrl: figmaUrl.trim(),
          figmaEmail: figmaEmail.trim() || undefined,
          figmaPassword: figmaPassword.trim() || undefined,
          projectType,
          useScreenshot,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "자동 생성에 실패했습니다.");
      }

      const data = await response.json();
      setAutoGenerateStatus(`완료! ${data.convertedPages}개 페이지 변환, ${data.totalFiles}개 파일 생성`);
      setGithubUrl(data.githubUrl);
      
      // 세션도 생성하여 대화 가능하게
      const sessionResponse = await fetch("/api/claude/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createNewSession: true,
          message: `Figma 디자인을 분석하여 ${data.convertedPages}개 페이지를 변환하고 GitHub 저장소(${data.githubUrl})에 업로드했습니다.`,
          githubRepoUrl: data.githubUrl,
        }),
      });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setSessionId(sessionData.sessionId);
        setMessages(sessionData.messages || []);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "자동 생성 중 오류가 발생했습니다.");
      setAutoGenerateStatus(null);
    } finally {
      setIsAutoGenerating(false);
      // 비밀번호만 초기화 (다른 값들은 localStorage에 저장되어 있으므로 유지)
      setFigmaPassword("");
    }
  };

  // 세션 생성 확인
  const confirmNewSession = async () => {
    // GitHub URL과 Figma URL이 모두 있으면 자동 생성
    if (githubRepoUrl.trim() && figmaUrl.trim()) {
      await handleAutoGenerate();
      return;
    }

    setIsLoading(true);
    setShowNewSessionModal(false);
    try {
      const response = await fetch("/api/claude/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createNewSession: true,
          message: "안녕하세요! 작업을 시작하겠습니다.",
          githubRepoUrl: githubRepoUrl.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("세션 생성에 실패했습니다.");
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setMessages(data.messages || []);
      setGithubUrl(data.githubRepoUrl || null);
      setDeploymentUrl(null);
      setSupervisorStatus(null);
      
      // GitHub URL이 설정된 경우 표시
      if (data.githubRepoUrl) {
        setGithubUrl(data.githubRepoUrl);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "세션 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      // 비밀번호만 초기화 (다른 값들은 localStorage에 저장되어 있으므로 유지)
      setFigmaPassword("");
    }
  };

  // 메시지 전송
  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionId) return;

    const userMessage = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    // 사용자 메시지 추가
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/claude/worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error("메시지 전송에 실패했습니다.");
      }

      const data = await response.json();
      setMessages(data.messages || []);

      // 세션의 GitHub URL 업데이트
      if (data.githubRepoUrl) {
        setGithubUrl(data.githubRepoUrl);
      }

      // GitHub URL 추출 (Tool 결과에서)
      if (data.toolResults) {
        for (const toolResult of data.toolResults) {
          if (toolResult.toolName === "upload_to_github" && toolResult.toolResult.repoUrl) {
            setGithubUrl(toolResult.toolResult.repoUrl);
          }
        }
      }

      // 메시지에서 URL 추출 시도
      const urlMatch = data.message?.match(/https?:\/\/[^\s]+/g);
      if (urlMatch) {
        for (const url of urlMatch) {
          if (url.includes("github.com")) {
            setGithubUrl(url);
          } else if (url.includes("vercel.app") || url.includes("netlify.app")) {
            setDeploymentUrl(url);
          }
        }
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "메시지 전송 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 클로드2가 작업물 확인
  const checkWithSupervisor = async () => {
    if (!githubUrl && !deploymentUrl) {
      alert("GitHub URL 또는 배포 URL이 필요합니다.");
      return;
    }

    setSupervisorStatus("확인 중...");
    setIsLoading(true);

    try {
      const response = await fetch("/api/claude/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUrl,
          deploymentUrl,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error("작업물 확인에 실패했습니다.");
      }

      const data = await response.json();
      setSupervisorStatus(data.feedback || "확인 완료");

      // 피드백이 클로드1에게 전달되었으면 메시지 새로고침
      if (data.feedbackDelivered && sessionId) {
        const sessionResponse = await fetch(`/api/claude/worker?sessionId=${sessionId}`);
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          setMessages(sessionData.messages || []);
        }
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "작업물 확인 중 오류가 발생했습니다.");
      setSupervisorStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 새 세션 모달 */}
      {showNewSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[600px] max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">새 세션 시작</h2>
            
            {/* GitHub URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                GitHub 저장소 URL (선택사항)
              </label>
              <input
                type="text"
                value={githubRepoUrl}
                onChange={(e) => setGithubRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                기존 저장소에 연동하려면 URL을 입력하세요. 비워두면 새 저장소를 생성합니다.
              </p>
            </div>

            {/* Figma URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Figma URL (선택사항)
              </label>
              <input
                type="text"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/file/..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                GitHub URL과 함께 입력하면 자동으로 Figma 디자인을 분석하고 코드를 생성하여 GitHub에 업로드합니다.
              </p>
            </div>

            {/* Figma 로그인 정보 (Figma URL이 있을 때만 표시) */}
            {figmaUrl.trim() && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Figma 이메일 (선택사항)
                  </label>
                  <input
                    type="email"
                    value={figmaEmail}
                    onChange={(e) => setFigmaEmail(e.target.value)}
                    placeholder="your-email@example.com"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    비공개 Figma 파일에 접근하려면 로그인 정보가 필요합니다.
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Figma 비밀번호 (선택사항)
                  </label>
                  <input
                    type="password"
                    value={figmaPassword}
                    onChange={(e) => setFigmaPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {/* 프로젝트 타입 (Figma URL이 있을 때만 표시) */}
            {figmaUrl.trim() && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  프로젝트 타입
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="nextjs"
                      checked={projectType === "nextjs"}
                      onChange={(e) => setProjectType(e.target.value as "nextjs" | "react-vite")}
                      className="mr-2"
                    />
                    Next.js
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="react-vite"
                      checked={projectType === "react-vite"}
                      onChange={(e) => setProjectType(e.target.value as "nextjs" | "react-vite")}
                      className="mr-2"
                    />
                    React + Vite
                  </label>
                </div>
              </div>
            )}

            {/* 자동 생성 안내 */}
            {githubRepoUrl.trim() && figmaUrl.trim() && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 GitHub URL과 Figma URL이 모두 입력되었습니다. &quot;시작&quot; 버튼을 클릭하면 자동으로 Figma 디자인을 분석하고 코드를 생성하여 GitHub에 업로드합니다.
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewSessionModal(false);
                  // 취소 시에도 값은 유지 (localStorage에 저장되어 있음)
                  setFigmaPassword("");
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={confirmNewSession}
                disabled={isAutoGenerating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isAutoGenerating ? "생성 중..." : "시작"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 자동 생성 상태 표시 */}
      {isAutoGenerating && autoGenerateStatus && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <p className="text-sm">{autoGenerateStatus}</p>
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-white border-b p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Claude Agent System</h1>
          <div className="flex gap-2">
            <button
              onClick={startNewSession}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              새 세션
            </button>
            {(githubUrl || deploymentUrl) && (
              <button
                onClick={checkWithSupervisor}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                클로드2 확인
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 클로드1 대화창 */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-4 border-b bg-blue-50">
            <h2 className="font-semibold text-blue-900">클로드1 (작업자)</h2>
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                GitHub: {githubUrl}
              </a>
            )}
            {deploymentUrl && (
              <a
                href={deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:underline ml-4"
              >
                배포: {deploymentUrl}
              </a>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                새 세션을 시작하여 클로드1과 대화하세요.
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-3xl rounded-lg p-4 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-900"
                    }`}
                  >
                    <div className="text-xs font-semibold mb-1 opacity-75">
                      {msg.role === "user" ? "사용자" : "클로드1"}
                    </div>
                    <div className="whitespace-pre-wrap">{String(msg.content)}</div>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 rounded-lg p-4">
                  <div className="text-xs font-semibold mb-1 opacity-75">클로드1</div>
                  <div className="text-gray-600">작업 중...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="메시지를 입력하세요..."
                disabled={!sessionId || isLoading}
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendMessage}
                disabled={!sessionId || isLoading || !inputMessage.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                전송
              </button>
            </div>
          </div>
        </div>

        {/* 클로드2 감독 패널 */}
        <div className="w-96 bg-gray-100 border-l flex flex-col">
          <div className="p-4 border-b bg-green-50">
            <h2 className="font-semibold text-green-900">클로드2 (감독자)</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {supervisorStatus ? (
              <div className="bg-white rounded-lg p-4">
                <div className="text-sm font-semibold mb-2 text-green-700">피드백</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                  {supervisorStatus}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 mt-8">
                클로드1이 작업물을 GitHub에 업로드한 후<br />
                &quot;클로드2 확인&quot; 버튼을 클릭하세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

