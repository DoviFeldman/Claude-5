// REST server the phone app talks to. Everything is pre-built by build.js, so
// this just hands out the latest briefing (text + audio) and takes settings.
import express from 'express';
import path from 'path';
import { config, DATA_DIR } from './config.js';
import { buildFromTwitter, buildBriefing, loadMockTweets, latestEpisode, BRIEFINGS_DIR } from './build.js';
import { saveProfile, loadProfile } from './topics.js';

const app = express();
app.use(express.json());

const startedAt = Date.now();
let building = false;
let lastBuildError = null;

// Simple bearer-token auth (set API_TOKEN in .env; empty disables auth).
app.use((req, res, next) => {
  if (!config.apiToken) return next();
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token;
  if (token === config.apiToken) return next();
  res.status(401).json({ error: 'unauthorized: send Authorization: Bearer <API_TOKEN>' });
});

// Pre-generated MP3s. ?token= works here too so audio URLs are easy to play.
app.use('/audio', express.static(BRIEFINGS_DIR));

app.get('/playlist', (req, res) => {
  const episode = latestEpisode();
  if (!episode) {
    return res
      .status(404)
      .json({ error: 'no briefing built yet — run `node src/build.js` or POST /refresh' });
  }
  res.json(episode);
});

app.get('/status', (req, res) => {
  const episode = latestEpisode();
  res.json({
    ok: true,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    building,
    lastBuildError,
    hasProfile: Boolean(loadProfile()),
    latestBriefing: episode
      ? { id: episode.id, createdAt: episode.createdAt, topicCount: episode.topics.length }
      : null,
  });
});

app.post('/onboarding', (req, res) => {
  const { interests, favoriteAccounts, commuteMinutes, depth, blockedTopics } = req.body || {};
  saveProfile({
    interests: interests || [],
    favoriteAccounts: favoriteAccounts || [],
    commuteMinutes: commuteMinutes || 20,
    depth: depth || 'moderate',
    blockedTopics: blockedTopics || [],
  });
  res.json({ ok: true });
});

app.post('/refresh', (req, res) => {
  if (building) return res.status(409).json({ error: 'a build is already running' });
  building = true;
  lastBuildError = null;
  buildFromTwitter()
    .catch((err) => {
      lastBuildError = err.message;
      console.error('[refresh] build failed:', err.message);
    })
    .finally(() => {
      building = false;
    });
  res.json({ ok: true, message: 'build started — poll /status, then GET /playlist' });
});

// Full pipeline on bundled mock tweets: verifies LLM + TTS + serving without
// touching Twitter. Returns a playable mini playlist.
app.get('/test', async (req, res) => {
  try {
    const episode = await buildBriefing(loadMockTweets().slice(0, 12), { idPrefix: 'test-' });
    res.json(episode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`twitter-radio server listening on port ${config.port}`);
  console.log(`data dir: ${DATA_DIR}`);
  if (!config.apiToken) console.log('WARNING: API_TOKEN is empty — the API is unauthenticated');
});
