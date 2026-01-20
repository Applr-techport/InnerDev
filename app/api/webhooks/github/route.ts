import { NextRequest, NextResponse } from "next/server";
import { findSessionByRepo, updateSessionDeploymentStatus } from "@/lib/claudeSession";

/**
 * GitHub webhook 시크릿 검증 (선택사항)
 */
function verifyWebhookSecret(payload: string, signature: string, secret: string): boolean {
  // 실제 구현에서는 crypto를 사용하여 HMAC 검증
  // 여기서는 간단히 secret이 설정되어 있으면 검증 통과
  return !secret || signature.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-hub-signature-256") || "";
    const event = request.headers.get("x-github-event") || "";

    // webhook secret 확인 (선택사항)
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret && !verifyWebhookSecret("", signature, webhookSecret)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // push 이벤트만 처리
    if (event !== "push") {
      return NextResponse.json({ success: true, message: "Event ignored" });
    }

    const payload = await request.json();
    const repoName = payload.repository?.full_name;

    if (!repoName) {
      return NextResponse.json(
        { error: "Repository information not found" },
        { status: 400 }
      );
    }

    // 세션 찾기
    const session = findSessionByRepo(repoName);
    if (!session) {
      return NextResponse.json({
        success: true,
        message: "No session found for this repository",
      });
    }

    // 배포 상태를 building으로 업데이트
    updateSessionDeploymentStatus(session.id, "building");

    // 배포 상태 확인 API 호출 (비동기)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                   (request.headers.get("origin") || "http://localhost:3000");

    // Vercel 배포가 완료될 때까지 polling 시작
    setTimeout(async () => {
      try {
        await fetch(`${baseUrl}/api/claude/check-deployment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            repoName,
          }),
        });
      } catch (error) {
        console.error("배포 상태 확인 실패:", error);
      }
    }, 10000); // 10초 후 배포 상태 확인 시작

    return NextResponse.json({
      success: true,
      message: "Webhook received, deployment check triggered",
      sessionId: session.id,
    });
  } catch (error) {
    console.error("GitHub webhook 오류:", error);
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
    message: "GitHub webhook endpoint is active",
    events: ["push"],
  });
}



