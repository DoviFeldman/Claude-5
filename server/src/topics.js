// Turns a pile of tweets into ordered topics, each with a spoken-style
// summary and a deep dive, personalized by the user's onboarding profile.
import fs from 'fs';
import path from 'path';
import { complete, parseJson } from './llm.js';
import { config, DATA_DIR } from './config.js';

export function loadProfile() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'profile.json'), 'utf8'));
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, 'profile.json'),
    JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }, null, 2)
  );
}

function profileText(profile) {
  if (!profile) return 'No profile yet — assume a general-interest listener.';
  return [
    profile.interests?.length ? `Interests: ${profile.interests.join(', ')}` : '',
    profile.favoriteAccounts?.length
      ? `Favorite accounts (their tweets matter most): ${profile.favoriteAccounts.join(', ')}`
      : '',
    profile.blockedTopics?.length
      ? `NEVER include these topics: ${profile.blockedTopics.join(', ')}`
      : '',
    profile.depth ? `Preferred depth: ${profile.depth}` : '',
    profile.commuteMinutes ? `Commute length: about ${profile.commuteMinutes} minutes` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function tweetsBlock(tweets) {
  return tweets
    .map(
      (t, i) =>
        `[${i}] @${t.author} (${t.likes} likes, ${t.retweets} RTs): ${t.text.replace(/\s+/g, ' ').slice(0, 500)}`
    )
    .join('\n');
}

export async function clusterTopics(tweets, profile) {
  const system =
    'You are a news editor building a personal audio briefing from the listener\'s own Twitter feed. ' +
    'You group tweets into distinct topics and rank them by how much THIS listener cares, using their profile. ' +
    'Respond with JSON only.';
  const prompt = `Listener profile:
${profileText(profile)}

Tweets from their home feed (index in brackets):
${tweetsBlock(tweets)}

Group these tweets into at most ${config.maxTopics} topics, ordered from most to least interesting for this listener. Skip pure noise (giveaways, spam, one-off jokes with no story) and anything on the never-include list. A topic can be one big story or a themed roundup.

For each topic set "autoExpand": true only if this listener would clearly want the full deep dive to play automatically after the summary (their top interests / favorite accounts); false means the summary is enough unless they ask.

Return JSON: [{"title": "short spoken title", "autoExpand": true, "tweetIndexes": [3, 17, 42]}, ...]`;

  const raw = parseJson(await complete(system, prompt, { maxTokens: 3000 }));
  // Some models wrap the array in an object like {"topics": [...]}.
  const topics = Array.isArray(raw)
    ? raw
    : Object.values(raw ?? {}).find(Array.isArray) || [];
  return topics
    .filter((t) => Array.isArray(t.tweetIndexes) && t.tweetIndexes.length)
    .slice(0, config.maxTopics)
    .map((t) => ({
      title: String(t.title || 'Untitled topic'),
      autoExpand: Boolean(t.autoExpand),
      tweets: t.tweetIndexes.map((i) => tweets[i]).filter(Boolean),
    }));
}

export async function writeTopicTexts(topic, profile) {
  const system =
    'You write scripts for a personal audio news briefing. Plain spoken prose only: no markdown, ' +
    'no bullet points, no emojis, no URLs, no hashtags read aloud. Natural, conversational, information-dense. ' +
    'Do NOT ramble or pad: no filler phrases, no repeating yourself, no long-winded intros or outros — ' +
    'but do not be so terse that details get lost. Every sentence must carry new information. ' +
    'Respond with JSON only.';
  const prompt = `Listener profile:
${profileText(profile)}

Topic: ${topic.title}
Source tweets:
${tweetsBlock(topic.tweets)}

Write two scripts about this topic based ONLY on these tweets:
1. "summary": 2-4 tight sentences with the essence of what happened. No preamble, get straight to it.
2. "deepDive": everything worth knowing from these tweets — the full story, key details, notable reactions and who said what — so the listener never has to open Twitter. A few flowing paragraphs, up to about 1500 characters. Not academic, just complete.

Return JSON: {"summary": "...", "deepDive": "..."}`;

  const out = parseJson(await complete(system, prompt, { maxTokens: 2500 }));
  return {
    summary: String(out.summary || '').trim(),
    deepDive: String(out.deepDive || '').trim().slice(0, 2000),
  };
}
