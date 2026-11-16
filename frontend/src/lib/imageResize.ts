// Client-side image resize/compression performed at upload time.
//
// Each picked file is turned into two JPEG variants before it is uploaded:
//   - original: capped at ORIGINAL_MAX_EDGE on the long edge, quality 0.85
//   - thumb:    capped at THUMB_MAX_EDGE on the long edge, quality 0.8
// This keeps a 10 MB phone photo closer to ~1 MB and gives the gallery a small
// thumbnail to render instead of shipping full-resolution originals into
// 300 px boxes.

const ORIGINAL_MAX_EDGE = 2560;
const ORIGINAL_QUALITY = 0.85;
const THUMB_MAX_EDGE = 480;
const THUMB_QUALITY = 0.8;

// Formats we can safely decode + re-encode in the browser. Anything else
// (e.g. GIF, HEIC) is passed through untouched so uploads never break.
const RESIZABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface ProcessedImage {
  original: Blob;
  thumb: Blob;
  contentType: string;
}

function scaledSize(width: number, height: number, maxEdge: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const ratio = maxEdge / longEdge;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

async function renderToBlob(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number
): Promise<Blob> {
  const { width, height } = scaledSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image encoding failed")),
      "image/jpeg",
      quality
    );
  });
}

export async function processImage(file: File): Promise<ProcessedImage> {
  // Pass through formats we can't safely re-encode.
  if (!RESIZABLE_TYPES.includes(file.type)) {
    return { original: file, thumb: file, contentType: file.type };
  }

  // `imageOrientation: "from-image"` bakes EXIF orientation into the pixels,
  // so the re-encoded JPEGs (which carry no EXIF) still display upright.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const [original, thumb] = await Promise.all([
      renderToBlob(bitmap, ORIGINAL_MAX_EDGE, ORIGINAL_QUALITY),
      renderToBlob(bitmap, THUMB_MAX_EDGE, THUMB_QUALITY),
    ]);
    return { original, thumb, contentType: "image/jpeg" };
  } finally {
    bitmap.close();
  }
}
