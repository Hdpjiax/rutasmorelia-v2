import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/theme/via_theme.dart';

class ViaOrb extends StatelessWidget {
  final Color color;
  final double size;
  final IconData icon;
  final bool pulse;

  const ViaOrb({
    super.key,
    required this.color,
    this.size = 44,
    required this.icon,
    this.pulse = true,
  });

  @override
  Widget build(BuildContext context) {
    final core = Stack(
      alignment: Alignment.center,
      children: [
        if (pulse)
          Container(
            width: size * 0.72,
            height: size * 0.72,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.28),
              shape: BoxShape.circle,
            ),
          )
              .animate(onPlay: (c) => c.repeat())
              .scale(
                begin: const Offset(0.85, 0.85),
                end: const Offset(2.1, 2.1),
                duration: ViaMotion.orbPulse,
                curve: Curves.easeOut,
              )
              .fadeOut(duration: ViaMotion.orbPulse),
        Container(
          width: size * 0.62,
          height: size * 0.62,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.45),
                blurRadius: 10,
                spreadRadius: 1,
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white, size: size * 0.34),
        ),
      ],
    );

    if (!pulse) return SizedBox(width: size, height: size, child: core);

    return SizedBox(
      width: size,
      height: size,
      child: core
          .animate(onPlay: (c) => c.repeat(reverse: true))
          .scale(
            begin: const Offset(0.94, 0.94),
            end: const Offset(1.04, 1.04),
            duration: 900.ms,
            curve: Curves.easeInOut,
          ),
    );
  }
}

class ViaUserDot extends StatelessWidget {
  final double size;
  final bool pulse;
  const ViaUserDot({super.key, this.size = 28, this.pulse = true});

  @override
  Widget build(BuildContext context) {
    final core = Container(
      width: size * 0.55,
      height: size * 0.55,
      decoration: BoxDecoration(
        color: ViaColors.mint,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(color: ViaColors.mint.withValues(alpha: 0.45), blurRadius: 6),
        ],
      ),
    );

    if (!pulse) {
      return SizedBox(width: size, height: size, child: Center(child: core));
    }

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: ViaColors.mint.withValues(alpha: 0.25),
              shape: BoxShape.circle,
            ),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .scale(begin: const Offset(0.8, 0.8), end: const Offset(1.35, 1.35), duration: 1100.ms)
              .fade(begin: 0.7, end: 0.15),
          core,
        ],
      ),
    );
  }
}
