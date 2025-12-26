import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { MilestoneItem } from "@/lib/quotationProcessor";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectName = formData.get("projectName") as string;
    const projectDescription = formData.get("projectDescription") as string || "";
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

    // Claude에게 마일스톤 분석 요청
    const systemPrompt = `당신은 소프트웨어 프로젝트 공수 산정 전문가입니다. 프로젝트 설명과 첨부된 파일을 분석하여 마일스톤과 공수를 산정해주세요.

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

각 공수는 man-hours 단위로 산정하며, 실제 개발에 필요한 시간을 정확히 계산해주세요.`;

    // 사용자 프롬프트 구성
    type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const userContent: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; data: string; media_type: ImageMediaType } }> = [];
    
    // 텍스트 프롬프트 추가
    const textPrompt = `프로젝트명: ${projectName || "미지정"}

프로젝트 설명:
${projectDescription || "(없음)"}

${files.length > 0 ? `\n첨부된 파일 ${files.length}개를 참고하여 ` : ""}위 프로젝트를 분석하여 마일스톤과 공수를 JSON 배열 형식으로 반환해주세요.`;
    
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

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
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
      
      // JSON 배열 찾기: 첫 번째 [부터 마지막 ]까지
      const firstBracket = jsonText.indexOf("[");
      const lastBracket = jsonText.lastIndexOf("]");
      
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        jsonText = jsonText.substring(firstBracket, lastBracket + 1);
        milestones = JSON.parse(jsonText);
      } else {
        // JSON 배열을 찾을 수 없는 경우 - Claude가 JSON이 아닌 텍스트로 응답
        throw new Error("Claude 응답에 JSON 배열이 없습니다. 응답: " + responseText.substring(0, 200));
      }

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

