"use client";

import { useState, useRef, useEffect } from "react";
import { generateIOSImageSet, generateAndroidImageSet } from "@/lib/imageProcessor";

export default function AppIconGenerator() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleImageFile = (file: File) => {
    // 이미지 형식 검증
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다.");
      setImage(null);
      setPreview(null);
      return;
    }

    // 이전 프리뷰 URL 정리
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    // 이미지 크기 검증 (1024x1024 필수)
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      if (img.width !== 1024 || img.height !== 1024) {
        setError(`이미지 크기는 정확히 1024x1024 픽셀이어야 합니다. (현재: ${img.width}x${img.height})`);
        setImage(null);
        setPreview(null);
        URL.revokeObjectURL(url);
      } else {
        setError(null);
        setImage(file);
        setPreview(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("이미지를 로드할 수 없습니다.");
      setImage(null);
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
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleGenerate = async (platform: "ios" | "android" | "both") => {
    if (!image) {
      setError("이미지를 먼저 업로드해주세요.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      if (platform === "ios" || platform === "both") {
        await generateIOSImageSet(image);
        // "모두 생성" 시 두 번째 다운로드를 위해 약간의 지연
        if (platform === "both") {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (platform === "android" || platform === "both") {
        await generateAndroidImageSet(image);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 생성 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
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
              {image?.name} (1024x1024)
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (preview) {
                  URL.revokeObjectURL(preview);
                }
                setImage(null);
                setPreview(null);
                setError(null);
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
            <p className="text-sm text-gray-500">필수 크기: 1024x1024 픽셀</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* 생성 버튼 */}
      {image && (
        <div className="mt-8 space-y-4">
          <div className="flex gap-4">
            <button
              onClick={() => handleGenerate("ios")}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "생성 중..." : "iOS 이미지셋 생성"}
            </button>
            <button
              onClick={() => handleGenerate("android")}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "생성 중..." : "Android 이미지셋 생성"}
            </button>
            <button
              onClick={() => handleGenerate("both")}
              disabled={isProcessing}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "생성 중..." : "모두 생성"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

