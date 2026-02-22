#!/usr/bin/env python3
"""
Abratronix — Broad Tech Trending Fetcher
=========================================
Aggregates content from Hacker News, Reddit, GitHub Trending, YouTube,
and major tech RSS feeds. Items are ranked by a multi-signal traction score
that combines upvotes, comments, view counts, recency, and source weight.

Traction Score Formula (0-100):
  score = (
      engagement_signal   * 0.40   # upvotes, HN points, YT views
    + comment_signal      * 0.20   # comments/discussions
    + recency_signal      * 0.25   # exponential decay over 48h
    + source_weight       * 0.15   # HN > Reddit > GitHub > YouTube > RSS
  ) * 100

Run:
  python3 fetcher/fetch.py

Env vars (optional, for higher quotas):
  YOUTUBE_API_KEY       -- YouTube Data API v3 key
  GITHUB_TOKEN          -- GitHub personal access token
  REDDIT_CLIENT_ID      -- Reddit OAuth app client ID
  REDDIT_CLIENT_SECRET  -- Reddit OAuth app client secret
"""

import json
import os
import re
import hashlib
import html as _html
import time
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

import feedparser
import requests

# --- Configuration -----------------------------------------------------------

OUTPUT_FILE = "client/public/data/feed.json"
MAX_ITEMS_PER_SOURCE = 30
MAX_TOTAL_ITEMS = 200

HN_TOP_N = 60  # fetch top N story IDs per type

REDDIT_SUBREDDITS = [
    "technology",
    "programming",
    "MachineLearning",
    "artificial",
    "LocalLLaMA",
    "webdev",
    "devops",
    "netsec",
    "Futurology",
    "gadgets",
    "hardware",
    "linux",
    "Python",
    "javascript",
    "rust",
    "golang",
]

GITHUB_TRENDING_LANGS = ["", "python", "typescript", "rust", "go"]

YOUTUBE_SEARCH_TERMS = [
    "AI news 2026",
    "tech news this week",
    "machine learning tutorial 2026",
    "open source project 2026",
    "programming tutorial trending",
]

RSS_FEEDS = [
    "https://feeds.feedburner.com/TechCrunch/",
    "https://www.theverge.com/rss/index.xml",
    "https://www.wired.com/feed/rss",
    "https://arstechnica.com/feed/",
    "https://www.technologyreview.com/feed/",
    "https://venturebeat.com/feed/",
    "https://hnrss.org/frontpage",
]

SOURCE_WEIGHTS = {
    "hackernews": 1.0,
    "reddit": 0.85,
    "github": 0.75,
    "youtube": 0.65,
    "news": 0.55,
}

# --- Helpers -----------------------------------------------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def make_id(source: str, key: str) -> str:
    return hashlib.md5(f"{source}:{key}".encode()).hexdigest()[:12]

def parse_date(date_str: str) -> str:
    if not date_str:
        return now_iso()
    for fmt in [
        "%a, %d %b %Y %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y%m%d",
    ]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            continue
    return now_iso()

def safe_get(url: str, params: dict = None, headers: dict = None, timeout: int = 10) -> Optional[requests.Response]:
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp
    except Exception as e:
        print(f"    [HTTP] Failed {url}: {e}")
        return None

def strip_html(text: str, max_len: int = 300) -> str:
    """Strip HTML tags, decode entities, and truncate a string."""
    if not text:
        return ""
    # Decode HTML entities first (&amp; -> &, &#x27; -> ', etc.)
    text = _html.unescape(text)
    # Remove any remaining HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace
    text = " ".join(text.split())
    return text[:max_len]

def hours_ago(iso_date: str) -> float:
    try:
        dt = datetime.fromisoformat(iso_date)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - dt
        return delta.total_seconds() / 3600
    except Exception:
        return 24.0

# --- Traction Scoring --------------------------------------------------------

