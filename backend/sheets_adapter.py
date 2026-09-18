import os
import threading
from typing import TypedDict

import anyio
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
RANGE = "Master!A:AD"
DELIVERIES_RANGE = "Deliveries!A:ZZ"
ERROR_TOKENS = {"#REF!", "#N/A", "#VALUE!", "#ERROR!", "#DIV/0!", "#NAME?", "Loading..."}


class MasterSheetRead(TypedDict):
    title: str
    values: list[list[str]]
    formula_error: bool


class DeliveriesSheetRead(TypedDict):
    values: list[list[str]]
    formula_error: bool


class SheetsAdapter:
    def __init__(self):
        self.sheet_id = os.environ["SHEET_ID"]
        self.cred_file = os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"]
        self._svc = None
        self._transport_lock = threading.Lock()

    def _service(self):
        if self._svc is None:
            creds = Credentials.from_service_account_file(self.cred_file, scopes=SCOPES)
            self._svc = build("sheets", "v4", credentials=creds, cache_discovery=False)
        return self._svc

    def _read_sync(self) -> MasterSheetRead:
        with self._transport_lock:
            svc = self._service()
            meta = svc.spreadsheets().get(spreadsheetId=self.sheet_id).execute()
            title = meta.get("properties", {}).get("title", "")
            res = svc.spreadsheets().values().get(
                spreadsheetId=self.sheet_id, range=RANGE
            ).execute()
        values = res.get("values", [])
        formula_error = any(
            any(str(cell).strip() in ERROR_TOKENS for cell in row) for row in values
        )
        return {"title": title, "values": values, "formula_error": formula_error}

    async def read_master(self) -> MasterSheetRead:
        return await anyio.to_thread.run_sync(self._read_sync)

    def _read_deliveries_sync(self) -> DeliveriesSheetRead:
        with self._transport_lock:
            res = self._service().spreadsheets().values().get(
                spreadsheetId=self.sheet_id, range=DELIVERIES_RANGE
            ).execute()
        values = res.get("values", [])
        formula_error = any(
            any(str(cell).strip() in ERROR_TOKENS for cell in row) for row in values
        )
        return {"values": values, "formula_error": formula_error}

    async def read_deliveries(self) -> DeliveriesSheetRead:
        return await anyio.to_thread.run_sync(self._read_deliveries_sync)
