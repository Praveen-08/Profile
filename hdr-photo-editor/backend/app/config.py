import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "HDR Architectural Photo Editor"

    base_dir: Path = Path(__file__).resolve().parent.parent
    storage_dir: Path = base_dir / "storage"
    uploads_dir: Path = storage_dir / "uploads"
    processed_dir: Path = storage_dir / "processed"
    thumbnails_dir: Path = storage_dir / "thumbnails"

    database_url: str = f"sqlite:///{base_dir / 'storage' / 'app.db'}"

    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    rq_queue_name: str = "hdr-processing"

    # Default auto-grouping time range, in seconds.
    default_group_range_seconds: float = 3.0

    # Comma-separated list (not JSON) so it's easy to paste into a host's
    # dashboard env var UI, e.g. "https://my-app.vercel.app,http://localhost:3000"
    # Set via HDR_CORS_ORIGINS.
    cors_origins: str = "http://localhost:3000"

    class Config:
        env_prefix = "HDR_"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

for path in (settings.uploads_dir, settings.processed_dir, settings.thumbnails_dir):
    path.mkdir(parents=True, exist_ok=True)
