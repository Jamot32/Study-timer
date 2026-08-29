import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p'
import StudyTimer from './components/StudyTimer'
import { SafeAreaProvider } from 'react-native-safe-area-context'

export default function App() {
  const [loaded] = useFonts({ PressStart2P_400Regular })
  if (!loaded) return null

  return (
    <SafeAreaProvider>
      <StudyTimer />
    </SafeAreaProvider>
  )
}