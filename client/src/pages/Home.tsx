/*
 * Home — Main page for Abratronix
 * Design: Editorial Modernism (same as Claw News Hub)
 * - Warm off-white background (#F8F6F1) with deep charcoal text
 * - Source-coded color system: HN=orange, Reddit=red, GitHub=emerald, YouTube=rose, News=indigo
 * - Traction score drives sort order; top 10% get "Hot" badge, top 25% get "Rising"
 * - Layout: sticky header + hero + two-column (70/30) feed + sidebar
 */

import { useState, useCallback } from "react";
import { Search, RefreshCw, ExternalLink, Rss, ChevronDown, TrendingUp, Flame } from "lucide-react";
import { useFeed, useFilteredFeed, formatRelativeTime, formatNumber } from "@/hooks/useFeed";
import { FeedCard } from "@/components/FeedCard";
import { SourceIcon } from "@/components/SourceIcon";
import type { SourceType } from "@/lib/types";
import { SOURCE_CONFIG } from "@/lib/types";

const SOURCE_FILTERS: { value: SourceType | "all"; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "hackernews", label: "Hacker News" },
  { value: "reddit", label: "Reddit" },
  { value: "github", label: "GitHub" },
  { value: "youtube", label: "YouTube" },
  { value: "news", label: "News" },
];

