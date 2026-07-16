import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/theme/via_theme.dart';

class WelcomeOverlay extends StatelessWidget {
  final VoidCallback onStart;
  final VoidCallback onExploreRoutes;
  final VoidCallback onLegal;
  final VoidCallback? onRestoreLast;

  const WelcomeOverlay({
    super.key,
    required this.onStart,
    required this.onExploreRoutes,
    required this.onLegal,
    this.onRestoreLast,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: ViaColors.paper.withValues(alpha: 0.97),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: onStart,
                  child: const Text('Saltar', style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
              const Spacer(),
              Center(
                child: Image.asset(
                  'assets/brand/icono-sin-fondo.png',
                  width: 96,
                  height: 96,
                  errorBuilder: (_, _, _) => Container(
                    width: 96,
                    height: 96,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(colors: [ViaColors.mint, ViaColors.coral]),
                    ),
                    child: const Icon(Icons.route_rounded, size: 44, color: Colors.white),
                  ),
                )
                    .animate(onPlay: (c) => c.repeat(reverse: true))
                    .scale(
                      begin: const Offset(0.97, 0.97),
                      end: const Offset(1.04, 1.04),
                      duration: 1500.ms,
                    ),
              ),
              const SizedBox(height: 16),
              Center(
                child: Image.asset(
                  'assets/brand/nombre-sin-fondo.png',
                  height: 36,
                  errorBuilder: (_, _, _) => Text(
                    'Vía Morelia',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Planifica combis y camiones por origen y destino.\nPuntos sugeridos — nunca paradas oficiales.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: ViaColors.textSecondary,
                  fontSize: 15,
                  height: 1.4,
                  fontWeight: FontWeight.w500,
                ),
              ).animate().fadeIn(delay: 100.ms),
              const SizedBox(height: 28),
              _tile(Icons.alt_route_rounded, 'Directos y transbordos',
                  'Opciones ordenadas por tiempo, caminata o cambios.', ViaColors.mint),
              const SizedBox(height: 10),
              _tile(Icons.directions_walk_rounded, 'Caminata por calles',
                  'OSRM vía API web · no líneas inventadas.', ViaColors.sky),
              const SizedBox(height: 10),
              _tile(Icons.my_location_rounded, 'GPS y seguimiento',
                  'Tu posición al entrar y “seguir mi viaje”.', ViaColors.coral),
              const Spacer(),
              FilledButton(onPressed: onStart, child: const Text('Empezar a viajar')),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onExploreRoutes,
                      child: const Text('Ver rutas'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onLegal,
                      child: const Text('Legal'),
                    ),
                  ),
                ],
              ),
              if (onRestoreLast != null) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: onRestoreLast,
                  child: const Text('Continuar último viaje',
                      style: TextStyle(fontWeight: FontWeight.w800)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _tile(IconData icon, String title, String body, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ViaColors.paperElevated,
        borderRadius: BorderRadius.circular(ViaRadii.md),
        border: Border.all(color: ViaColors.hairline),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF142033).withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
                const SizedBox(height: 2),
                Text(body,
                    style: const TextStyle(
                        color: ViaColors.textSecondary, fontSize: 12.5, height: 1.3)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
