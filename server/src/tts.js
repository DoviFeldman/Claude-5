// Text → MP3 via OpenAI TTS.
import fs from 'fs';
import { config } from './config.js';

export async function synthesize(text, outPath) {
  if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is not set in server/.env (needed for TTS)');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.openaiApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.ttsModel,
      voice: config.ttsVoice,
      input: text.slice(0, 4000), // API input limit safety
      response_format: 'mp3',
    }),
  });
  if (!res.ok) {
    throw new Error(`TTS request failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  return outPath;
}
