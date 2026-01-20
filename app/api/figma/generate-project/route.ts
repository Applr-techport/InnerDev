import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBaseProjectStructure, getViteProjectStructure, createProjectZip, type ProjectFile } from "@/lib/projectGenerator";

// Claude Tool 정의
const tools: any[] = [
  {
    name: "create_file",
    description: "프로젝트에 파일을 생성합니다. 파일 경로와 내용을 지정하세요.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "파일 경로 (예: app/page.tsx, components/Button.tsx)",
        },
        content: {
          type: "string",
          description: "파일 내용 (전체 코드)",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "update_file",
    description: "기존 파일을 수정합니다. 파일 경로와 새로운 내용을 지정하세요.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "수정할 파일 경로",
        },
        content: {
          type: "string",
          description: "수정된 파일 내용 (전체 코드)",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "validate_project",
    description: "프로젝트 구조를 검증하고 오류를 확인합니다. 발견된 오류 목록을 반환합니다.",
    input_schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "프로젝트의 모든 파일 목록",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
      required: ["files"],
    },
  },
  {
    name: "deploy_to_vercel",
    description: "생성된 프로젝트를 GitHub에 푸시하고 Vercel에 배포합니다. 프로젝트가 완성되면 이 도구를 사용하여 배포하세요.",
    input_schema: {
      type: "object",
      properties: {
        projectName: {
          type: "string",
          description: "프로젝트 이름 (GitHub 저장소 이름으로 사용됨)",
        },
        files: {
          type: "array",
          description: "배포할 모든 파일 목록",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
      required: ["projectName", "files"],
    },
  },
];

// GitHub 저장소 생성 및 파일 푸시
async function deployToGitHubAndVercel(
  projectName: string,
  files: Array<{ path: string; content: string }>
): Promise<{ success: boolean; url?: string; githubUrl?: string; error?: string }> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const vercelToken = process.env.VERCEL_API_TOKEN;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;

    if (!githubToken) {
      return { success: false, error: "GITHUB_TOKEN이 설정되지 않았습니다." };
    }
    if (!vercelToken) {
      return { success: false, error: "VERCEL_API_TOKEN이 설정되지 않았습니다." };
    }

    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const repoName = `${sanitizedName}-${Date.now()}`;

    // 1. GitHub 저장소 생성
    const createRepoResponse = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        name: repoName,
        description: `Generated from Figma design: ${projectName}`,
        private: false,
        auto_init: true, // README로 초기화하여 main 브랜치 생성
      }),
    });

    if (!createRepoResponse.ok) {
      const errorText = await createRepoResponse.text();
      return { success: false, error: `GitHub 저장소 생성 실패: ${errorText}` };
    }

    const repo = await createRepoResponse.json();
    const fullRepoName = repo.full_name;

    // 2. README.md 파일 삭제 (auto_init으로 생성된 것)
    try {
      const readmeResponse = await fetch(
        `https://api.github.com/repos/${fullRepoName}/contents/README.md`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (readmeResponse.ok) {
        const readmeData = await readmeResponse.json();
        await fetch(
          `https://api.github.com/repos/${fullRepoName}/contents/README.md`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${githubToken}`,
              "Content-Type": "application/json",
              Accept: "application/vnd.github.v3+json",
            },
            body: JSON.stringify({
              message: "Remove initial README",
              sha: readmeData.sha,
              branch: "main",
            }),
          }
        );
      }
    } catch (error) {
      console.warn("README 삭제 실패 (무시):", error);
    }

    // 3. 파일들을 GitHub에 커밋 및 푸시
    // GitHub API의 createOrUpdateFileContent 사용
    // 파일들을 순차적으로 업로드 (병렬 처리 시 rate limit 문제 발생 가능)
    for (const file of files) {
      const filePath = file.path;
      const fileContent = Buffer.from(file.content).toString("base64");

      const createFileResponse = await fetch(
        `https://api.github.com/repos/${fullRepoName}/contents/${filePath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            message: `Add ${filePath}`,
            content: fileContent,
            branch: "main",
          }),
        }
      );

      if (!createFileResponse.ok) {
        const errorText = await createFileResponse.text();
        throw new Error(`파일 ${filePath} 업로드 실패: ${errorText}`);
      }

      // Rate limit 방지를 위해 약간의 지연
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 4. Vercel 프로젝트 생성 및 GitHub 연결
    const createVercelProjectResponse = await fetch(
      `https://api.vercel.com/v9/projects${vercelTeamId ? `?teamId=${vercelTeamId}` : ""}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repoName,
          framework: "nextjs",
          gitRepository: {
            type: "github",
            repo: fullRepoName,
          },
        }),
      }
    );

    if (!createVercelProjectResponse.ok) {
      const errorText = await createVercelProjectResponse.text();
      return { success: false, error: `Vercel 프로젝트 생성 실패: ${errorText}` };
    }

    const vercelProject = await createVercelProjectResponse.json();

    // 5. Vercel 배포 트리거 (GitHub 연결 시 자동 배포되지만, 명시적으로 트리거)
    // Vercel은 GitHub 연결 시 자동으로 배포를 시작하므로 잠시 대기
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const deploymentUrl = `https://${vercelProject.name}.vercel.app`;

    return {
      success: true,
      url: deploymentUrl,
      githubUrl: repo.html_url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "배포 중 오류가 발생했습니다.",
    };
  }
}

