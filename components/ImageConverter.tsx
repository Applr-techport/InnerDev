"use client";

import { useState, useRef, useEffect } from "react";

type ConversionType = "png-to-svg" | "svg-to-png" | null;

export default function ImageConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [conversionType, setConversionType] = useState<ConversionType>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleImageFile(selectedFile);
    }
  };

  const handleImageFile = (selectedFile: File) => {
    // 이전 프리뷰 URL 정리
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    const fileType = selectedFile.type;
    const fileName = selectedFile.name.toLowerCase();

    // 파일 형식 검증
    if (
      !fileType.startsWith("image/") &&
      !fileName.endsWith(".svg") &&
      !fileName.endsWith(".png")
    ) {
      setError("PNG 또는 SVG 파일만 업로드 가능합니다.");
      setFile(null);
      setPreview(null);
      setConversionType(null);
      return;
    }

    // 파일 형식에 따라 변환 타입 자동 설정
    if (fileName.endsWith(".png") || fileType === "image/png") {
      setConversionType("png-to-svg");
      setError(null);
    } else if (fileName.endsWith(".svg") || fileType === "image/svg+xml") {
      setConversionType("svg-to-png");
      setError(null);
    } else {
      setError("PNG 또는 SVG 파일만 지원합니다.");
      setFile(null);
      setPreview(null);
      setConversionType(null);
      return;
    }

    setFile(selectedFile);

    // 프리뷰 생성
    if (fileName.endsWith(".svg") || fileType === "image/svg+xml") {
      // SVG 파일인 경우 내용을 읽어서 저장
      const reader = new FileReader();
      reader.onload = (e) => {
        setSvgContent(e.target?.result as string);
      };
      reader.readAsText(selectedFile);
      setPreview(null);
    } else {
      // PNG 파일인 경우 URL 생성
      const url = URL.createObjectURL(selectedFile);
      setPreview(url);
      setSvgContent(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleImageFile(droppedFile);
    }
  };

  const convertPNGtoSVG = async (pngFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // PNG를 base64로 인코딩하여 SVG에 포함
        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="100%">
  <image x="0" y="0" width="100%" height="100%" xlink:href="${result}"/>
</svg>`;
        const blob = new Blob([svgContent], { type: "image/svg+xml" });
        resolve(blob);
      };
      reader.onerror = reject;
      reader.readAsDataURL(pngFile);
    });
  };

  const convertSVGtoPNG = async (
    svgFile: File,
    width: number = 1024,
    height: number = 1024
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const svgContent = e.target?.result as string;
        const img = new Image();
        const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error("Canvas context를 가져올 수 없습니다."));
            return;
          }

          // SVG 이미지를 캔버스에 그리기
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url);
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("PNG 변환에 실패했습니다."));
              }
            },
            "image/png",
            1.0
          );
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("SVG 이미지를 로드할 수 없습니다."));
        };

        img.src = url;
      };
      reader.onerror = reject;
      reader.readAsText(svgFile);
    });
  };

  const handleConvert = async () => {
    if (!file || !conversionType) {
      setError("파일과 변환 타입을 선택해주세요.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let blob: Blob;
      let fileName: string;
      let mimeType: string;

      if (conversionType === "png-to-svg") {
        blob = await convertPNGtoSVG(file);
        fileName = file.name.replace(/\.png$/i, ".svg");
        mimeType = "image/svg+xml";
      } else {
        // SVG to PNG
        blob = await convertSVGtoPNG(file);
        fileName = file.name.replace(/\.svg$/i, ".png");
        mimeType = "image/png";
      }

      // 다운로드
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "변환 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview(null);
    setSvgContent(null);
    setConversionType(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-4xl">
      {/* 업로드 영역 */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-blue-500 bg-blue-50 scale-105"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.svg,image/png,image/svg+xml"
          onChange={handleFileSelect}
          className="hidden"
        />
        {(preview || svgContent) && file ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-xs">
              {svgContent ? (
                <div
                  className="rounded-lg shadow-lg bg-white p-4"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <img
                  src={preview!}
                  alt="Preview"
                  className="mx-auto rounded-lg shadow-lg max-w-full"
                />
              )}
            </div>
            <p className="text-sm text-gray-600">{file.name}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-red-600 hover:text-red-700 text-sm"
            >
              파일 제거
            </button>
          </div>
        ) : (
          <div>
            <p className={`mb-2 ${isDragging ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
              {isDragging
                ? "여기에 파일을 놓으세요"
                : "PNG 또는 SVG 파일을 드래그 앤 드롭하거나 클릭하여 선택"}
            </p>
            <p className="text-sm text-gray-500">PNG ↔ SVG 변환 지원</p>
          </div>
        )}
      </div>

      {/* 변환 타입 선택 */}
      {file && (
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            변환 타입 선택
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setConversionType("png-to-svg")}
              disabled={isProcessing}
              className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
                conversionType === "png-to-svg"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              PNG → SVG
            </button>
            <button
              onClick={() => setConversionType("svg-to-png")}
              disabled={isProcessing}
              className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
                conversionType === "svg-to-png"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              SVG → PNG
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* 변환 버튼 */}
      {file && conversionType && (
        <div className="mt-6">
          <button
            onClick={handleConvert}
            disabled={isProcessing}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "변환 중..." : "변환 및 다운로드"}
          </button>
        </div>
      )}
    </div>
  );
}

