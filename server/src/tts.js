// Text → MP3. Two providers:
//   edge   — free Microsoft Edge neural voices (no key needed), the default
//   openai — OpenAI TTS (needs OPENAI_API_KEY with credit)
import fs from 'fs';
import path from 'path';
import os from 'os';
import { config } from './config.js';

async function synthesizeOpenAI(text, outPath) {
  if (!config.openaiApiKey) throw new Error('OPENAI_API_KEY is not set in server/.env (needed for TTS_PROVIDER=openai)');
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

async function synthesizeEdge(text, outPath) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const tts = new MsEdgeTTS();
  await tts.setMetadata(config.edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  // toFile always writes <dir>/audio.mp3, so use a temp dir and move the result.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-tts-'));
  try {
    const { audioFilePath } = await tts.toFile(tmpDir, text.slice(0, 8000));
    fs.copyFileSync(audioFilePath, outPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  return outPath;
}

export async function synthesize(text, outPath) {
  if (config.ttsProvider === 'openai') return synthesizeOpenAI(text, outPath);
  return synthesizeEdge(text, outPath);
}
