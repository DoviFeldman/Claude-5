// Thin wrapper around expo-av: plays one local MP3 at a time, reports
// progress and end-of-segment. Audio routes to the phone speaker or a
// connected Bluetooth speaker automatically via normal system routing.
import { Audio } from 'expo-av';

export class Player {
  constructor() {
    this.sound = null;
    this.volume = 1.0;
    this.onFinish = null;
    this.onProgress = null;
    this._configured = false;
  }

  async _configure() {
    if (this._configured) return;
    await Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
    this._configured = true;
  }

  async play(uri) {
    await this._configure();
    await this.stop();
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: this.volume },
      (status) => {
        if (!status.isLoaded) return;
        if (this.onProgress && status.durationMillis) {
          this.onProgress(status.positionMillis / status.durationMillis);
        }
        if (status.didJustFinish && this.onFinish) this.onFinish();
      }
    );
    this.sound = sound;
  }

  async pause() {
    if (this.sound) await this.sound.pauseAsync().catch(() => {});
  }

  async resume() {
    if (this.sound) await this.sound.playAsync().catch(() => {});
  }

  async stop() {
    if (this.sound) {
      const s = this.sound;
      this.sound = null;
      await s.unloadAsync().catch(() => {});
    }
  }

  async setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.sound) await this.sound.setVolumeAsync(this.volume).catch(() => {});
    return this.volume;
  }
}
