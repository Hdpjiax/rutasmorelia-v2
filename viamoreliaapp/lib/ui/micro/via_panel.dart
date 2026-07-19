import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import '../../core/theme/via_theme.dart';

/// Standard glass decoration for consistency across all components.
class ViaGlass {
  ViaGlass._();

  static BoxDecoration decoration({
    double opacity = 0.90,
    double radius = ViaRadii.md,
    Color? borderColor,
    List<BoxShadow>? shadows,
    Color? backgroundColor,
  }) {
    return BoxDecoration(
      color: (backgroundColor ?? Colors.white).withValues(alpha: opacity),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(
        color: borderColor ?? Colors.white.withValues(alpha: 0.55),
      ),
      boxShadow: shadows,
    );
  }

  static Widget wrap(Widget child, {
    double blur = 24,
    double radius = ViaRadii.md,
    EdgeInsets? padding,
    double opacity = 0.90,
    Color? borderColor,
    List<BoxShadow>? shadows,
    Color? backgroundColor,
  }) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          decoration: ViaGlass.decoration(
            radius: radius,
            opacity: opacity,
            borderColor: borderColor ?? Colors.white.withValues(alpha: 0.55),
            shadows: shadows,
            backgroundColor: backgroundColor,
          ),
          padding: padding,
          child: child,
        ),
      ),
    );
  }
}

/// Premium tooltip with glass styling.
class ViaTooltip extends StatelessWidget {
  final String message;
  final Widget child;

  const ViaTooltip({super.key, required this.message, required this.child});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: message,
      decoration: ViaGlass.decoration(
        opacity: 0.92,
        radius: ViaRadii.sm,
        borderColor: Colors.white.withValues(alpha: 0.55),
        shadows: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8),
        ],
      ),
      textStyle: const TextStyle(
        color: ViaColors.textPrimary,
        fontWeight: FontWeight.w600,
        fontSize: 12,
      ),
      preferBelow: false,
      verticalOffset: 8,
      waitDuration: const Duration(milliseconds: 300),
      child: child,
    );
  }
}

class ViaPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Color? color;
  final Border? border;
  final Color? glow;

  const ViaPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.radius = ViaRadii.lg,
    this.color,
    this.border,
    this.glow,
  });

  @override
  Widget build(BuildContext context) {
    final shadows = <BoxShadow>[
      BoxShadow(
        color: const Color(0xFF142033).withValues(alpha: 0.05),
        blurRadius: 20,
        offset: const Offset(0, 8),
      ),
    ];
    if (glow != null) {
      shadows.add(BoxShadow(
        color: glow!.withValues(alpha: 0.18),
        blurRadius: 28,
        spreadRadius: -2,
        offset: const Offset(0, 4),
      ));
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Material(
          color: Colors.transparent,
          child: Stack(
            children: [
              Ink(
                padding: padding,
                decoration: ViaGlass.decoration(
                  radius: radius,
                  opacity: color != null ? 1.0 : 0.90,
                  backgroundColor: color ?? ViaColors.paperElevated,
                  borderColor: color != null ? null : Colors.white.withValues(alpha: 0.55),
                  shadows: shadows,
                ),
                child: child,
              ),
              // Golden light streak at the top border
              Positioned(
                top: 0,
                left: 20,
                right: 20,
                height: 1.5,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        ViaColors.dorado.withValues(alpha: 0.0),
                        ViaColors.dorado.withValues(alpha: 0.65),
                        ViaColors.dorado.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

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
      HapticFeedback.lightImpact();
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
                  Container(
                    height: 2,
                    margin: const EdgeInsets.symmetric(horizontal: 48),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(1),
                      gradient: LinearGradient(
                        colors: [
                          ViaColors.primary.withValues(alpha: 0.0),
                          ViaColors.primary.withValues(alpha: 0.35),
                          ViaColors.primary.withValues(alpha: 0.0),
                        ],
                      ),
                    ),
                  ),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onVerticalDragUpdate: _onDragUpdate,
                    onVerticalDragEnd: _onDragEnd,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(0, 12, 0, 8),
                      child: Center(
                        child: Container(
                          width: 38,
                          height: 4.5,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [ViaColors.petroleo, ViaColors.dorado],
                            ),
                            borderRadius: BorderRadius.circular(99),
                            boxShadow: [
                              BoxShadow(
                                color: ViaColors.dorado.withValues(alpha: 0.15),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                        ),
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
                              Row(
                                children: [
                                  Container(
                                    width: 4,
                                    height: 18,
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        colors: [ViaColors.petroleo, ViaColors.dorado],
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                      ),
                                      borderRadius: BorderRadius.circular(2),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      widget.title,
                                      style: const TextStyle(
                                        color: ViaColors.textPrimary,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 18,
                                        letterSpacing: -0.3,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (widget.subtitle != null) ...[
                                const SizedBox(height: 6),
                                Padding(
                                  padding: const EdgeInsets.only(left: 12),
                                  child: Text(
                                    widget.subtitle!,
                                    style: const TextStyle(
                                      color: ViaColors.textMuted,
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w500,
                                      height: 1.3,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        ...?widget.actions,
                        if (widget.onClose != null)
                          Padding(
                            padding: const EdgeInsets.only(left: 4, right: 8),
                            child: ViaBounceable(
                              onTap: widget.onClose!,
                              child: Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: ViaColors.paperTint.withValues(alpha: 0.8),
                                  border: Border.all(
                                    color: ViaColors.hairline.withValues(alpha: 0.5),
                                  ),
                                ),
                                child: const Icon(
                                  Icons.close_rounded,
                                  size: 16,
                                  color: ViaColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  // Thin gradient separator under the header
                  Container(
                    height: 1,
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          ViaColors.dorado.withValues(alpha: 0.25),
                          ViaColors.primary.withValues(alpha: 0.15),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
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

class ViaChip extends StatefulWidget {
  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final Color? selectedColor;
  final IconData? icon;
  final bool dark;

  const ViaChip({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
    this.selectedColor,
    this.icon,
    this.dark = false,
  });

  @override
  State<ViaChip> createState() => _ViaChipState();
}

class _ViaChipState extends State<ViaChip> with SingleTickerProviderStateMixin {
  late final AnimationController _bounceCtrl;
  late final Animation<double> _bounceAnim;
  bool _prevSelected = false;

  @override
  void initState() {
    super.initState();
    _bounceCtrl = AnimationController(
      vsync: this,
      duration: ViaMotion.quick,
    );
    _bounceAnim = Tween<double>(begin: 1.0, end: 1.08).animate(
      CurvedAnimation(parent: _bounceCtrl, curve: Curves.easeOutBack),
    );
    _prevSelected = widget.selected;
  }

  @override
  void didUpdateWidget(ViaChip old) {
    super.didUpdateWidget(old);
    if (widget.selected && !_prevSelected) {
      _bounceCtrl.forward().then((_) {
        if (mounted) _bounceCtrl.reverse();
      });
    }
    _prevSelected = widget.selected;
  }

  @override
  void dispose() {
    _bounceCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.selectedColor ?? ViaColors.primary;

    final bgColor = widget.dark
        ? (widget.selected ? accent.withValues(alpha: 0.2) : Colors.white.withValues(alpha: 0.06))
        : (widget.selected ? accent.withValues(alpha: 0.12) : ViaColors.paperTint);

    final borderColor = widget.selected
        ? accent.withValues(alpha: 0.55)
        : (widget.dark ? Colors.white.withValues(alpha: 0.1) : ViaColors.hairline);

    final labelColor = widget.selected
        ? accent
        : (widget.dark ? Colors.white.withValues(alpha: 0.7) : ViaColors.textSecondary);

    return ViaBounceable(
      onTap: widget.onTap ?? () {},
      child: ScaleTransition(
        scale: _bounceAnim,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(ViaRadii.pill),
            border: Border.all(color: borderColor),
            boxShadow: widget.selected
                ? [
                    BoxShadow(
                      color: accent.withValues(alpha: 0.15),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon, size: 14, color: labelColor),
                const SizedBox(width: 6),
              ],
              Text(
                widget.label,
                style: TextStyle(
                  color: labelColor,
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
    final btn = ViaBounceable(
      onTap: onPressed ?? () {},
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: background ?? ViaColors.paperElevated.withValues(alpha: 0.88),
          shape: BoxShape.circle,
          border: Border.all(color: ViaColors.hairline.withValues(alpha: 0.65)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF142033).withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
            BoxShadow(
              color: ViaColors.primary.withValues(alpha: 0.08),
              blurRadius: 16,
              spreadRadius: -4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Icon(icon, color: color ?? ViaColors.ink, size: size * 0.45),
      ),
    );
    if (tooltip == null) return btn;
    return ViaTooltip(message: tooltip!, child: btn);
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

class ViaBounceable extends StatefulWidget {
  final Widget child;
  final VoidCallback onTap;

  const ViaBounceable({
    super.key,
    required this.child,
    required this.onTap,
  });

  @override
  State<ViaBounceable> createState() => _ViaBounceableState();
}

class _ViaBounceableState extends State<ViaBounceable> with SingleTickerProviderStateMixin {
  late final AnimationController _bounceCtrl;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _bounceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 65),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.93).animate(
      CurvedAnimation(parent: _bounceCtrl, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _bounceCtrl.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails _) {
    _bounceCtrl.forward();
    HapticFeedback.selectionClick();
  }

  void _onTapUp(TapUpDetails _) {
    _bounceCtrl.reverse().then((_) {
      if (mounted) widget.onTap();
    });
  }

  void _onTapCancel() {
    _bounceCtrl.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: _onTapDown,
      onTapUp: _onTapUp,
      onTapCancel: _onTapCancel,
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: widget.child,
      ),
    );
  }
}
