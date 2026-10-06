/** Longest side sent for reading. Plenty for screenshot text, and keeps uploads to a few hundred KB each. */
const MAX_SIDE = 2000;

export interface ScreenshotUpload {
  mediaType: "image/jpeg";
  /** Base64 without the data: prefix. */
  data: string;
}

/** Shrink a screenshot (if needed) to a JPEG for the screenshot reader. Very tall phone captures keep their full width. */
export async function fileToScreenshotUpload(file: File): Promise<ScreenshotUpload> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't an image`);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`${file.name} couldn't be read. Try a PNG or JPG screenshot.`);
  }

  // Scale by the longer side, but never squeeze the width below ~1000px — on a long scrolling capture that would
  // make the text too small to read. (The server caps the overall size.)
  const scale = Math.min(1, Math.max(MAX_SIDE / Math.max(bitmap.width, bitmap.height), Math.min(1, 1000 / bitmap.width)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing isn't available in this browser");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const url = canvas.toDataURL("image/jpeg", 0.88);
  return { mediaType: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}
