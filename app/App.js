import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { loadSettings, saveSettings } from './src/settings';
import MainScreen from './src/screens/MainScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

export default function App() {
  const [settings, setSettings] = useState(null);
  const [screen, setScreen] = useState('main'); // main | settings | onboarding
  const [testEpisode, setTestEpisode] = useState(null);

  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      if (!loaded.onboardingDone) setScreen('onboarding');
    });
  }, []);

  const updateSettings = async (next) => {
    setSettings(next);
    await saveSettings(next);
  };

  if (!settings) return <View style={{ flex: 1, backgroundColor: '#0d1117' }} />;

  return (
    <View style={{ flex: 1, backgroundColor: '#0d1117' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />
      {screen === 'onboarding' && (
        <OnboardingScreen
          settings={settings}
          onDone={async (next) => {
            await updateSettings(next);
            setScreen('main');
          }}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onSave={updateSettings}
          onBack={() => setScreen('main')}
          onRedoOnboarding={() => setScreen('onboarding')}
          onTestEpisode={(episode) => {
            setTestEpisode(episode);
            setScreen('main');
          }}
        />
      )}
      {screen === 'main' && (
        <MainScreen
          settings={settings}
          onOpenSettings={() => setScreen('settings')}
          testEpisode={testEpisode}
          onTestEpisodeUsed={() => setTestEpisode(null)}
        />
      )}
    </View>
  );
}
