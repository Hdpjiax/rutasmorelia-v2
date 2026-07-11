import type { CapacitorConfig } from '@capacitor/cli';

/**
 * ViaMorelia — shell nativo (Fase 1).
 *
 * La WebView carga la web de producción/staging.
 * No hace falta empaquetar el build de Next en cada release de app:
 * los cambios de rutas/UI se despliegan en Vercel y la app los ve al abrir.
 *
 * Play Store: más adelante (Fase 2+). Por ahora solo build local / emulador.
 */
const APP_SERVER_URL =
  process.env.CAPACITOR_SERVER_URL?.trim() || 'https://viamorelia.org';

const config: CapacitorConfig = {
  appId: 'org.viamorelia.app',
  appName: 'ViaMorelia',
  webDir: 'www',
  android: {
    allowMixedContent: false,
    backgroundColor: '#f8fafc',
  },
  server: {
    // Carga remota: la app es un contenedor nativo alrededor de la web.
    url: APP_SERVER_URL,
    // Solo el origen de la app (y assets de mapa Carto/OSM vía la web).
    allowNavigation: [
      'viamorelia.org',
      '*.viamorelia.org',
      'localhost',
      '127.0.0.1',
    ],
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#f8fafc',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#f8fafc',
    },
  },
};

export default config;
