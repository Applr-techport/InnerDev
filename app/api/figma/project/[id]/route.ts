import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 프로젝트 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: project, error } = await supabase
      .from("FigmaProject")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) {
      throw error;
    }

    if (!project) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("프로젝트 조회 오류:", error);
    return NextResponse.json(
      { error: "프로젝트를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 프로젝트 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.figmaUrl !== undefined) updateData.figmaUrl = data.figmaUrl;
    if (data.fileId !== undefined) updateData.fileId = data.fileId;
    if (data.pages !== undefined) updateData.pages = data.pages;
    if (data.selectedPages !== undefined) updateData.selectedPages = data.selectedPages;
    if (data.convertedPages !== undefined) updateData.convertedPages = data.convertedPages;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.lastSavedData !== undefined) updateData.lastSavedData = data.lastSavedData;

    const { data: project, error } = await supabase
      .from("FigmaProject")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!project) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "프로젝트가 업데이트되었습니다.", project });
  } catch (error) {
    console.error("프로젝트 수정 오류:", error);
    return NextResponse.json(
      { error: "프로젝트 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 프로젝트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from("FigmaProject")
      .delete()
      .eq("id", params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "프로젝트가 삭제되었습니다." });
  } catch (error) {
    console.error("프로젝트 삭제 오류:", error);
    return NextResponse.json(
      { error: "프로젝트 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}



