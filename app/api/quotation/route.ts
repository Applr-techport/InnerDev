import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { QuotationData } from "@/lib/quotationProcessor";

// 견적서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectName = searchParams.get("projectName");

    const quotations = await prisma.quotation.findMany({
      where: {
        deletedAt: null, // 삭제되지 않은 것만 조회
        ...(projectName && { projectName: { contains: projectName, mode: "insensitive" } }),
      },
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

    return NextResponse.json(quotations);
  } catch (error) {
    console.error("견적서 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "견적서 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 견적서 저장
export async function POST(request: NextRequest) {
  try {
    const data: QuotationData = await request.json();

    const quotation = await prisma.quotation.create({
      data: {
        version: data.project.version,
        companyName: data.company.name,
        companyAddress: data.company.address,
        companyBusinessNumber: data.company.businessNumber,
        companyRepresentative: data.company.representative,
        companyPhone: data.company.phone,
        clientName: data.client.name,
        clientPhone: data.client.phone,
        projectName: data.project.name,
        projectVersion: data.project.version,
        projectDate: data.project.date,
        projectValidityDays: data.project.validityDays,
        discountRate: data.discountRate,
        workPeriod: data.workPeriod,
        notes: data.notes,
        totalAmount: data.totalAmount,
        vatIncluded: data.vatIncluded,
        historyData: data.history as any,
        milestonesData: data.milestones as any,
        quotationItems: data.quotationItems as any,
        gradeInfoData: data.gradeInfo as any,
        milestoneColumnWidths: data.milestoneColumnWidths as any || null,
        rowsPerPage: data.rowsPerPage || 20,
        roundingUnit: data.roundingUnit || 10000,
      },
    });

    return NextResponse.json({ id: quotation.id, message: "견적서가 저장되었습니다." });
  } catch (error) {
    console.error("견적서 저장 오류:", error);
    return NextResponse.json(
      { error: "견적서 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
