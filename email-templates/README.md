# Correo de Auth · ViaMorelia

Solo se usa **enlace mágico** (y Google, que no envía este HTML).

No hay plantilla de “confirmar cuenta”: el magic link ya autentica al abrir el correo.

## Archivo

| Archivo | Dónde en Supabase | Asunto |
|---------|-------------------|--------|
| `magic-link.html` | Authentication → Email Templates → **Magic Link** | `Tu enlace para entrar a ViaMorelia` |

## Supabase (recomendado)

**Authentication → Providers → Email**

- Enable Email: **ON**
- **Confirm email**: **OFF** (no hace falta con magic link)
- Google: **ON** (no usa plantilla HTML de confirmación)

**Email Templates**

- Configura solo **Magic Link**
- Las demás (Confirm signup, Invite, etc.) puedes dejarlas por defecto o ignorarlas

## Logos

- `https://viamorelia.org/brand/icono.png`
- `https://viamorelia.org/brand/nombre.png`

## Variable principal

- `{{ .ConfirmationURL }}` — enlace del magic link
