import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.playnx.evolve',
  appName: 'Evolve',
  webDir: 'dist',
  backgroundColor: '#060c12',
  // keep the app clear of the status bar and gesture bar on Android 15+
  android: { adjustMarginsForEdgeToEdge: 'auto' },
}

export default config
