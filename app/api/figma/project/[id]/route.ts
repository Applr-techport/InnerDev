import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 프로젝트 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.figmaProject.findUnique({
      where: { id: params.id },
    });

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

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.figmaUrl !== undefined) updateData.figmaUrl = data.figmaUrl;
    if (data.fileId !== undefined) updateData.fileId = data.fileId;
    if (data.pages !== undefined) updateData.pages = data.pages;
    if (data.selectedPages !== undefined) updateData.selectedPages = data.selectedPages;
    if (data.convertedPages !== undefined) updateData.convertedPages = data.convertedPages;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.lastSavedData !== undefined) updateData.lastSavedData = data.lastSavedData;

    const project = await prisma.figmaProject.update({
      where: { id: params.id },
      data: updateData,
    });

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
    await prisma.figmaProject.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: "프로젝트가 삭제되었습니다." });
  } catch (error) {
    console.error("프로젝트 삭제 오류:", error);
    return NextResponse.json(
      { error: "프로젝트 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
