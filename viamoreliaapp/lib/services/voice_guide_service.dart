import 'package:flutter_tts/flutter_tts.dart';

class VoiceGuideService {
  static final VoiceGuideService _instance = VoiceGuideService._();
  static VoiceGuideService get instance => _instance;
  VoiceGuideService._();

  final FlutterTts _tts = FlutterTts();
  bool _initialized = false;
  String _lastUttered = '';

  bool _announcedBoard = false;
  bool _announcedNearAlight = false;
  String _lastTurnInstruction = '';

  Future<void> init() async {
    if (_initialized) return;
    await _tts.setLanguage('es-MX');
    await _tts.setSpeechRate(0.45);
    await _tts.setPitch(1.0);
    await _tts.setVolume(1.0);
    _initialized = true;
  }

  void reset() {
    _announcedBoard = false;
    _announcedNearAlight = false;
    _lastTurnInstruction = '';
    _lastUttered = '';
    stop();
  }

  Future<void> speak(String text) async {
    if (text == _lastUttered) return;
    _lastUttered = text;
    await init();
    try {
      await _tts.speak(text);
    } catch (_) {}
  }

  Future<void> stop() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }

  void onTrackingUpdate({
    required String trackingSegment,
    required String? navInstruction,
    required double metersToNext,
    required bool nearAlight,
    required String? routeName,
    required String? routeDirection,
  }) {
    if (trackingSegment == 'ride' && nearAlight && !_announcedNearAlight) {
      _announcedNearAlight = true;
      speak('Prepárate para bajar. Tu destino está cerca.');
      return;
    }

    if (trackingSegment == 'walkToBoard' && metersToNext < 30 && !_announcedBoard) {
      _announcedBoard = true;
      final route = routeName ?? 'la ruta';
      speak('Sube a $route $routeDirection');
      return;
    }

    if ((trackingSegment == 'walkToBoard' || trackingSegment == 'walkToDest') &&
        navInstruction != null &&
        navInstruction != _lastTurnInstruction) {
      _lastTurnInstruction = navInstruction;
      speak(navInstruction);
      return;
    }

    if (trackingSegment == 'ride' && !_announcedBoard) {
      _announcedBoard = true;
      final route = routeName ?? 'la ruta';
      speak('Abordo de $route $routeDirection');
    }

    if (trackingSegment == 'done') {
      speak('Has llegado a tu destino.');
      reset();
    }
  }
}
