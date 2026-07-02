// The pipeline: fetch feed → cluster into topics → write summary + deep-dive
// scripts → synthesize all audio → save a briefing the app can download in one
// go. Run by cron twice a day, by POST /refresh, and by test.js.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, DATA_DIR } from './config.js';
import { fetchHomeFeed } from './twitter.js';
import { clusterTopics, writeTopicTexts, loadProfile } from './topics.js';
import { synthesize } from './tts.js';

export const BRIEFINGS_DIR = path.join(DATA_DIR, 'briefings');

export async function buildBriefing(tweets, { idPrefix = '' } = {}) {
  const profile = loadProfile();
  const id = idPrefix + new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(BRIEFINGS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  console.log(`[build] ${tweets.length} tweets → clustering...`);
  const clusters = await clusterTopics(tweets, profile);
  console.log(`[build] ${clusters.length} topics: ${clusters.map((c) => c.title).join(' | ')}`);

  const topics = [];
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    console.log(`[build] writing scripts ${i + 1}/${clusters.length}: ${cluster.title}`);
    const { summary, deepDive } = await writeTopicTexts(cluster, profile);
    if (!summary) continue;
    const summaryFile = `t${i}-summary.mp3`;
    const deepDiveFile = `t${i}-deepdive.mp3`;
    console.log(`[build] TTS ${i + 1}/${clusters.length}`);
    await synthesize(summary, path.join(dir, summaryFile));
    await synthesize(deepDive || summary, path.join(dir, deepDiveFile));
    topics.push({
      title: cluster.title,
      autoExpand: cluster.autoExpand,
      summaryText: summary,
      deepDiveText: deepDive,
      summaryAudio: `/audio/${id}/${summaryFile}`,
      deepDiveAudio: `/audio/${id}/${deepDiveFile}`,
      sources: cluster.tweets.map((t) => t.url),
    });
  }

  const episode = { id, createdAt: new Date().toISOString(), topics };
  fs.writeFileSync(path.join(dir, 'episode.json'), JSON.stringify(episode, null, 2));
  if (!idPrefix) {
    fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), JSON.stringify({ id }));
  }
  cleanupOldBriefings();
  console.log(`[build] done: ${dir}`);
  return episode;
}

export async function buildFromTwitter() {
  const tweets = await fetchHomeFeed();
  return buildBriefing(tweets);
}

export function loadMockTweets() {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'mock-tweets.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function cleanupOldBriefings() {
  if (!fs.existsSync(BRIEFINGS_DIR)) return;
  const cutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;
  for (const name of fs.readdirSync(BRIEFINGS_DIR)) {
    const dir = path.join(BRIEFINGS_DIR, name);
    try {
      if (fs.statSync(dir).mtimeMs < cutoff) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`[cleanup] removed old briefing ${name}`);
      }
    } catch {
      /* ignore races */
    }
  }
}

export function latestEpisode() {
  try {
    const { id } = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'latest.json'), 'utf8'));
    return JSON.parse(fs.readFileSync(path.join(BRIEFINGS_DIR, id, 'episode.json'), 'utf8'));
  } catch {
    return null;
  }
}

// Allow `node src/build.js` directly (what the cron job runs).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  buildFromTwitter()
    .then((e) => console.log(`Built briefing with ${e.topics.length} topics`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
