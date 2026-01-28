import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PAGE_TYPES, type TaskMilestoneItem } from "@/lib/quotationTaskProcessor";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectName = formData.get("projectName") as string;
    const projectDescription = formData.get("projectDescription") as string || "";
    const clientBudget = formData.get("clientBudget") as string || "";
    const files = formData.getAll("files") as File[];

    if (!projectDescription.trim() && files.length === 0) {
      return NextResponse.json(
        { error: "프로젝트 정보를 입력하거나 파일을 첨부해주세요." },
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

    // 파일 처리: 이미지 base64 변환
    const fileContents: Array<{ type: string; source: { type: string; data: string; media_type: string } }> = [];

    for (const file of files) {
      const fileType = file.type;

      // 이미지 파일인 경우
      if (fileType.startsWith("image/")) {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        fileContents.push({
          type: "image",
          source: {
            type: "base64",
            data: base64,
            media_type: fileType,
          },
        });
      } else {
        console.warn(`지원하지 않는 파일 타입: ${fileType} (${file.name})`);
      }
    }

    // 페이지 유형별 단가 정보 생성
    const pageTypesInfo = PAGE_TYPES.map(pt =>
      `- ${pt.type}: ${pt.price.toLocaleString()}원${pt.description ? ` (${pt.description})` : ""}`
    ).join("\n");

    // 예산 정보 처리
    let budget = 0;
    let budgetInfoText = "";
    if (clientBudget.trim()) {
      budget = parseFloat(clientBudget.trim().replace(/[^0-9.]/g, ""));
      if (!isNaN(budget) && budget > 0) {
        budgetInfoText = `
🚨 클라이언트 예산: ${Math.round(budget).toLocaleString()}원 (절대 초과 불가)

예산 계산 방법:
- 총 비용 = 각 항목의 (수량 × 단가)의 합계
- 예산을 초과하는 경우, 기능을 줄이거나 수량을 조정해야 합니다.

⚠️ 필수 지침:
1. 산정 후 반드시 총 비용을 계산하고, 예산(${Math.round(budget).toLocaleString()}원)을 초과하지 않는지 확인하세요.
2. 예산이 부족한 경우:
   - 핵심 기능만 포함하고 부가 기능은 제외하세요
   - 수량을 최소화하세요
   - 우선순위가 낮은 페이지는 제외하세요
`;
      }
    }

    // Claude에게 페이지 분석 요청
    const systemPrompt = `당신은 웹/앱 프로젝트 페이지 산정 전문가입니다. 프로젝트 설명과 첨부된 파일을 분석하여 필요한 페이지 목록과 유형을 산정해주세요.

페이지 유형별 단가:
${pageTypesInfo}

${budgetInfoText}

응답 형식은 반드시 다음 JSON 배열 형식이어야 합니다:
[
  {
    "name": "페이지/기능명",
    "pageType": "유형 (위 목록 중 하나)",
    "quantity": 수량
  }
]

페이지 유형 선택 기준:
1. "메인페이지": 웹사이트의 메인 페이지, 랜딩 페이지
2. "하드 코딩 페이지": 서버 연동 없이 정적인 정보만 표시하는 페이지 (회사소개, 이용약관, 개인정보처리방침 등)
3. "서버 연동 페이지": 서버와 데이터를 주고받지만 게시판 형태가 아닌 페이지 (마이페이지, 설정, 검색결과 등)
4. "템플릿 게시판": 기존 레이아웃을 재사용하는 일반적인 게시판 (공지사항, FAQ, 일반 목록형 게시판)
5. "커스텀 게시판": 새로운 디자인이 필요한 게시판 (갤러리형, 카드형, 복잡한 필터링 등)
6. "플로팅": 플로팅 버튼, 플로팅 배너 등
7. "팝업": 모달 팝업, 알림 팝업, 이벤트 팝업 등

산정 규칙:
1. 프로젝트 요구사항을 분석하여 필요한 모든 페이지를 나열하세요.
2. 각 페이지의 특성에 맞는 유형을 선택하세요.
3. 같은 유형의 유사한 페이지는 하나로 묶고 수량으로 표시하세요.
4. 요구사항에 명시되지 않은 페이지는 추가하지 마세요.
5. pageType은 반드시 위에 정의된 7가지 유형 중 하나여야 합니다.`;

    // 사용자 프롬프트 구성
    type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const userContent: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; data: string; media_type: ImageMediaType } }> = [];

    // 텍스트 프롬프트 추가
    let textPrompt = `프로젝트명: ${projectName || "미지정"}

프로젝트 설명:
${projectDescription || "(없음)"}`;

    if (budget > 0) {
      textPrompt += `\n\n클라이언트 예산: ${Math.round(budget).toLocaleString()}원`;
    }

    textPrompt += `\n\n${files.length > 0 ? `첨부된 파일 ${files.length}개를 참고하여 ` : ""}위 프로젝트를 분석하여 필요한 페이지 목록을 JSON 배열 형식으로 반환해주세요.

⚠️ 중요:
- pageType은 반드시 다음 7가지 중 하나여야 합니다: "메인페이지", "하드 코딩 페이지", "서버 연동 페이지", "템플릿 게시판", "커스텀 게시판", "플로팅", "팝업"
- 유사한 페이지는 하나로 묶고 quantity로 수량을 표시하세요.`;

    if (budget > 0) {
      textPrompt += `\n\n🚨 예산 준수: 총 비용이 ${Math.round(budget).toLocaleString()}원을 초과하지 않도록 페이지를 산정하세요.`;
    }

    userContent.push({ type: "text", text: textPrompt });

    // 이미지 파일 추가
    fileContents.forEach((content) => {
      if (content.type === "image" && "source" in content) {
        const mediaType = content.source.media_type as ImageMediaType;
        if (mediaType === "image/jpeg" || mediaType === "image/png" || mediaType === "image/gif" || mediaType === "image/webp") {
          userContent.push({
            type: "image",
            source: {
              type: "base64",
              data: content.source.data,
              media_type: mediaType,
            },
          });
        }
      }
    });

    // AI 요청
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    // Claude 응답에서 텍스트 추출
    const responseText = message.content[0].type === "text"
      ? message.content[0].text
      : "";

    if (!responseText) {
      throw new Error("Claude로부터 응답을 받지 못했습니다.");
    }

    // JSON 파싱
    let milestones: TaskMilestoneItem[] = [];

    try {
      let jsonText = responseText.trim();

      // ```json ... ``` 코드 블록 처리
      if (jsonText.startsWith("```")) {
        const startIndex = jsonText.indexOf("```") + 3;
        if (jsonText.substring(startIndex).startsWith("json")) {
          jsonText = jsonText.substring(startIndex + 4).trim();
        } else {
          jsonText = jsonText.substring(startIndex).trim();
        }
        const lastIndex = jsonText.lastIndexOf("```");
        if (lastIndex !== -1) {
          jsonText = jsonText.substring(0, lastIndex).trim();
        }
      }

      // JSON 배열 찾기
      const firstBracket = jsonText.indexOf("[");

      if (firstBracket === -1) {
        throw new Error("Claude 응답에 JSON 배열이 없습니다.");
      }

      // 중첩된 대괄호 고려
      let bracketCount = 0;
      let lastBracket = -1;

      for (let i = firstBracket; i < jsonText.length; i++) {
        if (jsonText[i] === '[') {
          bracketCount++;
        } else if (jsonText[i] === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            lastBracket = i;
            break;
          }
        }
      }

      if (lastBracket === -1 || lastBracket <= firstBracket) {
        throw new Error("Claude 응답에 올바른 JSON 배열이 없습니다.");
      }

      jsonText = jsonText.substring(firstBracket, lastBracket + 1).trim();

      // JSON 파싱
      const rawMilestones = JSON.parse(jsonText);

      if (!Array.isArray(rawMilestones)) {
        throw new Error("응답이 배열 형식이 아닙니다.");
      }

      // 유효한 페이지 유형 목록
      const validPageTypes = PAGE_TYPES.map(pt => pt.type);

      // 마일스톤 항목 변환 및 유효성 검사
      milestones = rawMilestones.map((item: any) => {
        const pageType = validPageTypes.includes(item.pageType) ? item.pageType : "";
        const unitPrice = PAGE_TYPES.find(pt => pt.type === pageType)?.price || 0;
        const quantity = Number(item.quantity) || 1;

        return {
          name: item.name || "",
          pageType: pageType,
          quantity: quantity,
          unitPrice: unitPrice,
          amount: unitPrice * quantity,
        };
      });

      // 총 비용 계산
      const totalCost = milestones.reduce((sum, m) => sum + m.amount, 0);

      // 예산 검증
      if (budget > 0 && totalCost > budget) {
        const overBudgetRate = ((totalCost / budget) - 1) * 100;

        return NextResponse.json({
          milestones: milestones,
          calculatedCost: totalCost,
          budget: Math.round(budget),
          overBudgetRate: overBudgetRate.toFixed(2),
          warning: `산정된 총 비용(${totalCost.toLocaleString()}원)이 예산(${Math.round(budget).toLocaleString()}원)을 ${overBudgetRate.toFixed(1)}% 초과했습니다. 수동으로 조정이 필요합니다.`
        });
      }

    } catch (parseError) {
      console.error("JSON 파싱 오류:", parseError);
      console.error("Claude 응답:", responseText);

      return NextResponse.json(
        {
          error: `AI 응답을 파싱하는 중 오류가 발생했습니다.`,
          details: "프로젝트 설명을 더 자세히 입력하거나 다시 시도해주세요.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ milestones });
  } catch (error) {
    console.error("AI 분석 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
