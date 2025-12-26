"use client";

import { useState, useRef, useEffect } from "react";

export default function ImageResizer() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [originalWidth, setOriginalWidth] = useState<number>(0);
  const [originalHeight, setOriginalHeight] = useState<number>(0);
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
    // 이미지 형식 검증
    if (!selectedFile.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다.");
      setFile(null);
      setPreview(null);
      return;
    }

    // 이전 프리뷰 URL 정리
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setFile(selectedFile);
    setError(null);

    // 프리뷰 생성 및 원본 크기 저장
    const img = new Image();
    const url = URL.createObjectURL(selectedFile);
    img.onload = () => {
      setOriginalWidth(img.width);
      setOriginalHeight(img.height);
      setWidth(String(img.width));
      setHeight(String(img.height));
      setPreview(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("이미지를 로드할 수 없습니다.");
      setFile(null);
      setPreview(null);
    };
    img.src = url;
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

  const handleWidthChange = (value: string) => {
    setWidth(value);
    if (maintainAspectRatio && originalWidth > 0 && originalHeight > 0) {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue > 0) {
        const ratio = originalHeight / originalWidth;
        setHeight(String(Math.round(numValue * ratio)));
      }
    }
  };

  const handleHeightChange = (value: string) => {
    setHeight(value);
    if (maintainAspectRatio && originalWidth > 0 && originalHeight > 0) {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue > 0) {
        const ratio = originalWidth / originalHeight;
        setWidth(String(Math.round(numValue * ratio)));
      }
    }
  };

  const resizeImage = async (
    file: File,
    newWidth: number,
    newHeight: number
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Canvas context를 가져올 수 없습니다."));
          return;
        }

        // 고품질 리사이징
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("이미지 변환에 실패했습니다."));
            }
          },
          file.type || "image/png",
          1.0
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("이미지를 로드할 수 없습니다."));
      };

      img.src = url;
    });
  };

  const handleResize = async () => {
    if (!file) {
      setError("이미지를 먼저 업로드해주세요.");
      return;
    }

    const numWidth = parseInt(width);
    const numHeight = parseInt(height);

    if (isNaN(numWidth) || numWidth <= 0) {
      setError("너비는 0보다 큰 숫자여야 합니다.");
      return;
    }

    if (isNaN(numHeight) || numHeight <= 0) {
      setError("높이는 0보다 큰 숫자여야 합니다.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const resizedBlob = await resizeImage(file, numWidth, numHeight);

      // 다운로드
      const url = URL.createObjectURL(resizedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resized-${numWidth}x${numHeight}-${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "리사이즈 중 오류가 발생했습니다.");
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
    setWidth("");
    setHeight("");
    setOriginalWidth(0);
    setOriginalHeight(0);
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
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        {preview ? (
          <div className="space-y-4">
            <img
              src={preview}
              alt="Preview"
              className="mx-auto max-w-xs rounded-lg shadow-lg"
            />
            <p className="text-sm text-gray-600">
              {file?.name} ({originalWidth}x{originalHeight})
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-red-600 hover:text-red-700 text-sm"
            >
              이미지 제거
            </button>
          </div>
        ) : (
          <div>
            <p className={`mb-2 ${isDragging ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
              {isDragging
                ? "여기에 이미지를 놓으세요"
                : "이미지를 드래그 앤 드롭하거나 클릭하여 선택"}
            </p>
            <p className="text-sm text-gray-500">모든 이미지 형식 지원</p>
          </div>
        )}
      </div>

      {/* 사이즈 입력 영역 */}
      {file && (
        <div className="mt-8 space-y-4">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">사이즈 설정</h3>
            
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={maintainAspectRatio}
                  onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">비율 유지</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  너비 (px)
                </label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="너비"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  높이 (px)
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="높이"
                />
              </div>
            </div>

            {originalWidth > 0 && originalHeight > 0 && (
              <p className="mt-4 text-sm text-gray-500">
                원본 크기: {originalWidth} x {originalHeight} px
              </p>
            )}
          </div>

          <button
            onClick={handleResize}
            disabled={isProcessing || !width || !height}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "처리 중..." : "리사이즈 및 다운로드"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

