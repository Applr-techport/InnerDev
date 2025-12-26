"use client";

import { useState, useRef, useEffect } from "react";
import {
  generateScreenshots,
  iOS_SCREENSHOT_SIZES,
  ANDROID_SCREENSHOT_SIZES,
  type ScreenshotSize,
} from "@/lib/screenshotProcessor";

export default function ScreenshotGenerator() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Array<{ url: string; index: number }>>([]);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 플랫폼 변경 시 선택된 사이즈 초기화
  useEffect(() => {
    setSelectedSizes([]);
  }, [platform]);

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      previews.forEach((preview) => {
        URL.revokeObjectURL(preview.url);
      });
    };
  }, [previews]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      handleImageFiles(selectedFiles);
    }
  };

  const handleImageFiles = (selectedFiles: File[]) => {
    // 이미지 형식 검증
    const validFiles = selectedFiles.filter((file) => {
      if (!file.type.startsWith("image/")) {
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      setError("이미지 파일만 업로드 가능합니다.");
      return;
    }

    if (validFiles.length < selectedFiles.length) {
      setError(`${selectedFiles.length - validFiles.length}개의 파일이 이미지가 아닙니다.`);
    } else {
      setError(null);
    }

    // 이전 프리뷰 URL 정리
    previews.forEach((preview) => {
      URL.revokeObjectURL(preview.url);
    });

    // 새 파일 추가
    const newFiles = [...files, ...validFiles];
    setFiles(newFiles);

    // 새 프리뷰 생성
    const newPreviews = validFiles.map((file, index) => ({
      url: URL.createObjectURL(file),
      index: files.length + index,
    }));
    setPreviews([...previews, ...newPreviews]);
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

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleImageFiles(droppedFiles);
    }
  };

  const handleSizeToggle = (sizeId: string) => {
    setSelectedSizes((prev) =>
      prev.includes(sizeId)
        ? prev.filter((id) => id !== sizeId)
        : [...prev, sizeId]
    );
  };

  const handleSelectAll = () => {
    const sizes = platform === "ios" ? iOS_SCREENSHOT_SIZES : ANDROID_SCREENSHOT_SIZES;
    if (selectedSizes.length === sizes.length) {
      setSelectedSizes([]);
    } else {
      setSelectedSizes(sizes.map((size) => size.id));
    }
  };

  const handleGenerate = async () => {
    if (files.length === 0) {
      setError("이미지를 먼저 업로드해주세요.");
      return;
    }

    if (selectedSizes.length === 0) {
      setError("최소 하나의 사이즈를 선택해주세요.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      await generateScreenshots(files, platform, selectedSizes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "스크린샷 생성 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    // 프리뷰 URL 정리
    const previewToRemove = previews.find((p) => p.index === index);
    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove.url);
    }

    // 파일과 프리뷰 제거
    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews
      .filter((p) => p.index !== index)
      .map((p) => ({
        ...p,
        index: p.index > index ? p.index - 1 : p.index,
      }));
    
    setFiles(newFiles);
    setPreviews(newPreviews);
  };

  const handleClear = () => {
    // 모든 프리뷰 URL 정리
    previews.forEach((preview) => {
      URL.revokeObjectURL(preview.url);
    });
    setFiles([]);
    setPreviews([]);
    setSelectedSizes([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const currentSizes =
    platform === "ios" ? iOS_SCREENSHOT_SIZES : ANDROID_SCREENSHOT_SIZES;

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
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        {files.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {files.map((file, index) => {
                const preview = previews.find((p) => p.index === index);
                return (
                  <div key={index} className="relative">
                    {preview && (
                      <img
                        src={preview.url}
                        alt={`Preview ${index + 1}`}
                        className="w-full rounded-lg shadow-lg"
                      />
                    )}
                    <div className="mt-2 text-center">
                      <p className="text-xs text-gray-600 truncate">{file.name}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        className="mt-1 text-xs text-red-600 hover:text-red-700"
                      >
                        제거
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                총 {files.length}개의 이미지
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                모두 제거
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className={`mb-2 ${isDragging ? "text-blue-600 font-semibold" : "text-gray-600"}`}>
              {isDragging
                ? "여기에 이미지를 놓으세요"
                : "이미지를 드래그 앤 드롭하거나 클릭하여 선택 (여러 장 가능)"}
            </p>
            <p className="text-sm text-gray-500">모든 이미지 형식 지원</p>
          </div>
        )}
      </div>

      {/* 플랫폼 선택 */}
      {files.length > 0 && (
        <div className="mt-8">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            플랫폼 선택
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setPlatform("ios")}
              className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
                platform === "ios"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              iOS App Store
            </button>
            <button
              onClick={() => setPlatform("android")}
              className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
                platform === "android"
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Google Play Store
            </button>
          </div>
        </div>
      )}

      {/* 사이즈 선택 */}
      {files.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              사이즈 선택
            </label>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {selectedSizes.length === currentSizes.length
                ? "전체 해제"
                : "전체 선택"}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {currentSizes.map((size) => (
              <label
                key={size.id}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedSizes.includes(size.id)
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSizes.includes(size.id)}
                  onChange={() => handleSizeToggle(size.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div className="ml-3">
                  <div className="text-sm font-medium text-gray-900">
                    {size.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {size.width} x {size.height}px
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* 생성 버튼 */}
      {files.length > 0 && selectedSizes.length > 0 && (
        <div className="mt-8">
          <button
            onClick={handleGenerate}
            disabled={isProcessing}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing
              ? "스크린샷 생성 중..."
              : `${files.length}개 이미지 × ${selectedSizes.length}개 사이즈 = ${files.length * selectedSizes.length}개 생성 및 다운로드`}
          </button>
        </div>
      )}
    </div>
  );
}

