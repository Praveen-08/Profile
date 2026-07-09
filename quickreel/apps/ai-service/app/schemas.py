from pydantic import BaseModel, ConfigDict, Field


class BeatDetectRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    audio_url: str = Field(alias="audioUrl")
    track_slug: str = Field(alias="trackSlug")


class DepthMapRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    image_url: str = Field(alias="imageUrl")
