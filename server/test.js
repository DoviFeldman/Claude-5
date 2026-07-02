#!/usr/bin/env node
// CLI test: runs the full pipeline with no client connected.
//
//   node test.js          → mock tweets (no Twitter needed; needs LLM + TTS keys)
//   node test.js --live   → your real home feed end to end
//   node test.js --feed   → only fetch the feed and print tweets (no LLM/TTS cost)
import { buildBriefing, buildFromTwitter, loadMockTweets } from './src/build.js';
import { fetchHomeFeed } from './src/twitter.js';

const arg = process.argv[2];

try {
  if (arg === '--feed') {
    const tweets = await fetchHomeFeed();
    console.log(`Fetched ${tweets.length} tweets from your home feed:\n`);
    for (const t of tweets.slice(0, 30)) {
      console.log(`@${t.author}: ${t.text.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
  } else {
    const episode =
      arg === '--live'
        ? await buildFromTwitter()
        : await buildBriefing(loadMockTweets(), { idPrefix: 'test-' });

    console.log(`\n=== Briefing ${episode.id}: ${episode.topics.length} topics ===\n`);
    for (const topic of episode.topics) {
      console.log(`## ${topic.title} ${topic.autoExpand ? '(auto deep dive)' : ''}`);
      console.log(`SUMMARY: ${topic.summaryText}\n`);
      console.log(`DEEP DIVE: ${topic.deepDiveText}\n`);
      console.log(`audio: ${topic.summaryAudio} , ${topic.deepDiveAudio}\n`);
    }
    console.log('MP3 files are under server/data/briefings/ — play one to verify TTS.');
  }
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
}
