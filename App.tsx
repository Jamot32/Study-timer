import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Dashboard from './components/Dashboard';
import StudyTimer from './components/StudyTimer';
import Settings from './components/Settings';
import ProfileEdit from './components/ProfileEdit';
import Login from './components/Login';
import Loading from './components/Loading';
import { clearProfile, loadProfile, saveProfile, type Profile } from './lib/profile';
import { googleSheetAuth, type AuthSession } from './lib/auth';
import { T } from './components/pixel';

type Screen = 'timer' | 'dashboard' | 'settings' | 'profile';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular });
  const [screen, setScreen] = useState<Screen>('timer');
  const [refreshKey, setRefreshKey] = useState(0);
  // undefined = still checking storage, null = no local profile yet
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    void Promise.all([loadProfile(), googleSheetAuth.restoreSession()]).then(
      async ([storedProfile, restoredSession]) => {
        setAuthSession(restoredSession);
        if (storedProfile) {
          setProfile(storedProfile);
        } else if (restoredSession) {
          setProfile(
            await saveProfile({
              name: restoredSession.user.displayName,
              avatar: restoredSession.user.avatar,
            })
          );
        } else {
          setProfile(null);
        }
      }
    );
  }, []);

  // after every hook — an early return above them breaks hook order on load.
  // fontError falls through to the system font rather than hanging on a blank screen.
  if ((!fontsLoaded && !fontError) || profile === undefined) return <Loading />;

  const backToTimer = () => setScreen('timer');

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {!profile && (
          <Login
            onLoggedIn={(nextProfile, session) => {
              setProfile(nextProfile);
              setAuthSession(session);
            }}
          />
        )}

        {/* The timer stays mounted while stats/config are open — unmounting it
            would throw away the running session. */}
        {profile && (
          // the timer frame is taller than the viewport on short devices
          <ScrollView
            style={screen === 'timer' ? styles.visible : styles.hidden}
            contentContainerStyle={styles.timerScroll}
            showsVerticalScrollIndicator={false}
          >
            <StudyTimer
              onFinished={() => setRefreshKey((k) => k + 1)}
              onOpenStats={() => setScreen('dashboard')}
              onOpenSettings={() => setScreen('settings')}
              onOpenProfile={() => setScreen('profile')}
              profile={profile}
            />
          </ScrollView>
        )}

        {profile && screen === 'dashboard' && (
          <View style={styles.page}>
            <Dashboard refreshKey={refreshKey} onBack={backToTimer} />
          </View>
        )}

        {profile && screen === 'settings' && (
          <View style={styles.page}>
            <Settings
              onChanged={() => setRefreshKey((k) => k + 1)}
              onBack={backToTimer}
              profile={profile}
              authSession={authSession}
              onEditProfile={() => setScreen('profile')}
              onSignOut={async () => {
                await googleSheetAuth.signOut();
                await clearProfile();
                setAuthSession(null);
                setProfile(null);
                setScreen('timer');
              }}
            />
          </View>
        )}
        {profile && screen === 'profile' && (
          <View style={styles.page}>
            <ProfileEdit
              profile={profile}
              onProfileChanged={setProfile}
              onBack={() => setScreen('settings')}
            />
          </View>
        )}
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: T.bg,
  },
  page: { flex: 1, width: '100%', maxWidth: 512, marginHorizontal: 'auto' },
  visible: { flex: 1 },
  hidden: { display: 'none' },
  timerScroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: 16 },
});
