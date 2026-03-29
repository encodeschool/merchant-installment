from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .routers import (
    auth,
    tariffs,
    merchants,
    products,
    applications,
    contracts,
    scoring,
    dashboard,
    face_verify,
    chat,
)

app = FastAPI(title="Installment Platform API", version="1.0.0", debug=settings.DEBUG)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "https://merchant-cbu.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tariffs.router, prefix="/api/v1/tariffs", tags=["tariffs"])
app.include_router(merchants.router, prefix="/api/v1/merchants", tags=["merchants"])
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(
    applications.router, prefix="/api/v1/applications", tags=["applications"]
)
app.include_router(contracts.router, prefix="/api/v1/contracts", tags=["contracts"])
app.include_router(scoring.router, prefix="/api/v1/score", tags=["scoring"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(
    face_verify.router, prefix="/api/v1/face-verify", tags=["face-verify"]
)
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])


@app.get("/health")
def health():
    return {"status": "ok"}
