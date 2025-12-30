import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MilestoneItem } from "@/lib/quotationProcessor";

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

    // 파일 처리: 텍스트 파일 내용 추출 및 이미지 base64 변환
    const fileContents: Array<{ type: string; source: { type: string; data: string; media_type: string } } | { type: string; text: string }> = [];
    
    for (const file of files) {
      const fileType = file.type;
      const fileName = file.name.toLowerCase();
      
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
      } 
      // 이미지가 아닌 파일인 경우 (지원하지 않음)
      else {
        // 이미지만 지원하므로 다른 파일 타입은 무시
        console.warn(`지원하지 않는 파일 타입: ${fileType} (${file.name})`);
      }
    }

    // 가격 기준 정보 (M/D 기준, 원 단위) - 노임단가
    const priceBaseInfo = {
      "기획/디자인": 326566,
      "PM": 443955,
      "백엔드": 337061,
      "프론트엔드": 337061,
      "QA": 173328,
    };

    // 제경비와 기술료를 포함한 단가 계산 (M/D 기준)
    // 직접인건비 = 노임단가 × 20.9일
    // 제경비 = 직접인건비 × 110% = 노임단가 × 20.9 × 1.1
    // 기술료 = 직접인건비 × 20% = 노임단가 × 20.9 × 0.2
    // 총액 = 직접인건비 + 제경비 + 기술료 = 노임단가 × 20.9 × (1 + 1.1 + 0.2) = 노임단가 × 20.9 × 2.3
    // M/D 기준 단가 = 총액 / 20.9 = 노임단가 × 2.3
    const getTotalPricePerMD = (basePrice: number) => basePrice * 2.3;

    // 가격 기준 정보 문자열 생성 (제경비, 기술료 포함)
    const priceInfoText = `
가격 기준 (M/D 단위, 원) - 제경비(110%), 기술료(20%) 포함:
- 기획/디자인: ${Math.round(getTotalPricePerMD(priceBaseInfo["기획/디자인"])).toLocaleString()}원/M/D
- PM: ${Math.round(getTotalPricePerMD(priceBaseInfo["PM"])).toLocaleString()}원/M/D
- 백엔드: ${Math.round(getTotalPricePerMD(priceBaseInfo["백엔드"])).toLocaleString()}원/M/D
- 프론트엔드: ${Math.round(getTotalPricePerMD(priceBaseInfo["프론트엔드"])).toLocaleString()}원/M/D
- QA: ${Math.round(getTotalPricePerMD(priceBaseInfo["QA"])).toLocaleString()}원/M/D

참고: 
- 노임단가(M/D) × 2.3 = 제경비(110%), 기술료(20%) 포함 단가(M/D)
- 1 M/D = 8시간
- 시간을 M/D로 변환: 시간 ÷ 8
`;

    // 예산 정보 추가
    let budgetInfoText = "";
    let budget = 0;
    if (clientBudget.trim()) {
      budget = parseFloat(clientBudget.trim().replace(/[^0-9.]/g, ""));
      if (!isNaN(budget) && budget > 0) {
        // 예산 계산 공식 제공 (M/D 기준, 제경비/기술료 포함)
        const budgetCalculationFormula = `
예산 계산 공식 (M/D 기준, 제경비 110%, 기술료 20% 포함):
총 비용 = (기획/디자인 시간 ÷ 8시간) × ${Math.round(getTotalPricePerMD(priceBaseInfo["기획/디자인"])).toLocaleString()}원/M/D
        + (PM 시간 ÷ 8시간) × ${Math.round(getTotalPricePerMD(priceBaseInfo["PM"])).toLocaleString()}원/M/D
        + (백엔드 시간 ÷ 8시간) × ${Math.round(getTotalPricePerMD(priceBaseInfo["백엔드"])).toLocaleString()}원/M/D
        + (프론트엔드 시간 ÷ 8시간) × ${Math.round(getTotalPricePerMD(priceBaseInfo["프론트엔드"])).toLocaleString()}원/M/D
        + (QA 시간 ÷ 8시간) × ${Math.round(getTotalPricePerMD(priceBaseInfo["QA"])).toLocaleString()}원/M/D

참고: 
- 1 M/D = 8시간
- 시간을 M/D로 변환: 시간 ÷ 8
- 단가는 제경비(110%), 기술료(20%) 포함된 금액

위 공식으로 계산한 총 비용이 반드시 예산(${Math.round(budget).toLocaleString()}원)을 초과하지 않아야 합니다.
`;

        // 예산별 시간 제한 계산 (대략적인 가이드) - M/D 기준
        const avgPricePerMD = (
          getTotalPricePerMD(priceBaseInfo["기획/디자인"]) +
          getTotalPricePerMD(priceBaseInfo["PM"]) +
          getTotalPricePerMD(priceBaseInfo["백엔드"]) +
          getTotalPricePerMD(priceBaseInfo["프론트엔드"]) +
          getTotalPricePerMD(priceBaseInfo["QA"])
        ) / 5;
        const avgPricePerHour = avgPricePerMD / 8; // M/D를 시간으로 변환
        const maxTotalHours = Math.floor(budget / avgPricePerHour * 0.9); // 90%로 제한하여 여유 확보

        budgetInfoText = `
🚨 클라이언트 예산: ${Math.round(budget).toLocaleString()}원 (절대 초과 불가)
${budgetCalculationFormula}

⚠️ 예산 계산 예시 (M/D 기준, 제경비/기술료 포함):
- 기획/디자인 10시간 = (10 ÷ 8) × ${Math.round(getTotalPricePerMD(priceBaseInfo["기획/디자인"])).toLocaleString()} ≈ ${Math.round((10 / 8) * getTotalPricePerMD(priceBaseInfo["기획/디자인"])).toLocaleString()}원
- 백엔드 20시간 = (20 ÷ 8) × ${Math.round(getTotalPricePerMD(priceBaseInfo["백엔드"])).toLocaleString()} ≈ ${Math.round((20 / 8) * getTotalPricePerMD(priceBaseInfo["백엔드"])).toLocaleString()}원
- 프론트엔드 15시간 = (15 ÷ 8) × ${Math.round(getTotalPricePerMD(priceBaseInfo["프론트엔드"])).toLocaleString()} ≈ ${Math.round((15 / 8) * getTotalPricePerMD(priceBaseInfo["프론트엔드"])).toLocaleString()}원

예상 최대 총 공수: 약 ${maxTotalHours}시간 (평균 단가 기준, 90% 여유 확보)

🚨 필수 지침 (반드시 준수):
1. 공수는 시간 단위로 산정하며, 8시간 단위로 맞출 필요 없습니다. (예: 3시간, 5시간, 12시간, 15시간 등)
2. ⚠️ 반드시 위 예산 계산 공식을 사용하여 각 마일스톤의 공수를 산정하기 전에 총 비용을 미리 계산하세요.
3. ⚠️ 총 비용이 예산(${Math.round(budget).toLocaleString()}원)을 초과하면 절대 안 됩니다. 초과하는 경우 즉시 공수를 줄이거나 기능을 제외하세요.
4. 예산이 부족한 경우:
   - AI 활용 개발 공수 기준을 참고하여 공수를 최소화하세요 (기존 공수의 30-50% 수준)
   - 요구사항에 명시되지 않은 기능은 완전히 제외하세요
   - 핵심 기능만 포함하고 부가 기능은 모두 제외하세요
   - 각 마일스톤의 공수를 최소화하여 예산 내에서 가능한 최소 기능만 포함하세요
5. ⚠️ 산정 후 반드시 총 비용을 계산하고, 예산(${Math.round(budget).toLocaleString()}원)을 초과하지 않는지 확인하세요. 초과하면 공수를 줄여서 다시 산정하세요.
6. 예산이 ${Math.round(budget).toLocaleString()}원이므로, 총 공수는 대략 ${maxTotalHours}시간 이하로 산정해야 합니다.
`;
      }
    }

    // Claude에게 마일스톤 분석 요청
    const systemPrompt = `당신은 소프트웨어 프로젝트 공수 산정 전문가입니다. 프로젝트 설명과 첨부된 파일을 분석하여 마일스톤과 공수를 산정해주세요.
${priceInfoText}
${budgetInfoText}
응답 형식은 반드시 다음 JSON 배열 형식이어야 합니다:
[
  {
    "depth1": "대분류",
    "depth2": "중분류",
    "depth3": "소분류",
    "planning": 기획/디자인 공수(시간),
    "server": 서버 개발 공수(시간),
    "app": 앱 개발 공수(시간),
    "web": 웹 개발 공수(시간),
    "text": QA 공수(시간),
    "pm": PM 공수(시간),
    "total": 총 공수(시간)
  }
]

⚠️ 매우 중요: 각 마일스톤 항목마다 모든 공수 필드를 반드시 포함해야 합니다:
- planning: 해당 기능의 기획/디자인 공수
- server: 해당 기능의 서버 개발 공수
- app: 해당 기능의 앱 개발 공수
- web: 해당 기능의 웹 개발 공수
- text: 해당 기능의 QA(테스트) 공수 - 각 기능마다 반드시 포함
- pm: 해당 기능의 PM(프로젝트 관리) 공수 - 각 기능마다 반드시 포함
- total: 위 모든 공수의 합계

QA와 PM은 별도 마일스톤 항목으로 만들지 말고, 각 기능 항목(depth1, depth2, depth3)에 포함되어야 합니다.
예를 들어, "회원가입" 기능이 있다면:
- planning: 회원가입 기획/디자인 공수
- server: 회원가입 서버 개발 공수
- app: 회원가입 앱 개발 공수
- web: 회원가입 웹 개발 공수
- text: 회원가입 QA 공수 (반드시 포함)
- pm: 회원가입 PM 공수 (반드시 포함)
- total: 위 모든 공수의 합

공수 산정 규칙 (반드시 준수):
1. 각 공수는 man-hours(시간) 단위로 산정합니다.
2. ⚠️ 중요: 8시간 단위로 맞출 필요가 전혀 없습니다. 정확한 시간 단위로 자유롭게 산정하세요. 
   - 좋은 예: 3시간, 5시간, 7시간, 12시간, 15시간, 18시간, 22시간, 30시간 등
   - 나쁜 예: 8시간, 16시간, 24시간, 32시간 등 (8의 배수로만 산정하지 마세요)
3. AI 활용 개발 공수 기준을 참고하여 현실적이고 효율적인 공수를 산정하세요.
4. ⚠️ 각 마일스톤 항목마다 QA(text)와 PM(pm) 공수를 반드시 포함하세요. 0이어도 명시적으로 0으로 표시하세요.
${budgetInfoText ? `
5. 🚨 예산이 있는 경우, 반드시 예산 계산 공식을 사용하여 총 비용을 계산하고 예산을 절대 초과하지 않도록 공수를 조정하세요.
6. 🚨 예산을 초과하는 경우, 즉시 공수를 줄이거나 기능을 제외하여 예산 내에서 산정하세요. 예산 초과는 절대 허용되지 않습니다.
7. 🚨 산정한 각 마일스톤의 공수를 합산하여 총 비용을 계산하고, 예산을 초과하지 않는지 반드시 확인하세요. 초과하면 공수를 줄여서 다시 산정하세요.
8. 🚨 예산(${Math.round(budget).toLocaleString()}원)을 초과하는 공수 산정은 절대 불가능합니다. 예산 내에서만 산정하세요.
` : ""}
9. 프로젝트의 핵심 기능은 반드시 포함하되, 요구사항에 없는 기능은 제외하세요.`;

    // 사용자 프롬프트 구성
    type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const userContent: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; data: string; media_type: ImageMediaType } }> = [];
    
    // 텍스트 프롬프트 추가
    let textPrompt = `프로젝트명: ${projectName || "미지정"}

프로젝트 설명:
${projectDescription || "(없음)"}`;

    if (clientBudget.trim() && budget > 0) {
      textPrompt += `\n\n클라이언트 예산: ${Math.round(budget).toLocaleString()}원`;
    }

    textPrompt += `\n\n${files.length > 0 ? `첨부된 파일 ${files.length}개를 참고하여 ` : ""}위 프로젝트를 분석하여 마일스톤과 공수를 JSON 배열 형식으로 반환해주세요.

⚠️ 중요: 각 마일스톤 항목마다 QA(text)와 PM(pm) 공수를 반드시 포함해야 합니다. 
- QA는 각 기능의 테스트 공수입니다. 각 기능마다 반드시 포함하세요.
- PM은 각 기능의 프로젝트 관리 공수입니다. 각 기능마다 반드시 포함하세요.
- QA와 PM을 별도 마일스톤 항목으로 만들지 말고, 각 기능 항목에 포함하세요.`;

    if (budget > 0) {
      // M/D 기준 평균 단가 계산
      const avgPricePerMD = (
        getTotalPricePerMD(priceBaseInfo["기획/디자인"]) +
        getTotalPricePerMD(priceBaseInfo["PM"]) +
        getTotalPricePerMD(priceBaseInfo["백엔드"]) +
        getTotalPricePerMD(priceBaseInfo["프론트엔드"]) +
        getTotalPricePerMD(priceBaseInfo["QA"])
      ) / 5;
      const avgPricePerHour = avgPricePerMD / 8; // M/D를 시간으로 변환
      const maxTotalHours = Math.floor(budget / avgPricePerHour * 0.9); // 90%로 제한하여 여유 확보
      
      textPrompt += `\n\n🚨 매우 중요 (반드시 준수):
1. 공수를 산정할 때 8시간 단위(8, 16, 24, 32...)로만 산정하지 말고, 정확한 시간 단위로 산정하세요.
2. 🚨 예산: ${Math.round(budget).toLocaleString()}원 (절대 초과 불가)
3. 🚨 예상 최대 총 공수: 약 ${maxTotalHours}시간 이하로 산정해야 합니다.
4. 🚨 산정한 공수로 계산한 총 비용이 예산(${Math.round(budget).toLocaleString()}원)을 절대 초과하지 않도록 반드시 확인하고 조정하세요.
5. 🚨 예산을 초과하는 경우, 즉시 공수를 줄이거나 기능을 제외하여 예산 내에서 산정하세요. 예산 초과는 절대 허용되지 않습니다.
6. 🚨 각 마일스톤의 공수를 산정한 후, 반드시 총 비용을 계산하고 예산을 초과하지 않는지 확인하세요. 초과하면 공수를 줄여서 다시 산정하세요.`;
    } else {
      textPrompt += `\n\n⚠️ 중요: 공수를 산정할 때 8시간 단위(8, 16, 24, 32...)로만 산정하지 말고, 정확한 시간 단위로 산정하세요.`;
    }
    
    userContent.push({ type: "text", text: textPrompt });
    
    // 파일 내용 추가
    fileContents.forEach((content) => {
      if (content.type === "image" && "source" in content) {
        const mediaType = content.source.media_type as ImageMediaType;
        // 지원되는 이미지 타입만 추가
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
      } else if (content.type === "text" && "text" in content) {
        userContent.push({
          type: "text",
          text: content.text,
        });
      }
    });

    // AI 요청 함수 (재사용을 위해 함수로 분리)
    const requestAI = async (messages: any[]) => {
      return await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        system: systemPrompt,
        messages: messages,
      });
    };

    let message = await requestAI([
      {
        role: "user",
        content: userContent,
      },
    ]);

    // Claude 응답에서 텍스트 추출
    const responseText = message.content[0].type === "text" 
      ? message.content[0].text 
      : "";

    if (!responseText) {
      throw new Error("Claude로부터 응답을 받지 못했습니다.");
    }

    // JSON 파싱 시도
    let milestones: MilestoneItem[] = [];
    
    try {
      let jsonText = responseText.trim();
      
      // ```json ... ``` 코드 블록이 있는 경우 추출
      if (jsonText.startsWith("```")) {
        // 첫 번째 ``` 이후부터 마지막 ``` 이전까지 추출
        const startIndex = jsonText.indexOf("```") + 3;
        // json 또는 다른 언어 태그 제거
        if (jsonText.substring(startIndex).startsWith("json")) {
          jsonText = jsonText.substring(startIndex + 4).trim();
        } else {
          jsonText = jsonText.substring(startIndex).trim();
        }
        // 마지막 ``` 제거
        const lastIndex = jsonText.lastIndexOf("```");
        if (lastIndex !== -1) {
          jsonText = jsonText.substring(0, lastIndex).trim();
        }
      }
      
      // JSON 배열 찾기: 첫 번째 [부터 올바른 닫는 ]까지 (중첩 대괄호 고려)
      const firstBracket = jsonText.indexOf("[");
      
      if (firstBracket === -1) {
        throw new Error("Claude 응답에 JSON 배열이 없습니다. 응답: " + responseText.substring(0, 200));
      }
      
      // 중첩된 대괄호를 고려하여 올바른 닫는 대괄호 찾기
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
        throw new Error("Claude 응답에 올바른 JSON 배열이 없습니다. 응답: " + responseText.substring(0, 200));
      }
      
      // JSON 배열 추출
      jsonText = jsonText.substring(firstBracket, lastBracket + 1);
      
      // JSON 파싱 전에 추가 문자 제거 (공백, 줄바꿈 등)
      jsonText = jsonText.trim();
      
      // JSON 파싱
      milestones = JSON.parse(jsonText);

      // 유효성 검사
      if (!Array.isArray(milestones)) {
        throw new Error("응답이 배열 형식이 아닙니다.");
      }

      // 각 마일스톤 항목의 필수 필드 확인 및 기본값 설정
      milestones = milestones.map((item: any) => ({
        depth1: item.depth1 || "",
        depth2: item.depth2 || "",
        depth3: item.depth3 || "",
        planning: Number(item.planning) || 0,
        server: Number(item.server) || 0,
        app: Number(item.app) || 0,
        web: Number(item.web) || 0,
        text: Number(item.text) || 0,
        pm: Number(item.pm) || 0,
        total: Number(item.total) || 0,
      }));

      // 예산 검증 (예산이 있는 경우)
      if (budget > 0) {
        // 총 시간 계산
        const totalPlanningHours = milestones.reduce((sum, m) => sum + m.planning, 0);
        const totalPMHours = milestones.reduce((sum, m) => sum + m.pm, 0);
        const totalServerHours = milestones.reduce((sum, m) => sum + m.server, 0);
        const totalAppHours = milestones.reduce((sum, m) => sum + m.app, 0);
        const totalWebHours = milestones.reduce((sum, m) => sum + m.web, 0);
        const totalQAHours = milestones.reduce((sum, m) => sum + m.text, 0);

        // 총 비용 계산 (M/D 기준, 제경비/기술료 포함)
        // 시간을 M/D로 변환: 시간 ÷ 8
        // M/D × (제경비/기술료 포함 단가)
        const totalCost = 
          ((totalPlanningHours / 8) * getTotalPricePerMD(priceBaseInfo["기획/디자인"])) +
          ((totalPMHours / 8) * getTotalPricePerMD(priceBaseInfo["PM"])) +
          ((totalServerHours / 8) * getTotalPricePerMD(priceBaseInfo["백엔드"])) +
          (((totalAppHours + totalWebHours) / 8) * getTotalPricePerMD(priceBaseInfo["프론트엔드"])) +
          ((totalQAHours / 8) * getTotalPricePerMD(priceBaseInfo["QA"]));

        let totalCostRounded = Math.round(totalCost);
        
        // 40% 이상 초과하는 경우에만 자동 재요청 (최대 2회)
        let retryCount = 0;
        const maxRetries = 2;
        const retryThreshold = 40; // 40% 초과 시 재요청
        
        // 예산 초과율 계산 (매번 재계산)
        let overBudgetRate = (totalCostRounded / budget - 1) * 100;
        
        // 디버깅: 초기 계산 값 로그
        console.log(`[예산 검증] 예산: ${Math.round(budget).toLocaleString()}원, 계산된 비용: ${totalCostRounded.toLocaleString()}원, 초과율: ${overBudgetRate.toFixed(2)}%`);
        
        while (totalCostRounded > budget && overBudgetRate >= retryThreshold && retryCount < maxRetries) {
          console.warn(`예산 초과 (재시도 ${retryCount + 1}/${maxRetries}): 계산된 총 비용 ${totalCostRounded.toLocaleString()}원이 예산 ${Math.round(budget).toLocaleString()}원을 ${overBudgetRate.toFixed(1)}% 초과했습니다.`);
          
          // 재요청 메시지 생성
          const retryMessage = `🚨 예산 초과 오류 발생!

현재 산정된 공수로 계산한 총 비용: ${totalCostRounded.toLocaleString()}원
예산: ${Math.round(budget).toLocaleString()}원
초과율: ${overBudgetRate.toFixed(1)}%

위 공수는 예산을 초과하므로 절대 사용할 수 없습니다. 다음을 수행하세요:

1. 모든 마일스톤의 공수를 ${Math.round((budget / totalCostRounded) * 100)}% 수준으로 줄이세요 (약 ${Math.round((budget / totalCostRounded) * 100)}% 감소 필요)
2. 우선순위가 낮은 기능은 완전히 제외하세요
3. 핵심 기능만 남기고 부가 기능은 모두 제외하세요
4. AI 활용 개발 공수 기준을 참고하여 공수를 최소화하세요
5. 총 비용이 예산(${Math.round(budget).toLocaleString()}원)을 절대 초과하지 않도록 다시 산정하세요

예산을 초과하는 공수 산정은 절대 허용되지 않습니다.`;

          // 재요청
          const retryResponse = await requestAI([
            {
              role: "user",
              content: userContent,
            },
            {
              role: "assistant",
              content: JSON.stringify(milestones, null, 2),
            },
            {
              role: "user",
              content: retryMessage,
            },
          ]);

          const retryResponseText = retryResponse.content[0].type === "text" 
            ? retryResponse.content[0].text 
            : "";

          if (!retryResponseText) {
            break; // 재요청 실패 시 중단
          }

          // JSON 파싱 (동일한 로직 사용)
          let retryJsonText = retryResponseText.trim();
          
          // ```json ... ``` 코드 블록이 있는 경우 추출
          if (retryJsonText.startsWith("```")) {
            const startIndex = retryJsonText.indexOf("```") + 3;
            if (retryJsonText.substring(startIndex).startsWith("json")) {
              retryJsonText = retryJsonText.substring(startIndex + 4).trim();
            } else {
              retryJsonText = retryJsonText.substring(startIndex).trim();
            }
            const lastIndex = retryJsonText.lastIndexOf("```");
            if (lastIndex !== -1) {
              retryJsonText = retryJsonText.substring(0, lastIndex).trim();
            }
          }

          // JSON 배열 찾기: 중첩된 대괄호 고려
          const retryFirstBracket = retryJsonText.indexOf("[");
          
          if (retryFirstBracket === -1) {
            break; // JSON 배열을 찾을 수 없음
          }
          
          // 중첩된 대괄호를 고려하여 올바른 닫는 대괄호 찾기
          let retryBracketCount = 0;
          let retryLastBracket = -1;
          
          for (let i = retryFirstBracket; i < retryJsonText.length; i++) {
            if (retryJsonText[i] === '[') {
              retryBracketCount++;
            } else if (retryJsonText[i] === ']') {
              retryBracketCount--;
              if (retryBracketCount === 0) {
                retryLastBracket = i;
                break;
              }
            }
          }
          
          if (retryLastBracket === -1 || retryLastBracket <= retryFirstBracket) {
            break; // 올바른 JSON 배열을 찾을 수 없음
          }
          
          // JSON 배열 추출
          retryJsonText = retryJsonText.substring(retryFirstBracket, retryLastBracket + 1).trim();
          
          try {
            // JSON 파싱
            milestones = JSON.parse(retryJsonText);
            
            // 마일스톤 재처리
            milestones = milestones.map((item: any) => ({
              depth1: item.depth1 || "",
              depth2: item.depth2 || "",
              depth3: item.depth3 || "",
              planning: Number(item.planning) || 0,
              server: Number(item.server) || 0,
              app: Number(item.app) || 0,
              web: Number(item.web) || 0,
              text: Number(item.text) || 0,
              pm: Number(item.pm) || 0,
              total: Number(item.total) || 0,
            }));

            // 재계산
            const retryTotalPlanningHours = milestones.reduce((sum, m) => sum + m.planning, 0);
            const retryTotalPMHours = milestones.reduce((sum, m) => sum + m.pm, 0);
            const retryTotalServerHours = milestones.reduce((sum, m) => sum + m.server, 0);
            const retryTotalAppHours = milestones.reduce((sum, m) => sum + m.app, 0);
            const retryTotalWebHours = milestones.reduce((sum, m) => sum + m.web, 0);
            const retryTotalQAHours = milestones.reduce((sum, m) => sum + m.text, 0);

            // 재요청 후 비용 계산 (M/D 기준, 제경비/기술료 포함)
            const retryTotalCost = 
              ((retryTotalPlanningHours / 8) * getTotalPricePerMD(priceBaseInfo["기획/디자인"])) +
              ((retryTotalPMHours / 8) * getTotalPricePerMD(priceBaseInfo["PM"])) +
              ((retryTotalServerHours / 8) * getTotalPricePerMD(priceBaseInfo["백엔드"])) +
              (((retryTotalAppHours + retryTotalWebHours) / 8) * getTotalPricePerMD(priceBaseInfo["프론트엔드"])) +
              ((retryTotalQAHours / 8) * getTotalPricePerMD(priceBaseInfo["QA"]));

            const retryTotalCostRounded = Math.round(retryTotalCost);
            
            if (retryTotalCostRounded <= budget) {
              // 예산 내로 조정됨
              console.log(`예산 조정 성공: ${retryTotalCostRounded.toLocaleString()}원 (예산: ${Math.round(budget).toLocaleString()}원)`);
              totalCostRounded = retryTotalCostRounded;
              break;
            } else {
              // 여전히 초과 - 초과율 재계산
              totalCostRounded = retryTotalCostRounded;
              overBudgetRate = (totalCostRounded / budget - 1) * 100;
              
              console.log(`[재요청 후] 계산된 비용: ${totalCostRounded.toLocaleString()}원, 초과율: ${overBudgetRate.toFixed(2)}%`);
              
              // 40% 미만 초과면 재요청 중단
              if (overBudgetRate < retryThreshold) {
                console.log(`예산 초과율이 ${overBudgetRate.toFixed(1)}%로 40% 미만이므로 재요청을 중단합니다.`);
                break;
              }
              
              retryCount++;
            }
          } catch (parseError) {
            console.error("재요청 JSON 파싱 오류:", parseError);
            break; // JSON 파싱 실패 시 중단
          }
        }

        // 최종 검증: 40% 이상 초과하는 경우에만 경고 반환
        // overBudgetRate를 최신 값으로 재계산 (while 루프에서 업데이트되었을 수 있음)
        overBudgetRate = (totalCostRounded / budget - 1) * 100;
        
        console.log(`[최종 검증] 예산: ${Math.round(budget).toLocaleString()}원, 계산된 비용: ${totalCostRounded.toLocaleString()}원, 초과율: ${overBudgetRate.toFixed(2)}%`);
        
        if (totalCostRounded > budget && overBudgetRate >= retryThreshold) {
          return NextResponse.json(
            {
              error: "예산 초과",
              details: `산정된 공수로 계산한 총 비용(${totalCostRounded.toLocaleString()}원)이 예산(${Math.round(budget).toLocaleString()}원)을 ${overBudgetRate.toFixed(1)}% 초과했습니다.`,
              milestones: milestones,
              calculatedCost: totalCostRounded,
              budget: Math.round(budget),
              overBudgetRate: overBudgetRate.toFixed(2),
              warning: "예산을 크게 초과하여 공수를 수동으로 조정하거나 기능을 줄여야 합니다."
            },
            { status: 200 }
          );
        }
        
        // 40% 미만 초과는 경고 없이 반환 (정상 처리)
        if (totalCostRounded > budget && overBudgetRate < retryThreshold) {
          console.log(`예산 초과율이 ${overBudgetRate.toFixed(1)}%로 40% 미만이므로 정상 처리합니다.`);
        }
      }

    } catch (parseError) {
      console.error("JSON 파싱 오류:", parseError);
      console.error("Claude 응답:", responseText);
      
      // JSON 파싱 실패 시 사용자에게 더 명확한 오류 메시지 제공
      const errorMessage = parseError instanceof Error ? parseError.message : "알 수 없는 오류";
      const responsePreview = responseText.substring(0, 500);
      
      return NextResponse.json(
        { 
          error: `AI 응답을 파싱하는 중 오류가 발생했습니다: ${errorMessage}`,
          details: "Claude가 JSON 형식이 아닌 텍스트로 응답했습니다. 프로젝트 설명을 더 자세히 입력하거나 다시 시도해주세요.",
          responsePreview: responsePreview
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

