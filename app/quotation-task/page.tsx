"use client";

import QuotationTaskGenerator from "@/components/QuotationTaskGenerator";

export default function QuotationTaskPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">견적서 생성기 (업무 단위 산정용)</h1>
      <p className="text-gray-600 mb-8">
        업무 단위로 공수를 산정하여 견적서를 생성할 수 있습니다.
      </p>
      <QuotationTaskGenerator />
    </div>
  );
}
