import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'twitter-radio-settings';

export const defaultSettings = {
  vpsUrl: '',
  apiToken: '',
  bleDeviceName: 'TwitterRadioRemote',
  onboardingDone: false,
};

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return { ...defaultSettings, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...defaultSettings };
  }
}

export async function saveSettings(settings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}
