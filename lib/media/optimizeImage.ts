/*
 * Client-only image optimizer for Workers-compatible environments.
 */
import { shouldOptimize } from "@/lib/media/optimizationPolicy";
export type OptimizeImageOptions = {
  maxEdge?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "image/webp" | "image/jpeg";
};

export type OptimizedImageResult = {
  file: File;
  optimizedFile: File;
  originalBytes: number;
  storedBytes: number;
  optimizedBytes: number;
  savingsPct: number;
  width: number;
  height: number;
  optimized: boolean;
  format: "webp" | "jpeg" | "png";
  encoder: "webp" | "jpeg" | "png";
  warnings: string[];
};

type OptimizedFormat = "webp" | "jpeg" | "png";

const DEFAULT_MIN_BYTES = 300 * 1024;
const DEFAULT_WEBP_QUALITY = 0.82;
const DEFAULT_JPEG_QUALITY = 0.82;

const FAILURE_WARNING = "최적화에 실패하여 원본 파일로 업로드합니다.";

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function formatLabel(mime: string): "webp" | "jpeg" | "png" {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpeg";
}

function withSavings(base: {
  file: File;
  optimizedFile: File;
  originalBytes: number;
  storedBytes: number;
  width: number;
  height: number;
  optimized: boolean;
  format: OptimizedFormat;
  warnings: string[];
}): OptimizedImageResult {
  const optimizedBytes = base.storedBytes;
  const savingsPct =
    base.originalBytes > 0 ? Math.max(0, ((base.originalBytes - optimizedBytes) / base.originalBytes) * 100) : 0;

  return {
    ...base,
    optimizedBytes,
    savingsPct,
    encoder: base.format,
  };
}

async function encodeCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number,
): Promise<Blob | null> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type, quality }).catch(() => null);
  }

  return new Promise((resolve) => {
    (canvas as HTMLCanvasElement).toBlob((value) => resolve(value), type, quality);
  });
}

async function detectAlpha(
  bitmap: ImageBitmap,
  probeSize = 48,
): Promise<boolean> {
  const width = Math.min(bitmap.width, probeSize);
  const height = Math.min(bitmap.height, probeSize);
  if (width <= 0 || height <= 0) return false;
  const canvas = createCanvas(width, height);
  const ctx = (canvas as HTMLCanvasElement).getContext?.("2d") ?? (canvas as OffscreenCanvas).getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const data = (ctx as CanvasRenderingContext2D).getImageData(0, 0, width, height).data;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) {
      return true;
    }
  }
  return false;
}

