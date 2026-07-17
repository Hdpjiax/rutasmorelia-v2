import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/via_theme.dart';

// ── Welcome-overlay brand palette ───────────────────────────
const Color _petroleum = Color(0xFF005B57);
const Color _petroleumDark = Color(0xFF003F3C);
const Color _dorado = Color(0xFFF5B719);
const Color _carbon = Color(0xFF17302C);

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
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_petroleum, _petroleumDark],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _SkipButton(onPressed: onStart),
                  const Spacer(flex: 2),
                  _LogoSection(),
                  const SizedBox(height: 24),
                  _Tagline(),
                  const SizedBox(height: 8),
                  _Subtitle(),
                  const Spacer(flex: 3),
                  _FeatureCard(
                    icon: Icons.map_rounded,
                    title: 'Origen a destino',
                    subtitle: 'Selecciona tu salida y llegada,\nnosotros planeamos la ruta.',
                    delay: 350.ms,
                  ),
                  const SizedBox(height: 10),
                  _FeatureCard(
                    icon: Icons.alt_route_rounded,
                    title: 'Rutas inteligentes',
                    subtitle: 'Combinaciones eficientes con\ntransbordos y caminata.',
                    delay: 450.ms,
                  ),
                  const SizedBox(height: 10),
                  _FeatureCard(
                    icon: Icons.directions_transit_rounded,
                    title: 'Sin paradas oficiales',
                    subtitle: 'Puntos sugeridos basados en\nel trazo real de cada ruta.',
                    delay: 550.ms,
                  ),
                  const Spacer(flex: 2),
                  _StartButton(onPressed: onStart),
                  const SizedBox(height: 10),
                  _InfoButton(onPressed: onExploreRoutes),
                  if (onRestoreLast != null) ...[
                    const SizedBox(height: 8),
                    _RestoreButton(onPressed: onRestoreLast!),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  Sub-widgets
// ─────────────────────────────────────────────────────────────

class _SkipButton extends StatelessWidget {
  final VoidCallback onPressed;

  const _SkipButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          foregroundColor: Colors.white.withValues(alpha: 0.7),
          textStyle: GoogleFonts.sora(fontWeight: FontWeight.w700, fontSize: 14),
        ),
        child: const Text('Saltar'),
      ),
    ).animate().fadeIn(duration: 200.ms).slideX(begin: 0.05, end: 0, curve: Curves.easeOutCubic);
  }
}

class _LogoSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(
          'assets/brand/icono-sin-fondo.png',
          width: 88,
          height: 88,
          errorBuilder: (_, error, stackTrace) => Container(
            width: 88,
            height: 88,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: _petroleum,
            ),
            child: const Icon(Icons.directions_bus_rounded, size: 44, color: _dorado),
          ),
      )
          .animate()
            .fadeIn(duration: 500.ms, curve: Curves.easeOut)
            .scale(
              begin: const Offset(0.82, 0.82),
              end: const Offset(1, 1),
              duration: 650.ms,
              curve: Curves.easeOutBack,
            ),
        const SizedBox(height: 20),
        Image.asset(
          'assets/brand/nombre-sin-fondo.png',
          height: 36,
          errorBuilder: (_, error, stackTrace) => Text(
            'ViaMorelia',
            style: GoogleFonts.sora(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.6,
            ),
          ),
        )
            .animate()
            .fadeIn(delay: 200.ms, duration: 400.ms, curve: Curves.easeOut)
            .slideY(begin: 0.08, end: 0, duration: 450.ms, curve: Curves.easeOutCubic),
      ],
    );
  }
}

class _Tagline extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Text(
      'Rutas Morelia',
      textAlign: TextAlign.center,
      style: GoogleFonts.sora(
        fontSize: 34,
        fontWeight: FontWeight.w800,
        color: Colors.white,
        letterSpacing: -0.6,
        height: 1.1,
      ),
    )
        .animate()
        .fadeIn(delay: 180.ms, duration: 400.ms, curve: Curves.easeOut)
        .slideY(begin: 0.08, end: 0, duration: 450.ms, curve: Curves.easeOutCubic);
  }
}

class _Subtitle extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Text(
      'Tu transporte, sin paradas oficiales',
      textAlign: TextAlign.center,
      style: GoogleFonts.sora(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        color: Colors.white.withValues(alpha: 0.72),
        height: 1.35,
      ),
    )
        .animate()
        .fadeIn(delay: 280.ms, duration: 400.ms, curve: Curves.easeOut)
        .slideY(begin: 0.08, end: 0, duration: 450.ms, curve: Curves.easeOutCubic);
  }
}

class _FeatureCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Duration delay;

  const _FeatureCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(ViaRadii.md),
        border: Border.all(color: _petroleum.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(ViaRadii.sm),
            ),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.sora(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: Colors.white,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.65),
                    fontSize: 12.5,
                    height: 1.3,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: delay, duration: 350.ms, curve: Curves.easeOut)
        .slideY(
          begin: 0.05,
          end: 0,
          duration: 400.ms,
          curve: Curves.easeOutCubic,
        )
        .scale(begin: const Offset(0.97, 0.97), end: const Offset(1, 1), duration: 400.ms);
  }
}

class _StartButton extends StatelessWidget {
  final VoidCallback onPressed;

  const _StartButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 54,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(ViaRadii.md),
        gradient: const LinearGradient(
          colors: [_dorado, Color(0xFFE6A700)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        boxShadow: [
          BoxShadow(
            color: _dorado.withValues(alpha: 0.45),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(ViaRadii.md),
          splashColor: Colors.white.withValues(alpha: 0.15),
          highlightColor: Colors.transparent,
          child: Center(
            child: Text(
              'Comenzar',
              style: GoogleFonts.sora(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: _carbon,
                letterSpacing: 0.2,
              ),
            ),
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(delay: 680.ms, duration: 400.ms, curve: Curves.easeOut)
        .slideY(begin: 0.12, end: 0, duration: 450.ms, curve: Curves.easeOutCubic);
  }
}

class _InfoButton extends StatelessWidget {
  final VoidCallback onPressed;

  const _InfoButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        side: BorderSide(color: Colors.white.withValues(alpha: 0.45)),
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ViaRadii.md)),
        textStyle: GoogleFonts.sora(fontWeight: FontWeight.w700, fontSize: 15),
      ),
      child: const Text('M\u00e1s informaci\u00f3n'),
    )
        .animate()
        .fadeIn(delay: 760.ms, duration: 400.ms, curve: Curves.easeOut)
        .slideY(begin: 0.12, end: 0, duration: 450.ms, curve: Curves.easeOutCubic);
  }
}

class _RestoreButton extends StatelessWidget {
  final VoidCallback onPressed;

  const _RestoreButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: Colors.white.withValues(alpha: 0.7),
        textStyle: GoogleFonts.sora(fontWeight: FontWeight.w700, fontSize: 14),
      ),
      child: const Text('Continuar \u00faltimo viaje'),
    )
        .animate()
        .fadeIn(delay: 840.ms, duration: 350.ms, curve: Curves.easeOut)
        .slideY(begin: 0.08, end: 0, duration: 350.ms, curve: Curves.easeOutCubic);
  }
}
