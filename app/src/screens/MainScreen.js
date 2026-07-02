import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useKeepAwake } from 'expo-keep-awake';
import { advance, segmentText, segmentAudioKey } from '../state';
import { fetchPlaylist, downloadEpisodeAudio } from '../api';
import { Player } from '../player';
import { Remote } from '../ble';

export default function MainScreen({ settings, onOpenSettings, testEpisode, onTestEpisodeUsed }) {
  // Screen stays on so audio keeps flowing and BLE never drops.
  useKeepAwake();

  const [episode, setEpisode] = useState(null);
  const [files, setFiles] = useState({});
  const [position, setPosition] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [bleState, setBleState] = useState('off');

  const playerRef = useRef(null);
  const remoteRef = useRef(null);
  const stateRef = useRef({ position: null, episode: null, files: {}, volume: 1 });
  stateRef.current.position = position;
  stateRef.current.episode = episode;
  stateRef.current.files = files;
  stateRef.current.volume = volume;

  if (!playerRef.current) playerRef.current = new Player();
  if (!remoteRef.current) remoteRef.current = new Remote();

  const playPosition = useCallback(async (pos) => {
    const player = playerRef.current;
    const { files: f } = stateRef.current;
    setPosition(pos);
    setProgress(0);
    setPaused(false);
    if (!pos) {
      await player.stop();
      setPlaying(false);
      return;
    }
    const uri = f[segmentAudioKey(pos)];
    setPlaying(true);
    if (uri) {
      try {
        await player.play(uri);
      } catch (e) {
        setError(`audio failed: ${e.message} — text is on screen`);
      }
    } else {
      setError('no audio for this segment — text is on screen');
    }
  }, []);

  const dispatch = useCallback(
    (action) => {
      const { position: pos, episode: ep } = stateRef.current;
      if (!ep) return;
      playPosition(advance(pos, ep.topics, action));
    },
    [playPosition]
  );

  useEffect(() => {
    const player = playerRef.current;
    player.onFinish = () => dispatch('FINISH');
    player.onProgress = setProgress;
    return () => {
      player.stop();
      remoteRef.current?.disconnect();
    };
  }, [dispatch]);

  const changeVolume = useCallback(async (v) => {
    const applied = await playerRef.current.setVolume(v);
    setVolume(applied);
  }, []);

  const handleBleSignal = useCallback(
    (signal) => {
      const map = { SKIP: 'SKIP', NEXT_TOPIC: 'NEXT', EXPAND: 'EXPAND' };
      if (map[signal]) return dispatch(map[signal]);
      if (signal === 'VOLUME_UP') changeVolume(stateRef.current.volume + 0.1);
      if (signal === 'VOLUME_DOWN') changeVolume(stateRef.current.volume - 0.1);
    },
    [dispatch, changeVolume]
  );

  const connectRemote = useCallback(async () => {
    try {
      await remoteRef.current.connect(settings.bleDeviceName, handleBleSignal, setBleState);
    } catch (e) {
      setBleState('off');
      setError(`Remote: ${e.message} (app works fine without it)`);
    }
  }, [settings.bleDeviceName, handleBleSignal]);

  const loadBriefing = useCallback(
    async (ep) => {
      setError('');
      await playerRef.current.stop();
      setPosition(null);
      setPlaying(false);
      try {
        setStatus('fetching briefing…');
        const fetched = ep || (await fetchPlaylist(settings.vpsUrl, settings.apiToken));
        if (!fetched.topics?.length) throw new Error('briefing has no topics');
        setStatus('downloading audio…');
        const downloaded = await downloadEpisodeAudio(
          settings.vpsUrl,
          settings.apiToken,
          fetched,
          (done, total) => setStatus(`downloading audio ${done}/${total}…`)
        );
        setEpisode(fetched);
        setFiles(downloaded);
        stateRef.current.episode = fetched;
        stateRef.current.files = downloaded;
        setStatus('');
        playPosition({ topicIndex: 0, segment: 'summary' });
      } catch (e) {
        setStatus('');
        setError(e.message);
      }
    },
    [settings, playPosition]
  );

  useEffect(() => {
    if (testEpisode) {
      loadBriefing(testEpisode);
      onTestEpisodeUsed();
    } else if (settings.vpsUrl && !episode) {
      loadBriefing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testEpisode, settings.vpsUrl]);

  const togglePause = useCallback(async () => {
    if (!stateRef.current.position) return dispatch('SKIP'); // start from top
    if (paused) {
      await playerRef.current.resume();
      setPaused(false);
    } else {
      await playerRef.current.pause();
      setPaused(true);
    }
  }, [paused, dispatch]);

  const topic = position && episode ? episode.topics[position.topicIndex] : null;
  const text = position && episode ? segmentText(position, episode.topics) : '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>📻 Twitter Radio</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={connectRemote}>
            <Text style={[styles.badge, bleState === 'connected' && styles.badgeOn]}>
              {bleState === 'connected' ? '◉ remote' : bleState === 'scanning' ? '… remote' : '○ remote'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenSettings}>
            <Text style={styles.settingsButton}>⚙︎</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!settings.vpsUrl ? (
        <View style={styles.center}>
          <Text style={styles.dim}>Set your VPS URL in settings to start.</Text>
        </View>
      ) : status ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7fd4ff" />
          <Text style={styles.dim}>{status}</Text>
        </View>
      ) : topic ? (
        <>
          <Text style={styles.topicCount}>
            topic {position.topicIndex + 1} / {episode.topics.length} ·{' '}
            {position.segment === 'summary' ? 'summary' : 'deep dive'}
            {topic.autoExpand && position.segment === 'summary' ? ' → deep dive next' : ''}
          </Text>
          <Text style={styles.topicTitle}>{topic.title}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <ScrollView style={styles.textScroll}>
            <Text style={styles.segmentText}>{text}</Text>
          </ScrollView>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.dim}>
            {episode ? 'End of briefing. Press ▶ to restart or ↻ to reload.' : 'No briefing loaded.'}
          </Text>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.controlsRow}>
        <ControlButton label="⏮ Back" onPress={() => dispatch('BACK')} />
        <ControlButton
          label={!playing || paused ? '▶' : '⏸'}
          big
          onPress={togglePause}
        />
        <ControlButton label="Next ⏭" onPress={() => dispatch('NEXT')} />
      </View>
      <View style={styles.controlsRow}>
        <ControlButton label="🔍 Deep dive" onPress={() => dispatch('EXPAND')} />
        <ControlButton label="↻ Reload" onPress={() => loadBriefing()} />
      </View>
      <View style={styles.volumeRow}>
        <Text style={styles.dim}>🔉</Text>
        <Slider
          style={{ flex: 1 }}
          minimumValue={0}
          maximumValue={1}
          value={volume}
          onValueChange={changeVolume}
          minimumTrackTintColor="#7fd4ff"
          maximumTrackTintColor="#333"
          thumbTintColor="#7fd4ff"
        />
        <Text style={styles.dim}>🔊</Text>
      </View>
    </View>
  );
}