export async function optimizeImage(file: File, options: OptimizeImageOptions = {}): Promise<OptimizedImageResult> {
  const maxEdge = options.maxEdge ?? 1920;
  const maxWidth = options.maxWidth ?? maxEdge;
  const maxHeight = options.maxHeight ?? maxEdge;
  const requestedFormat = options.format ?? "image/webp";
  const originalBytes = file.size;
  const warnings: string[] = [];
  const quality = options.quality ?? DEFAULT_WEBP_QUALITY;
  const webpQuality = quality;
  const jpegQuality = options.quality ?? DEFAULT_JPEG_QUALITY;

  if (!shouldOptimize(file.type)) {
    const fallbackFormat = formatLabel(file.type);
    return withSavings({
      file,
      optimizedFile: file,
      originalBytes,
      storedBytes: originalBytes,
      width: 0,
      height: 0,
      optimized: false,
      format: fallbackFormat,
      warnings,
    });
  }

  try {
    const bitmap = await createImageBitmap(file);
    let targetWidth = bitmap.width;
    let targetHeight = bitmap.height;

    if (bitmap.width > maxWidth || bitmap.height > maxHeight) {
      const widthRatio = maxWidth / bitmap.width;
      const heightRatio = maxHeight / bitmap.height;
      const ratio = Math.min(widthRatio, heightRatio, 1);
      targetWidth = Math.max(1, Math.round(bitmap.width * ratio));
      targetHeight = Math.max(1, Math.round(bitmap.height * ratio));
    }

    if (originalBytes < DEFAULT_MIN_BYTES && targetWidth === bitmap.width && targetHeight === bitmap.height) {
      const fallbackFormat = formatLabel(file.type);
      return withSavings({
        file,
        optimizedFile: file,
        originalBytes,
        storedBytes: originalBytes,
        width: bitmap.width,
        height: bitmap.height,
        optimized: false,
        format: fallbackFormat,
        warnings,
      });
    }

    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = (canvas as HTMLCanvasElement).getContext?.("2d") ?? (canvas as OffscreenCanvas).getContext("2d");
    if (!ctx) {
      const fallbackFormat = formatLabel(file.type);
      warnings.push(FAILURE_WARNING);
      return withSavings({
        file,
        optimizedFile: file,
        originalBytes,
        storedBytes: originalBytes,
        width: bitmap.width,
        height: bitmap.height,
        optimized: false,
        format: fallbackFormat,
        warnings,
      });
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const hasAlpha = file.type === "image/png" ? await detectAlpha(bitmap) : false;
    const preferredFormat = (() => {
      if (file.type === "image/png") {
        if (hasAlpha) {
          if (requestedFormat === "image/jpeg") {
            warnings.push("알파 채널이 있어 JPEG 대신 WebP를 시도합니다.");
          }
          return "image/webp";
        }
        return requestedFormat;
      }
      if (requestedFormat) {
        return requestedFormat;
      }
      return "image/webp";
    })();

    const primaryQuality = preferredFormat === "image/jpeg" ? jpegQuality : webpQuality;
    const webpBlob = preferredFormat === "image/webp" ? await encodeCanvas(canvas, "image/webp", webpQuality) : null;

    let finalBlob: Blob | null = null;
    let finalFormat: OptimizedFormat = "webp";

    if (preferredFormat === "image/webp") {
      if (webpBlob) {
        finalBlob = webpBlob;
        finalFormat = "webp";
      } else if (hasAlpha) {
        finalBlob = await encodeCanvas(canvas, "image/png", 1);
        finalFormat = "png";
        warnings.push("WebP 미지원으로 PNG를 유지했습니다.");
      } else {
        finalBlob = await encodeCanvas(canvas, "image/jpeg", jpegQuality);
        finalFormat = "jpeg";
        warnings.push("WebP 미지원으로 JPEG로 저장했습니다.");
      }
    } else {
      const fallbackQuality = primaryQuality;
      finalBlob = await encodeCanvas(canvas, preferredFormat, fallbackQuality);
      finalFormat = preferredFormat.includes("png") ? "png" : "jpeg";

      if (!finalBlob) {
        const fallbackBlob = await encodeCanvas(canvas, "image/webp", DEFAULT_WEBP_QUALITY);
        if (fallbackBlob) {
          finalBlob = fallbackBlob;
          finalFormat = "webp";
          warnings.push("지정 포맷 실패로 WebP로 저장했습니다.");
        }
      }
    }

    if (canvas instanceof HTMLCanvasElement) {
      canvas.width = 0;
      canvas.height = 0;
    }

    if (!finalBlob) {
      const fallbackFormat = formatLabel(file.type);
      warnings.push(FAILURE_WARNING);
      return withSavings({
        file,
        optimizedFile: file,
        originalBytes,
        storedBytes: originalBytes,
        width: bitmap.width,
        height: bitmap.height,
        optimized: false,
        format: fallbackFormat,
        warnings,
      });
    }

    const optimizedFile = new File([finalBlob], file.name, {
      type: finalBlob.type || preferredFormat,
      lastModified: Date.now(),
    });

    if (optimizedFile.size >= originalBytes) {
      const fallbackFormat = formatLabel(file.type);
      warnings.push("최적화 결과가 더 크거나 동일해 원본을 유지했습니다.");
      return withSavings({
        file,
        optimizedFile: file,
        originalBytes,
        storedBytes: originalBytes,
        width: bitmap.width,
        height: bitmap.height,
        optimized: false,
        format: fallbackFormat,
        warnings,
      });
    }

    return withSavings({
      file: optimizedFile,
      optimizedFile,
      originalBytes,
      storedBytes: optimizedFile.size,
      width: targetWidth,
      height: targetHeight,
      optimized: true,
      format: finalFormat,
      warnings,
    });
  } catch (error) {
    console.warn("[optimizeImage] failed, falling back to original", error);
    const fallbackFormat = formatLabel(file.type);
    warnings.push(FAILURE_WARNING);
    return withSavings({
      file,
      optimizedFile: file,
      originalBytes,
      storedBytes: originalBytes,
      width: 0,
      height: 0,
      optimized: false,
      format: fallbackFormat,
      warnings,
    });
  }
}
