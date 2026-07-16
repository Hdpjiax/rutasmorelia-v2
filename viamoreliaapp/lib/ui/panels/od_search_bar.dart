import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../models/place_model.dart';
import '../../state/app_controller.dart';
import '../micro/via_panel.dart';

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

class _OdSearchBarState extends ConsumerState<OdSearchBar> {
  final _originCtrl = TextEditingController();
  final _destCtrl = TextEditingController();
  final _originFocus = FocusNode();
  final _destFocus = FocusNode();
  Timer? _debounce;
  List<PlaceModel> _suggestions = [];
  bool _searching = false;
  _Field? _active;
  bool _listening = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _originCtrl.dispose();
    _destCtrl.dispose();
    _originFocus.dispose();
    _destFocus.dispose();
    super.dispose();
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
      final hits = await ref.read(appControllerProvider.notifier).searchPlaces(value);
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

  Future<void> _voice(_Field field) async {
    final speech = ref.read(speechServiceProvider);
    setState(() {
      _listening = true;
      _active = field;
    });
    final ok = await speech.initialize();
    if (!ok) {
      if (mounted) {
        setState(() => _listening = false);
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
    if (mounted) setState(() => _listening = false);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    _syncFromState(state);

    if (widget.collapsed) {
      return ViaRoundIconButton(
        icon: Icons.search_rounded,
        tooltip: 'Buscar viaje',
        color: ViaColors.mint,
        onPressed: widget.onToggleCollapse,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        ViaPanel(
          padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Planear viaje',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                          ),
                    ),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: widget.onToggleCollapse,
                    icon: const Icon(Icons.unfold_less_rounded, size: 20, color: ViaColors.textSecondary),
                    tooltip: 'Contraer',
                  ),
                ],
              ),
              _OdField(
                controller: _originCtrl,
                focusNode: _originFocus,
                hint: 'Origen',
                color: ViaColors.origin,
                icon: Icons.trip_origin_rounded,
                onChanged: (v) => _onQuery(v, _Field.origin),
                onFocus: () {
                  _active = _Field.origin;
                  _onQuery(_originCtrl.text, _Field.origin);
                },
                onMic: () => _voice(_Field.origin),
                onGps: () => ref.read(appControllerProvider.notifier).requestGps(setAsOrigin: true),
                listening: _listening && _active == _Field.origin,
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const SizedBox(width: 18),
                  Container(width: 2, height: 10, color: ViaColors.hairline),
                  const Spacer(),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () => ref.read(appControllerProvider.notifier).swapOd(),
                    icon: const Icon(Icons.swap_vert_rounded, color: ViaColors.mint, size: 22),
                    tooltip: 'Intercambiar',
                  ),
                ],
              ),
              const SizedBox(height: 2),
              _OdField(
                controller: _destCtrl,
                focusNode: _destFocus,
                hint: 'Destino',
                color: ViaColors.destination,
                icon: Icons.flag_rounded,
                onChanged: (v) => _onQuery(v, _Field.destination),
                onFocus: () {
                  _active = _Field.destination;
                  _onQuery(_destCtrl.text, _Field.destination);
                },
                onMic: () => _voice(_Field.destination),
                listening: _listening && _active == _Field.destination,
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => ref
                          .read(appControllerProvider.notifier)
                          .setPinDropMode(PinDropMode.origin),
                      icon: const Icon(Icons.trip_origin_rounded, size: 16, color: ViaColors.origin),
                      label: const Text('Pin origen', style: TextStyle(fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => ref
                          .read(appControllerProvider.notifier)
                          .setPinDropMode(PinDropMode.destination),
                      icon: const Icon(Icons.flag_rounded, size: 16, color: ViaColors.destination),
                      label: const Text('Pin destino', style: TextStyle(fontSize: 12)),
                    ),
                  ),
                ],
              ),
              if (state.planning) ...[
                const SizedBox(height: 10),
                LinearProgressIndicator(
                  minHeight: 3,
                  value: state.planningProgress.clamp(0.05, 1),
                  color: ViaColors.mint,
                  backgroundColor: ViaColors.paperTint,
                ),
              ],
              if (state.planningError != null) ...[
                const SizedBox(height: 8),
                Text(
                  state.planningError!,
                  style: const TextStyle(color: Color(0xFFDC3D4A), fontSize: 12),
                ),
              ],
            ],
          ),
        ),
        if (_suggestions.isNotEmpty || _searching) ...[
          const SizedBox(height: 8),
          ViaPanel(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 240),
              child: _searching && _suggestions.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: ViaColors.mint)),
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      itemCount: _suggestions.length,
                      separatorBuilder: (_, _) => const Divider(height: 1, color: ViaColors.hairline),
                      itemBuilder: (context, i) {
                        final p = _suggestions[i];
                        return ListTile(
                          dense: true,
                          leading: Icon(
                            p.source == PlaceSource.gps
                                ? Icons.my_location_rounded
                                : p.isFavorite
                                    ? Icons.favorite_rounded
                                    : Icons.place_rounded,
                            color: p.source == PlaceSource.geocode
                                ? ViaColors.violet
                                : ViaColors.mint,
                            size: 20,
                          ),
                          title: Text(
                            p.name,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                          ),
                          subtitle: p.description == null
                              ? null
                              : Text(
                                  p.description!,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: ViaColors.textMuted, fontSize: 11.5),
                                ),
                          trailing: Text(
                            p.source.name,
                            style: const TextStyle(color: ViaColors.textMuted, fontSize: 10),
                          ),
                          onTap: () => _pick(p),
                        );
                      },
                    ),
            ),
          ),
        ],
      ],
    );
  }
}

class _OdField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final String hint;
  final Color color;
  final IconData icon;
  final ValueChanged<String> onChanged;
  final VoidCallback onFocus;
  final VoidCallback onMic;
  final VoidCallback? onGps;
  final bool listening;

  const _OdField({
    required this.controller,
    required this.focusNode,
    required this.hint,
    required this.color,
    required this.icon,
    required this.onChanged,
    required this.onFocus,
    required this.onMic,
    this.onGps,
    this.listening = false,
  });

  @override
  Widget build(BuildContext context) {
    return Focus(
      onFocusChange: (has) {
        if (has) onFocus();
      },
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        onChanged: onChanged,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        decoration: InputDecoration(
          isDense: true,
          hintText: hint,
          prefixIcon: Icon(icon, color: color, size: 18),
          suffixIcon: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (onGps != null)
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: onGps,
                  icon: const Icon(Icons.my_location_rounded, size: 18, color: ViaColors.mint),
                  tooltip: 'Usar GPS',
                ),
              IconButton(
                visualDensity: VisualDensity.compact,
                onPressed: onMic,
                icon: Icon(
                  listening ? Icons.mic_rounded : Icons.mic_none_rounded,
                  size: 18,
                  color: listening ? ViaColors.coral : ViaColors.textSecondary,
                ),
                tooltip: 'Dictar',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
