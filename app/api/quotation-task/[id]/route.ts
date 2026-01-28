import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TaskQuotationData } from "@/lib/quotationTaskProcessor";

// 업무 단위 견적서 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const quotation = await prisma.taskQuotation.findUnique({
      where: { id: params.id },
    });

    if (!quotation) {
      return NextResponse.json(
        { error: "견적서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // DB 데이터를 TaskQuotationData 형식으로 변환
    const quotationData: TaskQuotationData = {
      company: {
        name: quotation.companyName,
        address: quotation.companyAddress,
        businessNumber: quotation.companyBusinessNumber,
        representative: quotation.companyRepresentative,
        phone: quotation.companyPhone,
      },
      client: {
        name: quotation.clientName,
        phone: quotation.clientPhone,
      },
      project: {
        name: quotation.projectName,
        version: quotation.projectVersion,
        date: quotation.projectDate,
        validityDays: quotation.projectValidityDays,
      },
      history: quotation.historyData as any,
      milestones: quotation.milestonesData as any,
      quotationItems: quotation.quotationItems as any,
      discountRate: quotation.discountRate,
      workPeriod: quotation.workPeriod,
      notes: quotation.notes || "",
      totalAmount: quotation.totalAmount,
      vatIncluded: quotation.vatIncluded,
      rowsPerPage: quotation.rowsPerPage || 15,
      roundingUnit: quotation.roundingUnit || 10000,
    };

    return NextResponse.json({
      ...quotationData,
      id: quotation.id,
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
      deletedAt: quotation.deletedAt,
    });
  } catch (error) {
    console.error("업무 단위 견적서 조회 오류:", error);
    return NextResponse.json(
      { error: "견적서 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 업무 단위 견적서 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data: TaskQuotationData = await request.json();

    const quotation = await prisma.taskQuotation.update({
      where: { id: params.id },
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
        rowsPerPage: data.rowsPerPage || 15,
        roundingUnit: data.roundingUnit || 10000,
      },
    });

    return NextResponse.json({ id: quotation.id, message: "견적서가 수정되었습니다." });
  } catch (error) {
    console.error("업무 단위 견적서 수정 오류:", error);
    return NextResponse.json(
      { error: "견적서 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 업무 단위 견적서 삭제 (소프트 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.taskQuotation.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: "견적서가 삭제되었습니다." });
  } catch (error) {
    console.error("업무 단위 견적서 삭제 오류:", error);
    return NextResponse.json(
      { error: "견적서 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 업무 단위 견적서 복구
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { action } = await request.json();

    if (action === "restore") {
      await prisma.taskQuotation.update({
        where: { id: params.id },
        data: { deletedAt: null },
      });
      return NextResponse.json({ message: "견적서가 복구되었습니다." });
    }

    return NextResponse.json(
      { error: "알 수 없는 작업입니다." },
      { status: 400 }
    );
  } catch (error) {
    console.error("업무 단위 견적서 복구 오류:", error);
    return NextResponse.json(
      { error: "견적서 복구 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
