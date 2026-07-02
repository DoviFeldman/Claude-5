import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');

export const config = {
  port: Number(process.env.PORT || 3000),
  apiToken: process.env.API_TOKEN || '',

  // Twitter session cookies (export from a logged-in browser)
  twAuthToken: process.env.TW_AUTH_TOKEN || '',
  twCt0: process.env.TW_CT0 || '',
  // GraphQL query id for HomeTimeline. Twitter rotates these occasionally;
  // grab a fresh one from browser devtools if the fetch starts failing (see README).
  twHomeTimelineQueryId: process.env.TW_HOME_QUERY_ID || 'HJFjzBgCs16TqxewQOeLNg',
  tweetCount: Number(process.env.TWEET_COUNT || 150),

  // LLM (summaries / clustering)
  llmProvider: process.env.LLM_PROVIDER || 'anthropic', // anthropic | openai | deepseek
  llmModel: process.env.LLM_MODEL || '',                // empty = provider default
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',

  // TTS (OpenAI)
  ttsModel: process.env.TTS_MODEL || 'gpt-4o-mini-tts',
  ttsVoice: process.env.TTS_VOICE || 'alloy',

  maxTopics: Number(process.env.MAX_TOPICS || 12),
  retentionDays: Number(process.env.RETENTION_DAYS || 7),
};

export function requireKeys(keys) {
  const missing = keys.filter((k) => !config[k]);
  if (missing.length) {
    throw new Error(
      `Missing required settings in server/.env: ${missing.join(', ')} (see .env.example)`
    );
  }
}
