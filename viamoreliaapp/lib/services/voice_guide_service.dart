import 'package:flutter_tts/flutter_tts.dart';

class VoiceGuideService {
  static final VoiceGuideService _instance = VoiceGuideService._();
  static VoiceGuideService get instance => _instance;
  VoiceGuideService._();

  final FlutterTts _tts = FlutterTts();
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    await _tts.setLanguage('es-MX');
    await _tts.setSpeechRate(0.45);
    await _tts.setPitch(1.0);
    await _tts.setVolume(1.0);
    _initialized = true;
  }

  void reset() {
    stop();
  }

  Future<void> speak(String text) async {
    // Silenciado por completo
    return;
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
    // Silenciado por completo
  }
}
