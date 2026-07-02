// Talks to the VPS. The whole briefing (text + every MP3) is downloaded up
// front so Next/Back/Expand are instant with zero network — and audio keeps
// playing through dead spots on a commute.
import * as FileSystem from 'expo-file-system';
import { segmentAudioKey } from './state';

const AUDIO_DIR = FileSystem.cacheDirectory + 'briefing-audio/';

function base(vpsUrl) {
  return vpsUrl.replace(/\/+$/, '');
}

async function getJson(vpsUrl, token, path) {
  const res = await fetch(base(vpsUrl) + path, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error || '';
    } catch {}
    throw new Error(`VPS ${path} failed (HTTP ${res.status}) ${detail}`);
  }
  return res.json();
}

export const fetchPlaylist = (vpsUrl, token) => getJson(vpsUrl, token, '/playlist');
export const fetchTestPlaylist = (vpsUrl, token) => getJson(vpsUrl, token, '/test');
export const fetchStatus = (vpsUrl, token) => getJson(vpsUrl, token, '/status');
export const triggerRefresh = (vpsUrl, token) =>
  fetch(base(vpsUrl) + '/refresh', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

export async function postOnboarding(vpsUrl, token, answers) {
  const res = await fetch(base(vpsUrl) + '/onboarding', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(answers),
  });
  if (!res.ok) throw new Error(`onboarding save failed (HTTP ${res.status})`);
}

// Downloads every segment's MP3 to the phone cache. Old briefing audio is
// wiped first (audio never accumulates on the phone; text history lives on
// the VPS). Returns { 't0-summary': fileUri, ... }.
export async function downloadEpisodeAudio(vpsUrl, token, episode, onProgress) {
  await FileSystem.deleteAsync(AUDIO_DIR, { idempotent: true });
  await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });

  const files = {};
  const jobs = [];
  episode.topics.forEach((topic, topicIndex) => {
    for (const segment of ['summary', 'deepDive']) {
      const key = segmentAudioKey({ topicIndex, segment });
      const remote = segment === 'summary' ? topic.summaryAudio : topic.deepDiveAudio;
      const url = `${base(vpsUrl)}${remote}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      jobs.push({ key, url, local: `${AUDIO_DIR}${key}.mp3` });
    }
  });

  let done = 0;
  for (const job of jobs) {
    const result = await FileSystem.downloadAsync(job.url, job.local);
    if (result.status !== 200) throw new Error(`audio download failed: ${job.key}`);
    files[job.key] = result.uri;
    done++;
    if (onProgress) onProgress(done, jobs.length);
  }
  return files;
}
