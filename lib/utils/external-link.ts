import { Capacitor } from '@capacitor/core';

/**
 * Abre una URL de forma segura en el navegador externo del sistema si la app
 * se ejecuta dentro de un entorno nativo (Capacitor), previniendo que la WebView
 * navegue fuera de la aplicación principal. En web abre una nueva pestaña estándar.
 */
export async function openExternalUrl(url: string) {
  if (typeof window === 'undefined') return;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
    } catch (e) {
      console.error('[Browser] Falló apertura nativa, usando window.open', e);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
