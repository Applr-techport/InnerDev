import JSZip from "jszip";

// iOS 포인트 사이즈 정의
const iOS_SIZES = [
  { point: 20, scales: [2, 3] }, // 40x40, 60x60
  { point: 29, scales: [2, 3] }, // 58x58, 87x87
  { point: 38, scales: [2, 3] }, // 76x76, 114x114
  { point: 40, scales: [2, 3] }, // 80x80, 120x120
  { point: 60, scales: [2, 3] }, // 120x120, 180x180
  { point: 64, scales: [2, 3] }, // 128x128, 192x192
  { point: 68, scales: [2] }, // 136x136
  { point: 76, scales: [2] }, // 152x152
  { point: 83.5, scales: [2] }, // 167x167
  { point: 1024, scales: [1] }, // 1024x1024
];

// Android 밀도별 배율
const ANDROID_DENSITIES = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};

// Android Launcher Icon 사이즈 (dp)
const ANDROID_LAUNCHER_SIZE = 48;
const ANDROID_ADAPTIVE_FOREGROUND_SIZE = 108;
const ANDROID_ACTION_BAR_SIZES = [24, 32, 48];
const ANDROID_NOTIFICATION_SIZES = [24, 48];

// 이미지 리사이징 함수 (Canvas API 사용)
async function resizeImage(
  file: File,
  width: number,
  height: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context를 가져올 수 없습니다."));
        return;
      }

      // 고품질 리사이징
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("이미지 변환에 실패했습니다."));
          }
        },
        "image/png",
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

// iOS Contents.json 생성
function generateIOSContentsJson(imageFiles: Array<{ filename: string; size: string; scale: string; idiom: string }>) {
  const images = imageFiles.map((img) => {
    const imageEntry: any = {
      filename: img.filename,
      size: img.size,
      scale: img.scale,
      idiom: img.idiom,
    };
    
    // ios-marketing이 아닌 경우 role 추가
    if (img.idiom !== "ios-marketing") {
      imageEntry.role = "app-launcher";
    }
    
    return imageEntry;
  });

  return JSON.stringify(
    {
      images,
      info: {
        author: "xcode",
        version: 1,
      },
    },
    null,
    2
  );
}

// iOS 이미지셋 생성
export async function generateIOSImageSet(file: File) {
  const zip = new JSZip();
  const appIconSet = zip.folder("Assets.xcassets/AppIcon.appiconset");

  if (!appIconSet) {
    throw new Error("ZIP 폴더를 생성할 수 없습니다.");
  }

  const imageFiles: Array<{ filename: string; size: string; scale: string; idiom: string }> = [];

  for (const sizeDef of iOS_SIZES) {
    for (const scale of sizeDef.scales) {
      const pixelSize = sizeDef.point * scale;
      const filename = `icon-${sizeDef.point}x${sizeDef.point}@${scale}x.png`;
      
      const resizedBlob = await resizeImage(file, pixelSize, pixelSize);
      appIconSet.file(filename, resizedBlob);

      // 83.5pt는 소수점이므로 문자열로 처리
      const pointStr = sizeDef.point === 83.5 ? "83.5" : String(sizeDef.point);
      
      imageFiles.push({
        filename,
        size: `${pointStr}x${pointStr}`,
        scale: `${scale}x`,
        idiom: sizeDef.point === 1024 ? "ios-marketing" : "iphone",
      });
    }
  }

  // Contents.json 생성
  const contentsJson = generateIOSContentsJson(imageFiles);
  appIconSet.file("Contents.json", contentsJson);

  // ZIP 다운로드
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ios-app-icon.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Android 이미지셋 생성
export async function generateAndroidImageSet(file: File) {
  const zip = new JSZip();
  const res = zip.folder("res");

  if (!res) {
    throw new Error("ZIP 폴더를 생성할 수 없습니다.");
  }

  // Launcher Icons
  for (const [density, multiplier] of Object.entries(ANDROID_DENSITIES)) {
    const size = ANDROID_LAUNCHER_SIZE * multiplier;
    const mipmapFolder = res.folder(`mipmap-${density}`);
    
    if (mipmapFolder) {
      const launcherBlob = await resizeImage(file, size, size);
      mipmapFolder.file("ic_launcher.png", launcherBlob);
      mipmapFolder.file("ic_launcher_round.png", launcherBlob);
    }
  }

  // Adaptive Icon Foreground
  for (const [density, multiplier] of Object.entries(ANDROID_DENSITIES)) {
    const size = ANDROID_ADAPTIVE_FOREGROUND_SIZE * multiplier;
    const mipmapFolder = res.folder(`mipmap-${density}`);
    
    if (mipmapFolder) {
      const foregroundBlob = await resizeImage(file, size, size);
      mipmapFolder.file("ic_launcher_foreground.png", foregroundBlob);
    }
  }

  // Action Bar Icons
  for (const [density, multiplier] of Object.entries(ANDROID_DENSITIES)) {
    const drawableFolder = res.folder(`drawable-${density}`);
    
    if (drawableFolder) {
      for (const dpSize of ANDROID_ACTION_BAR_SIZES) {
        const pixelSize = dpSize * multiplier;
        const actionBarBlob = await resizeImage(file, pixelSize, pixelSize);
        drawableFolder.file(`ic_action_${dpSize}dp.png`, actionBarBlob);
      }
    }
  }

  // Notification Icons
  for (const [density, multiplier] of Object.entries(ANDROID_DENSITIES)) {
    const drawableFolder = res.folder(`drawable-${density}`);
    
    if (drawableFolder) {
      for (const dpSize of ANDROID_NOTIFICATION_SIZES) {
        const pixelSize = dpSize * multiplier;
        const notificationBlob = await resizeImage(file, pixelSize, pixelSize);
        drawableFolder.file(`ic_notification_${dpSize}dp.png`, notificationBlob);
      }
    }
  }

  // ZIP 다운로드
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "android-app-icon.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

