import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../state/app_controller.dart';
import '../micro/via_panel.dart';

class LegalPanel extends ConsumerWidget {
  const LegalPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tab = ref.watch(appControllerProvider.select((s) => s.legalTab));
    final ctrl = ref.read(appControllerProvider.notifier);

    return ViaSheetScaffold(
      title: 'Avisos legales',
      subtitle: 'Última actualización: 11 de julio de 2026',
      onClose: () => ctrl.setPanel(AppPanel.none),
      maxHeightFactor: 0.88,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                ViaChip(
                  label: 'Privacidad',
                  selected: tab == LegalTab.privacy,
                  onTap: () => ctrl.setLegalTab(LegalTab.privacy),
                ),
                const SizedBox(width: 8),
                ViaChip(
                  label: 'Términos',
                  selected: tab == LegalTab.terms,
                  onTap: () => ctrl.setLegalTab(LegalTab.terms),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
              child: tab == LegalTab.privacy
                  ? _PrivacyBody(onOpenTerms: () => ctrl.setLegalTab(LegalTab.terms))
                  : _TermsBody(onOpenPrivacy: () => ctrl.setLegalTab(LegalTab.privacy)),
            ),
          ),
        ],
      ),
    );
  }
}

class _PrivacyBody extends StatelessWidget {
  final VoidCallback onOpenTerms;
  const _PrivacyBody({required this.onOpenTerms});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Política de privacidad',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        const Text(
          'ViaMorelia es una aplicación web y móvil para consultar y planificar viajes en el '
          'transporte público de Morelia (origen → destino). Esta política describe qué datos se usan y con qué fin.',
          style: TextStyle(color: ViaColors.textSecondary, height: 1.45),
        ),
        const _H('1. Resumen'),
        const _Bullet('No pedimos cuenta de pasajero para usar el mapa y planificar viajes.'),
        const _Bullet('Favoritos y recientes se guardan solo en tu dispositivo.'),
        const _Bullet('GPS y micrófono solo se usan si tú los activas.'),
        const _Bullet('Puede enviarse telemetría anónima de uso (sin nombre ni email).'),
        const _H('2. Responsable'),
        const _P(
          'El servicio se ofrece bajo la marca ViaMorelia, orientado a usuarios en Morelia, Michoacán, México. '
          'Sitio principal: viamorelia.org.',
        ),
        const _H('3. Datos que tratamos'),
        const _P(
          'En tu dispositivo: favoritos, recientes, último viaje, preferencias de UI y caché de GeoJSON. '
          'Estos datos no se suben a una cuenta de usuario.',
        ),
        const _P(
          'GPS: solo con permiso, para “mi ubicación”, centrar el mapa y “Seguir mi viaje”. '
          'No hacemos seguimiento permanente en segundo plano fuera de esa función en pantalla.',
        ),
        const _P(
          'Micrófono: solo si usas dictado. El audio se procesa en el dispositivo; no almacenamos grabaciones en servidores.',
        ),
        const _P(
          'Búsquedas: el texto puede enviarse a /api/geocode (proxy Nominatim) y caminatas a /api/walk-route (OSRM).',
        ),
        const _H('4. Telemetría'),
        const _P(
          'Eventos anónimos (abrir app, planificar, offline, errores) vía POST /api/telemetry. Sin PII.',
        ),
        const _H('5. Términos'),
        TextButton(
          onPressed: onOpenTerms,
          child: const Text('Ver términos de uso', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    );
  }
}

class _TermsBody extends StatelessWidget {
  final VoidCallback onOpenPrivacy;
  const _TermsBody({required this.onOpenPrivacy});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Términos de uso',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        const _P(
          'Al usar ViaMorelia (web en viamorelia.org o la aplicación móvil) aceptas estos términos. '
          'Si no estás de acuerdo, no uses el servicio.',
        ),
        const _H('1. Qué es ViaMorelia'),
        const _P(
          'Herramienta informativa para consultar corredores de transporte público en Morelia y planificar '
          'viajes por origen y destino. No vendemos boletos, no operamos combis ni autobuses, y no garantizamos '
          'horarios en tiempo real de las unidades.',
        ),
        const _H('2. Uso permitido'),
        const _Bullet('Consultar rutas y planificar trayectos de forma personal o informativa.'),
        const _Bullet('Compartir enlaces de viaje generados por la app.'),
        const _Bullet('Reportar errores de trazos cuando la función esté disponible.'),
        const _P(
          'No está permitido abusar de las APIs, saturar el servicio, extraer datos masivamente sin autorización, '
          'ni usar la app para actividades ilícitas.',
        ),
        const _H('3. Puntos de subida y bajada'),
        const _P(
          'Los puntos de subida, bajada y transbordo son sugeridos (aproximados). '
          'No son paradas oficiales. Debes confirmar en la calle cómo se detiene el servicio y priorizar tu seguridad.',
        ),
        const _H('4. Exactitud del mapa'),
        const _P(
          'Los trazos se basan en datos procesados y validados con herramientas GIS, pero pueden contener errores, '
          'desfases o rutas en revisión. El basemap y el geocoding dependen de terceros y de la red. '
          'ViaMorelia se ofrece “tal cual”.',
        ),
        const _H('5. GPS y micrófono'),
        const _P(
          'Funciones opcionales. El seguimiento de viaje es una ayuda aproximada: no sustituye la atención al entorno. '
          'La voz solo rellena campos de búsqueda.',
        ),
        const _H('6. Privacidad'),
        TextButton(
          onPressed: onOpenPrivacy,
          child: const Text('Ver política de privacidad', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
      ],
    );
  }
}

class _H extends StatelessWidget {
  final String text;
  const _H(this.text);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 8),
      child: Text(text, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
    );
  }
}

class _P extends StatelessWidget {
  final String text;
  const _P(this.text);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: const TextStyle(color: ViaColors.textSecondary, height: 1.45, fontSize: 13.5)),
    );
  }
}

class _Bullet extends StatelessWidget {
  final String text;
  const _Bullet(this.text);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6, left: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('•  ', style: TextStyle(fontWeight: FontWeight.w900)),
          Expanded(
            child: Text(text, style: const TextStyle(color: ViaColors.textSecondary, height: 1.4, fontSize: 13.5)),
          ),
        ],
      ),
    );
  }
}
