import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../models/place_model.dart';
import '../../state/app_controller.dart';
import '../micro/via_panel.dart';

const Color _petroleum = Color(0xFF005B57);
const Color _petroleumLight = Color(0xFF008F7A);
const Color _gold = Color(0xFFF5B719);
const Color _originAccent = Color(0xFF009CB5);
const Color _destAccent = Color(0xFFD94B45);

const LinearGradient _petroleumGradient = LinearGradient(
  colors: [_petroleum, _petroleumLight],
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

enum _Field { origin, destination }

class OdSearchBar extends ConsumerStatefulWidget {
  final bool collapsed;
  final VoidCallback onToggleCollapse;

  const OdSearchBar({
    super.key,
    required this.collapsed,
    required this.onToggleCollapse,
  });

  @override
  ConsumerState<OdSearchBar> createState() => _OdSearchBarState();
}

class _OdSearchBarState extends ConsumerState<OdSearchBar>
    with SingleTickerProviderStateMixin {
  final _originCtrl = TextEditingController();
  final _destCtrl = TextEditingController();
  final _originFocus = FocusNode();
  final _destFocus = FocusNode();
  Timer? _debounce;
  List<PlaceModel> _suggestions = [];
  bool _searching = false;
  _Field? _active;
  bool _listening = false;

  late final AnimationController _micPulseCtrl;
  late final Animation<double> _micPulseAnim;
  double _swapRotation = 0;

  @override
  void initState() {
    super.initState();
    _micPulseCtrl = AnimationController(
      vsync: this,
      duration: ViaMotion.orbPulse,
    );
    _micPulseAnim = Tween<double>(begin: 1.0, end: 1.35).animate(
      CurvedAnimation(parent: _micPulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _micPulseCtrl.dispose();
    _originCtrl.dispose();
    _destCtrl.dispose();
    _originFocus.dispose();
    _destFocus.dispose();
    super.dispose();
  }

  void _setListening(bool value) {
    setState(() => _listening = value);
    if (value) {
      _micPulseCtrl.repeat(reverse: true);
    } else {
      _micPulseCtrl.stop();
      _micPulseCtrl.reset();
    }
  }

  void _syncFromState(AppUiState s) {
    if (!_originFocus.hasFocus) {
      final t = s.origin?.name ?? '';
      if (_originCtrl.text != t) _originCtrl.text = t;
    }
    if (!_destFocus.hasFocus) {
      final t = s.destination?.name ?? '';
      if (_destCtrl.text != t) _destCtrl.text = t;
    }
  }

  void _onQuery(String value, _Field field) {
    _active = field;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () async {
      setState(() => _searching = true);
      final hits =
          await ref.read(appControllerProvider.notifier).searchPlaces(value);
      if (!mounted) return;
      setState(() {
        _suggestions = hits;
        _searching = false;
      });
    });
  }

  Future<void> _pick(PlaceModel place) async {
    final ctrl = ref.read(appControllerProvider.notifier);
    if (_active == _Field.origin) {
      _originCtrl.text = place.name;
      await ctrl.setOrigin(place);
    } else {
      _destCtrl.text = place.name;
      await ctrl.setDestination(place);
    }
    setState(() {
      _suggestions = [];
      _active = null;
    });
    _originFocus.unfocus();
    _destFocus.unfocus();
  }

  void _handleSwap() {
    setState(() => _swapRotation += math.pi);
    ref.read(appControllerProvider.notifier).swapOd();
  }

  Future<void> _voice(_Field field) async {
    final speech = ref.read(speechServiceProvider);
    _setListening(true);
    _active = field;
    final ok = await speech.initialize();
    if (!ok) {
      if (mounted) {
        _setListening(false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Micrófono no disponible en este dispositivo.')),
        );
      }
      return;
    }
    await speech.listen(onResult: (text) {
      if (!mounted) return;
      if (field == _Field.origin) {
        _originCtrl.text = text;
        _onQuery(text, _Field.origin);
      } else {
        _destCtrl.text = text;
        _onQuery(text, _Field.destination);
      }
    });
    await Future<void>.delayed(const Duration(seconds: 8));
    await speech.stop();
    if (mounted) _setListening(false);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    _syncFromState(state);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (widget.collapsed)
          _collapsedFab()
        else
          _expandedPanel(state),
        if (!widget.collapsed &&
            (_suggestions.isNotEmpty || _searching)) ...[
          const SizedBox(height: 8),
          _suggestionsPanel(),
        ],
      ],
    );
  }

  Widget _collapsedFab() {
    return SizedBox(
      width: 56,
      height: 56,
      child: Stack(
        alignment: Alignment.center,
        children: [
          IgnorePointer(
            child: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: _gold.withValues(alpha: 0.2), width: 1.5),
              ),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
             .scale(
               begin: const Offset(0.84, 0.84),
               end: const Offset(1.06, 1.06),
               duration: 1600.ms,
               curve: Curves.easeInOut,
             )
             .fadeOut(duration: 1600.ms),
          ),
          SizedBox(
            width: 44,
            height: 44,
            child: Material(
              color: Colors.transparent,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: widget.onToggleCollapse,
                splashColor: _gold.withValues(alpha: 0.3),
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: _petroleumGradient,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x30005B57),
                        blurRadius: 14,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(Icons.search_rounded, size: 20, color: Colors.white),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _expandedPanel(AppUiState state) {
    return ViaGlass.wrap(
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _headerBanner(state),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _OdField(
                  controller: _originCtrl,
                  focusNode: _originFocus,
                  hint: 'Centro, mi ubicación…',
                  color: _originAccent,
                  glowColor: _originAccent,
                  icon: Icons.trip_origin_rounded,
                  onChanged: (v) => _onQuery(v, _Field.origin),
                  onFocus: () {
                    _active = _Field.origin;
                    _onQuery(_originCtrl.text, _Field.origin);
                  },
                  onMic: () => _voice(_Field.origin),
                  onGps: () => ref
                      .read(appControllerProvider.notifier)
                      .requestGps(setAsOrigin: true),
                  listening: _listening && _active == _Field.origin,
                  pulseAnim: _micPulseAnim,
                ).animate().fadeIn(duration: 250.ms, delay: 60.ms).slideY(begin: 0.08, end: 0, curve: Curves.easeOutCubic),
                _swapRow(),
                _OdField(
                  controller: _destCtrl,
                  focusNode: _destFocus,
                  hint: 'Metrópolis, Aldea…',
                  color: _destAccent,
                  glowColor: _destAccent,
                  icon: Icons.flag_rounded,
                  onChanged: (v) => _onQuery(v, _Field.destination),
                  onFocus: () {
                    _active = _Field.destination;
                    _onQuery(_originCtrl.text, _Field.destination);
                  },
                  onMic: () => _voice(_Field.destination),
                  listening: _listening && _active == _Field.destination,
                  pulseAnim: _micPulseAnim,
                ).animate().fadeIn(duration: 250.ms, delay: 120.ms).slideY(begin: 0.08, end: 0, curve: Curves.easeOutCubic),
                const SizedBox(height: 10),
                _footerRow(state),
                if (state.planning) ...[
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      minHeight: 3,
                      value: state.planningProgress.clamp(0.05, 1),
                      color: _gold,
                      backgroundColor: _gold.withValues(alpha: 0.12),
                    ),
                  ),
                ],
                if (state.planningError != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: _destAccent.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(ViaRadii.sm),
                      border: Border.all(color: _destAccent.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, size: 14, color: _destAccent.withValues(alpha: 0.7)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            state.planningError!,
                            style: TextStyle(color: _destAccent.withValues(alpha: 0.9), fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
      radius: ViaRadii.lg + 2,
      blur: 24,
      backgroundColor: ViaColors.paper,
      opacity: 0.92,
      shadows: [
        BoxShadow(
          color: _petroleum.withValues(alpha: 0.12),
          blurRadius: 32,
          offset: const Offset(0, 12),
        ),
        BoxShadow(
          color: _petroleum.withValues(alpha: 0.05),
          blurRadius: 8,
          offset: const Offset(0, 4),
        ),
      ],
    ).animate().scale(
      begin: const Offset(0.95, 0.95),
      end: const Offset(1, 1),
      duration: 300.ms,
      curve: Curves.easeOutBack,
    ).fadeIn(duration: 200.ms);
  }

  Widget _headerBanner(AppUiState state) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
      decoration: const BoxDecoration(
        gradient: _petroleumGradient,
        borderRadius: BorderRadius.vertical(top: Radius.circular(ViaRadii.lg + 2)),
      ),
      child: Row(
        children: [
          Icon(Icons.auto_awesome_rounded, size: 15, color: _gold.withValues(alpha: 0.9)),
          const SizedBox(width: 7),
          Text(
            'Planificar viaje',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 14,
              color: Colors.white.withValues(alpha: 0.95),
              letterSpacing: -0.2,
            ),
          ),
          const Spacer(),
          if (state.planning)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: _gold.withValues(alpha: 0.7),
                ),
              ),
            ),
          SizedBox(
            width: 32,
            height: 32,
            child: Material(
              color: Colors.white.withValues(alpha: 0.12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: widget.onToggleCollapse,
                child: Center(
                  child: Icon(Icons.unfold_less_rounded, size: 18, color: Colors.white.withValues(alpha: 0.8)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _swapRow() {
    return Row(
      children: [
        const SizedBox(width: 16),
        Container(
          width: 2,
          height: 12,
          color: ViaColors.hairline.withValues(alpha: 0.5),
        ),
        const Spacer(),
        AnimatedRotation(
          turns: _swapRotation / (2 * math.pi),
          duration: ViaMotion.quick,
          curve: Curves.easeOutCubic,
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: _gold.withValues(alpha: 0.2),
              shape: BoxShape.circle,
              border: Border.all(color: _gold.withValues(alpha: 0.4), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: _gold.withValues(alpha: 0.15),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: _handleSwap,
                child: Center(
                  child: Icon(Icons.swap_vert_rounded, color: _gold, size: 20),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _footerRow(AppUiState state) {
    return Row(
      children: [
        _mapButton(
          icon: Icons.trip_origin_rounded,
          label: 'Origen en mapa',
          color: _originAccent,
          onTap: () => ref.read(appControllerProvider.notifier).setPinDropMode(PinDropMode.origin),
        ),
        const SizedBox(width: 8),
        _mapButton(
          icon: Icons.flag_rounded,
          label: 'Destino en mapa',
          color: _destAccent,
          onTap: () => ref.read(appControllerProvider.notifier).setPinDropMode(PinDropMode.destination),
        ),
      ],
    );
  }

  Widget _mapButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: TextButton.icon(
        style: TextButton.styleFrom(
          foregroundColor: color,
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          visualDensity: VisualDensity.compact,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ViaRadii.sm)),
        ),
        onPressed: onTap,
        icon: Icon(icon, size: 14, color: color.withValues(alpha: 0.6)),
        label: Text(label, style: TextStyle(fontSize: 11.5, color: color.withValues(alpha: 0.7), fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _suggestionsPanel() {
    return ViaGlass.wrap(
      ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 260),
        child: _searching && _suggestions.isEmpty
            ? const Padding(
                padding: EdgeInsets.all(20),
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: _petroleum),
                  ),
                ),
              )
            : ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 4),
                shrinkWrap: true,
                itemCount: _suggestions.length,
                separatorBuilder: (_, _) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Divider(height: 1, color: ViaColors.hairline.withValues(alpha: 0.4)),
                ),
                itemBuilder: (context, i) {
                  final p = _suggestions[i];
                  return TweenAnimationBuilder<double>(
                    key: ValueKey(p.id),
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: Duration(milliseconds: 300 + i * 50),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, child) {
                      return Opacity(
                        opacity: value,
                        child: Transform.translate(
                          offset: Offset(0, 16 * (1 - value)),
                          child: child,
                        ),
                      );
                    },
                    child: ListTile(
                      dense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                      leading: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: _iconColor(p).withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(_suggestionIcon(p), color: _iconColor(p), size: 16),
                      ),
                      title: Text(
                        p.name,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: ViaColors.textPrimary),
                      ),
                      subtitle: p.description == null
                          ? null
                          : Text(
                              p.description!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: ViaColors.textMuted, fontSize: 11.5),
                            ),
                      trailing: Text(p.source.name, style: const TextStyle(color: ViaColors.textMuted, fontSize: 10)),
                      onTap: () => _pick(p),
                    ),
                  );
                },
              ),
      ),
      radius: ViaRadii.md + 2,
      blur: 24,
      backgroundColor: ViaColors.paper,
      opacity: 0.92,
      shadows: [
        BoxShadow(
          color: _petroleum.withValues(alpha: 0.08),
          blurRadius: 20,
          offset: const Offset(0, 6),
        ),
      ],
    ).animate().fadeIn(duration: 200.ms).slideY(begin: -0.05, end: 0, curve: Curves.easeOutCubic);
  }

  IconData _suggestionIcon(PlaceModel p) {
    if (p.source == PlaceSource.gps) return Icons.my_location_rounded;
    if (p.isFavorite) return Icons.favorite_rounded;
    return Icons.place_rounded;
  }

  Color _iconColor(PlaceModel p) {
    if (p.source == PlaceSource.gps) return _originAccent;
    if (p.isFavorite) return _gold;
    return _petroleum;
  }
}

class _OdField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final String hint;
  final Color color;
  final Color glowColor;
  final IconData icon;
  final ValueChanged<String> onChanged;
  final VoidCallback onFocus;
  final VoidCallback onMic;
  final VoidCallback? onGps;
  final bool listening;
  final Animation<double>? pulseAnim;

  const _OdField({
    required this.controller,
    required this.focusNode,
    required this.hint,
    required this.color,
    required this.glowColor,
    required this.icon,
    required this.onChanged,
    required this.onFocus,
    required this.onMic,
    this.onGps,
    this.listening = false,
    this.pulseAnim,
  });

  @override
  Widget build(BuildContext context) {
    return Focus(
      onFocusChange: (has) {
        if (has) onFocus();
      },
      child: AnimatedContainer(
        duration: ViaMotion.quick,
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          color: ViaColors.paper,
          borderRadius: BorderRadius.circular(ViaRadii.input),
          border: Border.all(
            color: focusNode.hasFocus
                ? glowColor.withValues(alpha: 0.5)
                : ViaColors.hairline.withValues(alpha: 0.6),
            width: focusNode.hasFocus ? 1.5 : 1,
          ),
          boxShadow: focusNode.hasFocus
              ? [
                  BoxShadow(
                    color: glowColor.withValues(alpha: 0.15),
                    blurRadius: 10,
                    spreadRadius: 0,
                  ),
                ]
              : null,
        ),
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          onChanged: onChanged,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: ViaColors.textPrimary),
          decoration: InputDecoration(
            isDense: true,
            hintText: hint,
            hintStyle: const TextStyle(color: ViaColors.textMuted, fontSize: 13, fontWeight: FontWeight.w500),
            prefixIcon: Padding(
              padding: const EdgeInsets.only(left: 10),
              child: Icon(icon, color: color, size: 18),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 36, minHeight: 0),
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (onGps != null)
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: onGps,
                    icon: Icon(Icons.my_location_rounded, size: 18, color: color.withValues(alpha: 0.7)),
                    tooltip: 'Usar GPS',
                  ),
                AnimatedBuilder(
                  animation: pulseAnim ?? kAlwaysCompleteAnimation,
                  builder: (context, child) {
                    final scale = listening && pulseAnim != null ? pulseAnim!.value : 1.0;
                    final micColor = listening ? color : ViaColors.textMuted;
                    return Transform.scale(
                      scale: scale,
                      child: Container(
                        margin: const EdgeInsets.only(right: 2),
                        decoration: listening
                            ? BoxDecoration(
                                color: color.withValues(alpha: 0.1),
                                shape: BoxShape.circle,
                              )
                            : null,
                        child: IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: onMic,
                          icon: Icon(listening ? Icons.mic_rounded : Icons.mic_none_rounded, size: 18, color: micColor),
                          tooltip: 'Dictar',
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          ),
        ),
      ),
    );
  }
}
