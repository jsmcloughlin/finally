import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
      expect(screen.getByText("AAPL")).toBeInTheDocument();
      expect(screen.getByText("$190.00")).toBeInTheDocument();
    });
  });
});
