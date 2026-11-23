"""Request/response models. Mirror of lib/types.ts — change both together (PRD: shared types).

Field names are camelCase on purpose so the JSON matches the PRD contract exactly.
"""

from typing import Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

HousingType = Literal["apartment", "house", "condo", "any"]
Match = Literal["yes", "partial", "no"]


class Weights(BaseModel):
    model_config = ConfigDict(extra="forbid")
    safety: int = Field(3, ge=0, le=5)
    transit: int = Field(3, ge=0, le=5)
    schools: int = Field(1, ge=0, le=5)
    amenities: int = Field(3, ge=0, le=5)


class Preferences(BaseModel):
    """Input to the MCP score_zips tool. bedrooms: 0 = studio, 3 = 3+."""

    model_config = ConfigDict(extra="forbid")
    budgetMax: float = Field(2500, gt=0, le=20000)
    housingType: HousingType = "any"
    bedrooms: int = Field(1, ge=0, le=3)
    petFriendly: bool = False
    vibe: int = Field(3, ge=1, le=5)
    weights: Weights = Field(default_factory=Weights)
    topN: int = Field(5, ge=1, le=10)
    # Optional context from the onboarding survey (not used for hard filtering).
    householdSize: int | None = Field(None, ge=1, le=10)
    bathrooms: int | None = Field(None, ge=1, le=5)


class ZipFeature(BaseModel):
    key: str
    label: str
    value: Union[float, int, str, None] = None
    unit: str | None = None
    match: Match = "partial"
    contribution: float = 0.0


class ZipResult(BaseModel):
    zip: str
    neighborhood: str = ""
    rank: int = 0
    score: float = 0.0
    centroid: tuple[float, float] | None = None
    features: list[ZipFeature] = Field(default_factory=list)
    reason: str = ""

    @field_validator("zip", mode="before")
    @classmethod
    def five_char_zip(cls, value: Any) -> str:
        # PRD risk: "Zip codes don't join to GeoJSON" -> always 5-character strings.
        return str(value).strip().zfill(5)


class Meta(BaseModel):
    zipsScored: int = 0
    matched: int = 0


class RecommendResponse(BaseModel):
    results: list[ZipResult]
    appliedFilters: dict[str, Any]
    meta: Meta = Field(default_factory=Meta)


class ZipDetailsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    zip: str = Field(pattern=r"^\d{5}$")
    preferences: Preferences = Field(default_factory=Preferences)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    # Preferences already known (onboarding survey or a previous turn); chat refines them.
    context: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    reply: str
    understoodFilters: dict[str, Any]
    results: list[ZipResult]
    meta: Meta = Field(default_factory=Meta)
