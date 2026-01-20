import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSession, getSession, addMessage, type ClaudeSession } from "@/lib/claudeSession";
import { uploadToGitHub, type GitHubFile } from "@/lib/githubUploader";
import { executeCode, analyzeCode } from "@/lib/codeInterpreter";

// 클로드1 Tool 정의
const workerTools: any[] = [
  {
    name: "upload_to_github",
    description: "작업물을 GitHub 저장소에 업로드합니다. 코드나 파일을 생성한 후 이 도구를 사용하여 GitHub에 커밋 및 푸시하세요.",
    input_schema: {
      type: "object",
      properties: {
        projectName: {
          type: "string",
          description: "프로젝트 이름 (GitHub 저장소 이름으로 사용됨)",
        },
        files: {
          type: "array",
          description: "업로드할 파일 목록",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
          },
        },
        description: {
          type: "string",
          description: "저장소 설명 (선택사항)",
        },
      },
      required: ["projectName", "files"],
    },
  },
  {
    name: "execute_code",
    description: "코드를 실행하고 결과를 확인합니다. 코드를 테스트하거나 검증할 때 사용하세요.",
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "실행할 코드",
        },
        language: {
          type: "string",
          description: "코드 언어 (javascript, typescript, python 등)",
          enum: ["javascript", "typescript", "python", "bash"],
        },
      },
      required: ["code", "language"],
    },
  },
  {
    name: "analyze_code",
    description: "코드를 분석하고 구문 오류, 경고, 개선 제안을 제공합니다.",
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "분석할 코드",
        },
        language: {
          type: "string",
          description: "코드 언어 (javascript, typescript 등)",
          enum: ["javascript", "typescript"],
        },
      },
      required: ["code", "language"],
    },
  },
];

