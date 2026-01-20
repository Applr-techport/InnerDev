// 프로젝트 생성 관련 유틸리티 함수들

export interface ProjectFile {
  path: string;
  content: string;
}

export interface ProjectStructure {
  files: ProjectFile[];
}

// 기본 Next.js 프로젝트 구조 템플릿
export function getBaseProjectStructure(projectName: string): ProjectStructure {
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  
  return {
    files: [
      {
        path: "package.json",
        content: JSON.stringify({
          name: sanitizedName,
          version: "0.1.0",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint",
          },
          dependencies: {
            next: "^14.2.5",
            react: "^18.3.1",
            "react-dom": "^18.3.1",
          },
          devDependencies: {
            "@types/node": "^20.14.12",
            "@types/react": "^18.3.3",
            "@types/react-dom": "^18.3.0",
            typescript: "^5.5.4",
            tailwindcss: "^3.4.7",
            postcss: "^8.4.40",
            autoprefixer: "^10.4.19",
            eslint: "^8.57.0",
            "eslint-config-next": "^14.2.5",
          },
        }, null, 2),
      },
      {
        path: "tsconfig.json",
        content: JSON.stringify({
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [{ name: "next" }],
            paths: {
              "@/*": ["./*"],
            },
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"],
        }, null, 2),
      },
      {
        path: "next.config.js",
        content: `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
`,
      },
      {
        path: "tailwind.config.ts",
        content: `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
`,
      },
      {
        path: "postcss.config.js",
        content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
      },
      {
        path: ".gitignore",
        content: `# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`,
      },
      {
        path: "README.md",
        content: `# ${projectName}

This project was generated from a Figma design.

## Getting Started

First, install the dependencies:

\`\`\`bash
npm install
\`\`\`

Then, run the development server:

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
`,
      },
      {
        path: "app/layout.tsx",
        content: `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${projectName}",
  description: "Generated from Figma design",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`,
      },
      {
        path: "app/globals.css",
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
      },
    ],
  };
}

// React + Vite 프로젝트 구조 템플릿
export function getViteProjectStructure(projectName: string): ProjectStructure {
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  
  return {
    files: [
      {
        path: "package.json",
        content: JSON.stringify({
          name: sanitizedName,
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc && vite build",
            preview: "vite preview",
            lint: "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
          },
          dependencies: {
            react: "^18.3.1",
            "react-dom": "^18.3.1",
            "react-router-dom": "^6.26.0",
            axios: "^1.7.2",
          },
          devDependencies: {
            "@types/react": "^18.3.3",
            "@types/react-dom": "^18.3.0",
            "@typescript-eslint/eslint-plugin": "^7.13.0",
            "@typescript-eslint/parser": "^7.13.0",
            "@vitejs/plugin-react": "^4.3.1",
            eslint: "^8.57.0",
            "eslint-plugin-react-hooks": "^4.6.2",
            "eslint-plugin-react-refresh": "^0.4.7",
            typescript: "^5.5.4",
            vite: "^5.3.1",
            tailwindcss: "^3.4.7",
            postcss: "^8.4.40",
            autoprefixer: "^10.4.19",
          },
        }, null, 2),
      },
      {
        path: "tsconfig.json",
        content: JSON.stringify({
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
            baseUrl: ".",
            paths: {
              "@/*": ["./src/*"],
            },
          },
          include: ["src"],
          references: [{ path: "./tsconfig.node.json" }],
        }, null, 2),
      },
      {
        path: "tsconfig.node.json",
        content: JSON.stringify({
          compilerOptions: {
            composite: true,
            skipLibCheck: true,
            module: "ESNext",
            moduleResolution: "bundler",
            allowSyntheticDefaultImports: true,
          },
          include: ["vite.config.ts"],
        }, null, 2),
      },
      {
        path: "vite.config.ts",
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
`,
      },
      {
        path: "tailwind.config.js",
        content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`,
      },
      {
        path: "postcss.config.js",
        content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
      },
      {
        path: ".gitignore",
        content: `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Environment variables
.env
.env.local
.env.*.local
`,
      },
      {
        path: ".env.example",
        content: `# API Base URL
VITE_API_BASE_URL=http://localhost:3001/api
`,
      },
      {
        path: "index.html",
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      },
      {
        path: "src/main.tsx",
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
      },
      {
        path: "src/App.tsx",
        content: `import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>
    </Router>
  )
}

export default App
`,
      },
      {
        path: "src/styles/index.css",
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
      },
      {
        path: "src/services/api.ts",
        content: `import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = \`Bearer \${token}\`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient

// Example API functions
export const getUser = async (id: string) => {
  return apiClient.get(\`/users/\${id}\`)
}

export const createUser = async (data: any) => {
  return apiClient.post('/users', data)
}

export const updateUser = async (id: string, data: any) => {
  return apiClient.put(\`/users/\${id}\`, data)
}

export const deleteUser = async (id: string) => {
  return apiClient.delete(\`/users/\${id}\`)
}
`,
      },
      {
        path: "src/types/index.ts",
        content: `// Common types
export interface User {
  id: string
  name: string
  email: string
}

// Add more types as needed
`,
      },
      {
        path: "README.md",
        content: `# ${projectName}

This project was generated from a Figma design.

## Tech Stack

- React 18
- TypeScript
- Vite
- React Router
- Axios
- Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

\`\`\`bash
npm install
\`\`\`

### Environment Variables

Copy \`.env.example\` to \`.env\` and configure:

\`\`\`bash
cp .env.example .env
\`\`\`

Set \`VITE_API_BASE_URL\` to your backend API URL.

### Development

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:5173](http://localhost:5173) with your browser.

### Build

\`\`\`bash
npm run build
\`\`\`

### Preview Production Build

\`\`\`bash
npm run preview
\`\`\`

## Project Structure

\`\`\`
src/
 ├─ pages/          # Page components
 ├─ components/     # Reusable components
 ├─ hooks/          # Custom hooks
 ├─ services/       # API calls
 ├─ types/          # TypeScript types
 ├─ utils/          # Utility functions
 ├─ styles/         # Style files
 └─ App.tsx         # Main app component
\`\`\`

## API Integration

The project includes a pre-configured API client in \`src/services/api.ts\`.

### Backend Assumptions

- Node.js REST API
- MySQL database
- JWT authentication (optional)

### API Endpoints (Example)

- \`GET /api/users/:id\` - Get user
- \`POST /api/users\` - Create user
- \`PUT /api/users/:id\` - Update user
- \`DELETE /api/users/:id\` - Delete user

Update these endpoints based on your actual backend API.

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

## License

MIT
`,
      },
    ],
  };
}

// ZIP 파일 생성 (JSZip 사용)
export async function createProjectZip(
  projectStructure: ProjectStructure
): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // 모든 파일을 ZIP에 추가
  for (const file of projectStructure.files) {
    zip.file(file.path, file.content);
  }

  // ZIP 파일 생성
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return zipBuffer;
}

