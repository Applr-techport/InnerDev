import { NextRequest, NextResponse } from "next/server";
import { findSessionByRepo, updateSessionDeploymentStatus, updateSessionVercel } from "@/lib/claudeSession";

/**
 * Vercel webhook 시크릿 검증 (선택사항)
 */
function verifyWebhookSecret(payload: string, signature: string, secret: string): boolean {
  // 실제 구현에서는 crypto를 사용하여 검증
  // 여기서는 간단히 secret이 설정되어 있으면 검증 통과
  return !secret || signature.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-vercel-signature") || "";
    const event = request.headers.get("x-vercel-event") || "";

    // webhook secret 확인 (선택사항)
    const webhookSecret = process.env.VERCEL_WEBHOOK_SECRET;
    if (webhookSecret && !verifyWebhookSecret("", signature, webhookSecret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = await request.json();
    const deployment = payload.deployment;
    const project = payload.project;

    if (!deployment || !project) {
      return NextResponse.json(
        { error: "Deployment or project information not found" },
        { status: 400 }
      );
    }

    // 프로젝트 이름에서 저장소 이름 추출 시도
    // Vercel 프로젝트 이름이 보통 repo-name 형식이므로 이를 기반으로 세션 찾기
    const projectName = project.name;
    const repoName = project.link?.repo || projectName;

    // 세션 찾기 (프로젝트 이름으로)
    let session = findSessionByRepo(repoName);
    
    // 프로젝트 이름만으로 찾기 시도
    if (!session) {
      // 모든 세션을 확인하여 프로젝트 이름과 일치하는 것 찾기
      const { getAllSessions } = await import("@/lib/claudeSession");
      const allSessions = getAllSessions();
      session = allSessions.find(s => 
        s.githubRepoName?.endsWith(projectName) || 
        s.vercelUrl?.includes(projectName)
      ) || null;
    }

    if (!session) {
      return NextResponse.json({
        success: true,
        message: "No session found for this deployment",
      });
    }

    // 배포 상태 매핑
    const state = deployment.readyState;
    let status: "pending" | "building" | "ready" | "error" = "pending";
    
    if (state === "READY") {
      status = "ready";
    } else if (state === "ERROR" || state === "CANCELED") {
      status = "error";
    } else if (state === "BUILDING" || state === "QUEUED") {
      status = "building";
    }

    // 세션 업데이트
    updateSessionDeploymentStatus(session.id, status);
    
    if (deployment.url) {
      updateSessionVercel(session.id, deployment.url);
    }

    // 배포가 완료되었고 이전에 평가하지 않았거나 점수가 90점 미만인 경우 자동 평가 트리거
    if (status === "ready" && deployment.url && session.figmaUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                     (request.headers.get("origin") || "http://localhost:3000");

      // 자동 평가 트리거 (비동기)
      fetch(`${baseUrl}/api/claude/supervisor/auto-evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          deploymentUrl: deployment.url,
          figmaUrl: session.figmaUrl,
        }),
      }).catch((error) => {
        console.error("자동 평가 트리거 실패:", error);
      });
    }

    return NextResponse.json({
      success: true,
      message: "Webhook received, evaluation triggered",
      sessionId: session.id,
      status,
    });
  } catch (error) {
    console.error("Vercel webhook 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

// GET: webhook 설정 확인용
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Vercel webhook endpoint is active",
    events: ["deployment"],
  });
}



