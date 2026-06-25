from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import get_settings
from app.routes import auth, database, history, query, schema
from app.utils.exceptions import AppError


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Production-ready backend for an AI-powered SQL Assistant.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": f"Internal server error: {exc}"})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(database.router, prefix=settings.api_prefix)
app.include_router(schema.router, prefix=settings.api_prefix)
app.include_router(query.router, prefix=settings.api_prefix)
app.include_router(history.router, prefix=settings.api_prefix)
