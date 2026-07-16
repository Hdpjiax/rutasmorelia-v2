import 'package:flutter/material.dart';
import '../../core/theme/via_theme.dart';

class ViaPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color? color;
  final Border? border;

  const ViaPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.radius = ViaRadii.lg,
    this.color,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? ViaColors.paperElevated.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(radius),
        border: border ?? Border.all(color: ViaColors.hairline),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF142033).withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// Panel inferior con handle: deslizar hacia abajo cierra (onClose).
class ViaSheetScaffold extends StatefulWidget {
  final String title;
  final String? subtitle;
  final Widget child;
  final List<Widget>? actions;
  final VoidCallback? onClose;
  final double maxHeightFactor;

  const ViaSheetScaffold({
    super.key,
    required this.title,
    this.subtitle,
    required this.child,
    this.actions,
    this.onClose,
    this.maxHeightFactor = 0.72,
  });

  @override
  State<ViaSheetScaffold> createState() => _ViaSheetScaffoldState();
}

class _ViaSheetScaffoldState extends State<ViaSheetScaffold> {
  double _dragOffset = 0;

  void _onDragUpdate(DragUpdateDetails d) {
    if (widget.onClose == null) return;
    setState(() {
      _dragOffset = (_dragOffset + d.delta.dy).clamp(0.0, 420.0);
    });
  }

  void _onDragEnd(DragEndDetails d) {
    if (widget.onClose == null) return;
    final vy = d.primaryVelocity ?? 0;
    if (_dragOffset > 90 || vy > 700) {
      widget.onClose!();
      return;
    }
    setState(() => _dragOffset = 0);
  }

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.sizeOf(context).height * widget.maxHeightFactor;
    return Align(
      alignment: Alignment.bottomCenter,
      child: Transform.translate(
        offset: Offset(0, _dragOffset),
        child: Opacity(
          opacity: (1 - (_dragOffset / 320)).clamp(0.35, 1.0),
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: h),
            child: ViaPanel(
              radius: ViaRadii.xl,
              padding: EdgeInsets.zero,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Handle zone (swipe down)
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onVerticalDragUpdate: _onDragUpdate,
                    onVerticalDragEnd: _onDragEnd,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(0, 10, 0, 4),
                      child: Column(
                        children: [
                          Container(
                            width: 42,
                            height: 4,
                            decoration: BoxDecoration(
                              color: ViaColors.hairlineStrong,
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.onClose != null ? 'Desliza para cerrar' : '',
                            style: const TextStyle(
                              fontSize: 10,
                              color: ViaColors.textMuted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 6, 8, 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.title,
                                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                      color: ViaColors.textPrimary,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                              if (widget.subtitle != null) ...[
                                const SizedBox(height: 2),
                                Text(
                                  widget.subtitle!,
                                  style: const TextStyle(
                                    color: ViaColors.textSecondary,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        ...?widget.actions,
                        if (widget.onClose != null)
                          IconButton(
                            onPressed: widget.onClose,
                            icon: const Icon(Icons.close_rounded, color: ViaColors.textSecondary),
                          ),
                      ],
                    ),
                  ),
                  Flexible(child: widget.child),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ViaChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final Color? selectedColor;
  final IconData? icon;

  const ViaChip({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
    this.selectedColor,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final accent = selectedColor ?? ViaColors.mint;
    return Material(
      color: selected ? accent.withValues(alpha: 0.12) : ViaColors.paperTint,
      borderRadius: BorderRadius.circular(ViaRadii.pill),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ViaRadii.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(ViaRadii.pill),
            border: Border.all(
              color: selected ? accent.withValues(alpha: 0.55) : ViaColors.hairline,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 14, color: selected ? accent : ViaColors.textSecondary),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  color: selected ? accent : ViaColors.textSecondary,
                  fontWeight: FontWeight.w700,
                  fontSize: 12.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ViaRoundIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;
  final Color? color;
  final Color? background;
  final double size;

  const ViaRoundIconButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.tooltip,
    this.color,
    this.background,
    this.size = 44,
  });

  @override
  Widget build(BuildContext context) {
    final btn = Material(
      color: background ?? ViaColors.paperElevated.withValues(alpha: 0.96),
      shape: const CircleBorder(),
      elevation: 0,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: ViaColors.hairline),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF142033).withValues(alpha: 0.06),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Icon(icon, color: color ?? ViaColors.ink, size: size * 0.45),
        ),
      ),
    );
    if (tooltip == null) return btn;
    return Tooltip(message: tooltip!, child: btn);
  }
}

class ViaSuggestedStopBanner extends StatelessWidget {
  const ViaSuggestedStopBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: ViaColors.amberSoft,
        borderRadius: BorderRadius.circular(ViaRadii.sm),
        border: Border.all(color: ViaColors.amber.withValues(alpha: 0.35)),
      ),
      child: const Text(
        'Punto sugerido · no es parada oficial. Confirma en calle cómo se detiene el servicio.',
        style: TextStyle(
          color: ViaColors.inkSoft,
          fontSize: 12,
          height: 1.35,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
