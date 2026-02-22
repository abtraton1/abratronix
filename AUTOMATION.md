# Claw News Hub — Automation & Deployment Guide

This document explains how to set up fully automated, self-running news aggregation for the Claw News Hub.

---

## How It Works

The site is a **static React application** that reads from a single JSON file (`client/public/data/feed.json`). A Python script (`fetcher/fetch.py`) fetches fresh content from multiple sources and writes that file. Automation is achieved by running this script on a schedule and redeploying the site.

```
┌─────────────────────────────────────────────────────────┐
│                   Scheduled Job (every 3h)              │
│                                                         │
│  fetcher/fetch.py                                       │
│    ├── GitHub API  ──► releases, commits, issues        │
│    ├── Reddit API  ──► r/openclaw, r/LocalLLaMA, etc.   │
│    ├── YouTube API ──► search by keyword                │
│    ├── RSS Feeds   ──► HN, Verge, TechCrunch            │
│    └── HN Algolia  ──► Hacker News search               │
│                  │                                      │
│                  ▼                                      │
│         feed.json (static data file)                    │
│                  │                                      │
│                  ▼                                      │
│         Redeploy static site                            │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: API Keys (Optional but Recommended)

The fetcher works without any API keys using public endpoints. Adding keys improves rate limits and unlocks more data.

| Service | Environment Variable | How to Get | Free Tier |
|---|---|---|---|
| YouTube Data API v3 | `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → YouTube Data API v3 | 10,000 units/day |
| Reddit OAuth | `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` | [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) → Create "script" app | 60 req/min |
| GitHub Personal Token | `GITHUB_TOKEN` | [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (no scopes needed) | 5,000 req/hr |

### Getting a YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project.
2. Navigate to **APIs & Services → Library** and search for "YouTube Data API v3".
3. Click **Enable**.
4. Go to **APIs & Services → Credentials** and click **Create Credentials → API Key**.
5. Copy the key and set it as the `YOUTUBE_API_KEY` environment variable.

### Getting Reddit API Credentials

1. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) and log in.
2. Click **Create another app** at the bottom.
3. Select **script** as the app type.
4. Fill in a name (e.g., "openclaw-news-bot") and set the redirect URI to `http://localhost`.
5. Copy the **client ID** (shown under the app name) and the **secret**.

---

## Step 2: Run the Fetcher Locally

```bash
# Install dependencies
pip install -r fetcher/requirements.txt

# Run without API keys (uses public endpoints only)
python3 fetcher/fetch.py

# Run with API keys
YOUTUBE_API_KEY=your_key \
REDDIT_CLIENT_ID=your_id \
REDDIT_CLIENT_SECRET=your_secret \
GITHUB_TOKEN=your_token \
python3 fetcher/fetch.py
```

The script writes its output to `client/public/data/feed.json`. The frontend reads this file on page load.

---

## Step 3: Automated Deployment Options

### Option A: GitHub Actions (Recommended — Free)

This is the simplest fully-automated setup. GitHub Actions runs the fetcher on a schedule and commits the updated `feed.json` back to the repository. A connected deployment service (Netlify, Vercel, or GitHub Pages) then automatically redeploys the site.

**Setup:**

1. Push this repository to GitHub.
2. Go to **Settings → Secrets and variables → Actions** and add your API keys as repository secrets:
   - `YOUTUBE_API_KEY`
   - `REDDIT_CLIENT_ID`
   - `REDDIT_CLIENT_SECRET`
   - (The `GITHUB_TOKEN` secret is automatically provided by GitHub Actions)
3. The workflow file at `.github/workflows/refresh-feed.yml` is already configured to run every 3 hours.
4. Connect your repository to Netlify or Vercel for automatic deployment on every push.

**Workflow summary:**

```yaml
# Runs every 3 hours
schedule:
  - cron: "0 */3 * * *"
```

The workflow: checks out the repo → runs `fetch.py` → commits the updated `feed.json` → pushes → triggers a redeployment.

### Option B: Netlify Scheduled Functions (No GitHub Required)

