"use client";

import { useState, useEffect, useCallback } from "react";
import { AppNav } from "@/components/nav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  LoaderIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ActivityIcon,
  DollarSignIcon,
  BarChart3Icon,
  BrainIcon,
} from "lucide-react";
import type { Market, TradingSignal, PortfolioState } from "@/lib/polymarket/types";
import type { Model } from "@/lib/games/types";

const models: Model[] = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
];

// --- Market Card ---

function MarketCard({
  market,
  onAnalyze,
  onTrade,
  analysis,
  analyzing,
}: {
  market: Market;
  onAnalyze: () => void;
  onTrade: (signal: TradingSignal) => void;
  analysis: TradingSignal | null;
  analyzing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const yesPrice = market.outcomePrices[0];
  const noPrice = market.outcomePrices[1];

  return (
    <div className="rounded-xl border border-border/50 bg-card">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium leading-snug">
            {market.question}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUpIcon size={12} />
              Yes {(yesPrice * 100).toFixed(1)}%
            </span>
            <span className="flex items-center gap-1">
              <TrendingDownIcon size={12} />
              No {(noPrice * 100).toFixed(1)}%
            </span>
            <span className="flex items-center gap-1">
              <BarChart3Icon size={12} />
              ${(market.volume / 1000).toFixed(0)}k vol
            </span>
          </div>
          {market.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {market.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {analysis && analysis.recommendation !== "hold" && (
            <button
              onClick={() => onTrade(analysis)}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
            >
              Trade
            </button>
          )}
          <button
            onClick={onAnalyze}
            disabled={analyzing}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {analyzing ? (
              <LoaderIcon size={14} className="animate-spin" />
            ) : (
              "Analyze"
            )}
          </button>
        </div>
      </div>

      {analysis && (
        <div className="border-t border-border/50">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left"
          >
            <BrainIcon size={14} className="text-muted-foreground" />
            <span className="text-xs font-medium">AI Analysis</span>
            <Badge
              variant={
                analysis.recommendation === "hold"
                  ? "secondary"
                  : analysis.edge > 0.1
                    ? "default"
                    : "outline"
              }
              className="ml-1 text-[10px]"
            >
              {analysis.recommendation === "hold"
                ? "Hold"
                : `Buy ${analysis.outcome}`}
            </Badge>
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Fair: {(analysis.fairValue * 100).toFixed(1)}% | Edge:{" "}
                {(analysis.edge * 100).toFixed(1)}% | Conf:{" "}
                {(analysis.confidence * 100).toFixed(0)}%
              </span>
              <ChevronDownIcon
                size={14}
                className={`transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          {expanded && (
            <div className="border-t border-border/30 px-4 py-3">
              <MessageResponse className="text-sm">
                {analysis.reasoning}
              </MessageResponse>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Portfolio Tab ---

function PortfolioTab({ portfolio }: { portfolio: PortfolioState }) {
  const totalUnrealized = portfolio.positions.reduce(
    (sum, p) => sum + p.unrealizedPnL,
    0,
  );
  const totalInvested = portfolio.positions.reduce(
    (sum, p) => sum + p.entryPrice * p.size,
    0,
  );
  const totalValue = portfolio.cashBalance + totalInvested + totalUnrealized;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Cash",
            value: `$${portfolio.cashBalance.toFixed(2)}`,
            icon: DollarSignIcon,
          },
          {
            label: "Invested",
            value: `$${totalInvested.toFixed(2)}`,
            icon: ActivityIcon,
          },
          {
            label: "Unrealized P&L",
            value: `${totalUnrealized >= 0 ? "+" : ""}$${totalUnrealized.toFixed(2)}`,
            icon: totalUnrealized >= 0 ? TrendingUpIcon : TrendingDownIcon,
            color: totalUnrealized >= 0 ? "text-green-500" : "text-red-400",
          },
          {
            label: "Total Value",
            value: `$${totalValue.toFixed(2)}`,
            icon: BarChart3Icon,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/50 bg-card p-3"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <stat.icon size={12} />
              {stat.label}
            </div>
            <div
              className={`mt-1 text-lg font-semibold ${stat.color ?? ""}`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {portfolio.positions.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
          No open positions. Analyze markets and trade to get started.
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Open Positions</h3>
          {portfolio.positions.map((pos) => {
            const pnl = pos.unrealizedPnL;
            return (
              <div
                key={`${pos.marketId}-${pos.outcome}`}
                className="rounded-xl border border-border/50 bg-card p-3"
              >
                <div className="text-sm font-medium">
                  {pos.question.slice(0, 70)}
                  {pos.question.length > 70 ? "..." : ""}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">
                    {pos.outcome}
                  </Badge>
                  <span>Entry: ${pos.entryPrice.toFixed(3)}</span>
                  <span>Now: ${pos.currentPrice.toFixed(3)}</span>
                  <span>Size: {pos.size}</span>
                  <span
                    className={pnl >= 0 ? "text-green-500" : "text-red-400"}
                  >
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- History Tab ---

function HistoryTab({ portfolio }: { portfolio: PortfolioState }) {
  const trades = [...portfolio.trades].reverse();

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
        No trades yet. Paper trades will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {trades.map((trade) => (
        <TradeCard key={trade.id} trade={trade} />
      ))}
    </div>
  );
}

function TradeCard({ trade }: { trade: PortfolioState["trades"][number] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border/50 bg-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 p-3 text-left"
      >
        <Badge
          variant={trade.side === "buy" ? "default" : "destructive"}
          className="text-[10px] shrink-0"
        >
          {trade.side.toUpperCase()}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {trade.question}
          </div>
          <div className="text-xs text-muted-foreground">
            {trade.outcome} @ ${trade.price.toFixed(3)} x {trade.size} shares
            <span className="ml-2">
              {new Date(trade.timestamp).toLocaleDateString()}{" "}
              {new Date(trade.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
        <ChevronDownIcon
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-border/30 p-3">
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Fair value: {(trade.signal.fairValue * 100).toFixed(1)}%</span>
            <span>Edge: {(trade.signal.edge * 100).toFixed(1)}%</span>
            <span>Confidence: {(trade.signal.confidence * 100).toFixed(0)}%</span>
          </div>
          <MessageResponse className="text-sm">
            {trade.signal.reasoning}
          </MessageResponse>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioState>({
    positions: [],
    trades: [],
    cashBalance: 1000,
  });
  const [analyses, setAnalyses] = useState<Record<string, TradingSignal>>({});
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [selectedModel, setSelectedModel] = useState(models[0].id);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/markets/scan");
      const data = await res.json();
      setMarkets(data);
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      setScanning(false);
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch("/api/markets/portfolio");
      const data = await res.json();
      setPortfolio(data);
    } catch (err) {
      console.error("Portfolio fetch failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    fetchPortfolio();
  }, [fetchMarkets, fetchPortfolio]);

  const handleAnalyze = async (market: Market) => {
    setAnalyzingIds((prev) => new Set(prev).add(market.id));
    try {
      const res = await fetch("/api/markets/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, model: selectedModel }),
      });
      const signal = await res.json();
      if (signal.error) {
        console.error("Analysis failed:", signal.error);
      } else {
        setAnalyses((prev) => ({ ...prev, [market.id]: signal }));
      }
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(market.id);
        return next;
      });
    }
  };

  const handleTrade = async (signal: TradingSignal) => {
    setTradeError(null);
    try {
      const res = await fetch("/api/markets/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal }),
      });
      const result = await res.json();
      if (result.portfolio) {
        setPortfolio(result.portfolio);
      }
      if (!result.traded) {
        setTradeError(`Trade rejected: ${result.reason}`);
      }
    } catch (err) {
      console.error("Trade failed:", err);
      setTradeError("Trade failed. Check console for details.");
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <AppNav active="markets" />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Polymarket Trading</h1>
            <Badge variant="secondary" className="text-xs">
              Paper Trading
            </Badge>
          </div>

          {tradeError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {tradeError}
              <button
                type="button"
                onClick={() => setTradeError(null)}
                className="ml-2 text-red-300 underline hover:text-red-200"
              >
                Dismiss
              </button>
            </div>
          )}

          <Tabs defaultValue="markets">
            <TabsList>
              <TabsTrigger value="markets">
                Markets ({markets.length})
              </TabsTrigger>
              <TabsTrigger value="portfolio">
                Portfolio ({portfolio.positions.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                History ({portfolio.trades.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="markets" className="mt-4">
              <div className="mb-4 flex items-center gap-3">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="rounded-lg border border-border/50 bg-card px-3 py-1.5 text-xs"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={fetchMarkets}
                  disabled={scanning}
                  className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RefreshCwIcon
                    size={12}
                    className={scanning ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
              </div>

              {scanning && markets.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <LoaderIcon size={24} className="animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {markets.map((market) => (
                    <MarketCard
                      key={market.id}
                      market={market}
                      analysis={analyses[market.id] ?? null}
                      analyzing={analyzingIds.has(market.id)}
                      onAnalyze={() => handleAnalyze(market)}
                      onTrade={handleTrade}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="portfolio" className="mt-4">
              <div className="mb-4 flex justify-end">
                <button
                  onClick={fetchPortfolio}
                  className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCwIcon size={12} />
                  Refresh Prices
                </button>
              </div>
              <PortfolioTab portfolio={portfolio} />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <HistoryTab portfolio={portfolio} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
