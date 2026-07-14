/** Shared rules for person/profile photo uploads (must match backend). */

export const PERSON_PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PERSON_PHOTO_MAX_DIMENSION = 4000;

export const PERSON_PHOTO_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const PERSON_PHOTO_ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

/** Value for `<input type="file" accept="...">` */
export const PERSON_PHOTO_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export const PERSON_PHOTO_HELPER_TEXT =
  "JPEG, PNG, or WebP · max 5 MB · max 4000×4000 px";

export type PersonPhotoValidationResult =
  | { ok: true }
  | { ok: false; message: string };

function getExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

function isAllowedType(file: File): boolean {
  const ext = getExtension(file.name);
  const mimeOk = PERSON_PHOTO_ALLOWED_MIME_TYPES.includes(
    file.type as (typeof PERSON_PHOTO_ALLOWED_MIME_TYPES)[number],
  );
  const extOk = PERSON_PHOTO_ALLOWED_EXTENSIONS.includes(
    ext as (typeof PERSON_PHOTO_ALLOWED_EXTENSIONS)[number],
  );
  // Accept if extension is allowed (some browsers leave type empty) and MIME is
  // empty or also allowed.
  if (!extOk) return false;
  if (!file.type) return true;
  return mimeOk;
}

function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file)
        .then((bitmap) => {
          const dims = { width: bitmap.width, height: bitmap.height };
          bitmap.close();
          resolve(dims);
        })
        .catch(() => {
          // Fall through to Image element
          loadViaImageElement(file).then(resolve).catch(reject);
        });
      return;
    }
    loadViaImageElement(file).then(resolve).catch(reject);
  });
}

function loadViaImageElement(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export async function validatePersonPhoto(
  file: File,
): Promise<PersonPhotoValidationResult> {
  if (!isAllowedType(file)) {
    return {
      ok: false,
      message: `Unsupported file type. Use ${PERSON_PHOTO_HELPER_TEXT}.`,
    };
  }

  if (file.size > PERSON_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      message: `Photo is too large (max 5 MB). ${PERSON_PHOTO_HELPER_TEXT}.`,
    };
  }

  try {
    const { width, height } = await readImageDimensions(file);
    if (
      width > PERSON_PHOTO_MAX_DIMENSION ||
      height > PERSON_PHOTO_MAX_DIMENSION
    ) {
      return {
        ok: false,
        message: `Photo dimensions are too large (max ${PERSON_PHOTO_MAX_DIMENSION}×${PERSON_PHOTO_MAX_DIMENSION} px).`,
      };
    }
  } catch {
    return {
      ok: false,
      message: `Could not read image. Use ${PERSON_PHOTO_HELPER_TEXT}.`,
    };
  }

  return { ok: true };
}
