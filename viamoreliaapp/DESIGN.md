# Vía Morelia App — Design System (Flutter)

## Aesthetic: Horizon Paper + MapLibre

Chrome de UI **claro** (papel) sobre mapa **MapLibre + Carto Positron GL** (paridad web).

### Color

| Token | Hex | Uso |
|-------|-----|-----|
| ink | `#070B14` | Fondo chrome |
| inkElevated | `#10182A` | Paneles |
| mint | `#2DD4BF` | Primary / brand |
| coral | `#FF6B4A` | Destino / accent |
| sky | `#38BDF8` | Origen |
| violet | `#A78BFA` | Transbordo |
| amber | `#FBBF24` | Sube / avisos |

### Typography

- Display: **Syne** (google_fonts)
- Body: **DM Sans**

### Layout

- Mapa full-bleed
- Logo + nombre **izquierda**
- Barras origen/destino **derecha** (colapsables)
- Dock inferior: Viaje · Rutas · Favoritos · Legal
- Paneles tipo sheet oscuros que se cierran al elegir ruta

### Motion

- Orbes origen/destino con pulso
- Flechas animadas a lo largo de la polyline (ida/vuelta)
- Welcome full-screen con stagger
- Panel auto-cierre al seleccionar plan

### Map rules (parity web)

- Casing oscuro + color de ruta
- Flechas de sentido animadas
- Labels Ida/Vuelta en explorador
- Walk OSRM dashed (to_board / from_alight / transfer)
- Sube/Baja virtuales (nunca “parada oficial”)
