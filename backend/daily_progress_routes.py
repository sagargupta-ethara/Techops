from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

import daily_progress as DP
import delivery as DL


class ImportBody(BaseModel):
    csv_text: str
    duplicate_mode: str = "skip"


def create_router(db, adapter, current_user: Callable, require_admin: Callable) -> APIRouter:
    router = APIRouter(prefix="/api/daily-progress", tags=["daily-progress"])

    @router.get("")
    async def dashboard(
        _user: dict = Depends(current_user), dates: str = Query(None),
        date_from: str = Query(None), date_to: str = Query(None), name: str = Query(None),
        email: str = Query(None), task_type: str = Query(None), search: str = Query(None),
    ):
        records = await db.daily_progress.find({}, {"_id": 0}).to_list(length=None)
        raw = await adapter.read_deliveries()
        if raw.get("formula_error"):
            raise HTTPException(status_code=503, detail="Formula error detected in Deliveries sheet")
        filters = {key: value for key, value in {
            "dates": dates, "date_from": date_from, "date_to": date_to, "name": name,
            "email": email, "task_type": task_type, "search": search,
        }.items() if value}
        return DP.build_dashboard(records, DL.parse_delivery_rows(raw.get("values", [])), filters)

    @router.post("/import")
    async def import_csv(body: ImportBody, _user: dict = Depends(require_admin)):
        if body.duplicate_mode not in {"skip", "replace"}:
            raise HTTPException(status_code=422, detail="duplicate_mode must be skip or replace")
        records, errors = DP.parse_csv(body.csv_text)
        imported = replaced = duplicates = 0
        for record in records:
            exists = await db.daily_progress.find_one({"record_key": record["record_key"]}, {"_id": 1})
            if exists and body.duplicate_mode == "skip":
                duplicates += 1
                continue
            if exists:
                await db.daily_progress.replace_one({"record_key": record["record_key"]}, record)
                replaced += 1
            else:
                await db.daily_progress.insert_one(record)
                imported += 1
        return {"imported": imported, "replaced": replaced, "duplicates": duplicates,
                "invalid": len(errors), "errors": errors[:100]}

    return router


async def seed_historical(db, source: Path) -> int:
    records = json.loads(source.read_text(encoding="utf-8"))
    inserted = 0
    for record in records:
        result = await db.daily_progress.update_one(
            {"record_key": record["record_key"]}, {"$setOnInsert": record}, upsert=True,
        )
        inserted += int(result.upserted_id is not None)
    return inserted
