export const MAX_IMAGES = 8;
/** The browser shrinks screenshots before upload; this only stops something unreasonable (~5 MB per image). */
const MAX_BASE64_CHARS = 7_000_000;
export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";
const MEDIA_TYPES = new Set<string>(["image/jpeg", "image/png", "image/webp"]);

export interface ImageUpload {
  mediaType: ImageMediaType;
  data: string;
}

/** Check uploaded screenshots: an error message for the parent, or the images. `required` = at least one. */
export function validateImages(raw: unknown, required: boolean): { error: string } | { images: ImageUpload[] } {
  const images = raw === undefined || raw === null ? [] : raw;
  if (!Array.isArray(images)) return { error: "images must be a list" };
  if (required && images.length === 0) return { error: "Add at least one screenshot" };
  if (images.length > MAX_IMAGES) return { error: `At most ${MAX_IMAGES} screenshots at a time` };
  for (const img of images as { mediaType?: unknown; data?: unknown }[]) {
    if (!img || typeof img.mediaType !== "string" || !MEDIA_TYPES.has(img.mediaType)) return { error: "Screenshots must be JPEG, PNG or WebP" };
    if (typeof img.data !== "string" || !img.data || img.data.length > MAX_BASE64_CHARS || !/^[A-Za-z0-9+/]+=*$/.test(img.data)) {
      return { error: "One of the screenshots couldn't be read — try a smaller image" };
    }
  }
  return { images: images as ImageUpload[] };
}
