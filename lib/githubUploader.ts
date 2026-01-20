// GitHub 업로드 유틸리티 함수

export interface GitHubFile {
  path: string;
  content: string;
}

export interface GitHubUploadResult {
  success: boolean;
  repoUrl?: string;
  repoName?: string;
  error?: string;
}

/**
 * 기존 GitHub 저장소에 파일들을 업로드합니다.
 * @param repoName owner/repo 형식의 저장소 이름
 * @param files 업로드할 파일 목록
 * @returns 업로드 결과
 */
export async function uploadToExistingGitHub(
  repoName: string,
  files: GitHubFile[]
): Promise<GitHubUploadResult> {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { success: false, error: "GITHUB_TOKEN이 설정되지 않았습니다." };
    }

    // 파일들을 GitHub에 커밋 및 푸시
    for (const file of files) {
      const filePath = file.path;
      const fileContent = Buffer.from(file.content).toString("base64");

      // 기존 파일이 있는지 확인
      let existingFileSha: string | undefined;
      try {
        const getFileResponse = await fetch(
          `https://api.github.com/repos/${repoName}/contents/${filePath}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        if (getFileResponse.ok) {
          const fileData = await getFileResponse.json();
          existingFileSha = fileData.sha;
        }
      } catch (error) {
        // 파일이 없으면 새로 생성
      }

      const createFileResponse = await fetch(
        `https://api.github.com/repos/${repoName}/contents/${filePath}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            message: existingFileSha ? `Update ${filePath}` : `Add ${filePath}`,
            content: fileContent,
            branch: "main",
            ...(existingFileSha && { sha: existingFileSha }),
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

    const repoUrl = `https://github.com/${repoName}`;

    return {
      success: true,
      repoUrl,
      repoName,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "GitHub 업로드 중 오류가 발생했습니다.",
    };
  }
}

/**
 * GitHub 저장소에 파일들을 업로드합니다.
 * @param projectName 프로젝트 이름
 * @param files 업로드할 파일 목록
 * @param description 저장소 설명
 * @param existingRepoName 기존 저장소 이름 (owner/repo 형식, 있으면 기존 저장소에 업로드)
 * @returns 업로드 결과
 */
export async function uploadToGitHub(
  projectName: string,
  files: GitHubFile[],
  description?: string,
  existingRepoName?: string
): Promise<GitHubUploadResult> {
  // 기존 저장소가 지정된 경우
  if (existingRepoName) {
    return await uploadToExistingGitHub(existingRepoName, files);
  }
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return { success: false, error: "GITHUB_TOKEN이 설정되지 않았습니다." };
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
        description: description || `Generated project: ${projectName}`,
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
    const repoUrl = repo.html_url;

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

    return {
      success: true,
      repoUrl,
      repoName: fullRepoName,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "GitHub 업로드 중 오류가 발생했습니다.",
    };
  }
}

