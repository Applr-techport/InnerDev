// Claude 세션 관리 유틸리티

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | any[];
}

export interface ClaudeSession {
  id: string;
  messages: ClaudeMessage[];
  githubRepoUrl?: string; // 연동된 GitHub 저장소 URL
  githubRepoName?: string; // owner/repo 형식
  vercelUrl?: string; // Vercel 배포 URL
  figmaUrl?: string; // Figma 디자인 URL
  lastDeploymentStatus?: "pending" | "building" | "ready" | "error"; // 배포 상태
  lastEvaluationScore?: number; // 마지막 평가 점수 (0-100)
  lastEvaluationDate?: Date; // 마지막 평가 일시
  isCompleted?: boolean; // 작업 완료 여부 (90점 이상)
  createdAt: Date;
  updatedAt: Date;
}

// 메모리 기반 세션 저장소 (실제로는 DB 사용 권장)
const sessions = new Map<string, ClaudeSession>();

/**
 * 새 세션 생성
 */
export function createSession(githubRepoUrl?: string): ClaudeSession {
  const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // GitHub URL에서 owner/repo 추출
  let githubRepoName: string | undefined;
  if (githubRepoUrl) {
    try {
      const url = new URL(githubRepoUrl);
      const pathParts = url.pathname.split("/").filter(p => p);
      if (pathParts.length >= 2) {
        githubRepoName = `${pathParts[0]}/${pathParts[1]}`;
      }
    } catch (e) {
      // URL 파싱 실패 시 무시
    }
  }
  
  const session: ClaudeSession = {
    id,
    messages: [],
    githubRepoUrl,
    githubRepoName,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.set(id, session);
  return session;
}

/**
 * 세션의 GitHub 저장소 정보 업데이트
 */
export function updateSessionGitHub(sessionId: string, githubRepoUrl: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    try {
      const url = new URL(githubRepoUrl);
      const pathParts = url.pathname.split("/").filter(p => p);
      if (pathParts.length >= 2) {
        session.githubRepoUrl = githubRepoUrl;
        session.githubRepoName = `${pathParts[0]}/${pathParts[1]}`;
        session.updatedAt = new Date();
      }
    } catch (e) {
      // URL 파싱 실패 시 무시
    }
  }
}

/**
 * 세션 가져오기
 */
export function getSession(sessionId: string): ClaudeSession | null {
  return sessions.get(sessionId) || null;
}

/**
 * 세션에 메시지 추가
 */
export function addMessage(sessionId: string, message: ClaudeMessage): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.messages.push(message);
    session.updatedAt = new Date();
  }
}

/**
 * 세션 삭제
 */
export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * 세션의 Vercel URL 업데이트
 */
export function updateSessionVercel(sessionId: string, vercelUrl: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.vercelUrl = vercelUrl;
    session.updatedAt = new Date();
  }
}

/**
 * 세션의 Figma URL 업데이트
 */
export function updateSessionFigma(sessionId: string, figmaUrl: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.figmaUrl = figmaUrl;
    session.updatedAt = new Date();
  }
}

/**
 * 세션의 배포 상태 업데이트
 */
export function updateSessionDeploymentStatus(
  sessionId: string,
  status: "pending" | "building" | "ready" | "error"
): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastDeploymentStatus = status;
    session.updatedAt = new Date();
  }
}

/**
 * 세션의 평가 결과 업데이트
 */
export function updateSessionEvaluation(
  sessionId: string,
  score: number,
  isCompleted?: boolean
): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastEvaluationScore = score;
    session.lastEvaluationDate = new Date();
    if (isCompleted !== undefined) {
      session.isCompleted = isCompleted;
    }
    session.updatedAt = new Date();
  }
}

/**
 * GitHub 저장소 이름으로 세션 찾기
 */
export function findSessionByRepo(repoName: string): ClaudeSession | null {
  for (const session of sessions.values()) {
    if (session.githubRepoName === repoName) {
      return session;
    }
  }
  return null;
}

/**
 * 모든 세션 목록 가져오기
 */
export function getAllSessions(): ClaudeSession[] {
  return Array.from(sessions.values());
}

