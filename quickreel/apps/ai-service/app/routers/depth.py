import httpx
from fastapi import APIRouter, HTTPException, Response

from app.depth_estimation import estimate_depth
from app.schemas import DepthMapRequest

router = APIRouter(prefix="/vision", tags=["vision"])


@router.post("/depth-map")
async def depth_map(request: DepthMapRequest) -> Response:
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(request.image_url)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to fetch image from {request.image_url}: {exc}") from exc

    try:
        png_bytes = estimate_depth(response.content)
    except Exception as exc:  # model download/inference can fail in many ways
        raise HTTPException(status_code=422, detail=f"Depth estimation failed: {exc}") from exc

    return Response(content=png_bytes, media_type="image/png")
