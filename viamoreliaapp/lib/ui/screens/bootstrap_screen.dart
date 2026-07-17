import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../state/app_controller.dart';
import 'home_shell.dart';

class BootstrapScreen extends ConsumerStatefulWidget {
  const BootstrapScreen({super.key});

  @override
  ConsumerState<BootstrapScreen> createState() => _BootstrapScreenState();
}

class _BootstrapScreenState extends ConsumerState<BootstrapScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(appControllerProvider.notifier).bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);

    if (state.bootstrapped) {
      return const HomeShell();
    }

    return Scaffold(
      backgroundColor: ViaColors.paper,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset(
                  'assets/brand/icono-sin-fondo.png',
                  width: 88,
                  height: 88,
                  errorBuilder: (_, _, _) => const Icon(
                    Icons.route_rounded,
                    size: 72,
                    color: ViaColors.primary,
                  ),
                )
                    .animate(onPlay: (c) => c.repeat(reverse: true))
                    .scale(
                      begin: const Offset(0.96, 0.96),
                      end: const Offset(1.04, 1.04),
                      duration: 1100.ms,
                    ),
                const SizedBox(height: 20),
                Image.asset(
                  'assets/brand/nombre-sin-fondo.png',
                  height: 32,
                  errorBuilder: (_, _, _) => Text(
                    'Vía Morelia',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Cargando catálogo de Morelia…',
                  style: TextStyle(
                    color: ViaColors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 28),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: state.loadProgress.clamp(0.08, 1),
                    minHeight: 6,
                    color: ViaColors.primary,
                    backgroundColor: ViaColors.hairline,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  '${(state.loadProgress * 100).round()}%',
                  style: const TextStyle(
                    color: ViaColors.textMuted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (state.loadError != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    state.loadError!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: ViaColors.coralBrand, fontSize: 12.5),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
