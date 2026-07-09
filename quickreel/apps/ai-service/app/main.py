from dotenv import load_dotenv
from fastapi import FastAPI

from app.routers import beat_detect, depth

# python-dotenv walks up from cwd() looking for a .env file, so this finds the
# monorepo root .env regardless of which directory uvicorn is launched from.
load_dotenv()

app = FastAPI(title="QuickReel AI Service", version="0.1.0")
app.include_router(beat_detect.router)
app.include_router(depth.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