def compute_traction_score(
    source: str,
    engagement: float,
    comments: float,
    hours_old: float,
    engagement_cap: float = 5000,
    comments_cap: float = 500,
) -> float:
    eng_norm = math.log1p(min(engagement, engagement_cap)) / math.log1p(engagement_cap)
    cmt_norm = math.log1p(min(comments, comments_cap)) / math.log1p(comments_cap)
    half_life = 12.0
    recency = math.exp(-0.693 * max(hours_old, 0) / half_life)
    src_w = SOURCE_WEIGHTS.get(source, 0.5)
    score = (eng_norm * 0.40 + cmt_norm * 0.20 + recency * 0.25 + src_w * 0.15) * 100
    return round(score, 2)

# --- Hacker News Fetcher -----------------------------------------------------

def fetch_hackernews() -> list[dict]:
    items = []
    seen_ids: set[int] = set()
    print("  [HN] Fetching top/best/new stories...")

    for story_type in ["topstories", "beststories"]:
        resp = safe_get(f"https://hacker-news.firebaseio.com/v0/{story_type}.json")
        if not resp:
            continue
        story_ids = resp.json()[:HN_TOP_N]

        for story_id in story_ids:
            if story_id in seen_ids:
                continue
            seen_ids.add(story_id)

            story_resp = safe_get(f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json")
            if not story_resp:
                continue
            story = story_resp.json()
            if not story or story.get("type") not in ("story", "ask", "show"):
                continue

            title = story.get("title", "")
            url = story.get("url") or f"https://news.ycombinator.com/item?id={story_id}"
            score = story.get("score", 0)
            n_comments = story.get("descendants", 0)
            by = story.get("by", "")
            unix_time = story.get("time", 0)
            iso_date = datetime.fromtimestamp(unix_time, tz=timezone.utc).isoformat() if unix_time else now_iso()
            age_h = hours_ago(iso_date)

            traction = compute_traction_score("hackernews", score, n_comments, age_h)

            items.append({
                "id": make_id("hackernews", str(story_id)),
                "source": "hackernews",
                "type": "story",
                "title": title,
                "summary": strip_html(story.get("text") or ""),
                "url": url,
                "author": by,
                "date": iso_date,
                "traction_score": traction,
                "meta": {
                    "hn_id": story_id,
                    "points": score,
                    "num_comments": n_comments,
                    "story_type": story.get("type", "story"),
                }
            })
            time.sleep(0.05)

        if len(items) >= MAX_ITEMS_PER_SOURCE * 2:
            break

    print(f"  -> {len(items)} HN items fetched")
    return items

# --- Reddit Fetcher ----------------------------------------------------------

def fetch_reddit(client_id: Optional[str] = None, client_secret: Optional[str] = None) -> list[dict]:
    items = []
    headers = {"User-Agent": "Abratronix/1.0 (tech trending aggregator)"}

    for subreddit in REDDIT_SUBREDDITS:
        print(f"  [Reddit] Fetching r/{subreddit}")
        resp = safe_get(
            f"https://www.reddit.com/r/{subreddit}/hot.json",
            params={"limit": 15},
            headers=headers,
        )
        if not resp:
            time.sleep(1)
            continue

        try:
            posts = resp.json().get("data", {}).get("children", [])
        except Exception:
            continue

        for post in posts:
            d = post.get("data", {})
            if d.get("stickied"):
                continue

            title = d.get("title", "")
            url = d.get("url") or f"https://reddit.com{d.get('permalink', '')}"
            score = d.get("score", 0)
            n_comments = d.get("num_comments", 0)
            created = d.get("created_utc", 0)
            iso_date = datetime.fromtimestamp(created, tz=timezone.utc).isoformat() if created else now_iso()
            age_h = hours_ago(iso_date)

            traction = compute_traction_score("reddit", score, n_comments, age_h)

            items.append({
                "id": make_id("reddit", d.get("id", url)),
                "source": "reddit",
                "type": "post",
                "title": title,
                "summary": strip_html(d.get("selftext") or ""),
                "url": url,
                "author": d.get("author", ""),
                "date": iso_date,
                "traction_score": traction,
                "meta": {
                    "subreddit": subreddit,
                    "score": score,
                    "num_comments": n_comments,
                    "thumbnail": d.get("thumbnail") if d.get("thumbnail", "").startswith("http") else "",
                    "flair": d.get("link_flair_text", ""),
                }
            })

        time.sleep(0.6)

    print(f"  -> {len(items)} Reddit items fetched")
    return items

# --- GitHub Trending Fetcher -------------------------------------------------

def fetch_github_trending(token: Optional[str] = None) -> list[dict]:
    items = []
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

    for lang in GITHUB_TRENDING_LANGS:
        q = f"created:>{week_ago} stars:>10"
        if lang:
            q += f" language:{lang}"

        print(f"  [GitHub] Trending{' (' + lang + ')' if lang else ' (all)'}")
        resp = safe_get(
            "https://api.github.com/search/repositories",
            params={"q": q, "sort": "stars", "order": "desc", "per_page": 10},
            headers=headers,
        )
        if not resp:
            time.sleep(1)
            continue

        for repo in resp.json().get("items", []):
            stars = repo.get("stargazers_count", 0)
            forks = repo.get("forks_count", 0)
            created = repo.get("created_at", "")
            age_h = hours_ago(parse_date(created))

            traction = compute_traction_score(
                "github", stars, forks, age_h,
                engagement_cap=10000, comments_cap=2000
            )

            items.append({
                "id": make_id("github", repo.get("full_name", "")),
                "source": "github",
                "type": "repo",
                "title": f"{repo.get('full_name', '')} — {repo.get('description') or 'No description'}",
                "summary": strip_html(repo.get("description") or ""),
                "url": repo.get("html_url", ""),
                "author": repo.get("owner", {}).get("login", ""),
                "date": parse_date(created),
                "traction_score": traction,
                "meta": {
                    "stars": stars,
                    "forks": forks,
                    "language": repo.get("language", ""),
                    "topics": repo.get("topics", [])[:5],
                    "full_name": repo.get("full_name", ""),
                }
            })

        time.sleep(0.5)

    print(f"  -> {len(items)} GitHub trending items fetched")
    return items

# --- YouTube Fetcher ---------------------------------------------------------

def fetch_youtube(api_key: Optional[str] = None) -> list[dict]:
    items = []

    if api_key:
        seen_ids: set[str] = set()
        raw_items: list[dict] = []
        for term in YOUTUBE_SEARCH_TERMS:
            print(f"  [YouTube/API] Searching: {term}")
            resp = safe_get(
                "https://www.googleapis.com/youtube/v3/search",
                params={"part": "snippet", "q": term, "type": "video",
                        "order": "relevance", "maxResults": 10, "key": api_key}
            )
            if not resp:
                continue
            for item in resp.json().get("items", []):
                snippet = item.get("snippet", {})
                video_id = item.get("id", {}).get("videoId", "")
                if not video_id or video_id in seen_ids:
                    continue
                seen_ids.add(video_id)
                raw_items.append({
                    "video_id": video_id,
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description", "")[:300],
                    "channel_title": snippet.get("channelTitle", ""),
                    "channel_id": snippet.get("channelId", ""),
                    "published_at": snippet.get("publishedAt", ""),
                    "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
                })
            time.sleep(0.2)
        # Batch-fetch video statistics and content details (duration, views, likes)
        video_stats: dict[str, dict] = {}
        all_ids = [r["video_id"] for r in raw_items]
        for i in range(0, len(all_ids), 50):
            batch = all_ids[i:i+50]
            stats_resp = safe_get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={"part": "statistics,contentDetails", "id": ",".join(batch), "key": api_key}
            )
            if stats_resp:
                for v in stats_resp.json().get("items", []):
                    vid = v.get("id", "")
                    stats = v.get("statistics", {})
                    content = v.get("contentDetails", {})
                    raw_dur = content.get("duration", "")
                    duration_str = ""
                    if raw_dur:
                        m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', raw_dur)
                        if m:
                            h, mn, s = (int(x or 0) for x in m.groups())
                            duration_str = f"{h}:{mn:02d}:{s:02d}" if h else f"{mn}:{s:02d}"
                    view_count = int(stats.get("viewCount", 0) or 0)
                    like_count = int(stats.get("likeCount", 0) or 0)
                    comment_count = int(stats.get("commentCount", 0) or 0)
                    video_stats[vid] = {
                        "view_count": view_count,
                        "like_count": like_count,
                        "comment_count": comment_count,
                        "duration": duration_str,
                    }
        for r in raw_items:
            vid = r["video_id"]
            vstats = video_stats.get(vid, {})
            iso_date = parse_date(r["published_at"])
            age_h = hours_ago(iso_date)
            view_count = vstats.get("view_count", 0)
            like_count = vstats.get("like_count", 0)
            comment_count = vstats.get("comment_count", 0)
            traction = compute_traction_score("youtube", view_count + like_count * 10, comment_count, age_h, engagement_cap=1_000_000)
            items.append({
                "id": make_id("youtube", vid),
                "source": "youtube",
                "type": "video",
                "title": r["title"],
                "summary": strip_html(r["description"]),
                "url": f"https://www.youtube.com/watch?v={vid}",
                "author": r["channel_title"],
                "date": iso_date,
                "traction_score": traction,
                "meta": {
                    "video_id": vid,
                    "channel_id": r["channel_id"],
                    "thumbnail": r["thumbnail"],
                    "duration": vstats.get("duration", ""),
                    "view_count": view_count,
                    "like_count": like_count,
                    "comment_count": comment_count,
                }
            })
        print(f"  [YouTube/API] Fetched {len(items)} videos with full stats")
        return items

    try:
        import yt_dlp
    except ImportError:
        print("  [YouTube] yt-dlp not installed.")
        return items

    seen_ids: set[str] = set()
    ydl_opts = {"quiet": True, "no_warnings": True, "extract_flat": True, "playlist_items": "1-8"}

    for term in YOUTUBE_SEARCH_TERMS:
        print(f"  [YouTube/yt-dlp] Searching: {term}")
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(f"ytsearch8:{term}", download=False)
            if not result or "entries" not in result:
                continue
            for entry in result["entries"]:
                if not entry:
                    continue
                video_id = entry.get("id", "")
                if not video_id or video_id in seen_ids:
                    continue
                seen_ids.add(video_id)

                upload_date = entry.get("upload_date") or ""
                if upload_date and len(upload_date) == 8:
                    iso_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}T00:00:00+00:00"
                else:
                    iso_date = now_iso()

                duration_secs = entry.get("duration") or 0
                duration_str = ""
                if duration_secs:
                    mins, secs = divmod(int(duration_secs), 60)
                    hrs, mins = divmod(mins, 60)
                    duration_str = f"{hrs}:{mins:02d}:{secs:02d}" if hrs else f"{mins}:{secs:02d}"

                view_count = entry.get("view_count") or 0
                age_h = hours_ago(iso_date)
                traction = compute_traction_score("youtube", view_count, 0, age_h, engagement_cap=1_000_000)

                items.append({
                    "id": make_id("youtube", video_id),
                    "source": "youtube",
                    "type": "video",
                    "title": entry.get("title", ""),
                    "summary": strip_html(entry.get("description") or ""),
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "author": entry.get("channel") or entry.get("uploader", ""),
                    "date": iso_date,
                    "traction_score": traction,
                    "meta": {
                        "video_id": video_id,
                        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                        "duration": duration_str,
                        "view_count": view_count,
                    }
                })
        except Exception as e:
            print(f"  [YouTube/yt-dlp] Search failed for '{term}': {e}")
        time.sleep(1)

    print(f"  -> {len(items)} YouTube items fetched")
    return items

