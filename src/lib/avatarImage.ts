const AVATAR_PX = 128;

/**
 * Center-crop an uploaded photo to a square and shrink it to a small JPEG data URL.
 * Doing this in the browser keeps stored avatars ~10 KB no matter what a phone camera produced,
 * and means a parent never needs to crop or resize anything by hand.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the EXIF rotation so phone photos aren't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That image couldn't be read. Try a JPG or PNG.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing isn't available in this browser");

  ctx.fillStyle = "#fff"; // JPEG has no alpha; keep transparent PNGs from turning black
  ctx.fillRect(0, 0, AVATAR_PX, AVATAR_PX);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.85);
}
