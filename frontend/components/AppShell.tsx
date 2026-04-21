"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";

import { createPriceStream } from "../lib/sse";
import type { ConnectionStatus, PriceSnapshot } from "../lib/types";

function statusColor(status: ConnectionStatus): string {
  if (status === "connected") return "#16a34a";
  if (status === "reconnecting") return "#f59e0b";
  return "#dc2626";
}

export function AppShell(): JSX.Element {
  const [prices, setPrices] = useState<PriceSnapshot>({});
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    const dispose = createPriceStream({
      onStatusChange: setStatus,
      onPriceData: (next) => {
        setStreamError(null);
        setPrices(next);
      },
      onError: (error) => {
        setStreamError(error.message);
      }
    });

    return dispose;
  }, []);

  const tickers = useMemo(() => Object.values(prices), [prices]);

  return (
    <main style={{ background: "#0d1117", color: "#e6edf3", minHeight: "100vh", padding: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>FinAlly</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            aria-label={`connection-${status}`}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: statusColor(status),
              display: "inline-block"
            }}
          />
          <span style={{ textTransform: "capitalize" }}>{status}</span>
        </div>
      </header>

      <section style={{ border: "1px solid #30363d", borderRadius: 8, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Watchlist</h2>
        {tickers.length === 0 ? (
          <p>No price data yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {tickers.map((row) => (
              <li key={row.ticker} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <strong>{row.ticker}</strong>
                <span>${row.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {streamError ? <p role="alert">Stream error: {streamError}</p> : null}
    </main>
  );
}
