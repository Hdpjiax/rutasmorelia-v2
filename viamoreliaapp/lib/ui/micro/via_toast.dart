import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/theme/via_theme.dart';
import 'via_panel.dart';

// ─────────────────────────────────────────────────────────────
//  ENUMS
// ─────────────────────────────────────────────────────────────

/// Premium toast types for the redesigned toast system.
enum ViaToastType { success, error, info, warning }

/// Legacy toast kind — kept for backward compatibility.
/// Maps to [ViaToastType] for visual styling.
enum ViaToastKind {
  info(ViaToastType.info),
  success(ViaToastType.success),
  warn(ViaToastType.warning),
  error(ViaToastType.error),
  offline(ViaToastType.warning),
  gps(ViaToastType.info),
  pin(ViaToastType.info);

  final ViaToastType type;
  const ViaToastKind(this.type);
}

// ─────────────────────────────────────────────────────────────
//  INTERNAL MODEL
// ─────────────────────────────────────────────────────────────

class _ToastItem {
  final String id;
  final String message;
  final String? title;
  final ViaToastType type;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  _ToastItem({
    required this.id,
    required this.message,
    this.title,
    required this.type,
    required this.icon,
    this.actionLabel,
    this.onAction,
  });
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────

/// Premium floating toast notification system.
///
/// Supports stacked toasts, glassmorphism, animated entrance,
/// action buttons, and four semantic types.
///
/// Usage:
/// ```dart
/// ViaToast.show(context, message: 'Ruta encontrada', type: ViaToastType.success);
/// ViaToast.show(context, message: 'Error de red', type: ViaToastType.error, actionLabel: 'Reintentar', onAction: () => retry());
/// ```
class ViaToast {
  ViaToast._();

  static final GlobalKey<_ViaToastOverlayState> _overlayKey = GlobalKey();
  static OverlayEntry? _entry;
  static int _seq = 0;

  /// Shows a toast notification.
  ///
  /// [type] controls the color scheme and default icon.
  /// [icon] overrides the default icon for the type.
  /// [actionLabel] and [onAction] add a tappable action button (e.g. Undo).
  /// [duration] controls auto-dismiss; defaults to 4 seconds.
  ///
  /// Legacy [kind] and [title] parameters are supported for backward
  /// compatibility.
  static void show(
    BuildContext context, {
    required String message,
    String? actionLabel,
    VoidCallback? onAction,
    Duration duration = const Duration(seconds: 4),
    ViaToastType type = ViaToastType.info,
    IconData? icon,
    // legacy
    ViaToastKind? kind,
    String? title,
  }) {
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;

    final effectiveType = kind?.type ?? type;
    final effectiveIcon = icon ?? _defaultIcon(effectiveType);

    if (_entry == null) {
      _entry = OverlayEntry(
        builder: (_) => _ViaToastOverlay(key: _overlayKey),
      );
      overlay.insert(_entry!);
    }

    Future.microtask(() {
      final state = _overlayKey.currentState;
      if (state == null) return;
      state.addToast(
        _ToastItem(
          id: 'toast_${++_seq}',
          message: message,
          title: title,
          type: effectiveType,
          icon: effectiveIcon,
          actionLabel: actionLabel,
          onAction: onAction,
        ),
        duration,
      );
    });
  }

  /// Dismisses all visible toasts and removes the overlay.
  static void dismiss() {
    _overlayKey.currentState?.removeAll();
    _removeEntry();
  }

  static void _removeEntry() {
    _entry?.remove();
    _entry = null;
  }

  static IconData _defaultIcon(ViaToastType type) {
    switch (type) {
      case ViaToastType.success:
        return Icons.check_circle_outline;
      case ViaToastType.error:
        return Icons.error_outline;
      case ViaToastType.info:
        return Icons.info_outline;
      case ViaToastType.warning:
        return Icons.warning_amber_outlined;
    }
  }

  // ── Convenience shorthands ──

  static void info(BuildContext c, String m, {String? title}) =>
      show(c, message: m, title: title, type: ViaToastType.info);

  static void success(BuildContext c, String m, {String? title}) =>
      show(c, message: m, title: title, type: ViaToastType.success);

  static void warn(BuildContext c, String m, {String? title}) =>
      show(c, message: m, title: title, type: ViaToastType.warning, duration: const Duration(seconds: 4));

  static void error(BuildContext c, String m, {String? title}) =>
      show(c, message: m, title: title, type: ViaToastType.error, duration: const Duration(seconds: 4));
}

// ─────────────────────────────────────────────────────────────
//  OVERLAY — manages stacked toast entries
// ─────────────────────────────────────────────────────────────

class _ViaToastOverlay extends StatefulWidget {
  const _ViaToastOverlay({super.key});

