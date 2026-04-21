import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";

class EventSourceMock {
  static latest: EventSourceMock | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners: Record<string, Array<() => void>> = {};

  constructor(public readonly _url: string) {
    EventSourceMock.latest = this;
  }

  addEventListener(name: string, cb: () => void): void {
    this.listeners[name] = [...(this.listeners[name] ?? []), cb];
  }

  close(): void {}

  emitStatus(): void {
    for (const cb of this.listeners.status ?? []) cb();
  }

  emitMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  emitError(): void {
    this.onerror?.();
  }
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", EventSourceMock as unknown as typeof EventSource);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows reconnecting state when stream errors", async () => {
    render(<AppShell />);
    EventSourceMock.latest?.emitError();
    await waitFor(() => {
      expect(screen.getByText("reconnecting")).toBeInTheDocument();
    });
  });

  it("renders prices from stream updates", async () => {
    render(<AppShell />);
    EventSourceMock.latest?.emitMessage(
      JSON.stringify({
        AAPL: {
          ticker: "AAPL",
          price: 190,
          previous_price: 189.5,
          timestamp: 1,
          change: 0.5,
          change_percent: 0.26,
          direction: "up"
        }
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /AAPL/ })).toBeInTheDocument();
      expect(screen.getByText("Selected Ticker")).toBeInTheDocument();
      expect(screen.getByText("Price: $190.00")).toBeInTheDocument();
    });
  });

  it("switches selected ticker when a watchlist row is clicked", async () => {
    render(<AppShell />);
    EventSourceMock.latest?.emitMessage(
      JSON.stringify({
        AAPL: {
          ticker: "AAPL",
          price: 190,
          previous_price: 189.5,
          timestamp: 1,
          change: 0.5,
          change_percent: 0.26,
          direction: "up"
        },
        MSFT: {
          ticker: "MSFT",
          price: 420,
          previous_price: 419,
          timestamp: 1,
          change: 1,
          change_percent: 0.24,
          direction: "up"
        }
      })
    );

    await waitFor(() => {
      expect(screen.getByText("Price: $190.00")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /MSFT/ }));

    await waitFor(() => {
      expect(screen.getByText("Price: $420.00")).toBeInTheDocument();
    });
  });

  it("renders sparkline and direction-aware change text", async () => {
    render(<AppShell />);
    EventSourceMock.latest?.emitMessage(
      JSON.stringify({
        TSLA: {
          ticker: "TSLA",
          price: 250,
          previous_price: 252,
          timestamp: 1,
          change: -2,
          change_percent: -0.79,
          direction: "down"
        }
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText("sparkline-TSLA")).toBeInTheDocument();
      expect(screen.getByText("-2.00 (-0.79%)")).toBeInTheDocument();
    });
  });

  it("falls back to demo mode when no live data arrives", async () => {
    vi.useFakeTimers();
    render(<AppShell />);
    await vi.advanceTimersByTimeAsync(2600);
    expect(screen.getByText(/Demo mode active/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("executes a buy trade and updates portfolio table", async () => {
    render(<AppShell />);
    EventSourceMock.latest?.emitMessage(
      JSON.stringify({
        AAPL: {
          ticker: "AAPL",
          price: 100,
          previous_price: 99,
          timestamp: 1,
          change: 1,
          change_percent: 1.01,
          direction: "up"
        }
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /AAPL/ })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("trade-quantity"), {
      target: { value: "2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));

    await waitFor(() => {
      expect(screen.getByText(/Bought 2 AAPL/)).toBeInTheDocument();
      expect(screen.getByText("$9800.00")).toBeInTheDocument();
      expect(screen.getByText("2.00")).toBeInTheDocument();
    });
  });

  it("submits buy from trade quantity input with Enter", async () => {
    render(<AppShell />);
    EventSourceMock.latest?.emitMessage(
      JSON.stringify({
        AAPL: {
          ticker: "AAPL",
          price: 100,
          previous_price: 99,
          timestamp: 1,
          change: 1,
          change_percent: 1.01,
          direction: "up"
        }
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /AAPL/ })).toBeInTheDocument();
      expect(screen.queryByText("N/A")).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText("trade-quantity");
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/Bought 1 AAPL/)).toBeInTheDocument();
    });
  });

  it("submits a chat message and receives a mocked assistant response", async () => {
    render(<AppShell />);

    fireEvent.change(screen.getByLabelText("chat-input"), {
      target: { value: "Give me a buy idea" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText("Give me a buy idea")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thinking..." })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/I can stage a conservative buy/i)).toBeInTheDocument();
      expect(screen.getByText(/Proposed trade: buy 1/i)).toBeInTheDocument();
    });
  });

  it("submits chat with Enter key", async () => {
    render(<AppShell />);
    const chatInput = screen.getByLabelText("chat-input");
    fireEvent.change(chatInput, {
      target: { value: "sell suggestion" }
    });
    fireEvent.keyDown(chatInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/reduce exposure/i)).toBeInTheDocument();
    });
  });
});
