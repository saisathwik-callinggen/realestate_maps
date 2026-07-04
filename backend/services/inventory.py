"""Property inventory helpers for LLM context."""

from data.apartments import APARTMENTS

CITY_KEYWORDS: dict[str, str] = {
    "pune": "Pune",
    "mumbai": "Mumbai",
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "hyderabad": "Hyderabad",
    "gurugram": "Delhi",
    "gurgaon": "Delhi",
    "ncr": "Delhi",
}


def detect_city_from_text(text: str) -> str | None:
    lowered = text.lower()
    for keyword, city in sorted(CITY_KEYWORDS.items(), key=lambda item: -len(item[0])):
        if keyword in lowered:
            return city
    return None


def get_apartments_for_city(city: str | None) -> list[dict]:
    if not city:
        return APARTMENTS
    normalized = city.strip().lower()
    return [a for a in APARTMENTS if a["city"].lower() == normalized]


def build_inventory_context(city: str | None) -> str:
    listings = get_apartments_for_city(city)
    if not listings:
        return ""

    city_label = city or "all cities"
    lines = [
        (
            f"- {item['name']} ({item.get('tag', 'Listed')}): "
            f"{item['bhk']}, {item['price']}, {item['address']}. {item['description']}"
        )
        for item in listings
    ]

    return (
        f"ACTIVE CITY: {city_label}\n"
        f"Available properties in {city_label} — ONLY mention these exact options:\n"
        + "\n".join(lines)
        + "\n\nWhen the user asks about this city, list ALL properties above with name, BHK, and price. "
        "Do not invent properties outside this list."
    )
