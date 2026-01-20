import { NextRequest, NextResponse } from "next/server";
import { uploadToExistingGitHub, type GitHubFile } from "@/lib/githubUploader";

/**
 * GitHub URL에서 owner/repo 추출
 */
function extractRepoName(githubUrl: string): string | null {
  try {
    const url = new URL(githubUrl);
    const pathParts = url.pathname.split("/").filter(p => p);
    if (pathParts.length >= 2) {
      return `${pathParts[0]}/${pathParts[1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Figma URL에서 fileId 추출
 * 지원하는 URL 형식:
 * - https://www.figma.com/file/abc123/Project-Name
 * - https://figma.com/file/abc123/Project-Name
 * - https://www.figma.com/design/abc123/Project-Name
 * - https://www.figma.com/file/abc123/Project-Name?node-id=123%3A456
 * 
 * 검증을 완화하여 다양한 길이의 fileId를 지원합니다.
 * 실제 유효성은 Figma API 접근 시 확인됩니다.
 */
function extractFileId(figmaUrl: string): string | null {
  try {
    // URL 정규화 (공백 제거, www 추가 등)
    let normalizedUrl = figmaUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    
    // file 또는 design 경로에서 fileId 추출
    // Figma file ID는 다양한 길이를 가질 수 있으므로 길이 제한을 완화
    const patterns = [
      /(?:www\.)?figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/i,  // 표준 형식 (길이 제한 없음)
      /\/file\/([a-zA-Z0-9]+)/i,  // file 경로
      /\/design\/([a-zA-Z0-9]+)/i,  // design 경로
    ];
    
    for (const pattern of patterns) {
      const match = normalizedUrl.match(pattern);
      if (match && match[1]) {
        const fileId = match[1];
        // 쿼리 파라미터나 슬래시 전까지만 추출
        const cleanFileId = fileId.split('/')[0].split('?')[0];
        // 최소 10자리 이상이면 유효한 것으로 간주 (실제로는 Figma 접근 시 확인)
        if (cleanFileId.length >= 10) {
          return cleanFileId;
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { githubUrl, figmaUrl, figmaEmail, figmaPassword, projectType, useScreenshot } = await request.json();

    if (!githubUrl || !figmaUrl) {
      return NextResponse.json(
        { error: "GitHub URL과 Figma URL이 필요합니다." },
        { status: 400 }
      );
    }

    // GitHub 저장소 이름 추출
    const repoName = extractRepoName(githubUrl);
    if (!repoName) {
      return NextResponse.json(
        { error: "유효하지 않은 GitHub URL입니다." },
        { status: 400 }
      );
    }

    // Figma fileId 추출
    const fileId = extractFileId(figmaUrl);
    if (!fileId) {
      return NextResponse.json(
        { error: "유효하지 않은 Figma URL입니다." },
        { status: 400 }
      );
    }

    // baseUrl 구성 (서버 사이드에서 호출)
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host") || "localhost:3000";
    const baseUrl = `${protocol}://${host}`;

    // 1. Figma 디자인 분석
    const analyzeResponse = await fetch(`${baseUrl}/api/figma/analyze`, {
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
      return NextResponse.json(
        { error: `Figma 분석 실패: ${errorData.error || "알 수 없는 오류"}` },
        { status: analyzeResponse.status }
      );
    }

    const analyzeData = await analyzeResponse.json();
    const pages = analyzeData.pages || [];

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "Figma 파일에서 페이지를 찾을 수 없습니다." },
        { status: 400 }
      );
    }

    // 2. 모든 페이지를 React 코드로 변환
    const convertedPages: Record<string, { code: string; convertedAt: string }> = {};
    const allFiles: GitHubFile[] = [];
    const isVite = projectType === "react-vite";

    for (const page of pages) {
      try {
        // 각 페이지별로 스크린샷 캡처
        const screenshotResponse = await fetch(`${baseUrl}/api/figma/screenshot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            figmaUrl: `${figmaUrl}?node-id=${page.id}`,
            pageId: page.id,
            nodeId: page.id,
            email: figmaEmail || undefined,
            password: figmaPassword || undefined,
          }),
        });

        if (!screenshotResponse.ok) {
          console.warn(`페이지 ${page.name} 스크린샷 캡처 실패`);
          continue;
        }

        const { screenshot: pageScreenshot } = await screenshotResponse.json();

        // 스크린샷을 사용하여 React 코드 생성
        const convertResponse = await fetch(`${baseUrl}/api/figma/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId: page.id,
            screenshot: pageScreenshot,
            useScreenshot: true,
            semanticAnalysis: analyzeData.semanticAnalysis,
            figmaUrl: `${figmaUrl}?node-id=${page.id}`,
          }),
        });

        if (convertResponse.ok) {
          const convertData = await convertResponse.json();
          convertedPages[page.id] = {
            code: convertData.code,
            convertedAt: new Date().toISOString(),
          };

          // 컴포넌트 파일 생성
          const componentName = page.name.replace(/[^a-zA-Z0-9]/g, "") || `Component${page.id}`;
          const fileName = `${componentName}.tsx`;
          const componentPath = isVite 
            ? `src/components/${fileName}`
            : `components/${fileName}`;
          allFiles.push({
            path: componentPath,
            content: convertData.code,
          });
        }
      } catch (error) {
        console.error(`페이지 ${page.name} 변환 실패:`, error);
        // 계속 진행
      }
    }

    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: "변환된 페이지가 없습니다." },
        { status: 400 }
      );
    }

    // 3. 프로젝트 기본 구조 파일 추가
    // package.json
    allFiles.push({
      path: "package.json",
      content: JSON.stringify({
        name: repoName.split("/")[1],
        private: true,
        version: "0.0.0",
        ...(isVite ? {
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc && vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
          },
          devDependencies: {
            "@types/react": "^18.2.66",
            "@types/react-dom": "^18.22.22",
            "@vitejs/plugin-react": "^4.2.1",
            typescript: "^5.2.2",
            vite: "^5.2.0",
          },
        } : {
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
          },
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            next: "^14.0.0",
          },
          devDependencies: {
            "@types/node": "^20.0.0",
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
            typescript: "^5.0.0",
          },
        }),
      }, null, 2),
    });

    // tsconfig.json
    allFiles.push({
      path: "tsconfig.json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          ...(isVite ? {
            module: "ESNext",
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
          } : {
            module: "esnext",
            moduleResolution: "node",
          }),
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          ...(isVite ? {} : {
            incremental: true,
            plugins: [{ name: "next" }],
          }),
        },
        include: isVite ? ["src"] : ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        ...(isVite ? {} : { exclude: ["node_modules"] }),
      }, null, 2),
    });

    // README.md
    allFiles.push({
      path: "README.md",
      content: `# ${repoName.split("/")[1]}

이 프로젝트는 Figma 디자인에서 자동으로 생성되었습니다.

## 시작하기

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
    });

    // .gitignore
    allFiles.push({
      path: ".gitignore",
      content: `node_modules
${isVite ? "dist" : ".next"}
.env.local
.env.*.local
`,
    });

    // 메인 앱 파일
    if (isVite) {
      allFiles.push({
        path: "src/main.tsx",
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
      });

      // 컴포넌트 import 및 사용
      const componentImports = pages
        .filter((page: any) => convertedPages[page.id])
        .map((page: any) => {
          const componentName = page.name.replace(/[^a-zA-Z0-9]/g, "") || `Component${page.id}`;
          return `import ${componentName} from './components/${componentName}.tsx'`;
        })
        .join('\n');

      const componentUsages = pages
        .filter((page: any) => convertedPages[page.id])
        .map((page: any) => {
          const componentName = page.name.replace(/[^a-zA-Z0-9]/g, "") || `Component${page.id}`;
          return `<${componentName} />`;
        })
        .join('\n      ');

      allFiles.push({
        path: "src/App.tsx",
        content: `import './App.css'
${componentImports}

function App() {
  return (
    <div className="App">
      ${componentUsages}
    </div>
  )
}

export default App
`,
      });

      allFiles.push({
        path: "src/index.css",
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`,
      });

      allFiles.push({
        path: "src/App.css",
        content: `/* Add your global styles here */`,
      });

      allFiles.push({
        path: "index.html",
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${repoName.split("/")[1]}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      });

      allFiles.push({
        path: "vite.config.ts",
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
      });
    } else {
      // Next.js 구조
      const nextComponentImports = pages
        .filter((page: any) => convertedPages[page.id])
        .map((page: any) => {
          const componentName = page.name.replace(/[^a-zA-Z0-9]/g, "") || `Component${page.id}`;
          return `import ${componentName} from '@/components/${componentName}'`;
        })
        .join('\n');

      const nextComponentUsages = pages
        .filter((page: any) => convertedPages[page.id])
        .map((page: any) => {
          const componentName = page.name.replace(/[^a-zA-Z0-9]/g, "") || `Component${page.id}`;
          return `<${componentName} />`;
        })
        .join('\n      ');

      allFiles.push({
        path: "app/page.tsx",
        content: `${nextComponentImports}

export default function Home() {
  return (
    <main>
      ${nextComponentUsages}
    </main>
  )
}
`,
      });

      allFiles.push({
        path: "app/layout.tsx",
        content: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '${repoName.split("/")[1]}',
  description: 'Generated from Figma',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
      });

      // Next.js tsconfig.json에 path alias 추가
      const nextTsConfig = allFiles.find(f => f.path === "tsconfig.json");
      if (nextTsConfig) {
        const tsConfig = JSON.parse(nextTsConfig.content);
        tsConfig.compilerOptions.paths = {
          "@/*": ["./*"]
        };
        nextTsConfig.content = JSON.stringify(tsConfig, null, 2);
      }

      allFiles.push({
        path: "next.config.js",
        content: `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
`,
      });
    }

    // 4. GitHub에 업로드
    const uploadResult = await uploadToExistingGitHub(repoName, allFiles);

    if (!uploadResult.success) {
      return NextResponse.json(
        { error: `GitHub 업로드 실패: ${uploadResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      githubUrl: uploadResult.repoUrl,
      repoName: uploadResult.repoName,
      convertedPages: Object.keys(convertedPages).length,
      totalFiles: allFiles.length,
    });
  } catch (error) {
    console.error("자동 생성 오류:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "자동 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

