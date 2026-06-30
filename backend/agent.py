from typing import Dict


def handle_message(text: str) -> Dict[str, str]:
    """Simple agent logic for the real estate voice assistant."""
    cleaned = (text or "").strip()

    if not cleaned:
        return {
            "reply": "Hello! I can help you find properties, answer questions, and help schedule a site visit."
        }

    lowered = cleaned.lower()

    if "2bhk" in lowered or "2 bhk" in lowered:
        return {
            "reply": "I can help you find 2 BHK options near your preferred area. Tell me your budget and location."
        }

    if "book" in lowered or "visit" in lowered or "schedule" in lowered:
        return {
            "reply": "I can help you schedule a site visit. Please share your preferred date and location."
        }

    if "price" in lowered or "budget" in lowered:
        return {
            "reply": "I can suggest properties within your budget. Tell me your preferred price range."
        }

    return {
        "reply": f"Thanks for your message: {cleaned}. I can help with property suggestions, local options, and site visit scheduling."
    }
