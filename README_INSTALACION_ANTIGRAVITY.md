# Instalación en Google Antigravity — Rutas Morelia

Este paquete está preparado para Antigravity, no para Gemini CLI.

## 1. Descomprimir en el proyecto

En PowerShell, entra al proyecto:

```powershell
cd C:\ruta\a\tu\proyecto\rutas-morelia
```

Descomprime el ZIP en la raíz del repo:

```powershell
Expand-Archive C:\ruta\a\descargas\rutas_morelia_antigravity_skills.zip -DestinationPath . -Force
```

La estructura debe quedar así:

```txt
rutas-morelia/
  AGENTS.md
  prompt_completo_antigravity_rutas_morelia.md
  .agents/
    skills/
      rutas-morelia-gis/
        SKILL.md
      rutas-morelia-map-ui/
        SKILL.md
      rutas-morelia-ingesta-qa/
        SKILL.md
  templates/
    .env.local.example
    .env-valhalla.example
  references/
    map_replication_guide.md
    rutamarilla_reference.png
```

## 2. Abrir proyecto en Antigravity

Abre Google Antigravity y selecciona la carpeta del proyecto `rutas-morelia`.

Antigravity puede usar instrucciones de workspace como `AGENTS.md` y skills de workspace dentro de `.agents/skills/<skill>/SKILL.md`.

## 3. Verificar skills

En el chat del Agent escribe:

```txt
¿Qué skills tienes disponibles en este workspace?
```

Debe mencionar:

- `rutas-morelia-gis`
- `rutas-morelia-map-ui`
- `rutas-morelia-ingesta-qa`

Si no aparecen, cierra y abre Antigravity, o confirma que la ruta sea `.agents/skills`, no `.gemini/skills`.

## 4. Configurar Supabase

Copia el template:

```powershell
copy .\templates\.env.local.example .\.env.local
notepad .env.local
```

Pega tu `anon_public` en `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Nunca pegues `service_role` en frontend, GitHub o variables `NEXT_PUBLIC`.

## 5. Instalar ui-ux-pro-max-skill junto con este paquete

```powershell
mkdir external
 git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git .\external\ui-ux-pro-max-skill
```

Luego dile al agente que lo use como referencia de UI/UX sin romper las reglas GIS.

## 6. Prompt para arrancar en Antigravity

Pega esto en el Agent:

```txt
Lee AGENTS.md, prompt_completo_antigravity_rutas_morelia.md y las skills dentro de .agents/skills.
Usa también external/ui-ux-pro-max-skill si existe.

Empieza por Fase 1.

Antes de modificar archivos:
1. inspecciona el repo,
2. detecta herramientas faltantes,
3. dime qué falta instalar,
4. dame comandos exactos para Windows PowerShell y WSL2,
5. configura el proyecto,
6. ejecuta validaciones.

Reglas obligatorias:
- Supabase será Cloud.
- Deploy será Vercel.
- No usar Google Maps, Google Directions ni Mapbox.
- El mapa debe usar estilo blanco Carto Positron.
- Las rutas deben verse con línea de color, casing oscuro, flechas sobre línea y etiquetas Ida/Vuelta.
- Cada ruta debe tener únicamente dos sentidos: ida y vuelta.
- No usar paradas oficiales.
- No inventar trazos.
- Todo trazo debe apegarse 100% al eje vial real.
- Extrae KML/PDF/PNG/layers desde la carpeta configurada en .env-valhalla.
- Convierte a GeoJSON solo si hay georreferencia válida.
- Valida con QGIS/GDAL/Valhalla/OSRM/OSM local.
- Rutas dudosas deben quedar needs_review o rejected.
```