// Tool 실행 함수
async function executeTool(
  toolName: string,
  input: any,
  projectFiles: Map<string, string>
): Promise<any> {
  switch (toolName) {
    case "create_file":
    case "update_file":
      projectFiles.set(input.path, input.content);
      return {
        success: true,
        message: `파일 ${input.path}이(가) 생성/수정되었습니다.`,
      };

    case "validate_project":
      // 간단한 검증 로직
      const errors: string[] = [];
      const warnings: string[] = [];

      // 필수 파일 확인
      const requiredFiles = [
        "package.json",
        "tsconfig.json",
        "next.config.js",
        "app/layout.tsx",
        "app/page.tsx",
      ];

      for (const requiredFile of requiredFiles) {
        if (!projectFiles.has(requiredFile)) {
          errors.push(`필수 파일이 없습니다: ${requiredFile}`);
        }
      }

      // TypeScript 구문 검증 (간단한 체크)
      for (const [path, content] of projectFiles.entries()) {
        if (path.endsWith(".tsx") || path.endsWith(".ts")) {
          // 기본적인 구문 오류 체크
          if (content.includes("export default") && !content.includes("function") && !content.includes("const")) {
            warnings.push(`${path}: export default가 올바르게 사용되지 않을 수 있습니다.`);
          }
        }
      }

      return {
        errors,
        warnings,
        isValid: errors.length === 0,
      };

    case "deploy_to_vercel":
      // 프로젝트 파일들을 배열로 변환
      const filesArray = Array.from(projectFiles.entries()).map(([path, content]) => ({
        path,
        content,
      }));

      const deployResult = await deployToGitHubAndVercel(input.projectName, filesArray);
      return deployResult;

    default:
      return { error: `알 수 없는 도구: ${toolName}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { convertedPages, projectName, figmaData, projectType = "nextjs" } = await request.json();

    if (!convertedPages || Object.keys(convertedPages).length === 0) {
      return NextResponse.json(
        { error: "변환된 페이지가 필요합니다." },
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

    // Claude 클라이언트 초기화
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // 프로젝트 타입에 따라 기본 구조 생성
    const baseStructure = projectType === "react-vite" 
      ? getViteProjectStructure(projectName || "figma-project")
      : getBaseProjectStructure(projectName || "figma-project");
    const projectFiles = new Map<string, string>();
    
    // 기본 파일들 추가
    for (const file of baseStructure.files) {
      projectFiles.set(file.path, file.content);
    }

    // 변환된 컴포넌트들을 파일 목록으로 변환
    const componentsInfo = Object.entries(convertedPages).map(([pageId, pageData]: [string, any]) => ({
      pageId,
      pageName: pageId,
      code: pageData.code,
    }));

    const isVite = projectType === "react-vite";
    const frameworkName = isVite ? "React + Vite" : "Next.js";
    
    const systemPrompt = `당신은 ${frameworkName} 프로젝트를 생성하고 배포하는 전문가입니다.
당신은 다음 역할을 동시에 수행하는 개발 조직입니다:
- Tech Lead / Architect: 전체 아키텍처 설계
- Frontend Engineer: React 컴포넌트 및 페이지 구현
- Infra Engineer: GitHub + Vercel 배포 설정
- Backend Integrator: Node.js + MySQL 백엔드 연동 가능한 API 구조 설계
- AI Evaluator: 코드 품질 및 실서비스 가능성 평가

다음 단계를 순서대로 수행하여 완전한 ${frameworkName} 프로젝트를 생성하고 Vercel에 배포하세요:

1. **프로젝트 기본 구조 확인**
   - ${isVite ? "package.json, tsconfig.json, vite.config.ts" : "package.json, tsconfig.json, next.config.js"} 등이 이미 생성되어 있습니다.
   - 필요한 경우 수정하세요.

2. **의미 기반 해석 적용**
   - Frame → Page 매핑: 각 Frame을 페이지로 변환
   - Section → Feature 추출: 주요 섹션을 기능 단위로 구성
   - Component → 재사용 컴포넌트: 공통 컴포넌트는 components/ 디렉토리에 분리
   - 라우팅 구조: ${isVite ? "React Router" : "Next.js App Router"} 기반 라우팅 구성
   - CRUD 기능: 폼, 버튼, 테이블 등을 분석하여 API 연동 구조 설계

3. **페이지 및 컴포넌트 생성**
   ${isVite 
     ? "- src/pages/ 디렉토리에 페이지 컴포넌트 생성\n   - src/components/ 디렉토리에 재사용 컴포넌트 생성\n   - src/App.tsx에서 React Router 설정"
     : "- app/ 디렉토리에 페이지 생성 (App Router)\n   - components/ 디렉토리에 재사용 컴포넌트 생성"
   }

4. **API 연동 구조 생성**
   - ${isVite ? "src/services/api.ts" : "lib/api.ts"} 파일에 API 클라이언트 구현
   - 환경변수 VITE_API_BASE_URL 사용 (${isVite ? "Vite" : "Next.js"} 환경변수)
   - 백엔드 연동 가능한 구조 (Node.js + MySQL 가정)
   - CRUD 기능에 맞는 API 함수 생성
   - API 스펙은 README에 명시

5. **프로젝트 검증**
   - validate_project tool을 사용하여 오류를 확인하세요.
   - 오류가 있으면 수정하세요.

6. **완성 확인**
   - 모든 파일이 올바르게 생성되었는지 확인하세요.
   - 프로젝트가 바로 실행 가능한지 확인하세요.
   - 빌드 에러가 없는지 확인하세요.

7. **AI 평가 및 수정**
   - 프로젝트 생성 후 자동으로 평가를 수행합니다.
   - 80점 미만이거나 releaseReady가 false면 수정 후 재평가를 반복합니다.
   - blockers가 있으면 반드시 수정하세요.

8. **Vercel 배포**
   - 프로젝트가 완성되고 평가를 통과하면 deploy_to_vercel tool을 사용하여 GitHub에 푸시하고 Vercel에 배포하세요.
   - 이 단계는 반드시 수행해야 합니다.

중요 규칙:
- 모든 파일은 완전한 코드여야 합니다 (import 포함)
- TypeScript 타입을 올바르게 사용하세요
- ${isVite ? "React Router" : "Next.js 14 App Router"} 규칙을 따르세요
- ${isVite ? "" : '"use client" 지시어는 클라이언트 컴포넌트에만 사용하세요'}
- 환경변수는 하드코딩하지 말고 .env 파일 사용
- API 호출은 services/api.ts로 통합
- 각 단계마다 tool을 사용하세요
- 프로젝트 생성이 완료되고 평가를 통과하면 반드시 deploy_to_vercel tool을 호출하세요`;

    const userPrompt = `다음 변환된 컴포넌트들을 사용하여 완전한 ${frameworkName} 프로젝트를 생성하세요:

${JSON.stringify(componentsInfo, null, 2)}

프로젝트 이름: ${projectName || "figma-project"}
프로젝트 타입: ${frameworkName}

위 컴포넌트들을 의미 기반으로 해석하여 바로 실행 가능한 ${frameworkName} 프로젝트를 만들어주세요.
- Frame은 페이지로 변환
- Section은 기능 단위로 구성
- 재사용 가능한 컴포넌트는 components/ 디렉토리에 분리
- 라우팅 구조를 적절히 구성
- API 연동 구조를 포함하여 백엔드와 연동 가능하도록 설계`;

    const messages: any[] = [
      {
        role: "user",
        content: userPrompt,
      },
    ];

    let maxIterations = 10;
    let iteration = 0;
    let isComplete = false;

    // 반복 작업: Claude가 tool을 사용하여 프로젝트 생성
    while (iteration < maxIterations && !isComplete) {
      iteration++;

      // Claude에게 메시지 전송
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 16384,
        tools: tools,
        system: systemPrompt,
        messages: messages,
      });

      // 응답 처리
      for (const content of response.content) {
        if (content.type === "text") {
          messages.push({
            role: "assistant",
            content: content.text,
          });
        } else if (content.type === "tool_use") {
          // Tool 실행
          const toolResult = await executeTool(
            content.name,
            content.input,
            projectFiles
          );

          // Tool 결과를 메시지에 추가
          messages.push({
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

          messages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: content.id,
                content: JSON.stringify(toolResult),
              },
            ],
          });

          // validate_project 결과 확인
          if (content.name === "validate_project" && toolResult.isValid) {
            isComplete = true;
          }
        }
      }

      // 완료 확인
      if (isComplete) {
        break;
      }
    }

    // 최종 프로젝트 구조 생성
    let finalFiles: ProjectFile[] = Array.from(projectFiles.entries()).map(
      ([path, content]) => ({
        path,
        content,
      })
    );

    // 프로젝트 평가 및 수정 반복
    let evaluationPassed = false;
    let maxEvaluationIterations = 3;
    let evaluationIteration = 0;
    let projectEvaluation: any = null;

    while (!evaluationPassed && evaluationIteration < maxEvaluationIterations) {
      evaluationIteration++;

      // 프로젝트 평가 수행
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                       (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        
        const evaluateResponse = await fetch(`${baseUrl}/api/figma/evaluate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            files: finalFiles,
            projectType,
            semanticAnalysis: figmaData?.semanticAnalysis,
          }),
        });

        if (evaluateResponse.ok) {
          projectEvaluation = await evaluateResponse.json();
          
          // 평가 통과 확인 (80점 이상 && releaseReady === true)
          if (projectEvaluation.totalScore >= 80 && projectEvaluation.releaseReady) {
            evaluationPassed = true;
            break;
          }

          // blockers가 있으면 수정 필요
          if (projectEvaluation.blockers && projectEvaluation.blockers.length > 0) {
            // Claude에게 수정 요청
            const fixPrompt = `프로젝트 평가 결과:
점수: ${projectEvaluation.totalScore}/100
배포 가능: ${projectEvaluation.releaseReady ? "예" : "아니오"}

심각한 오류 (반드시 수정 필요):
${projectEvaluation.blockers.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}

개선 제안:
${projectEvaluation.improvements.map((i: string, idx: number) => `${idx + 1}. ${i}`).join('\n')}

위 오류들을 수정하여 프로젝트를 개선해주세요.`;

            messages.push({
              role: "user",
              content: fixPrompt,
            });

            // Claude에게 수정 요청
            const fixResponse = await anthropic.messages.create({
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 16384,
              tools: tools,
              system: systemPrompt,
              messages: messages,
            });

            // 수정 응답 처리
            for (const content of fixResponse.content) {
              if (content.type === "text") {
                messages.push({
                  role: "assistant",
                  content: content.text,
                });
              } else if (content.type === "tool_use") {
                const toolResult = await executeTool(
                  content.name,
                  content.input,
                  projectFiles
                );

                messages.push({
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

                messages.push({
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

            // 수정된 파일 목록 업데이트
            finalFiles = Array.from(projectFiles.entries()).map(
              ([path, content]) => ({
                path,
                content,
              })
            );
          } else {
            // blockers는 없지만 점수가 낮은 경우
            break;
          }
        }
      } catch (evalError) {
        console.warn("평가 중 오류 발생:", evalError);
        break; // 평가 실패 시 중단
      }
    }

    // 배포 여부 확인 (deploy_to_vercel tool이 호출되었는지)
    let deploymentUrl: string | null = null;
    let githubUrl: string | null = null;
    let deploymentSuccess = false;

    // 메시지 히스토리에서 배포 결과 확인
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "user" && Array.isArray(msg.content)) {
        for (const content of msg.content) {
          if (content.type === "tool_result" && content.content) {
            try {
              const result = JSON.parse(content.content);
              if (result.success && result.url) {
                deploymentUrl = result.url;
                githubUrl = result.githubUrl || null;
                deploymentSuccess = true;
                break;
              }
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }
        }
        if (deploymentSuccess) break;
      }
    }

    // 배포가 성공한 경우 배포 URL 반환, 실패한 경우 ZIP 파일 제공
    if (deploymentSuccess && deploymentUrl) {
      return NextResponse.json({
        success: true,
        message: "프로젝트가 성공적으로 생성되고 Vercel에 배포되었습니다.",
        deploymentUrl: deploymentUrl,
        githubUrl: githubUrl,
        files: finalFiles,
        evaluation: projectEvaluation,
      });
    } else {
      // 배포 실패 또는 배포하지 않은 경우 ZIP 파일 생성
      const zipBuffer = await createProjectZip({ files: finalFiles });

      return NextResponse.json({
        success: true,
        message: projectEvaluation 
          ? `프로젝트가 생성되었습니다. (평가 점수: ${projectEvaluation.totalScore}/100, 배포 가능: ${projectEvaluation.releaseReady ? "예" : "아니오"})`
          : "프로젝트가 성공적으로 생성되었습니다. (배포되지 않음)",
        files: finalFiles,
        zipBase64: zipBuffer.toString("base64"),
        deploymentUrl: null,
        evaluation: projectEvaluation,
      });
    }
  } catch (error) {
    console.error("프로젝트 생성 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "프로젝트 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

