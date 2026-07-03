from fastapi import APIRouter, HTTPException

from data.apartments import APARTMENTS

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/apartments")
async def list_apartments(city: str | None = None):
    """Return apartments, optionally filtered by city name."""
    if city:
        normalized = city.strip().lower()
        filtered = [a for a in APARTMENTS if a["city"].lower() == normalized]
        return {"city": city, "apartments": filtered, "count": len(filtered)}
    return {"city": None, "apartments": APARTMENTS, "count": len(APARTMENTS)}


@router.get("/apartments/{apartment_id}")
async def get_apartment(apartment_id: str):
    for apartment in APARTMENTS:
        if apartment["id"] == apartment_id:
            return apartment
    raise HTTPException(status_code=404, detail="Apartment not found")
