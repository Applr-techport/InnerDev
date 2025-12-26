"use client";

import QuotationGenerator from "@/components/QuotationGenerator";

export default function QuotationPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">견적서 생성기</h1>
      <p className="text-gray-600 mb-8">
        견적서 정보를 입력하고 PDF로 생성할 수 있습니다.
      </p>
      <QuotationGenerator />
    </div>
  );
}

