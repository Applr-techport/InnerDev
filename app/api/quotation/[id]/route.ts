import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { QuotationData } from "@/lib/quotationProcessor";

// 견적서 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: quotation, error } = await supabase
      .from("Quotation")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !quotation) {
      return NextResponse.json(
        { error: "견적서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // DB 데이터를 QuotationData 형식으로 변환
    const quotationData: QuotationData = {
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
      gradeInfo: quotation.gradeInfoData as any,
      discountRate: quotation.discountRate,
      workPeriod: quotation.workPeriod,
      notes: quotation.notes || "",
      totalAmount: quotation.totalAmount,
      vatIncluded: quotation.vatIncluded,
      milestoneColumnWidths: quotation.milestoneColumnWidths as any,
      rowsPerPage: quotation.rowsPerPage || 20,
      roundingUnit: quotation.roundingUnit || 10000,
    };

    return NextResponse.json({
      ...quotationData,
      id: quotation.id,
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
    });
  } catch (error) {
    console.error("견적서 조회 오류:", error);
    return NextResponse.json(
      { error: "견적서 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 견적서 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data: QuotationData = await request.json();

    const { data: quotation, error } = await supabase
      .from("Quotation")
      .update({
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
        historyData: data.history,
        milestonesData: data.milestones,
        quotationItems: data.quotationItems,
        gradeInfoData: data.gradeInfo,
        milestoneColumnWidths: data.milestoneColumnWidths || null,
        rowsPerPage: data.rowsPerPage || 20,
        roundingUnit: data.roundingUnit || 10000,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ id: quotation.id, message: "견적서가 수정되었습니다." });
  } catch (error) {
    console.error("견적서 수정 오류:", error);
    return NextResponse.json(
      { error: "견적서 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 견적서 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from("Quotation")
      .delete()
      .eq("id", params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "견적서가 삭제되었습니다." });
  } catch (error) {
    console.error("견적서 삭제 오류:", error);
    return NextResponse.json(
      { error: "견적서 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