If you prefer to keep the fetcher logic inside Netlify itself, you can use [Netlify Scheduled Functions](https://docs.netlify.com/functions/scheduled-functions/).

1. Deploy the site to Netlify.
2. Create a Netlify Function that calls the fetcher logic (rewritten in JavaScript/TypeScript).
3. Set the schedule in `netlify.toml`:

```toml
[functions."refresh-feed"]
  schedule = "@hourly"
```

### Option C: Cron Job on a VPS

If you have a VPS or server, you can run the fetcher directly via cron:

```bash
# Edit crontab
crontab -e

# Add this line to run every 3 hours
0 */3 * * * cd /path/to/openclaw-news && python3 fetcher/fetch.py >> /var/log/openclaw-fetch.log 2>&1
```

After running, you would need to rebuild and redeploy the static site. Combine with a deployment script:

```bash
0 */3 * * * cd /path/to/openclaw-news && python3 fetcher/fetch.py && pnpm build && rsync -avz dist/ user@yourserver:/var/www/openclaw-news/
```

### Option D: n8n / Make / Zapier (No-Code)

For a fully visual, no-code approach:

1. Set up an [n8n](https://n8n.io) workflow (self-hosted or cloud).
2. Use the **HTTP Request** node to call each API (GitHub, Reddit, etc.).
3. Use the **Code** node to transform and merge the results.
4. Use the **Write Binary File** node to write `feed.json`.
5. Trigger a Netlify or Vercel deploy hook via an HTTP request.
6. Schedule the workflow to run every few hours.

---

## Step 4: Deployment

### Deploying to Netlify

1. Push the repository to GitHub.
2. Log in to [netlify.com](https://netlify.com) and click **Add new site → Import an existing project**.
3. Connect your GitHub repository.
4. Set the build settings:
   - **Build command:** `pnpm build`
   - **Publish directory:** `dist`
5. Click **Deploy site**.

Netlify will automatically redeploy whenever you push a new commit (including the automated `feed.json` updates from GitHub Actions).

### Deploying to Vercel

1. Push the repository to GitHub.
2. Log in to [vercel.com](https://vercel.com) and click **Add New → Project**.
3. Import your GitHub repository.
4. Vercel will auto-detect the Vite configuration. Click **Deploy**.

### Deploying to GitHub Pages

1. In `vite.config.ts`, set `base: '/your-repo-name/'`.
2. Add a GitHub Actions job that builds and deploys to the `gh-pages` branch after the feed refresh job.

---

## Adding New Sources

To add a new data source, edit `fetcher/fetch.py`:

1. Write a new `fetch_*()` function that returns a list of `dict` items matching the schema:

```python
{
    "id": "unique_12char_hash",
    "source": "github" | "reddit" | "youtube" | "news",
    "type": "release" | "commit" | "post" | "video" | "article" | ...,
    "title": "Item title",
    "summary": "Short description (max 300 chars)",
    "url": "https://...",
    "author": "username or channel name",
    "date": "2026-02-21T12:00:00+00:00",  # ISO 8601
    "meta": {}  # Source-specific metadata
}
```

2. Call your new function in `main()` and extend `all_items`.
3. If it's a new source type, add it to the frontend's `SOURCE_CONFIG` in `client/src/lib/types.ts`.

### Suggested Additional Sources

| Source | Method | Notes |
|---|---|---|
| Bluesky | [AT Protocol API](https://docs.bsky.app/) | Search by hashtag `#openclaw` |
| Mastodon | [Mastodon API](https://docs.joinmastodon.org/api/) | Search public timeline |
| Twitter/X | [Twitter API v2](https://developer.twitter.com/) | Requires paid API access |
| Dev.to | [Dev.to API](https://developers.forem.com/api) | Search articles by tag |
| Medium | RSS feed | `https://medium.com/feed/tag/openclaw` |
| Podcast RSS | feedparser | Any podcast mentioning OpenClaw |

---

## Monitoring & Maintenance

The fetcher logs its output to stdout. In a GitHub Actions environment, these logs are visible in the Actions tab. For local cron jobs, redirect output to a log file as shown above.

The `feed.json` file includes a `generated_at` timestamp. The frontend displays this as "Updated X minutes ago" in the header, so you can immediately see if the feed is stale.

If a source starts failing (e.g., API rate limit exceeded), the fetcher will log a warning and continue with the remaining sources — it will never fail entirely due to a single source being unavailable.

---

## Customizing Search Terms

Edit the `SEARCH_TERMS`, `REDDIT_SUBREDDITS`, `YOUTUBE_SEARCH_TERMS`, and `RSS_FEEDS` lists at the top of `fetcher/fetch.py` to track different projects or keywords. The same codebase can be repurposed for any open-source project by changing these configuration values.
