import JSZip from "jszip";

// iOS App Store 스크린샷 사이즈
export const iOS_SCREENSHOT_SIZES = [
  { name: "iPhone 6.7\"", width: 1290, height: 2796, id: "iphone-6.7" },
  { name: "iPhone 6.5\"", width: 1242, height: 2688, id: "iphone-6.5" },
  { name: "iPhone 5.5\"", width: 1242, height: 2208, id: "iphone-5.5" },
  { name: "iPad Pro 12.9\"", width: 2048, height: 2732, id: "ipad-12.9" },
  { name: "iPad Pro 11\"", width: 1668, height: 2388, id: "ipad-11" },
];

// Google Play Store 스크린샷 사이즈
export const ANDROID_SCREENSHOT_SIZES = [
  { name: "Phone", width: 1080, height: 1920, id: "phone" },
  { name: "Phone HD", width: 1440, height: 2560, id: "phone-hd" },
  { name: "7인치 태블릿", width: 1200, height: 1920, id: "tablet-7" },
  { name: "10인치 태블릿", width: 1600, height: 2560, id: "tablet-10" },
];

export type ScreenshotSize = {
  name: string;
  width: number;
  height: number;
  id: string;
};

// 이미지 리사이징 함수 (비율 유지하며 리사이즈, letterbox 처리)
export async function resizeScreenshot(
  file: File,
  targetWidth: number,
  targetHeight: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context를 가져올 수 없습니다."));
        return;
      }

      // 배경색 설정 (흰색)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // 원본 이미지 비율 계산
      const originalRatio = img.width / img.height;
      const targetRatio = targetWidth / targetHeight;

      let drawWidth: number;
      let drawHeight: number;
      let offsetX: number;
      let offsetY: number;

      if (originalRatio > targetRatio) {
        // 원본이 더 넓음 - 높이에 맞춤
        drawHeight = targetHeight;
        drawWidth = drawHeight * originalRatio;
        offsetX = (targetWidth - drawWidth) / 2;
        offsetY = 0;
      } else {
        // 원본이 더 높음 - 너비에 맞춤
        drawWidth = targetWidth;
        drawHeight = drawWidth / originalRatio;
        offsetX = 0;
        offsetY = (targetHeight - drawHeight) / 2;
      }

      // 고품질 리사이징
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

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
}

// 스크린샷 생성 및 ZIP 다운로드 (여러 파일 지원)
export async function generateScreenshots(
  files: File[],
  platform: "ios" | "android",
  selectedSizes: string[]
) {
  const sizes =
    platform === "ios" ? iOS_SCREENSHOT_SIZES : ANDROID_SCREENSHOT_SIZES;
  const selectedSizeObjects = sizes.filter((size) =>
    selectedSizes.includes(size.id)
  );

  if (selectedSizeObjects.length === 0) {
    throw new Error("최소 하나의 사이즈를 선택해주세요.");
  }

  if (files.length === 0) {
    throw new Error("최소 하나의 이미지를 업로드해주세요.");
  }

  const zip = new JSZip();
  const platformName = platform === "ios" ? "ios" : "android";

  // 각 파일별로 처리
  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    const originalName = file.name.replace(/\.[^/.]+$/, ""); // 확장자 제거

    // 각 사이즈별로 이미지 생성
    for (const size of selectedSizeObjects) {
      const resizedBlob = await resizeScreenshot(file, size.width, size.height);
      // 파일명: {platform}-{width}x{height}-{index}-{originalName}.png
      const fileName = `${platformName}-${size.width}x${size.height}-${String(fileIndex + 1).padStart(2, "0")}-${originalName}.png`;
      zip.file(fileName, resizedBlob);
    }
  }

  // ZIP 다운로드
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${platformName}-screenshots-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

