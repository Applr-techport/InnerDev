import { NextRequest, NextResponse } from "next/server";
import { findSessionByRepo, updateSessionDeploymentStatus, getSession } from "@/lib/claudeSession";

/**
 * GitHub 저장소의 최근 커밋 확인
 */
async function checkGitHubCommits(repoName: string): Promise<{ hasNewCommits: boolean; lastCommitSha?: string }> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { hasNewCommits: false };
    }

    const response = await fetch(`https://api.github.com/repos/${repoName}/commits?per_page=1`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return { hasNewCommits: false };
    }

    const commits = await response.json();
    if (commits.length > 0) {
      return {
        hasNewCommits: true,
        lastCommitSha: commits[0].sha,
      };
    }

    return { hasNewCommits: false };
  } catch (error) {
    console.error("GitHub 커밋 확인 오류:", error);
    return { hasNewCommits: false };
  }
}

/**
 * Vercel 배포 상태 확인
 */
async function checkVercelDeployment(repoName: string): Promise<{
  status: "pending" | "building" | "ready" | "error" | "unknown";
  url?: string;
}> {
  try {
    const vercelToken = process.env.VERCEL_API_TOKEN;
    if (!vercelToken) {
      return { status: "unknown" };
    }

    const vercelTeamId = process.env.VERCEL_TEAM_ID;
    const teamParam = vercelTeamId ? `?teamId=${vercelTeamId}` : "";

    // 프로젝트 찾기
    const projectsResponse = await fetch(
      `https://api.vercel.com/v9/projects${teamParam}`,
      {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
        },
      }
    );

    if (!projectsResponse.ok) {
      return { status: "unknown" };
    }

    const projects = await projectsResponse.json();
    const project = projects.projects?.find((p: any) => p.name === repoName.split("/")[1]);

    if (!project) {
      return { status: "unknown" };
    }

    // 최근 배포 확인
    const deploymentsResponse = await fetch(
      `https://api.vercel.com/v6/deployments${teamParam}&projectId=${project.id}&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
        },
      }
    );

    if (!deploymentsResponse.ok) {
      return { status: "unknown" };
    }

    const deployments = await deploymentsResponse.json();
    if (deployments.deployments && deployments.deployments.length > 0) {
      const deployment = deployments.deployments[0];
      const status = deployment.readyState;

      let mappedStatus: "pending" | "building" | "ready" | "error" = "pending";
      if (status === "READY") {
        mappedStatus = "ready";
      } else if (status === "ERROR" || status === "CANCELED") {
        mappedStatus = "error";
      } else if (status === "BUILDING" || status === "QUEUED") {
        mappedStatus = "building";
      }

      return {
        status: mappedStatus,
        url: deployment.url || `https://${project.name}.vercel.app`,
      };
    }

    return { status: "unknown" };
  } catch (error) {
    console.error("Vercel 배포 확인 오류:", error);
    return { status: "unknown" };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, repoName } = await request.json();

    if (!sessionId && !repoName) {
      return NextResponse.json(
        { error: "sessionId 또는 repoName이 필요합니다." },
        { status: 400 }
      );
    }

    // 세션 찾기
    let session = sessionId ? getSession(sessionId) : null;
    if (!session && repoName) {
      session = findSessionByRepo(repoName);
    }

    if (!session || !session.githubRepoName) {
      return NextResponse.json(
        { error: "세션을 찾을 수 없거나 GitHub 저장소 정보가 없습니다." },
        { status: 404 }
      );
    }

    const repoNameToCheck = session.githubRepoName;

    // GitHub 커밋 확인
    const gitHubStatus = await checkGitHubCommits(repoNameToCheck);

    // Vercel 배포 상태 확인
    const vercelStatus = await checkVercelDeployment(repoNameToCheck);

    // 세션의 배포 상태 업데이트
    if (vercelStatus.status !== "unknown") {
      updateSessionDeploymentStatus(session.id, vercelStatus.status);
    }

    // 배포가 완료되었고 이전에 평가하지 않았거나 점수가 90점 미만인 경우 자동 평가 트리거
    if (vercelStatus.status === "ready" && vercelStatus.url) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                     (request.headers.get("origin") || "http://localhost:3000");

      // 자동 평가 트리거 (비동기)
      fetch(`${baseUrl}/api/claude/supervisor/auto-evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          deploymentUrl: vercelStatus.url,
          figmaUrl: session.figmaUrl,
        }),
      }).catch((error) => {
        console.error("자동 평가 트리거 실패:", error);
      });
    }

    return NextResponse.json({
      success: true,
      github: gitHubStatus,
      vercel: vercelStatus,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("배포 상태 확인 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "배포 상태 확인 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}



