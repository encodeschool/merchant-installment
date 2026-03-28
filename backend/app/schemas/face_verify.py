from pydantic import BaseModel


class FaceVerifyRequest(BaseModel):
    passport_number: str
    face_image: str  # base64-encoded JPEG/PNG


class FaceVerifyResponse(BaseModel):
    verified: bool
    confidence: float
    message: str
