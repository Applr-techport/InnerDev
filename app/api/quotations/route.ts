import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 모든 견적서 통합 목록 조회 (M/M 기반 + 페이지 단가 기반)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectName = searchParams.get("projectName");
    const type = searchParams.get("type"); // 'mm', 'task', or null (all)

    const whereClause = {
      deletedAt: null,
      ...(projectName && { projectName: { contains: projectName, mode: "insensitive" as const } }),
    };

    // M/M 기반 견적서 조회
    const mmQuotations = type === "task" ? [] : await prisma.quotation.findMany({
      where: whereClause,
      select: {
        id: true,
        version: true,
        projectName: true,
        clientName: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 페이지 단가 기반 견적서 조회
    const taskQuotations = type === "mm" ? [] : await prisma.taskQuotation.findMany({
      where: whereClause,
      select: {
        id: true,
        version: true,
        projectName: true,
        clientName: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 합쳐서 type 필드 추가
    const combined = [
      ...mmQuotations.map(q => ({ ...q, type: "mm" as const, typeLabel: "M/M 기반" })),
      ...taskQuotations.map(q => ({ ...q, type: "task" as const, typeLabel: "페이지 단가" })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      quotations: combined,
      total: combined.length,
      mmCount: mmQuotations.length,
      taskCount: taskQuotations.length,
    });
  } catch (error) {
    console.error("통합 견적서 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "견적서 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
