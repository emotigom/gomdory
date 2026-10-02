export type Rect = { x: number; y: number; width: number; height: number };
export type FaceBoxLike = { x: number; y: number; width: number; height: number };

export const PORTRAIT_CROP_DEFAULTS = {
  targetAspectRatio: 4 / 5,
  minCropWidthRatio: 0.38,
  faceHeightScale: 2.12,
  headroomRatio: 0.24,
  lowerSpaceRatio: 0.78,
  maxFaceFillRatio: 0.52,
} as const;

export function clampCropRect(rect: Rect, imageWidth: number, imageHeight: number): Rect {
  const width = Math.max(1, Math.min(imageWidth, rect.width));
  const height = Math.max(1, Math.min(imageHeight, rect.height));
  const x = Math.max(0, Math.min(imageWidth - width, rect.x));
  const y = Math.max(0, Math.min(imageHeight - height, rect.y));
  return { x, y, width, height };
}

export function getPortraitCropRect(options: { imageWidth: number; imageHeight: number; faceBox?: FaceBoxLike; targetAspectRatio?: number }): Rect {
  const { imageWidth, imageHeight, faceBox } = options;
  const ratio = options.targetAspectRatio ?? PORTRAIT_CROP_DEFAULTS.targetAspectRatio;
  let width = imageWidth;
  let height = width / ratio;
  if (height > imageHeight) {
    height = imageHeight;
    width = height * ratio;
  }

  if (faceBox) {
    const facePx = {
      x: faceBox.x * imageWidth,
      y: faceBox.y * imageHeight,
      width: faceBox.width * imageWidth,
      height: faceBox.height * imageHeight,
    };
    height = Math.max(facePx.height * PORTRAIT_CROP_DEFAULTS.faceHeightScale, imageHeight * 0.5);
    width = height * ratio;
    const minWidth = imageWidth * PORTRAIT_CROP_DEFAULTS.minCropWidthRatio;
    if (width < minWidth) {
      width = minWidth;
      height = width / ratio;
    }
    if (width > imageWidth) {
      width = imageWidth;
      height = width / ratio;
    }
    if (height > imageHeight) {
      height = imageHeight;
      width = height * ratio;
    }
    const centerX = facePx.x + facePx.width / 2;
    const faceTop = facePx.y;
    const top = faceTop - facePx.height * PORTRAIT_CROP_DEFAULTS.headroomRatio;
    const centerY = top + (facePx.height * (1 + PORTRAIT_CROP_DEFAULTS.lowerSpaceRatio + PORTRAIT_CROP_DEFAULTS.headroomRatio)) / 2;
    return clampCropRect({ x: centerX - width / 2, y: centerY - height / 2, width, height }, imageWidth, imageHeight);
  }

  return clampCropRect({ x: (imageWidth - width) / 2, y: (imageHeight - height) / 2, width, height }, imageWidth, imageHeight);
}

export function drawPortraitCrop(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  cropRect: Rect,
  targetRect: Rect,
  options?: { filter?: string },
) {
  ctx.save();
  if (options?.filter) ctx.filter = options.filter;
  ctx.drawImage(image, cropRect.x, cropRect.y, cropRect.width, cropRect.height, targetRect.x, targetRect.y, targetRect.width, targetRect.height);
  ctx.restore();
}
