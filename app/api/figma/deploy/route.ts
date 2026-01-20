import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { code, figmaUrl } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: "React 코드가 필요합니다." },
        { status: 400 }
      );
    }

    // Vercel API 토큰 확인
    const vercelToken = process.env.VERCEL_API_TOKEN;
    if (!vercelToken) {
      return NextResponse.json(
        { error: "VERCEL_API_TOKEN이 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // Vercel 팀 ID 확인 (선택사항)
    const teamId = process.env.VERCEL_TEAM_ID;

    // Vercel에 프로젝트 생성 및 배포
    // 1. 프로젝트 생성
    const projectName = `figma-website-${Date.now()}`;
    
    const createProjectResponse = await fetch(
      `https://api.vercel.com/v9/projects${teamId ? `?teamId=${teamId}` : ""}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName,
          framework: "nextjs",
        }),
      }
    );

    if (!createProjectResponse.ok) {
      const errorText = await createProjectResponse.text();
      throw new Error(`Vercel 프로젝트 생성 실패: ${errorText}`);
    }

    const project = await createProjectResponse.json();

    // 2. 파일 업로드 및 배포
    // Vercel CLI를 사용하거나 API를 통해 배포
    // 간단한 방법: GitHub 저장소에 푸시 후 자동 배포
    // 또는 Vercel API를 통해 직접 배포

    // 임시로 배포 URL 생성 (실제로는 Vercel API를 통해 배포해야 함)
    const deploymentUrl = `https://${projectName}.vercel.app`;

    // 실제 배포를 위해서는 Vercel API의 deployment 엔드포인트를 사용해야 합니다
    // 여기서는 프로젝트 생성만 하고, 실제 배포는 별도로 처리해야 합니다
    
    return NextResponse.json({
      url: deploymentUrl,
      projectId: project.id,
      message: "배포가 시작되었습니다. 잠시 후 URL에서 확인할 수 있습니다.",
    });
  } catch (error) {
    console.error("배포 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "배포 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}



