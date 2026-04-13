from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_tables
from app.routers import auth, catering, cash, clover, employees, expenses, reports, vendors

app = FastAPI(title="Basera API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_tables()


# Routers
app.include_router(auth.router, prefix="/api")
app.include_router(clover.router, prefix="/api")
app.include_router(catering.router, prefix="/api")
app.include_router(expenses.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(vendors.router, prefix="/api")
app.include_router(employees.router, prefix="/api")
app.include_router(cash.router, prefix="/api")


@app.get("/health")
def health_check():
    return {"status": "ok"}
