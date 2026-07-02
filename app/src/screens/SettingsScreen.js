import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchTestPlaylist, fetchStatus, triggerRefresh } from '../api';

export default function SettingsScreen({ settings, onSave, onBack, onRedoOnboarding, onTestEpisode }) {
  const [vpsUrl, setVpsUrl] = useState(settings.vpsUrl);
  const [apiToken, setApiToken] = useState(settings.apiToken);
  const [bleDeviceName, setBleDeviceName] = useState(settings.bleDeviceName);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    await onSave({ ...settings, vpsUrl: vpsUrl.trim(), apiToken: apiToken.trim(), bleDeviceName: bleDeviceName.trim() });
    setMessage('saved ✓');
  };

  const run = (label, fn) => async () => {
    setBusy(true);
    setMessage(`${label}…`);
    try {
      await fn();
    } catch (e) {
      setMessage(`${label} failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const testConnection = run('checking VPS', async () => {
    const status = await fetchStatus(vpsUrl.trim(), apiToken.trim());
    setMessage(
      `VPS OK ✓ — latest briefing: ${
        status.latestBriefing
          ? `${status.latestBriefing.topicCount} topics (${status.latestBriefing.createdAt})`
          : 'none yet'
      }${status.building ? ' — building now' : ''}`
    );
  });

  // Test mode: full pipeline on mock tweets, then plays the result. Verifies
  // VPS + LLM + TTS + download + audio playback without real Twitter data.
  const testMode = run('running test pipeline (takes ~a minute)', async () => {
    const episode = await fetchTestPlaylist(vpsUrl.trim(), apiToken.trim());
    setMessage('test briefing ready — playing');
    onTestEpisode(episode);
  });

  const refresh = run('asking VPS to rebuild', async () => {
    await triggerRefresh(vpsUrl.trim(), apiToken.trim());
    setMessage('rebuild started on VPS — check back in a few minutes, then Reload on the main screen');
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.label}>VPS URL</Text>
      <TextInput
        style={styles.input}
        value={vpsUrl}
        onChangeText={setVpsUrl}
        placeholder="http://your-vps-ip:3000"
        placeholderTextColor="#484f58"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>API token (same as API_TOKEN in server .env)</Text>
      <TextInput
        style={styles.input}
        value={apiToken}
        onChangeText={setApiToken}
        placeholder="token"
        placeholderTextColor="#484f58"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>ESP32 remote name (optional)</Text>
      <TextInput
        style={styles.input}
        value={bleDeviceName}
        onChangeText={setBleDeviceName}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Button label="Save" onPress={save} primary />
      <Button label="Test VPS connection" onPress={testConnection} disabled={busy} />
      <Button label="Test mode (mock briefing + audio)" onPress={testMode} disabled={busy} />
      <Button label="Rebuild briefing from my feed now" onPress={refresh} disabled={busy} />
      <Button label="Redo onboarding questions" onPress={onRedoOnboarding} />

      {busy ? <ActivityIndicator color="#7fd4ff" style={{ marginTop: 12 }} /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </ScrollView>
  );
}

function Button({ label, onPress, primary, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.button, primary && styles.buttonPrimary, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 48, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  back: { color: '#7fd4ff', fontSize: 18 },
  title: { color: '#e6edf3', fontSize: 20, fontWeight: 'bold' },
  label: { color: '#8b949e', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#161b22',
    color: '#e6edf3',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  button: {
    backgroundColor: '#21262d',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonPrimary: { backgroundColor: '#1f6feb', marginTop: 24 },
  buttonText: { color: '#e6edf3', fontSize: 16 },
  message: { color: '#3fb950', marginTop: 16, lineHeight: 20 },
});
