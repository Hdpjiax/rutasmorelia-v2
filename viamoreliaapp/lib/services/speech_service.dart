import 'package:speech_to_text/speech_to_text.dart';

class SpeechService {
  final SpeechToText _speech = SpeechToText();
  bool _ready = false;

  bool get isAvailable => _ready;

  Future<bool> initialize() async {
    try {
      _ready = await _speech.initialize(
        onError: (_) {},
        onStatus: (_) {},
      );
      return _ready;
    } catch (_) {
      _ready = false;
      return false;
    }
  }

  Future<void> listen({
    required void Function(String text) onResult,
    String localeId = 'es_MX',
  }) async {
    if (!_ready) {
      final ok = await initialize();
      if (!ok) return;
    }

    await _speech.listen(
      onResult: (result) {
        if (result.recognizedWords.trim().isNotEmpty) {
          onResult(result.recognizedWords.trim());
        }
      },
      listenOptions: SpeechListenOptions(
        partialResults: true,
        cancelOnError: true,
        listenMode: ListenMode.confirmation,
        localeId: localeId,
      ),
    );
  }

  Future<void> stop() async {
    await _speech.stop();
  }

  bool get isListening => _speech.isListening;
}
