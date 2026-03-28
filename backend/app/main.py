from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine

from app.models import user as _m_user
from app.models import merchant as _m_merchant
from app.models import product as _m_product
from app.models import tariff as _m_tariff
from app.models import client as _m_client
from app.models import application as _m_application
from app.models import contract as _m_contract
from app.models import audit as _m_audit
from app.models import scoring as _m_scoring

from app.routers import auth, tariffs, merchants, products, applications, contracts, scoring, dashboard

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Installment Platform API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(tariffs.router, prefix="/api/v1/tariffs", tags=["tariffs"])
app.include_router(merchants.router, prefix="/api/v1/merchants", tags=["merchants"])
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(applications.router, prefix="/api/v1/applications", tags=["applications"])
app.include_router(contracts.router, prefix="/api/v1/contracts", tags=["contracts"])
app.include_router(scoring.router, prefix="/api/v1/score", tags=["scoring"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])


@app.get("/health")
def health():
    return {"status": "ok"}
