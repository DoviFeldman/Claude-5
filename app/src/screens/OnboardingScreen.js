import React, { useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { postOnboarding } from '../api';

const TOPIC_OPTIONS = [
  'politics', 'tech', 'AI', 'sports', 'finance', 'crypto',
  'science', 'space', 'gaming', 'entertainment', 'health', 'world news',
];

const STEPS = [
  {
    key: 'vpsUrl',
    type: 'text',
    question: "Hi! I'm your Twitter radio. First — what's your VPS URL? (like http://1.2.3.4:3000)",
    placeholder: 'http://your-vps-ip:3000',
  },
  {
    key: 'apiToken',
    type: 'text',
    question: 'And the API token you set on the server (API_TOKEN in .env)?',
    placeholder: 'token',
  },
  {
    key: 'interests',
    type: 'multi',
    question: 'What topics interest you? Tap all that apply.',
    options: TOPIC_OPTIONS,
  },
  {
    key: 'favoriteAccounts',
    type: 'text',
    question: 'Which Twitter accounts matter most to you? (comma separated, like elonmusk, paulg)',
    placeholder: 'account1, account2, …',
  },
  {
    key: 'commuteMinutes',
    type: 'slider',
    question: 'How long is your commute? (This tunes how much content gets prepared.)',
    min: 5,
    max: 60,
  },
  {
    key: 'depth',
    type: 'single',
    question: 'How deep do you want summaries by default?',
    options: ['brief', 'moderate', 'deep'],
  },
  {
    key: 'blockedTopics',
    type: 'multi',
    question: "Last one — any topics you NEVER want to hear about?",
    options: TOPIC_OPTIONS,
    allowEmpty: true,
  },
];

export default function OnboardingScreen({ settings, onDone }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [chat, setChat] = useState([{ from: 'bot', text: STEPS[0].question }]);
  const [answers, setAnswers] = useState({});
  const [textValue, setTextValue] = useState('');
  const [multiValue, setMultiValue] = useState([]);
  const [sliderValue, setSliderValue] = useState(20);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const step = STEPS[stepIndex];

  const submit = async (value, displayText) => {
    const nextAnswers = { ...answers, [step.key]: value };
    const nextChat = [...chat, { from: 'me', text: displayText }];
    setAnswers(nextAnswers);
    setError('');
    if (stepIndex + 1 < STEPS.length) {
      setChat([...nextChat, { from: 'bot', text: STEPS[stepIndex + 1].question }]);
      setStepIndex(stepIndex + 1);
      setTextValue('');
      setMultiValue([]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } else {
      setChat([...nextChat, { from: 'bot', text: 'Perfect — saving your profile…' }]);
      await finish(nextAnswers);
    }
  };

  const finish = async (finalAnswers) => {
    const profile = {
      interests: finalAnswers.interests || [],
      favoriteAccounts: (finalAnswers.favoriteAccounts || '')
        .split(',')
        .map((s) => s.trim().replace(/^@/, ''))
        .filter(Boolean),
      commuteMinutes: finalAnswers.commuteMinutes || 20,
      depth: finalAnswers.depth || 'moderate',
      blockedTopics: finalAnswers.blockedTopics || [],
    };
    const newSettings = {
      ...settings,
      vpsUrl: (finalAnswers.vpsUrl || settings.vpsUrl || '').trim(),
      apiToken: (finalAnswers.apiToken || settings.apiToken || '').trim(),
      onboardingDone: true,
    };
    try {
      await postOnboarding(newSettings.vpsUrl, newSettings.apiToken, profile);
    } catch (e) {
      // Don't trap the user in onboarding if the VPS is unreachable right now;
      // they can redo setup from settings once it's up.
      setError(`Couldn't reach the VPS (${e.message}) — continuing anyway. You can redo setup in settings.`);
    }
    onDone(newSettings);
  };

  const toggleMulti = (option) =>
    setMultiValue((current) =>
      current.includes(option) ? current.filter((o) => o !== option) : [...current, option]
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📻 Setup</Text>
      <ScrollView ref={scrollRef} style={styles.chat}>
        {chat.map((message, i) => (
          <View key={i} style={[styles.bubble, message.from === 'me' ? styles.bubbleMe : styles.bubbleBot]}>
            <Text style={styles.bubbleText}>{message.text}</Text>
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.inputArea}>
        {step.type === 'text' && (
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={textValue}
              onChangeText={setTextValue}
              placeholder={step.placeholder}
              placeholderTextColor="#484f58"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.send}
              onPress={() => submit(textValue.trim(), textValue.trim() || '(skipped)')}
            >
              <Text style={styles.sendText}>➤</Text>
            </TouchableOpacity>
          </View>
        )}

        {(step.type === 'multi' || step.type === 'single') && (
          <>
            <View style={styles.chips}>
              {step.options.map((option) => {
                const selected =
                  step.type === 'multi' ? multiValue.includes(option) : false;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, selected && styles.chipOn]}
                    onPress={() =>
                      step.type === 'single'
                        ? submit(option, option)
                        : toggleMulti(option)
                    }
                  >
                    <Text style={styles.chipText}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {step.type === 'multi' && (
              <TouchableOpacity
                style={styles.send2}
                onPress={() => {
                  if (!multiValue.length && !step.allowEmpty) return;
                  submit(multiValue, multiValue.join(', ') || 'none');
                }}
              >
                <Text style={styles.sendText}>
                  {multiValue.length ? `Done (${multiValue.length} picked)` : step.allowEmpty ? 'None — done' : 'Pick at least one'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {step.type === 'slider' && (
          <>
            <Text style={styles.sliderLabel}>{Math.round(sliderValue)} minutes</Text>
            <Slider
              minimumValue={step.min}
              maximumValue={step.max}
              step={5}
              value={sliderValue}
              onValueChange={setSliderValue}
              minimumTrackTintColor="#7fd4ff"
              maximumTrackTintColor="#333"
              thumbTintColor="#7fd4ff"
            />
            <TouchableOpacity
              style={styles.send2}
              onPress={() => submit(Math.round(sliderValue), `${Math.round(sliderValue)} minutes`)}
            >
              <Text style={styles.sendText}>Done</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingTop: 48, paddingHorizontal: 16 },
  title: { color: '#e6edf3', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  chat: { flex: 1 },
  bubble: { borderRadius: 14, padding: 12, marginVertical: 5, maxWidth: '85%' },
  bubbleBot: { backgroundColor: '#21262d', alignSelf: 'flex-start' },
  bubbleMe: { backgroundColor: '#1f6feb', alignSelf: 'flex-end' },
  bubbleText: { color: '#e6edf3', fontSize: 15, lineHeight: 21 },
  inputArea: { paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#161b22',
    color: '#e6edf3',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  send: { backgroundColor: '#1f6feb', borderRadius: 8, padding: 12, justifyContent: 'center' },
  send2: { backgroundColor: '#1f6feb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 10 },
  sendText: { color: '#fff', fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#21262d',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  chipOn: { backgroundColor: '#1f6feb', borderColor: '#1f6feb' },
  chipText: { color: '#e6edf3' },
  sliderLabel: { color: '#e6edf3', textAlign: 'center', fontSize: 16, marginBottom: 4 },
  error: { color: '#f0883e', marginTop: 8 },
});
