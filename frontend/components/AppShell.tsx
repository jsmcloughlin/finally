"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";

import { getPortfolio, getWatchlist, postChat, postTrade } from "../lib/api";
import { createMockPriceSnapshot } from "../lib/mockStream";
import { createPriceStream } from "../lib/sse";
import type { ConnectionStatus, PriceSnapshot } from "../lib/types";

const SPARKLINE_LIMIT = 30;

function statusColor(status: ConnectionStatus): string {
  if (status === "connected") return "#16a34a";
  if (status === "reconnecting") return "#f59e0b";
  return "#dc2626";
}

function directionColor(direction: "up" | "down" | "flat"): string {
  if (direction === "up") return "#22c55e";
  if (direction === "down") return "#ef4444";
  return "#94a3b8";
}

function buildSparklinePath(points: number[], width = 80, height = 24): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M 0 ${height / 2}`;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / Math.max(points.length - 1, 1);

  return points
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

const panelStyle: React.CSSProperties = {
  border: "1px solid #30363d",
  borderRadius: 8,
  padding: 12,
  background: "#11161d"
};

interface Position {
  ticker: string;
  quantity: number;
  avgCost: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: string[];
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildMockAssistantReply(input: string, selectedTicker: string | null): ChatMessage {
  const lower = input.toLowerCase();
  const ticker = selectedTicker ?? "AAPL";

  if (lower.includes("buy")) {
    return {
      id: makeId(),
      role: "assistant",
      content: `I can stage a conservative buy in ${ticker} based on current momentum.`,
      actions: [`Proposed trade: buy 1 ${ticker}`]
    };
  }

  if (lower.includes("sell")) {
    return {
      id: makeId(),
      role: "assistant",
      content: `I can reduce exposure in ${ticker} to lock gains or limit downside.`,
      actions: [`Proposed trade: sell 1 ${ticker}`]
    };
  }

  return {
    id: makeId(),
    role: "assistant",
    content:
      "Portfolio snapshot: concentration appears manageable. Consider one small rebalancing trade and keep cash for volatility.",
    actions: [`Watchlist insight: monitor ${ticker} intraday trend`]
  };
}

export function AppShell(): JSX.Element {
  const [prices, setPrices] = useState<PriceSnapshot>({});
  const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({});
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [usingDemoFallback, setUsingDemoFallback] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [cash, setCash] = useState(10000);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [tradeQuantity, setTradeQuantity] = useState("1");
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [dataMode, setDataMode] = useState<"api" | "fallback">("fallback");

  useEffect(() => {
    let latestPrices: PriceSnapshot = {};
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let demoInterval: ReturnType<typeof setInterval> | null = null;

    const startDemoFallback = () => {
      if (demoInterval) return;
      setUsingDemoFallback(true);
      setStatus("connected");
      demoInterval = setInterval(() => {
        latestPrices = createMockPriceSnapshot(latestPrices);
        setPrices(latestPrices);
        setPriceHistory((previous) => {
          const nextHistory: Record<string, number[]> = {};
          for (const [ticker, update] of Object.entries(latestPrices)) {
            const existing = previous[ticker] ?? [];
            nextHistory[ticker] = [...existing, update.price].slice(-SPARKLINE_LIMIT);
          }
          return nextHistory;
        });
      }, 800);
    };

    const dispose = createPriceStream({
      onStatusChange: setStatus,
      onPriceData: (next) => {
        latestPrices = next;
        setStreamError(null);
        setUsingDemoFallback(false);
        setPrices(next);
        setPriceHistory((previous) => {
          const nextHistory: Record<string, number[]> = {};
          for (const [ticker, update] of Object.entries(next)) {
            const existing = previous[ticker] ?? [];
            nextHistory[ticker] = [...existing, update.price].slice(-SPARKLINE_LIMIT);
          }
          return nextHistory;
        });
      },
      onError: (error) => {
        setStreamError(error.message);
      }
    });

    fallbackTimer = setTimeout(() => {
      if (Object.keys(latestPrices).length === 0) {
        startDemoFallback();
      }
    }, 1800);

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (demoInterval) clearInterval(demoInterval);
      dispose();
    };
  }, []);

  useEffect(() => {
    const bootstrapApiData = async () => {
      const [portfolio, watchlist] = await Promise.all([getPortfolio(), getWatchlist()]);

      if (portfolio) {
        setDataMode("api");
        setCash(portfolio.cash_balance);
        setPositions(
          Object.fromEntries(
            portfolio.positions.map((position) => [
              position.ticker,
              {
                ticker: position.ticker,
                quantity: position.quantity,
                avgCost: position.avg_cost
              }
            ])
          )
        );
      }

      if (watchlist?.tickers?.length && !selectedTicker) {
        setSelectedTicker(watchlist.tickers[0]);
      }
    };

    void bootstrapApiData();
  }, [selectedTicker]);

  const tickers = useMemo(
    () => Object.values(prices).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [prices]
  );
  const selectedQuote = selectedTicker ? prices[selectedTicker] : null;
  const portfolioRows = useMemo(() => {
    return Object.values(positions)
      .map((position) => {
        const live = prices[position.ticker]?.price ?? position.avgCost;
        const marketValue = live * position.quantity;
        const costBasis = position.avgCost * position.quantity;
        const pnl = marketValue - costBasis;
        return {
          ...position,
          live,
          marketValue,
          pnl
        };
      })
      .sort((a, b) => b.marketValue - a.marketValue);
  }, [positions, prices]);

  const portfolioValue = useMemo(() => {
    const positionsValue = portfolioRows.reduce((sum, row) => sum + row.marketValue, 0);
    return cash + positionsValue;
  }, [cash, portfolioRows]);
  const totalPnl = useMemo(() => portfolioRows.reduce((sum, row) => sum + row.pnl, 0), [portfolioRows]);

  useEffect(() => {
    if (!selectedTicker && tickers.length > 0) {
      setSelectedTicker(tickers[0].ticker);
    }
  }, [selectedTicker, tickers]);

  const executeTrade = async (side: "buy" | "sell") => {
    if (!selectedTicker || !selectedQuote) {
      setTradeMessage("Select a ticker before trading.");
      return;
    }
    const quantity = Number(tradeQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTradeMessage("Enter a valid quantity greater than zero.");
      return;
    }

    if (side === "buy") {
      const cost = selectedQuote.price * quantity;
      if (cost > cash) {
        setTradeMessage("Insufficient cash for this buy.");
        return;
      }
      const apiResult = await postTrade({
        ticker: selectedTicker,
        quantity,
        side
      });
      if (apiResult) {
        setDataMode("api");
        setCash(apiResult.cash_balance);
        setPositions(
          Object.fromEntries(
            apiResult.positions.map((position) => [
              position.ticker,
              {
                ticker: position.ticker,
                quantity: position.quantity,
                avgCost: position.avg_cost
              }
            ])
          )
        );
        setTradeMessage(apiResult.message ?? `Bought ${quantity} ${selectedTicker} via API`);
        return;
      }

      setCash((previous) => previous - cost);
      setPositions((previous) => {
        const existing = previous[selectedTicker];
        if (!existing) {
          return {
            ...previous,
            [selectedTicker]: {
              ticker: selectedTicker,
              quantity,
              avgCost: selectedQuote.price
            }
          };
        }
        const nextQty = existing.quantity + quantity;
        const nextAvg = (existing.avgCost * existing.quantity + selectedQuote.price * quantity) / nextQty;
        return {
          ...previous,
          [selectedTicker]: {
            ...existing,
            quantity: nextQty,
            avgCost: nextAvg
          }
        };
      });
      setDataMode("fallback");
      setTradeMessage(`Bought ${quantity} ${selectedTicker} at $${selectedQuote.price.toFixed(2)} (local fallback)`);
      return;
    }

    const owned = positions[selectedTicker]?.quantity ?? 0;
    if (quantity > owned) {
      setTradeMessage(`Cannot sell ${quantity}; only ${owned.toFixed(2)} owned.`);
      return;
    }

    const apiResult = await postTrade({
      ticker: selectedTicker,
      quantity,
      side
    });
    if (apiResult) {
      setDataMode("api");
      setCash(apiResult.cash_balance);
      setPositions(
        Object.fromEntries(
          apiResult.positions.map((position) => [
            position.ticker,
            {
              ticker: position.ticker,
              quantity: position.quantity,
              avgCost: position.avg_cost
            }
          ])
        )
      );
      setTradeMessage(apiResult.message ?? `Sold ${quantity} ${selectedTicker} via API`);
      return;
    }

    const proceeds = selectedQuote.price * quantity;
    setCash((previous) => previous + proceeds);
    setPositions((previous) => {
      const existing = previous[selectedTicker];
      if (!existing) return previous;
      const nextQty = existing.quantity - quantity;
      if (nextQty <= 0) {
        const { [selectedTicker]: _removed, ...rest } = previous;
        return rest;
      }
      return {
        ...previous,
        [selectedTicker]: {
          ...existing,
          quantity: nextQty
        }
      };
    });
    setDataMode("fallback");
    setTradeMessage(`Sold ${quantity} ${selectedTicker} at $${selectedQuote.price.toFixed(2)} (local fallback)`);
  };

  const submitChat = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      content: message
    };
    setChatMessages((previous) => [...previous, userMessage]);
    setChatInput("");
    setChatLoading(true);

    const apiReply = await postChat(message);
    if (apiReply) {
      setDataMode("api");
      const assistant: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: apiReply.message,
        actions: [
          ...(apiReply.trades?.map((trade) => `${trade.side.toUpperCase()} ${trade.quantity} ${trade.ticker}`) ?? []),
          ...(apiReply.watchlist_changes?.map(
            (change) => `Watchlist ${change.action}: ${change.ticker}`
          ) ?? [])
        ]
      };
      setChatMessages((previous) => [...previous, assistant]);
      setChatLoading(false);
      return;
    }

    setDataMode("fallback");
    setTimeout(() => {
      const assistant = buildMockAssistantReply(message, selectedTicker);
      setChatMessages((previous) => [...previous, assistant]);
      setChatLoading(false);
    }, 700);
  };

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
      <section style={{ ...panelStyle, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>Portfolio Value</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>${portfolioValue.toFixed(2)}</p>
          </div>
          <div>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>Cash</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>${cash.toFixed(2)}</p>
          </div>
          <div>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>Unrealized P&L</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
            </p>
          </div>
        </div>
        <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 12 }}>
          Data mode: {dataMode === "api" ? "API-connected" : "Fallback-local"}
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 12
        }}
      >
        <div style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Watchlist</h2>
          {tickers.length === 0 ? (
            <p>No price data yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {tickers.map((row) => {
                const isSelected = row.ticker === selectedTicker;
                return (
                  <li key={row.ticker} style={{ padding: "4px 0" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedTicker(row.ticker)}
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        border: "1px solid #30363d",
                        borderRadius: 6,
                        background: isSelected ? "#161b22" : "transparent",
                        color: "#e6edf3",
                        padding: "8px 10px",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                        <strong>{row.ticker}</strong>
                        <span style={{ color: directionColor(row.direction), fontSize: 12 }}>
                          {row.change >= 0 ? "+" : ""}
                          {row.change.toFixed(2)} ({row.change_percent.toFixed(2)}%)
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <svg
                          aria-label={`sparkline-${row.ticker}`}
                          width="80"
                          height="24"
                          viewBox="0 0 80 24"
                          role="img"
                        >
                          <path
                            d={buildSparklinePath(priceHistory[row.ticker] ?? [])}
                            fill="none"
                            stroke={directionColor(row.direction)}
                            strokeWidth="1.5"
                          />
                        </svg>
                        <span>${row.price.toFixed(2)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Selected Ticker</h2>
          {selectedQuote ? (
            <div>
              <p style={{ margin: "0 0 8px" }}>
                <strong>{selectedQuote.ticker}</strong>
              </p>
              <p style={{ margin: "0 0 6px" }}>Price: ${selectedQuote.price.toFixed(2)}</p>
              <p style={{ margin: 0 }}>
                Change: {selectedQuote.change >= 0 ? "+" : ""}
                {selectedQuote.change.toFixed(2)} ({selectedQuote.change_percent.toFixed(2)}%)
              </p>
            </div>
          ) : (
            <p>No ticker selected.</p>
          )}
        </aside>
      </section>

      <section style={{ marginTop: 12, ...panelStyle }}>
        <h2 style={{ marginTop: 0 }}>AI Chat Panel</h2>
        <div
          style={{
            border: "1px solid #21262d",
            borderRadius: 6,
            padding: 10,
            minHeight: 120,
            maxHeight: 220,
            overflowY: "auto",
            marginBottom: 10
          }}
        >
          {chatMessages.length === 0 ? (
            <p style={{ margin: 0, color: "#94a3b8" }}>No messages yet. Ask FinAlly for a trade idea.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {chatMessages.map((message) => (
                <li
                  key={message.id}
                  style={{
                    border: "1px solid #30363d",
                    borderRadius: 6,
                    padding: 8,
                    background: message.role === "assistant" ? "#161b22" : "transparent"
                  }}
                >
                  <p style={{ margin: "0 0 4px" }}>
                    <strong>{message.role === "assistant" ? "FinAlly" : "You"}:</strong> {message.content}
                  </p>
                  {message.actions?.length ? (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {message.actions.map((action) => (
                        <li key={action} style={{ color: "#94a3b8", fontSize: 13 }}>
                          {action}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            aria-label="chat-input"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitChat();
              }
            }}
            placeholder="Ask for analysis or a trade suggestion..."
            style={{
              flex: 1,
              background: "#0d1117",
              border: "1px solid #30363d",
              color: "#e6edf3",
              borderRadius: 6,
              padding: "8px 10px"
            }}
          />
          <button
            type="button"
            onClick={submitChat}
            disabled={chatLoading}
            style={{
              background: "#753991",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "8px 12px",
              cursor: chatLoading ? "not-allowed" : "pointer",
              opacity: chatLoading ? 0.7 : 1
            }}
          >
            {chatLoading ? "Thinking..." : "Send"}
          </button>
        </div>
      </section>

      <section
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 12
        }}
      >
        <div style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Portfolio</h2>
          <div style={{ display: "flex", gap: 20, marginBottom: 10 }} />
          {portfolioRows.length === 0 ? (
            <p>No open positions.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #30363d" }}>
                  <th>Ticker</th>
                  <th>Qty</th>
                  <th>Avg</th>
                  <th>Live</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {portfolioRows.map((row) => (
                  <tr key={row.ticker} style={{ borderBottom: "1px solid #21262d" }}>
                    <td>{row.ticker}</td>
                    <td>{row.quantity.toFixed(2)}</td>
                    <td>${row.avgCost.toFixed(2)}</td>
                    <td>${row.live.toFixed(2)}</td>
                    <td style={{ color: row.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                      {row.pnl >= 0 ? "+" : ""}${row.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Trade Bar</h2>
          <p style={{ margin: "0 0 8px" }}>
            Active ticker: <strong>{selectedTicker ?? "N/A"}</strong>
          </p>
          <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>Quantity</label>
          <input
            aria-label="trade-quantity"
            value={tradeQuantity}
            onChange={(event) => setTradeQuantity(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                executeTrade("buy");
              }
            }}
            style={{
              width: "100%",
              background: "#0d1117",
              border: "1px solid #30363d",
              color: "#e6edf3",
              borderRadius: 6,
              padding: "8px 10px",
              marginBottom: 8
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => executeTrade("buy")}
              style={{
                flex: 1,
                background: "#1f6feb",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "8px 10px",
                cursor: "pointer"
              }}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => executeTrade("sell")}
              style={{
                flex: 1,
                background: "#753991",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "8px 10px",
                cursor: "pointer"
              }}
            >
              Sell
            </button>
          </div>
          {tradeMessage ? <p style={{ marginTop: 10 }}>{tradeMessage}</p> : null}
        </aside>
      </section>

      {streamError ? <p role="alert">Stream error: {streamError}</p> : null}
      {usingDemoFallback ? (
        <p style={{ marginTop: 12, color: "#94a3b8" }}>
          Demo mode active: showing simulated frontend price stream.
        </p>
      ) : null}
    </main>
  );
}
