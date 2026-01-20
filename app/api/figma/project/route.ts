import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 프로젝트 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { data: projects, error } = await supabase
      .from("FigmaProject")
      .select("id, name, figmaUrl, status, createdAt, updatedAt")
      .order("updatedAt", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json(projects);
  } catch (error) {
    console.error("프로젝트 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "프로젝트 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 프로젝트 생성
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, figmaUrl, fileId, pages } = data;

    if (!name || !figmaUrl || !fileId) {
      return NextResponse.json(
        { error: "프로젝트 이름, 피그마 URL, 파일 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();

    const { data: project, error } = await supabase
      .from("FigmaProject")
      .insert({
        id,
        name,
        figmaUrl,
        fileId,
        pages: pages || [],
        selectedPages: [],
        convertedPages: {},
        status: "draft",
        lastSavedData: null,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ id: project.id, message: "프로젝트가 생성되었습니다." });
  } catch (error) {
    console.error("프로젝트 생성 오류:", error);
    return NextResponse.json(
      { error: "프로젝트 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}



