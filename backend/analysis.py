"""LLM-backed blocker analysis over POD member remarks (Claude Haiku 4.5)."""
import json
import os

from emergentintegrations.llm.chat import LlmChat, UserMessage

MODEL = ("anthropic", "claude-haiku-4-5-20251001")

SYSTEM = (
    "You are an operations analyst for an AI data-labeling org. You read short free-text "
    "remarks written by individual contributors and their leads and surface WHY work is not "
    "getting completed. Be blunt, specific, and quantitative. Never invent facts not present "
    "in the remarks. Respond ONLY with valid minified JSON, no markdown."
)

PROMPT = """POD: {pod}
People: {n}. Completion status: {complete} complete, {incomplete} in progress, {absent} on leave. Overall completion is effectively {overall}.

Below are per-person entries as "STATUS | REMARK". Blank remarks are shown as [no remark].

{entries}

Analyze the remarks and return JSON with EXACTLY these keys:
{{
  "headline": "one sentence explaining the single biggest reason completion is low",
  "blockers": [{{"issue": "short blocker label", "count": <int people affected>, "detail": "one concrete sentence"}}],
  "no_remark_count": <int number of entries with no remark>,
  "recommendation": "one actionable next step for the POD lead"
}}
Rules: 3-5 blockers max, ordered by how many people are affected. Base counts only on the entries shown."""


def _entries(members):
    lines = []
    for p in members:
        status = (p.get("tasking_status") or "").strip() or "No status"
        remark = (p.get("remarks") or "").strip() or (p.get("remark") or "").strip()
        remark = remark or "[no remark]"
        lines.append(f"- {status} | {remark[:240]}")
    return "\n".join(lines[:80])


async def analyze_blockers(pod: str, members: list[dict], metrics: dict) -> dict:
    key = os.environ["EMERGENT_LLM_KEY"]
    comp = metrics.get("completion", {})
    overall = comp.get("pct")
    overall_txt = "0%" if not overall else f"{overall}%"
    prompt = PROMPT.format(
        pod=pod, n=len(members),
        complete=comp.get("complete", 0), incomplete=comp.get("incomplete", 0),
        absent=comp.get("absent", 0), overall=overall_txt, entries=_entries(members),
    )
    chat = LlmChat(api_key=key, session_id=f"blocker-{pod}", system_message=SYSTEM).with_model(*MODEL)
    resp = await chat.send_message(UserMessage(text=prompt))
    text = resp if isinstance(resp, str) else str(resp)
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1].replace("json", "", 1).strip() if "```" in text else text
    try:
        data = json.loads(text)
    except Exception:
        data = {"headline": text[:400], "blockers": [], "no_remark_count": None,
                "recommendation": ""}
    data["model"] = "claude-haiku-4-5"
    return data
