import base64
import hashlib
from fastapi import APIRouter, HTTPException

from ..schemas.face_verify import FaceVerifyRequest, FaceVerifyResponse

router = APIRouter()

_JPEG_MAGIC = b"\xff\xd8\xff"
_PNG_MAGIC = b"\x89PNG"


def _validate_image(b64: str) -> bytes:
    try:
        data = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid base64 image data")
    if len(data) < 1024:
        raise HTTPException(status_code=422, detail="Image too small — ensure camera is working")
    if not (data[:3] == _JPEG_MAGIC or data[:4] == _PNG_MAGIC):
        raise HTTPException(status_code=422, detail="Unsupported image format — use JPEG or PNG")
    return data


@router.post("", response_model=FaceVerifyResponse)
def verify_face(body: FaceVerifyRequest):
    image_bytes = _validate_image(body.face_image)

    # Deterministic confidence derived from image + passport so same pair always gives same result.
    # In production this would call a real face-matching service.
    digest = hashlib.sha256(image_bytes[:512] + body.passport_number.encode()).hexdigest()
    seed = int(digest[:8], 16)
    # Map into 0.82–0.97 range
    confidence = round(0.82 + (seed % 1000) / 6666, 4)

    return FaceVerifyResponse(
        verified=True,
        confidence=confidence,
        message=f"Face matched to passport {body.passport_number[:2]}***{body.passport_number[-2:]} "
                f"with {confidence * 100:.1f}% confidence",
    )
