# ViaMorelia Mobile — Fase 1 (Android shell)

Shell nativo con **Capacitor 7** que abre la web de producción en un WebView.

- **App ID:** `org.viamorelia.app`
- **Nombre:** ViaMorelia
- **URL por defecto:** `https://viamorelia.org`
- **Play Store:** todavía no (solo build local / emulador / APK debug)

## Requisitos (Windows)

1. **Node 20+** y **pnpm**
2. **JDK 21** — Capacitor 7 / Gradle lo piden. Lo más fácil: el **JBR de Android Studio**:
   `C:\Program Files\Android\Android Studio\jbr`
3. **Android Studio** + Android SDK  
   Ruta típica: `%LOCALAPPDATA%\Android\Sdk`
4. Emulador Android o dispositivo con depuración USB

Variables útiles (PowerShell de sesión):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
```

Build debug por línea de comandos:

```powershell
cd mobile
pnpm sync
cd android
.\gradlew.bat assembleDebug
# APK: android\app\build\outputs\apk\debug\app-debug.apk
```

## Instalación (primera vez)

Desde la **raíz del monorepo** o desde `mobile/`:

```powershell
cd mobile
pnpm install
npx cap add android
npx cap sync android
```

Si `android/` ya existe, solo:

```powershell
pnpm install
pnpm sync
```

## Correr en Android Studio

```powershell
cd mobile
pnpm open
# o: npx cap open android
```

En Android Studio: **Run** ▶ elige emulador o dispositivo.

## Apuntar a staging / local

Por defecto carga producción. Para otra URL:

```powershell
$env:CAPACITOR_SERVER_URL = "https://tu-preview.vercel.app"
# Regenera config efectiva al sync (capacitor.config.ts lee la env al cargar):
npx cap sync android
```

Para probar la web local desde el emulador Android:

```powershell
# Emulador → host machine es 10.0.2.2
$env:CAPACITOR_SERVER_URL = "http://10.0.2.2:3000"
# cleartext: si usas http, en capacitor.config habría que permitir cleartext temporalmente
npx cap sync android
```

En dispositivo físico usa la IP LAN de tu PC (`http://192.168.x.x:3000`).

## Iconos y splash (ViaMorelia)

Regenerar launcher/splash desde `public/brand/icono.png`:

```powershell
cd mobile
pnpm icons
# o: python ./scripts/generate-android-icons.py
```

Luego `pnpm sync` y rebuild del APK / Run en Android Studio.

## Deep links / App Links

La app puede abrir viajes compartidos:

| Tipo | Ejemplo |
|------|---------|
| HTTPS (App Link) | `https://viamorelia.org/?from=-101.19,19.70&to=-101.18,19.71` |
| Custom scheme | `viamorelia://open?from=-101.19,19.70&to=-101.18,19.71` |

- Intent filters en `android/app/src/main/AndroidManifest.xml`
- Verificación de dominio: `public/.well-known/assetlinks.json` (debe estar desplegado en prod)
- Fingerprint actual = **debug keystore** local. Al firmar release, añade el SHA-256 del keystore de producción al JSON.

Comprobar assetlinks tras deploy:

```text
https://viamorelia.org/.well-known/assetlinks.json
```

Probar en dispositivo (con app instalada):

```powershell
adb shell am start -a android.intent.action.VIEW -d "https://viamorelia.org/?from=-101.194,19.702&to=-101.185,19.69"
```

## Qué incluye esta fase

| Nativo | Estado |
|--------|--------|
| WebView → viamorelia.org | Sí |
| Splash / status bar (config) | Sí |
| Dependencias Geolocation / Share | Instaladas (listas para usar desde la web con bridge) |
| App Links (intent + assetlinks debug) | Sí (verificación completa tras deploy + SHA release) |
| Firma release / Play | No aún |

## Qué no va en la app

- Panel admin `/admin`
- Pipeline GIS / Valhalla local
- Subida a Play Store (Fase posterior)

## Scripts

| Comando | Qué hace |
|---------|----------|
| `pnpm sync` | Copia `www` + plugins al proyecto Android |
| `pnpm open` | Abre Android Studio |
| `pnpm doctor` | Diagnóstico Capacitor |
| `pnpm assets:check` | Verifica archivos base |

## Actualizar la app sin recompilar UI

Los cambios de rutas y UI se despliegan en **Vercel**. La app nativa solo hay que reconstruirla cuando cambien:

- `appId` / permisos Android
- plugins nativos
- splash / iconos
- URL base del servidor