// Tool 실행 함수
async function executeWorkerTool(
  toolName: string,
  input: any,
  session?: ClaudeSession
): Promise<any> {
  switch (toolName) {
    case "upload_to_github":
      // 세션에 연동된 GitHub 저장소가 있으면 사용, 없으면 새로 생성
      const existingRepoName = session?.githubRepoName;
      const result = await uploadToGitHub(
        input.projectName,
        input.files as GitHubFile[],
        input.description,
        existingRepoName
      );
      
      // GitHub 업로드 성공 시 배포 상태 확인 트리거 (비동기)
      if (result.success && result.repoName && session) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        // 10초 후 배포 상태 확인 시작
        setTimeout(async () => {
          try {
            await fetch(`${baseUrl}/api/claude/check-deployment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: session.id,
                repoName: result.repoName,
              }),
            });
          } catch (error) {
            console.error("배포 상태 확인 실패:", error);
          }
        }, 10000);
      }
      
      return result;

    case "execute_code":
      const executionResult = await executeCode(
        input.code,
        input.language || "javascript"
      );
      return executionResult;

    case "analyze_code":
      const analysisResult = await analyzeCode(
        input.code,
        input.language || "javascript"
      );
      return analysisResult;

    default:
      return { error: `알 수 없는 도구: ${toolName}` };
  }
}

// POST: 새 메시지 전송
export async function POST(request: NextRequest) {
  try {
    const { sessionId, message, createNewSession, githubRepoUrl } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: "메시지가 필요합니다." },
        { status: 400 }
      );
    }

    // Claude API 키 확인
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 세션 관리
    let session: ClaudeSession;
    if (createNewSession || !sessionId) {
      session = createSession(githubRepoUrl);
    } else {
      const existingSession = getSession(sessionId);
      if (!existingSession) {
        return NextResponse.json(
          { error: "세션을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      session = existingSession;
      
      // GitHub 저장소 URL 업데이트 (제공된 경우)
      if (githubRepoUrl && githubRepoUrl !== session.githubRepoUrl) {
        const { updateSessionGitHub } = await import("@/lib/claudeSession");
        updateSessionGitHub(sessionId, githubRepoUrl);
        session = getSession(sessionId)!;
      }
    }

    // Claude 클라이언트 초기화
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // 클로드2의 피드백이 있는지 확인
    const hasFeedback = session.messages.some(
      (msg) => msg.role === "user" && 
      typeof msg.content === "string" && 
      msg.content.includes("[클로드2")
    );

    // 시스템 프롬프트
    let systemPrompt = `당신은 클로드1 (작업자)입니다. 사용자의 요청에 따라 코드를 생성하고 작업을 수행합니다.

주요 역할:
- 코드 생성 및 수정
- 파일 생성 및 관리
- 코드 실행 및 검증 (Code Interpreter 사용)
- 작업물을 GitHub에 업로드

사용 가능한 도구:
1. execute_code: 코드를 실행하고 결과를 확인합니다. 코드를 테스트하거나 검증할 때 사용하세요.
2. analyze_code: 코드를 분석하고 구문 오류, 경고, 개선 제안을 제공합니다.
3. upload_to_github: 작업물을 GitHub 저장소에 업로드합니다.

중요 규칙:
- 코드를 생성한 후에는 execute_code 또는 analyze_code 도구를 사용하여 검증하세요.
- 코드가 올바르게 작동하는지 확인한 후 GitHub에 업로드하세요.
- 작업물을 생성한 후에는 반드시 upload_to_github 도구를 사용하여 GitHub에 업로드하세요.
- GitHub 저장소 URL을 사용자에게 제공하세요.
- 모든 파일은 완전한 코드여야 합니다.
- TypeScript 타입을 올바르게 사용하세요.
- 코드 실행 결과를 확인하여 오류가 없도록 하세요.`;

    // 클로드2의 피드백이 있으면 추가 지시
    if (hasFeedback) {
      systemPrompt += `\n\n중요: 클로드2 (감독자)로부터 피드백을 받았습니다. 피드백의 보완사항을 반영하여 코드를 수정하고 다시 GitHub에 업로드하세요.`;
    }

    // 메시지 히스토리 구성
    const messages: any[] = session.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // 새 사용자 메시지 추가
    messages.push({
      role: "user",
      content: message,
    });

    // 세션에 메시지 저장
    addMessage(session.id, {
      role: "user",
      content: message,
    });

    // Claude에게 메시지 전송
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 16384,
      tools: workerTools,
      system: systemPrompt,
      messages: messages,
    });

    // 응답 처리
    let assistantMessage: any = null;
    let toolResults: any[] = [];

    for (const content of response.content) {
      if (content.type === "text") {
        assistantMessage = content.text;
        addMessage(session.id, {
          role: "assistant",
          content: content.text,
        });
      } else if (content.type === "tool_use") {
        // Tool 실행
        const toolResult = await executeWorkerTool(content.name, content.input, session);

        toolResults.push({
          toolName: content.name,
          toolInput: content.input,
          toolResult,
        });

        // Tool 결과를 메시지에 추가
        addMessage(session.id, {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: content.id,
              name: content.name,
              input: content.input,
            },
          ],
        });

        addMessage(session.id, {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: content.id,
              content: JSON.stringify(toolResult),
            },
          ],
        });
      }
    }

    // 세션 정보 다시 가져오기 (업데이트된 정보 포함)
    const updatedSession = getSession(session.id);

    return NextResponse.json({
      sessionId: session.id,
      message: assistantMessage,
      toolResults,
      messages: updatedSession?.messages || session.messages,
      githubRepoUrl: updatedSession?.githubRepoUrl || session.githubRepoUrl,
      githubRepoName: updatedSession?.githubRepoName || session.githubRepoName,
    });
  } catch (error) {
    console.error("클로드1 작업 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "작업 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

// GET: 세션 정보 가져오기
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId가 필요합니다." },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      messages: session.messages,
      githubRepoUrl: session.githubRepoUrl,
      githubRepoName: session.githubRepoName,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error("세션 조회 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "세션 조회 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

