"""Tests for SSE stream generation."""

from __future__ import annotations

import pytest

from app.market.cache import PriceCache
from app.market.stream import _format_sse, _generate_events


class _RequestClient:
    def __init__(self, host: str = "test-client") -> None:
        self.host = host


class _RequestStub:
    def __init__(self) -> None:
        self.client = _RequestClient()

    async def is_disconnected(self) -> bool:
        return False


def test_format_sse_with_default_message_event() -> None:
    """SSE formatter should emit unnamed message event format."""
    assert _format_sse('{"ok":true}') == 'data: {"ok":true}\n\n'


def test_format_sse_with_named_event() -> None:
    """SSE formatter should include event name when provided."""
    assert _format_sse('{"status":"connected"}', event="status") == (
        'event: status\ndata: {"status":"connected"}\n\n'
    )


@pytest.mark.asyncio
async def test_generate_events_emits_retry_and_price_payload() -> None:
    """Generator should emit retry directive and data when cache changes."""
    cache = PriceCache()
    request = _RequestStub()
    cache.update("AAPL", 190.0)

    generator = _generate_events(
        cache,
        request,
        interval=0.001,
        heartbeat_interval=10.0,
    )

    retry_event = await anext(generator)
    status_event = await anext(generator)
    data_event = await anext(generator)

    assert retry_event == "retry: 1000\n\n"
    assert status_event == 'event: status\ndata: {"status":"connected"}\n\n'
    assert data_event.startswith("data: ")
    assert '"AAPL"' in data_event

    await generator.aclose()


@pytest.mark.asyncio
async def test_generate_events_emits_keepalive_when_idle() -> None:
    """Generator should emit keepalive comment when no updates arrive."""
    cache = PriceCache()
    request = _RequestStub()

    generator = _generate_events(
        cache,
        request,
        interval=0.001,
        heartbeat_interval=0.002,
    )

    retry_event = await anext(generator)
    status_event = await anext(generator)
    keepalive_event = await anext(generator)

    assert retry_event == "retry: 1000\n\n"
    assert status_event == 'event: status\ndata: {"status":"connected"}\n\n'
    assert keepalive_event == ": keepalive\n\n"

    await generator.aclose()
