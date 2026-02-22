// Abratronix — Feed Data Types

export type SourceType = "hackernews" | "reddit" | "github" | "youtube" | "news";

export interface FeedItem {
  id: string;
  source: SourceType;
  type: string;
  title: string;
  summary: string;
  url: string;
  author: string;
  date: string;
  traction_score: number;
  meta: Record<string, unknown>;
}

export interface TractionStats {
  max_score: number;
  p90_score: number;
  p75_score: number;
}

export interface FeedData {
  generated_at: string;
  total_items: number;
  sources: Partial<Record<SourceType, number>>;
  traction_stats: TractionStats;
  items: FeedItem[];
}

export const SOURCE_CONFIG: Record<SourceType, {
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
}> = {
  hackernews: {
    label: "Hacker News",
    color: "text-orange-600",
    borderColor: "border-l-orange-500",
    bgColor: "bg-orange-50",
  },
  reddit: {
    label: "Reddit",
    color: "text-red-500",
    borderColor: "border-l-red-400",
    bgColor: "bg-red-50",
  },
  github: {
    label: "GitHub",
    color: "text-emerald-600",
    borderColor: "border-l-emerald-500",
    bgColor: "bg-emerald-50",
  },
  youtube: {
    label: "YouTube",
    color: "text-rose-600",
    borderColor: "border-l-rose-500",
    bgColor: "bg-rose-50",
  },
  news: {
    label: "News",
    color: "text-indigo-600",
    borderColor: "border-l-indigo-500",
    bgColor: "bg-indigo-50",
  },
};
