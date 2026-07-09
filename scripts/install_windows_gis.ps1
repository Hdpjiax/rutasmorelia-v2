<#
Instalador guiado para GIS local en Windows.
Ejecutar en PowerShell como usuario normal. Algunos pasos abrirán instaladores.
No instala Valhalla nativo; prepara WSL2 para Valhalla/OSRM cuando se requiera.
#>
$ErrorActionPreference = "Stop"

Write-Host "== Verificando winget =="
winget --version

Write-Host "== Instalando herramientas base =="
winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
winget install --id Python.Python.3.12 -e --accept-package-agreements --accept-source-agreements
winget install --id Microsoft.VisualStudioCode -e --accept-package-agreements --accept-source-agreements
winget install --id QGIS.QGIS.LTR -e --accept-package-agreements --accept-source-agreements

Write-Host "== Activando Corepack/pnpm =="
corepack enable
corepack prepare pnpm@latest --activate

Write-Host "== Instalando WSL2/Ubuntu para Valhalla/OSRM si no existe =="
wsl --install -d Ubuntu

Write-Host "Reinicia si Windows lo pide. Luego abre Ubuntu y ejecuta scripts/wsl_setup_routing.sh."
