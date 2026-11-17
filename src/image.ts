// Small enough that four photos fit in one upload.
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.82;

/** Shrinks a photo from the phone to a JPEG data URL small enough to upload quickly. */
export async function preparePhoto(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That photo could not be opened. Try another one.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
