/*
 * FeedCard — Abratronix individual item card
 * - Left-border accent by source
 * - Traction score badge (Hot / Rising) for top items
 * - YouTube cards show thumbnail + duration + view count
 */

import { ExternalLink, MessageSquare, Star, ThumbsUp, Play, Eye, GitFork } from "lucide-react";
import type { FeedItem, TractionStats } from "@/lib/types";
import { SOURCE_CONFIG } from "@/lib/types";
import { SourceIcon } from "./SourceIcon";
import { formatRelativeTime, formatNumber, getTractionLabel } from "@/hooks/useFeed";
import { decodeHtml } from "@/lib/utils";

interface FeedCardProps {
  item: FeedItem;
  stats?: TractionStats;
  compact?: boolean;
}

export function FeedCard({ item, stats, compact = false }: FeedCardProps) {
  const config = SOURCE_CONFIG[item.source];
  const meta = item.meta as Record<string, unknown>;
  const traction = getTractionLabel(item.traction_score, stats);

  const isVideo = item.source === "youtube" && item.type === "video";
  const thumbnail = isVideo ? (meta.thumbnail as string) : null;
  const duration = isVideo ? (meta.duration as string) : null;
  const viewCount = isVideo && typeof meta.view_count === "number" ? (meta.view_count as number) : null;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        feed-item block bg-card rounded-sm border-l-4 ${config.borderColor}
        group no-underline hover:shadow-sm transition-all duration-150
        ${isVideo ? "overflow-hidden" : "px-4 py-3.5"}
      `}
    >
      {isVideo && thumbnail ? (
        /* ── YouTube video card ── */
        <div className="flex">
          <div className="relative shrink-0 w-36 sm:w-44">
            <img
              src={thumbnail}
              alt={item.title}
              className="w-full h-full object-cover"
              style={{ aspectRatio: "16/9" }}
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
                <Play size={14} className="text-white ml-0.5" fill="white" />
              </div>
            </div>
            {duration && (
              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs font-mono-data px-1 py-0.5 rounded leading-none">
                {duration}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium font-mono-data source-badge-youtube`}>
                <SourceIcon source="youtube" size={11} />
                YouTube
              </span>
              {traction.label && (
                <span className={`text-xs font-semibold font-mono-data ${traction.className}`}>
                  {traction.label}
                </span>
              )}
              <span className="flex-1" />
              <span className="text-xs text-muted-foreground font-mono-data shrink-0">
                {formatRelativeTime(item.date)}
              </span>
              <ExternalLink size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            <h3 className="text-sm font-medium text-foreground leading-snug mb-1 group-hover:text-primary transition-colors line-clamp-2">
              {item.title}
            </h3>
            <div className="flex items-center gap-2 mt-auto">
              {item.author && <span className="text-xs text-muted-foreground truncate">{item.author}</span>}
              {viewCount !== null && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-mono-data shrink-0">
                  <Eye size={10} />
                  <span>{formatNumber(viewCount)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── Standard text card ── */
        <>
          {/* Header */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium font-mono-data source-badge-${item.source}`}>
              <SourceIcon source={item.source} size={11} />
              {config.label}
            </span>

            {/* Traction badge */}
            {traction.label && (
              <span className={`text-xs font-semibold font-mono-data ${traction.className}`}>
                {traction.label}
              </span>
            )}

            {/* Subreddit */}
            {item.source === "reddit" && meta.subreddit ? (
              <span className="text-xs text-muted-foreground">r/{String(meta.subreddit)}</span>
            ) : null}

            {/* GitHub language */}
            {item.source === "github" && meta.language ? (
              <span className="text-xs text-muted-foreground font-mono-data">{String(meta.language)}</span>
            ) : null}

            {/* HN story type */}
            {item.source === "hackernews" && meta.story_type && meta.story_type !== "story" ? (
              <span className="text-xs text-muted-foreground font-mono-data capitalize">{String(meta.story_type)}</span>
            ) : null}

            <span className="flex-1" />
            <span className="text-xs text-muted-foreground font-mono-data shrink-0">
              {formatRelativeTime(item.date)}
            </span>
            <ExternalLink size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
            {item.title}
          </h3>

          {/* Summary */}
          {!compact && item.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
              {decodeHtml(item.summary)}
            </p>
          )}

          {/* Footer metadata */}
          <div className="flex items-center gap-3 mt-1">
            {item.author && (
              <span className="text-xs text-muted-foreground">
                {item.source === "reddit" ? `u/${item.author}` : item.author}
              </span>
            )}

            {/* HN points */}
            {item.source === "hackernews" && typeof meta.points === "number" ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-mono-data">
                <Star size={10} />
                <span>{formatNumber(meta.points as number)}</span>
              </span>
            ) : null}

            {/* HN comments */}
            {item.source === "hackernews" && typeof meta.num_comments === "number" ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-mono-data">
                <MessageSquare size={10} />
                <span>{formatNumber(meta.num_comments as number)}</span>
              </span>
            ) : null}

            {/* Reddit score */}
            {item.source === "reddit" && typeof meta.score === "number" ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-mono-data">
                <ThumbsUp size={10} />
                <span>{formatNumber(meta.score as number)}</span>
              </span>
            ) : null}

            {/* Reddit comments */}
            {item.source === "reddit" && typeof meta.num_comments === "number" ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-mono-data">
                <MessageSquare size={10} />
                <span>{formatNumber(meta.num_comments as number)}</span>
              </span>
            ) : null}

            {/* GitHub stars */}
            {item.source === "github" && typeof meta.stars === "number" ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-mono-data">
                <Star size={10} />
                <span>{formatNumber(meta.stars as number)}</span>
              </span>
            ) : null}

            {/* GitHub forks */}
            {item.source === "github" && typeof meta.forks === "number" ? (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-mono-data">
                <GitFork size={10} />
                <span>{formatNumber(meta.forks as number)}</span>
              </span>
            ) : null}

            {/* GitHub topics */}
            {item.source === "github" && Array.isArray(meta.topics) && (meta.topics as string[]).length > 0 && (
              <div className="flex gap-1">
                {(meta.topics as string[]).slice(0, 2).map((t) => (
                  <span key={t} className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono-data">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </a>
  );
}
