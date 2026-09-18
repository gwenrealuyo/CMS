"""Validators for person/profile photo uploads (must match frontend/src/lib/personPhoto.ts)."""

from django.core.exceptions import ValidationError
from django.core.files.images import get_image_dimensions

PERSON_PHOTO_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
PERSON_PHOTO_MAX_DIMENSION = 4000
PERSON_PHOTO_ALLOWED_MIME_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp"}
)
# Safari / some Apple clients report non-standard JPEG MIME aliases.
PERSON_PHOTO_MIME_ALIASES = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "image/x-png": "image/png",
}
PERSON_PHOTO_ALLOWED_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})
PERSON_PHOTO_HELPER_TEXT = (
    "JPEG, PNG, WebP, or Apple HEIC · max 5 MB · max 4000×4000 px"
)
# Apple HEIC is converted to JPEG on the client before upload; stored types remain
# JPEG/PNG/WebP only.


def _extension(filename: str) -> str:
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


def validate_person_photo(value):
    """Reject photos that exceed type, size, or dimension limits."""
    if value is None:
        return

    name = getattr(value, "name", "") or ""
    content_type = getattr(value, "content_type", None) or ""
    ext = _extension(name)

    if ext not in PERSON_PHOTO_ALLOWED_EXTENSIONS:
        raise ValidationError(
            f"Unsupported file type. Use {PERSON_PHOTO_HELPER_TEXT}."
        )

    if content_type:
        normalized_type = PERSON_PHOTO_MIME_ALIASES.get(
            content_type.lower(), content_type.lower()
        )
        if normalized_type not in PERSON_PHOTO_ALLOWED_MIME_TYPES:
            raise ValidationError(
                f"Unsupported file type. Use {PERSON_PHOTO_HELPER_TEXT}."
            )

    size = getattr(value, "size", None)
    if size is not None and size > PERSON_PHOTO_MAX_BYTES:
        raise ValidationError(
            f"Photo is too large (max 5 MB). {PERSON_PHOTO_HELPER_TEXT}."
        )

    try:
        width, height = get_image_dimensions(value)
    except Exception:
        raise ValidationError(
            f"Could not read image. Use {PERSON_PHOTO_HELPER_TEXT}."
        ) from None

    if width is None or height is None:
        raise ValidationError(
            f"Could not read image. Use {PERSON_PHOTO_HELPER_TEXT}."
        )

    if width > PERSON_PHOTO_MAX_DIMENSION or height > PERSON_PHOTO_MAX_DIMENSION:
        raise ValidationError(
            f"Photo dimensions are too large "
            f"(max {PERSON_PHOTO_MAX_DIMENSION}×{PERSON_PHOTO_MAX_DIMENSION} px)."
        )