export default function Home() {
  const { data, loading, error } = useFeed();
  const [activeSource, setActiveSource] = useState<SourceType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const { paginated, hasMore, total } = useFilteredFeed(data, activeSource, searchQuery, page, 20);

  const handleSourceChange = useCallback((source: SourceType | "all") => {
    setActiveSource(source);
    setPage(1);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setPage(1);
  }, []);

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  // Top 5 hottest items for the "Hot Right Now" sidebar widget
  const hotItems = data?.items.slice(0, 5) ?? [];

  return (
    <div className="min-h-screen bg-background paper-texture">

      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container">
          <div className="flex items-center h-14 gap-4">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2.5 shrink-0 no-underline group">
              <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center">
                <span className="text-background text-sm font-bold">⚡</span>
              </div>
              <div>
                <span className="font-editorial font-bold text-foreground text-base leading-none block">
                  Abratronix
                </span>
                <span className="text-xs text-muted-foreground leading-none font-mono-data tracking-wider uppercase">
                  Tech Trending
                </span>
              </div>
            </a>

            <div className="h-6 w-px bg-border hidden sm:block" />

            {/* Live indicator */}
            {data && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="live-dot w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Updated {formatRelativeTime(data.generated_at)}
              </div>
            )}

            <div className="flex-1" />

            {/* Source count badges */}
            {data && (
              <div className="hidden md:flex items-center gap-2">
                {(Object.entries(data.sources) as [SourceType, number][])
                  .filter(([, count]) => count > 0)
                  .map(([source, count]) => (
                    <span
                      key={source}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono-data source-badge-${source}`}
                    >
                      <SourceIcon source={source} size={10} />
                      {count}
                    </span>
                  ))}
              </div>
            )}

            {/* Links */}
            <div className="flex items-center gap-1">
              <a
                href="/data/feed.json"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Raw JSON feed"
              >
                <Rss size={16} />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ── News Ticker ── */}
      {data && data.items.length > 0 && (
        <div className="bg-foreground text-background py-1.5 overflow-hidden">
          <div className="flex items-center">
            <span className="shrink-0 bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold font-mono-data uppercase tracking-wider z-10">
              Trending
            </span>
            <div className="overflow-hidden flex-1">
              <div className="ticker-content flex gap-8 whitespace-nowrap">
                {[...data.items.slice(0, 12), ...data.items.slice(0, 12)].map((item, idx) => (
                  <a
                    key={`${item.id}-${idx}`}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs text-background/80 hover:text-background no-underline transition-colors"
                  >
                    <SourceIcon source={item.source} size={10} className="opacity-60" />
                    <span className="truncate max-w-xs">{item.title}</span>
                    <span className="text-background/40 font-mono-data">·</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero Banner ── */}
      <div className="relative bg-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 41px)"
          }} />
        </div>
        <div className="container relative py-8 md:py-10">
          <div className="max-w-xl">
            <p className="text-white/50 text-xs font-mono-data uppercase tracking-widest mb-1">
              What's trending in tech
            </p>
            <h1 className="font-editorial text-white text-3xl md:text-4xl font-bold leading-tight mb-1">
              Abratronix
            </h1>
            <h2 className="font-editorial italic text-white/70 text-lg md:text-xl font-normal leading-tight mb-2">
              Broad Tech Trending — Ranked by Traction
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-md">
              The most talked-about tech stories right now, aggregated from Hacker News, Reddit,
              GitHub Trending, YouTube, and major tech publications — ranked by a multi-signal
              traction score combining upvotes, comments, views, and recency.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="container py-6">
        <div className="flex gap-6 items-start">

          {/* ── Left: Feed ── */}
          <div className="flex-1 min-w-0">

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {/* Source tabs */}
              <div className="flex flex-wrap items-center gap-1 bg-muted rounded-sm p-0.5">
                {SOURCE_FILTERS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleSourceChange(value)}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-all
                      ${activeSource === value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      }
                    `}
                  >
                    {value !== "all" && <SourceIcon source={value as SourceType} size={11} />}
                    {label}
                    {data && value !== "all" && (
                      <span className="font-mono-data text-muted-foreground text-xs">
                        ({data.sources[value as SourceType] ?? 0})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-card border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Sort indicator */}
            {data && !searchQuery && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono-data mb-3">
                <TrendingUp size={12} />
                <span>
                  {searchQuery || activeSource !== "all"
                    ? `${total} results`
                    : `${data.total_items} items · sorted by traction score`}
                </span>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <RefreshCw size={16} className="animate-spin" />
                <span className="text-sm">Loading feed...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4 text-sm text-destructive">
                Failed to load feed: {error}. Make sure to run the fetcher script first.
              </div>
            )}

            {/* Feed items */}
            {!loading && !error && (
              <div className="space-y-2">
                {paginated.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No items found. Try adjusting your filters.
                  </div>
                ) : (
                  paginated.map((item) => (
                    <FeedCard key={item.id} item={item} stats={data?.traction_stats} />
                  ))
                )}
              </div>
            )}

            {/* Load more */}
            {hasMore && !loading && (
              <div className="mt-4 text-center">
                <button
                  onClick={loadMore}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-sm hover:bg-muted transition-colors"
                >
                  <ChevronDown size={14} />
                  Load more ({total - paginated.length} remaining)
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Sidebar ── */}
          <aside className="hidden lg:block w-72 shrink-0 space-y-4">

            {/* Hot Right Now */}
            {hotItems.length > 0 && (
              <div className="bg-card border border-border rounded-sm overflow-hidden">
                <div className="px-4 pt-3 pb-2 border-b border-border flex items-center gap-2">
                  <Flame size={14} className="text-orange-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground font-mono-data">
                    Hot Right Now
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {hotItems.map((item, idx) => {
                    const config = SOURCE_CONFIG[item.source];
                    return (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors no-underline group"
                      >
                        <span className="text-xl font-editorial font-bold text-muted-foreground/30 leading-none mt-0.5 w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-1">
                            {item.title}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <SourceIcon source={item.source} size={10} className={config.color} />
                            <span className={`text-xs font-mono-data ${config.color}`}>{config.label}</span>
                            <span className="text-xs text-muted-foreground font-mono-data">
                              · {Math.round(item.traction_score)}pts
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Traction Score Explained */}
            {data?.traction_stats && (
              <div className="bg-card border border-border rounded-sm p-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 font-mono-data flex items-center gap-1.5">
                  <TrendingUp size={12} />
                  Traction Score
                </h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Top score today</span>
                    <span className="font-mono-data text-foreground">{Math.round(data.traction_stats.max_score)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="traction-hot">🔥 Hot threshold (top 10%)</span>
                    <span className="font-mono-data text-foreground">{Math.round(data.traction_stats.p90_score)}+</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="traction-rising">↑ Rising threshold (top 25%)</span>
                    <span className="font-mono-data text-foreground">{Math.round(data.traction_stats.p75_score)}+</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 leading-relaxed pt-1 border-t border-border">
                    Score = engagement (40%) + comments (20%) + recency (25%) + source weight (15%)
                  </p>
                </div>
              </div>
            )}

            {/* Source Legend */}
            <div className="bg-card border border-border rounded-sm p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 font-mono-data">
                Sources
              </h3>
              <div className="space-y-1.5">
                {(Object.entries(SOURCE_CONFIG) as [SourceType, typeof SOURCE_CONFIG[SourceType]][]).map(([source, config]) => (
                  <button
                    key={source}
                    onClick={() => handleSourceChange(source)}
                    className={`
                      w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left transition-colors
                      ${activeSource === source ? config.bgColor : "hover:bg-muted"}
                    `}
                  >
                    <SourceIcon source={source} size={13} className={config.color} />
                    <span className={`text-xs font-medium ${activeSource === source ? config.color : "text-foreground"}`}>
                      {config.label}
                    </span>
                    {data && (
                      <span className="ml-auto text-xs text-muted-foreground font-mono-data">
                        {data.sources[source] ?? 0}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* About */}
            <div className="bg-muted/50 border border-border rounded-sm p-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 font-mono-data">
                About
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Abratronix aggregates the most-discussed tech stories from Hacker News, Reddit,
                GitHub Trending, YouTube, and major tech publications. Items are ranked by a
                multi-signal traction score — not just recency.
              </p>
              <a
                href="/data/feed.json"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
              >
                <Rss size={10} />
                Raw JSON feed
              </a>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card mt-8">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-editorial font-bold text-foreground">⚡ Abratronix</span>
              <span className="text-xs text-muted-foreground">— Broad Tech Trending</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="font-mono-data">
                {data ? `${data.total_items} items · Updated ${formatRelativeTime(data.generated_at)}` : "Loading..."}
              </span>
              <a href="/data/feed.json" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                JSON Feed
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
