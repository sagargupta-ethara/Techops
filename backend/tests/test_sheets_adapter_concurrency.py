import threading
import time

import anyio

from sheets_adapter import SheetsAdapter


class _Call:
    def __init__(self, transport, payload):
        self.transport = transport
        self.payload = payload

    def execute(self):
        with self.transport.guard:
            self.transport.active += 1
            self.transport.max_active = max(self.transport.max_active, self.transport.active)
        time.sleep(0.03)
        with self.transport.guard:
            self.transport.active -= 1
        return self.payload


class _Endpoint:
    def __init__(self, transport):
        self.transport = transport

    def get(self, **kwargs):
        payload = {"properties": {"title": "Test"}} if "range" not in kwargs else {"values": [["ok"]]}
        return _Call(self.transport, payload)

    def values(self):
        return self


class _Transport:
    def __init__(self):
        self.active = 0
        self.max_active = 0
        self.guard = threading.Lock()

    def spreadsheets(self):
        return _Endpoint(self)

    def values(self):
        return _Endpoint(self)


def test_master_and_delivery_reads_do_not_share_transport_concurrently():
    adapter = object.__new__(SheetsAdapter)
    adapter.sheet_id = "sheet"
    adapter.cred_file = "unused"
    adapter._svc = _Transport()
    adapter._transport_lock = threading.Lock()

    async def read_both():
        async with anyio.create_task_group() as group:
            group.start_soon(adapter.read_master)
            group.start_soon(adapter.read_deliveries)

    anyio.run(read_both)
    assert adapter._svc.max_active == 1
