"""
Claude Vision analysis for unauthorized access incidents.

After the real-time face recognition system detects an unauthorized access,
this service sends the captured frame to Claude's vision API for deeper
analysis. This runs async (non-blocking) after the alert has already fired.

Analysis includes:
- Description of the detected individual (clothing, visible ID, etc.)
- Whether they appear to be a student, staff, or visitor
- Risk assessment based on context
- Recommended follow-up actions

Results are broadcast to admins as a follow-up enrichment event.
"""

import asyncio
import base64
import os
from datetime import datetime, timezone
from typing import Optional

import anthropic


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_client: Optional[anthropic.AsyncAnthropic] = None

ANALYSIS_MODEL = "claude-sonnet-4-20250514"
ANALYSIS_MAX_TOKENS = 512
ANALYSIS_TEMPERATURE = 0.2


def _get_client() -> anthropic.AsyncAnthropic:
    """Lazy-init the Anthropic client."""
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")
        _client = anthropic.AsyncAnthropic(api_key=api_key)
    return _client


# ---------------------------------------------------------------------------
# Analysis prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a campus security analysis assistant for PirateFlow, a university space management platform.

You are analyzing a security camera frame where an unauthorized access has been detected — either the person was not recognized by the face recognition system, or they were recognized but don't have a valid room booking.

Your job is to provide a brief, professional security analysis that helps campus administrators assess the situation.

Respond ONLY with a JSON object in this exact format:
{
    "description": "Brief physical description (clothing, visible items, approximate age range). Do NOT attempt to identify race or ethnicity.",
    "person_type": "student" | "staff" | "visitor" | "unknown",
    "person_type_reasoning": "Why you classified them this way (backpack, uniform, visitor badge, etc.)",
    "risk_level": "low" | "medium" | "high",
    "risk_reasoning": "Why this risk level (e.g., looks like a lost student vs. deliberate unauthorized entry)",
    "recommended_action": "Specific next step for the admin (e.g., 'Send a courtesy reminder about booking policy' or 'Dispatch security to verify identity')"
}

Guidelines:
- Be professional and objective
- Focus on observable details (clothing, carried items, badges, behavior cues)
- NEVER speculate about race, ethnicity, or national origin
- "low" risk = likely a student/staff who forgot to book
- "medium" risk = unclear intent, warrants a check
- "high" risk = clear signs of unauthorized intent (e.g., accessing restricted lab, after hours)
- Keep descriptions factual and concise"""


def _build_user_message(
    room_name: str,
    building_name: str,
    detected_user: str | None,
    had_booking: bool,
    image_b64: str,
) -> list[dict]:
    """Build the Claude messages array with the image and context."""
    context_parts = [
        f"Location: {room_name}, {building_name}",
        f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
    ]
    if detected_user and detected_user != "Unknown":
        context_parts.append(f"Face matched to: {detected_user} (but they have no booking for this room)")
    else:
        context_parts.append("Face not recognized in the system (unregistered individual)")

    context_text = "\n".join(context_parts)

    return [
        {
            "type": "text",
            "text": f"Analyze this security camera frame. Context:\n{context_text}\n\nRespond with the JSON analysis.",
        },
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": image_b64,
            },
        },
    ]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def analyze_unauthorized_access(
    image_base64: str,
    room_name: str,
    building_name: str,
    detected_user: str | None,
    had_booking: bool,
) -> Optional[dict]:
    """
    Send a camera frame to Claude Vision for deeper analysis of an
    unauthorized access incident.

    Returns the parsed analysis dict, or None if the call fails.
    This should be called fire-and-forget (non-blocking) after the
    real-time alert has already been sent.
    """
    try:
        client = _get_client()
    except RuntimeError:
        # No API key configured — skip analysis silently
        return None

    # Strip data URL prefix if present
    clean_b64 = image_base64
    if "," in clean_b64:
        clean_b64 = clean_b64.split(",", 1)[1]

    try:
        response = await client.messages.create(
            model=ANALYSIS_MODEL,
            max_tokens=ANALYSIS_MAX_TOKENS,
            temperature=ANALYSIS_TEMPERATURE,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": _build_user_message(
                        room_name=room_name,
                        building_name=building_name,
                        detected_user=detected_user,
                        had_booking=had_booking,
                        image_b64=clean_b64,
                    ),
                }
            ],
        )

        # Parse the JSON response
        raw_text = response.content[0].text.strip()
        # Strip markdown fences if Claude wraps in ```json ... ```
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            if raw_text.endswith("```"):
                raw_text = raw_text[: raw_text.rfind("```")]
            raw_text = raw_text.strip()

        import json
        analysis = json.loads(raw_text)
        return analysis

    except Exception as e:
        print(f"[vision_analysis] Claude Vision call failed: {e}")
        return None


async def analyze_and_broadcast(
    image_base64: str,
    room_id: str,
    room_name: str,
    building_name: str,
    detected_user: str | None,
    access_log_id: str,
):
    """
    Fire-and-forget: analyze the frame with Claude Vision, then broadcast
    the enriched analysis to admin dashboards as a follow-up event.

    Called via asyncio.create_task() so it doesn't block the verify response.
    """
    analysis = await analyze_unauthorized_access(
        image_base64=image_base64,
        room_name=room_name,
        building_name=building_name,
        detected_user=detected_user,
        had_booking=False,
    )

    if analysis is None:
        return

    # Broadcast the enrichment to admins
    from routers.websocket import manager

    await manager.broadcast_to_admins("access_analysis", {
        "access_log_id": access_log_id,
        "room_id": room_id,
        "room_name": room_name,
        "building_name": building_name,
        "detected_user": detected_user or "Unknown",
        "analysis": analysis,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    })
