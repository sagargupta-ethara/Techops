"""Google Sheets read-only adapter for the Master tab."""
import asyncio
import os

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
RANGE = "Master!A:AD"
ERROR_TOKENS = {"#REF!", "#N/A", "#VALUE!", "#ERROR!", "#DIV/0!", "#NAME?", "Loading..."}


class SheetsAdapter:
    def __init__(self):
        self.sheet_id = os.environ["SHEET_ID"]
        self.cred_file = os.environ["GOOGLE_SERVICE_ACCOUNT_FILE"]
        self._svc = None

    def _service(self):
        if self._svc is None:
            creds = Credentials.from_service_account_file(self.cred_file, scopes=SCOPES)
            self._svc = build("sheets", "v4", credentials=creds, cache_discovery=False)
        return self._svc

    def _read_sync(self) -> dict:
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

    async def read_master(self) -> dict:
        return await asyncio.to_thread(self._read_sync)
