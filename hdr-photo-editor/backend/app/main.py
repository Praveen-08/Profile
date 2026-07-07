from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import export, groups, process, upload

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(upload.router)
app.include_router(groups.router)
app.include_router(process.router)
app.include_router(export.router)

app.mount("/media/thumbnails", StaticFiles(directory=str(settings.thumbnails_dir)), name="thumbnails")
app.mount("/media/processed", StaticFiles(directory=str(settings.processed_dir)), name="processed")
app.mount("/media/uploads", StaticFiles(directory=str(settings.uploads_dir)), name="uploads")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": settings.app_name}
