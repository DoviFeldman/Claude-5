# Step 1 — VPS Server

Turns your Twitter home feed into a personal audio briefing: topics, each with a
short **summary** and a **deep dive**, as text + pre-generated MP3s. The phone
app downloads the whole thing in one go, so skipping around has zero lag.

No browser, no Playwright — the feed is fetched with plain HTTPS using your
session cookies, so it runs fine on a $1/month VPS.

## Install (RackNerd / any Ubuntu-ish VPS)

```bash
# Node 20+ (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt-get install -y nodejs

git clone <this repo> && cd Claude-5/server
npm install
cp .env.example .env && nano .env   # fill in keys + cookies (below)
```

## Get your Twitter cookies (one-time, ~2 minutes)

1. Log in to **x.com** in Chrome/Firefox on your computer.
2. Open DevTools (F12) → **Application** (Firefox: Storage) → **Cookies** → `https://x.com`.
3. Copy the values of the cookies named **`auth_token`** and **`ct0`** into
   `TW_AUTH_TOKEN` and `TW_CT0` in `.env`.

Cookies last months. If feed fetching starts failing with 401/403, re-export them.

### If it fails with "query id likely rotated"

Twitter occasionally renames its internal `HomeTimeline` endpoint id. To fix:
DevTools → **Network** tab on x.com home page → filter for `HomeTimeline` →
the request URL looks like `/i/api/graphql/AbCdEf123/HomeTimeline`. Put that
`AbCdEf123` part in `.env` as `TW_HOME_QUERY_ID`.

## Test it

```bash
node test.js          # full pipeline on bundled mock tweets (no Twitter needed)
node test.js --feed   # just fetch your real feed and print tweets (free, no LLM/TTS)
node test.js --live   # full pipeline on your real feed
```

`node test.js` prints every summary + deep dive and writes MP3s under
`data/briefings/` — play one to check the voice.

## Run it for real

```bash
node src/build.js      # build a briefing now
node src/server.js     # start the API (port 3000)
```

Keep it running with systemd — create `/etc/systemd/system/twitter-radio.service`:

```ini
[Unit]
Description=Twitter radio server
After=network.target

[Service]
WorkingDirectory=/root/Claude-5/server
ExecStart=/usr/bin/node src/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now twitter-radio
```

Build fresh briefings twice a day with cron (`crontab -e`):

```cron
0 7,18 * * * cd /root/Claude-5/server && /usr/bin/node src/build.js >> build.log 2>&1
```

Old briefings are deleted automatically after `RETENTION_DAYS` (default 7).

## API

All endpoints require `Authorization: Bearer <API_TOKEN>` (or `?token=` on audio URLs).

| Endpoint | What it does |
|---|---|
| `GET /playlist` | Latest briefing: topics with summary/deep-dive text + audio URLs |
| `GET /audio/<id>/<file>.mp3` | The pre-generated audio |
| `GET /status` | Last build time, topic count, build errors, uptime |
| `POST /refresh` | Rebuild from your feed right now (runs in background) |
| `POST /onboarding` | Save your interest profile (the app sends this) |
| `GET /test` | Full pipeline on mock tweets — verifies LLM + TTS + serving |

## Costs (rough)

Two builds/day with 12 topics: a few cents of Claude + roughly $0.20–0.50/day of
OpenAI TTS. Lower `MAX_TOPICS` or build once a day to cut it further.