function ControlButton({ label, onPress, big }) {
  return (
    <TouchableOpacity style={[styles.button, big && styles.buttonBig]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 48, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  appTitle: { color: '#e6edf3', fontSize: 20, fontWeight: 'bold' },
  settingsButton: { color: '#7fd4ff', fontSize: 24 },
  badge: { color: '#8b949e', fontSize: 13 },
  badgeOn: { color: '#3fb950' },
  topicCount: { color: '#8b949e', marginTop: 16, fontSize: 13 },
  topicTitle: { color: '#e6edf3', fontSize: 24, fontWeight: 'bold', marginVertical: 8 },
  progressTrack: { height: 4, backgroundColor: '#21262d', borderRadius: 2, marginBottom: 12 },
  progressFill: { height: 4, backgroundColor: '#7fd4ff', borderRadius: 2 },
  textScroll: { flex: 1 },
  segmentText: { color: '#c9d1d9', fontSize: 17, lineHeight: 26 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  dim: { color: '#8b949e', fontSize: 15, textAlign: 'center' },
  error: { color: '#f85149', marginVertical: 6 },
  controlsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  button: {
    backgroundColor: '#21262d',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  buttonBig: { backgroundColor: '#1f6feb', minWidth: 70 },
  buttonText: { color: '#e6edf3', fontSize: 16 },
});