# --- RSS / News Fetcher ------------------------------------------------------

def fetch_rss() -> list[dict]:
    items = []
    print("  [RSS] Fetching tech news feeds...")

    for feed_url in RSS_FEEDS:
        print(f"    Parsing: {feed_url}")
        try:
            feed = feedparser.parse(feed_url)
        except Exception as e:
            print(f"    Failed: {e}")
            continue

        for entry in feed.entries[:15]:
            title = entry.get("title", "")
            summary = strip_html(entry.get("summary", entry.get("description", "")))
            link = entry.get("link", "")
            published = entry.get("published", entry.get("updated", ""))
            iso_date = parse_date(published)
            age_h = hours_ago(iso_date)
            traction = compute_traction_score("news", 0, 0, age_h)

            items.append({
                "id": make_id("news", link),
                "source": "news",
                "type": "article",
                "title": title,
                "summary": summary,
                "url": link,
                "author": entry.get("author", feed.feed.get("title", "")),
                "date": iso_date,
                "traction_score": traction,
                "meta": {
                    "feed_title": feed.feed.get("title", ""),
                    "feed_url": feed_url,
                }
            })

    print(f"  -> {len(items)} RSS items fetched")
    return items

# --- Deduplication -----------------------------------------------------------

def deduplicate(items: list[dict]) -> list[dict]:
    seen_urls: set[str] = set()
    seen_ids: set[str] = set()
    result = []
    for item in items:
        url = item.get("url", "")
        item_id = item.get("id", "")
        if url in seen_urls or item_id in seen_ids:
            continue
        seen_urls.add(url)
        seen_ids.add(item_id)
        result.append(item)
    return result

