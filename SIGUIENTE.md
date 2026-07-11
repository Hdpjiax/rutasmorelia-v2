# Qué sigue — ViaMorelia / Rutas Morelia

Documento vivo del **siguiente paso** después del trabajo reciente (web móvil, shell Android Capacitor, flechas HD, micrófono, bienvenida).

Última actualización: **2026-07-11** (App Links / deep links).

---

## Estado actual (ya hecho)

| Área | Estado |
|------|--------|
| Web Next.js (mapa, planificar, rutas, favoritos locales) | En producción / Vercel |
| Admin QA | Solo web (`/admin`) |
| Shell Android Capacitor (`mobile/`) | Fase 1 lista (APK debug local) |
| Iconos / splash ViaMorelia en Android | Generados desde `public/brand` |
| Micrófono (voz) + permiso Android `RECORD_AUDIO` | Implementado (requiere rebuild APK) |
| Bienvenida centrada sobre el dock | Ajustada (móvil / tablet / escritorio) |
| Flechas de ruta y calle nítidas al zoom | Bitmap HD + tamaño estable |
| GPS en vivo (punto azul, sin recargar) | Implementado |
| **Deep links / App Links** | Implementado (deploy + rebuild APK) |
| Play Store / App Store | **Aún no** (explícito: después) |

Guía móvil: `mobile/README.md`.

---

## Prioridad inmediata (cerrar Fase 1 en dispositivo)

1. **Rebuild e instalar APK** con permisos de mic + iconos actuales  
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   cd mobile
   pnpm sync
   cd android
   .\gradlew.bat assembleDebug
   # APK: android\app\build\outputs\apk\debug\app-debug.apk
   ```
2. **Checklist de prueba en teléfono/tablet**
   - [ ] Abre y carga `viamorelia.org`
   - [ ] GPS / “Usar mi ubicación”
   - [ ] Planificar origen → destino → ver en mapa
   - [ ] Micrófono: pide permiso y escribe en origen/destino
   - [ ] Bienvenida centrada encima del dock (si no sale: borrar `sessionStorage` `vm-welcome-seen`)
   - [ ] Zoom en rutas: flechas nítidas, no enormes
   - [ ] Compartir / copiar enlace de viaje
3. Corregir solo bugs bloqueantes de esa lista.

---

## Siguiente bloque de producto (sin tiendas)

Orden sugerido:

### 1. Deep links / App Links (Android) — HECHO en código
- [x] Intent filters HTTPS + esquema `viamorelia://`
- [x] `public/.well-known/assetlinks.json` (SHA **debug**)
- [x] Bridge web + hidratar viaje sin recargar
- [ ] **Deploy** a Vercel para que assetlinks sea público
- [ ] **Rebuild APK** e instalar
- [ ] Probar con `adb shell am start -d "https://viamorelia.org/?from=…&to=…"`
- [ ] Al firmar release: añadir SHA-256 del keystore de prod al JSON

### 2. PWA / offline del catálogo ← **siguiente bloque de código**
- Service worker + cache de `public/routes/*` e `index.json`.
- Mensaje claro offline (ya hay banner parcial).
- Iconos PWA 192/512 coherentes con marca.

### 3. Legal mínimo (antes de cualquier tienda)
- Página de **política de privacidad** (GPS, micrófono, telemetría, sin cuentas de pasajero).
- Términos de uso breves.
- Enlaces en la app/web (footer o ajustes).

### 4. Hardening app (Fase 2 ligera)
- Splash / status bar revisados en dispositivos reales.
- Staging URL vía `CAPACITOR_SERVER_URL`.
- (Opcional) flavors debug/prod.
- Telemetría de opens/crashes si se quiere métrica.

---

## Cuando digas “sí a tiendas”

### Google Play (Android)
1. Cuenta de desarrollador.
2. Keystore de release + AAB firmado.
3. Ficha (es-MX), capturas, feature graphic.
4. Data safety (ubicación, micrófono).
5. Testing interno → cerrada → producción.

### Apple (iOS) — después de Android estable
1. Mismo Capacitor: `npx cap add ios`.
2. Cuenta Apple Developer + textos de privacidad (ubicación, mic).
3. TestFlight → App Store.
4. Universal Links.

---

## Más adelante (solo si hace falta)

- App nativa “de verdad” (Expo + MapLibre RN) si WebView se queda corto.
- Notificaciones push / seguimiento en background (no en v1).
- Cuentas de usuario (hoy favoritos son **solo local**).

---

## Qué no reabrir sin motivo

- Valhalla/OSRM en producción (siguen **solo locales** para realinear trazos).
- Google Maps / Mapbox / Directions propietarios.
- Paradas oficiales como base del sistema.
- Cuentas de pasajero obligatorias.
- Subir a Play “ya” sin checklist de prueba y legal.

---

## Comandos útiles (raíz)

```powershell
pnpm dev                 # web local
pnpm mobile:sync         # sync Capacitor → Android
pnpm mobile:open         # Android Studio
cd mobile; pnpm icons    # regenerar iconos Android desde brand
```

---

## Definición de “listo para el siguiente hito”

**Hito A — App usable en casa (sin store)**  
APK debug en 2–3 dispositivos; flujos viaje + GPS + voz estables; sin crash al abrir.

**Hito B — Listo para Play (cuando se decida)**  
Hito A + deep links + privacidad publicada + AAB firmado + ficha en borrador.

---

*Si se cambia el orden de trabajo, actualizar este archivo en la misma PR o al final de la sesión.*
