import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/theme/via_theme.dart';

enum ViaToastKind { info, success, warn, error, offline, gps, pin }

/// Toasts flotantes animados (estilo “atrapa la mirada”).
class ViaToast {
  ViaToast._();

  static OverlayEntry? _entry;
  static Timer? _timer;
  static int _seq = 0;

  static void show(
    BuildContext context, {
    required String message,
    ViaToastKind kind = ViaToastKind.info,
    Duration duration = const Duration(milliseconds: 3200),
    String? title,
  }) {
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;

    _timer?.cancel();
    _entry?.remove();
    _entry = null;

    final id = ++_seq;
    final top = MediaQuery.paddingOf(context).top + 12;

    _entry = OverlayEntry(
      builder: (ctx) {
        return Positioned(
          top: top,
          left: 14,
          right: 14,
          child: IgnorePointer(
            ignoring: false,
            child: Material(
              color: Colors.transparent,
              child: _ViaToastCard(
                message: message,
                title: title,
                kind: kind,
                onDismiss: () => dismiss(id: id),
              )
                  .animate()
                  .fadeIn(duration: 220.ms, curve: Curves.easeOut)
                  .slideY(begin: -0.35, end: 0, duration: 380.ms, curve: Curves.easeOutBack)
                  .scale(
                    begin: const Offset(0.94, 0.94),
                    end: const Offset(1, 1),
                    duration: 320.ms,
                    curve: Curves.easeOutCubic,
                  ),
            ),
          ),
        );
      },
    );

    overlay.insert(_entry!);
    _timer = Timer(duration, () => dismiss(id: id));
  }

  static void dismiss({int? id}) {
    if (id != null && id != _seq) return;
    _timer?.cancel();
    _timer = null;
    _entry?.remove();
    _entry = null;
  }

  static void info(BuildContext c, String m, {String? title}) =>
      show(c, message: m, title: title, kind: ViaToastKind.info);

  static void success(BuildContext c, String m, {String? title}) =>
      show(c, message: m, title: title, kind: ViaToastKind.success);

  static void warn(BuildContext c, String m, {String? title}) =>
      show(c, message: m, title: title, kind: ViaToastKind.warn, duration: const Duration(seconds: 4));

  static void error(BuildContext c, String m, {String? title}) =>
      show(c, message: m, title: title, kind: ViaToastKind.error, duration: const Duration(seconds: 4));
}

class _ViaToastCard extends StatelessWidget {
  final String message;
  final String? title;
  final ViaToastKind kind;
  final VoidCallback onDismiss;

  const _ViaToastCard({
    required this.message,
    required this.kind,
    required this.onDismiss,
    this.title,
  });

  @override
  Widget build(BuildContext context) {
    final meta = _meta(kind);
    return GestureDetector(
      onTap: onDismiss,
      onHorizontalDragEnd: (_) => onDismiss(),
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 12, 10, 12),
        decoration: BoxDecoration(
          color: meta.bg,
          borderRadius: BorderRadius.circular(ViaRadii.lg),
          border: Border.all(color: meta.accent.withValues(alpha: 0.55), width: 1.4),
          boxShadow: [
            BoxShadow(
              color: meta.accent.withValues(alpha: 0.28),
              blurRadius: 22,
              offset: const Offset(0, 10),
            ),
            BoxShadow(
              color: const Color(0xFF142033).withValues(alpha: 0.12),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: meta.accent.withValues(alpha: 0.16),
                shape: BoxShape.circle,
                border: Border.all(color: meta.accent.withValues(alpha: 0.35)),
              ),
              child: Icon(meta.icon, color: meta.accent, size: 20),
            )
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .scale(
                  begin: const Offset(0.94, 0.94),
                  end: const Offset(1.08, 1.08),
                  duration: 900.ms,
                ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title ?? meta.defaultTitle,
                    style: TextStyle(
                      color: meta.accent,
                      fontWeight: FontWeight.w900,
                      fontSize: 12.5,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    message,
                    style: const TextStyle(
                      color: ViaColors.ink,
                      fontWeight: FontWeight.w700,
                      fontSize: 13.5,
                      height: 1.25,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              onPressed: onDismiss,
              icon: const Icon(Icons.close_rounded, size: 18, color: ViaColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  ({Color bg, Color accent, IconData icon, String defaultTitle}) _meta(ViaToastKind k) {
    switch (k) {
      case ViaToastKind.success:
        return (
          bg: const Color(0xFFF2FCFA),
          accent: ViaColors.mint,
          icon: Icons.check_circle_rounded,
          defaultTitle: 'Listo',
        );
      case ViaToastKind.warn:
        return (
          bg: const Color(0xFFFFF9EC),
          accent: ViaColors.amber,
          icon: Icons.warning_amber_rounded,
          defaultTitle: 'Atención',
        );
      case ViaToastKind.error:
        return (
          bg: const Color(0xFFFFF4F2),
          accent: ViaColors.coral,
          icon: Icons.error_outline_rounded,
          defaultTitle: 'Error',
        );
      case ViaToastKind.offline:
        return (
          bg: const Color(0xFFFFF9EC),
          accent: ViaColors.amber,
          icon: Icons.wifi_off_rounded,
          defaultTitle: 'Sin conexión',
        );
      case ViaToastKind.gps:
        return (
          bg: const Color(0xFFEFF8FF),
          accent: ViaColors.sky,
          icon: Icons.my_location_rounded,
          defaultTitle: 'GPS',
        );
      case ViaToastKind.pin:
        return (
          bg: const Color(0xFFF5F3FF),
          accent: ViaColors.violet,
          icon: Icons.push_pin_rounded,
          defaultTitle: 'Mapa',
        );
      case ViaToastKind.info:
        return (
          bg: Colors.white,
          accent: ViaColors.inkSoft,
          icon: Icons.info_rounded,
          defaultTitle: 'Vía Morelia',
        );
    }
  }
}
