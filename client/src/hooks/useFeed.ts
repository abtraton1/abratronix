import { useState, useEffect, useMemo } from "react";
import type { FeedData, FeedItem, SourceType } from "@/lib/types";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const FEED_URL = `${BASE}/data/feed.json`;
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useFeed() {
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = (isBackground = false) => {
    if (!isBackground) setLoading(true);
    // Cache-bust with a timestamp so the browser always gets the latest file
    const url = `${FEED_URL}?t=${Date.now()}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: FeedData) => {
        setData(d);
        if (!isBackground) setLoading(false);
      })
      .catch((e: Error) => {
        if (!isBackground) {
          setError(e.message);
          setLoading(false);
        }
        // Silently ignore background refresh errors
      });
  };

  useEffect(() => {
    // Initial load
    fetchFeed(false);

    // Poll every 5 minutes for fresh content
    const timer = setInterval(() => {
      fetchFeed(true);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return { data, loading, error, refresh: () => fetchFeed(false) };
}

export function useFilteredFeed(
  data: FeedData | null,
  activeSource: SourceType | "all",
  searchQuery: string,
  page: number,
  pageSize: number
) {
  return useMemo(() => {
    if (!data) return { paginated: [], hasMore: false, total: 0 };

    let items = data.items;

    if (activeSource !== "all") {
      items = items.filter((i) => i.source === activeSource);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.author.toLowerCase().includes(q)
      );
    }

    // Sort newest first
    items = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const total = items.length;
    const paginated = items.slice(0, page * pageSize);
    const hasMore = paginated.length < total;

    return { paginated, hasMore, total };
  }, [data, activeSource, searchQuery, page, pageSize]);
}

export function formatRelativeTime(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function getTractionLabel(score: number, stats: { p90_score: number; p75_score: number } | undefined): {
  label: string;
  className: string;
} {
  if (!stats) return { label: "", className: "" };
  if (score >= stats.p90_score) return { label: "🔥 Hot", className: "traction-hot" };
  if (score >= stats.p75_score) return { label: "↑ Rising", className: "traction-rising" };
  return { label: "", className: "" };
}
