// Code Interpreter 유틸리티 함수

export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

/**
 * 코드를 실행하고 결과를 반환합니다.
 * @param code 실행할 코드
 * @param language 코드 언어 (javascript, python, bash 등)
 * @returns 실행 결과
 */
export async function executeCode(
  code: string,
  language: string = "javascript"
): Promise<CodeExecutionResult> {
  try {
    // JavaScript/TypeScript 코드 실행
    if (language === "javascript" || language === "typescript" || language === "js" || language === "ts") {
      // Node.js 환경에서 코드 실행
      // 보안을 위해 sandbox 환경에서 실행해야 함
      // 실제로는 vm 모듈이나 별도의 실행 환경 사용 권장
      
      try {
        // 간단한 코드 실행 (제한적)
        // 실제 프로덕션에서는 더 안전한 방법 사용 필요
        const result = eval(code);
        return {
          success: true,
          output: String(result),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "코드 실행 중 오류가 발생했습니다.",
        };
      }
    }

    // Python 코드 실행 (Python이 설치되어 있는 경우)
    if (language === "python" || language === "py") {
      // Python 실행은 별도의 프로세스 필요
      // 여기서는 기본 구현만 제공
      return {
        success: false,
        error: "Python 실행은 아직 지원되지 않습니다.",
      };
    }

    // Bash/Shell 코드 실행
    if (language === "bash" || language === "shell" || language === "sh") {
      // Shell 실행은 보안상 위험하므로 제한적
      return {
        success: false,
        error: "Shell 실행은 보안상 제한됩니다.",
      };
    }

    return {
      success: false,
      error: `지원되지 않는 언어: ${language}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "코드 실행 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 코드를 분석하고 검증합니다.
 * @param code 분석할 코드
 * @param language 코드 언어
 * @returns 분석 결과
 */
export async function analyzeCode(
  code: string,
  language: string = "javascript"
): Promise<{
  syntaxValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // 기본적인 구문 검사
  if (language === "javascript" || language === "typescript") {
    try {
      // 간단한 구문 검사
      new Function(code);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "구문 오류가 있습니다.");
    }
  }

  return {
    syntaxValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}