# --- Main --------------------------------------------------------------------

def main():
    print("=" * 60)
    print("Abratronix -- Trending Tech Fetcher")
    print(f"Started at: {now_iso()}")
    print("=" * 60)

    youtube_key = os.environ.get("YOUTUBE_API_KEY")
    github_token = os.environ.get("GITHUB_TOKEN")
    reddit_client_id = os.environ.get("REDDIT_CLIENT_ID")
    reddit_client_secret = os.environ.get("REDDIT_CLIENT_SECRET")

    all_items: list[dict] = []

    print("\n[1/5] Fetching Hacker News...")
    all_items.extend(fetch_hackernews())

    print("\n[2/5] Fetching Reddit...")
    all_items.extend(fetch_reddit(reddit_client_id, reddit_client_secret))

    print("\n[3/5] Fetching GitHub Trending...")
    all_items.extend(fetch_github_trending(github_token))

    print("\n[4/5] Fetching YouTube...")
    all_items.extend(fetch_youtube(youtube_key))

    print("\n[5/5] Fetching RSS/News...")
    all_items.extend(fetch_rss())

    all_items = deduplicate(all_items)
    all_items.sort(key=lambda x: x.get("traction_score", 0), reverse=True)
    all_items = all_items[:MAX_TOTAL_ITEMS]

    sources: dict[str, int] = {}
    for item in all_items:
        s = item["source"]
        sources[s] = sources.get(s, 0) + 1

    scores = [i.get("traction_score", 0) for i in all_items]
    max_score = max(scores) if scores else 0
    p75 = sorted(scores)[int(len(scores) * 0.75)] if scores else 0
    p90 = sorted(scores)[int(len(scores) * 0.90)] if scores else 0

    output = {
        "generated_at": now_iso(),
        "total_items": len(all_items),
        "sources": sources,
        "traction_stats": {
            "max_score": max_score,
            "p90_score": p90,
            "p75_score": p75,
        },
        "items": all_items,
    }

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"Done! {len(all_items)} total items written to:")
    print(f"  {OUTPUT_FILE}")
    print("Source breakdown:")
    for src, count in sorted(sources.items(), key=lambda x: -x[1]):
        print(f"  {src:<14}: {count}")
    print(f"Top traction score: {max_score:.1f}")
    print("=" * 60)

if __name__ == "__main__":
    main()
