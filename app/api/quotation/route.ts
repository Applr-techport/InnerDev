import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { QuotationData } from "@/lib/quotationProcessor";

// 견적서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectName = searchParams.get("projectName");

    let query = supabase
      .from("Quotation")
      .select("id, version, projectName, clientName, totalAmount, createdAt, updatedAt")
      .order("createdAt", { ascending: false });

    if (projectName) {
      query = query.ilike("projectName", `%${projectName}%`);
    }

    const { data: quotations, error } = await query;

    if (error) {
      throw error;
    }

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

    // UUID 생성 (Supabase는 자동으로 UUID 생성하지 않으므로 직접 생성)
    const id = crypto.randomUUID();

    const { data: quotation, error } = await supabase
      .from("Quotation")
      .insert({
        id,
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
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ id: quotation.id, message: "견적서가 저장되었습니다." });
  } catch (error) {
    console.error("견적서 저장 오류:", error);
    return NextResponse.json(
      { error: "견적서 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