  @override
  State<_ViaToastOverlay> createState() => _ViaToastOverlayState();
}

class _ViaToastOverlayState extends State<_ViaToastOverlay> {
  final List<_ToastItem> _toasts = [];

  void addToast(_ToastItem toast, Duration duration) {
    setState(() => _toasts.add(toast));
    Future.delayed(duration + 400.ms, () {
      if (mounted) removeToast(toast.id);
    });
  }

  void removeToast(String id) {
    if (!mounted) return;
    setState(() => _toasts.removeWhere((t) => t.id == id));
  }

  void removeAll() {
    if (!mounted) return;
    setState(() => _toasts.clear());
  }

  @override
  Widget build(BuildContext context) {
    if (_toasts.isEmpty) return const SizedBox.shrink();

    final topPad = MediaQuery.paddingOf(context).top + 12;

    return Positioned(
      top: topPad,
      left: 14,
      right: 14,
      child: IgnorePointer(
        ignoring: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final toast in _toasts)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _ViaToastCard(
                  toast: toast,
                  onDismiss: () => removeToast(toast.id),
                )
                    .animate()
                    .fadeIn(duration: 220.ms, curve: ViaMotion.easeOut)
                    .slideY(begin: -0.5, end: 0, duration: 450.ms, curve: ViaMotion.bounce)
                    .scale(
                      begin: const Offset(0.92, 0.92),
                      end: const Offset(1, 1),
                      duration: 350.ms,
                      curve: ViaMotion.easeOut,
                    ),
              ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  TOAST CARD — glassmorphism, accent strip, icon, action
// ─────────────────────────────────────────────────────────────

class _ViaToastCard extends StatelessWidget {
  final _ToastItem toast;
  final VoidCallback onDismiss;

  const _ViaToastCard({
    required this.toast,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final meta = _meta(toast.type);

    return GestureDetector(
      onTap: onDismiss,
      onHorizontalDragEnd: (_) => onDismiss(),
      child: ViaGlass.wrap(
        Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Left accent strip ──
                  Container(
                    width: 4.5,
                    decoration: BoxDecoration(
                      color: meta.accent,
                      borderRadius: const BorderRadius.horizontal(
                        left: Radius.circular(ViaRadii.lg),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // ── Icon ──
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Icon(toast.icon, color: meta.accent, size: 24),
                  ),
                  const SizedBox(width: 10),
                  // ── Title + Message ──
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            toast.title ?? meta.defaultTitle,
                            style: TextStyle(
                              color: meta.accent,
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            toast.message,
                            style: const TextStyle(
                              color: ViaColors.ink,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              height: 1.3,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ),
                  // ── Action button ──
                  if (toast.actionLabel != null && toast.onAction != null)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 2),
                        child: Semantics(
                          button: true,
                          child: GestureDetector(
                            onTap: () {
                              toast.onAction?.call();
                              onDismiss();
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: meta.accent.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(ViaRadii.badge),
                                border: Border.all(color: meta.accent.withValues(alpha: 0.25)),
                              ),
                              child: Text(
                                toast.actionLabel!,
                                style: TextStyle(
                                  color: meta.accent,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  // ── Close ──
                  SizedBox(
                    width: 36,
                    child: IconButton(
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                      onPressed: onDismiss,
                      icon: const Icon(Icons.close_rounded, size: 17, color: ViaColors.textMuted),
                    ),
                  ),
                ],
              ),
              radius: ViaRadii.lg,
              blur: 24,
              opacity: 0.78,
              borderColor: meta.border,
              shadows: [
                BoxShadow(
                  color: meta.accent.withValues(alpha: 0.18),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
                BoxShadow(
                  color: const Color(0xFF142033).withValues(alpha: 0.10),
                  blurRadius: 14,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
    );
  }

  ({Color accent, Color border, String defaultTitle}) _meta(ViaToastType type) {
    switch (type) {
      case ViaToastType.success:
        return (
          accent: ViaColors.secondary,
          border: ViaColors.violetSoft.withValues(alpha: 0.7),
          defaultTitle: 'Listo',
        );
      case ViaToastType.error:
        return (
          accent: ViaColors.coral,
          border: ViaColors.coralSoft.withValues(alpha: 0.7),
          defaultTitle: 'Error',
        );
      case ViaToastType.info:
        return (
          accent: ViaColors.primary,
          border: ViaColors.mintSoft.withValues(alpha: 0.7),
          defaultTitle: 'Vía Morelia',
        );
      case ViaToastType.warning:
        return (
          accent: ViaColors.amber,
          border: ViaColors.amberSoft.withValues(alpha: 0.7),
          defaultTitle: 'Atención',
        );
    }
  }
}
