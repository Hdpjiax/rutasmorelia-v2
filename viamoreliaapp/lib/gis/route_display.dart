/// Port de `lib/routes/route-display.ts` (web).
class RouteDisplayInfo {
  final String baseName;
  final List<String> corridors;
  final String corridorLabel;
  final String terminalIda;
  final String terminalVuelta;
  final String searchBlob;

  const RouteDisplayInfo({
    required this.baseName,
    required this.corridors,
    required this.corridorLabel,
    required this.terminalIda,
    required this.terminalVuelta,
    required this.searchBlob,
  });
}

class RouteDisplay {
  static final _bracketRe = RegExp(r'\[([^\]]+)\]|\(([^)]+)\)');

  static RouteDisplayInfo parse({
    required String id,
    required String name,
    String? description,
    String? transportType,
  }) {
    final corridors = <String>[];
    for (final m in _bracketRe.allMatches(name)) {
      final raw = (m.group(1) ?? m.group(2) ?? '').trim();
      if (raw.isEmpty) continue;
      for (final part in raw.split(RegExp(r'[-–—\/,|]+'))) {
        final t = part.trim();
        if (t.length > 1) corridors.add(t);
      }
    }

    final baseName = name
            .replaceAll(RegExp(r'\s*[\[(][^)\]]*[)\]]\s*'), ' ')
            .replaceAll(RegExp(r'\s+'), ' ')
            .trim()
            .isEmpty
        ? name
        : name
            .replaceAll(RegExp(r'\s*[\[(][^)\]]*[)\]]\s*'), ' ')
            .replaceAll(RegExp(r'\s+'), ' ')
            .trim();

    final unique = corridors.toSet().take(5).toList();
    final terminalIda = unique.isNotEmpty
        ? unique.first
        : 'Salida / sentido ida';
    final terminalVuelta = unique.length >= 2
        ? unique.last
        : unique.isNotEmpty
            ? 'Regreso · ${unique.first}'
            : 'Regreso / sentido vuelta';
    final corridorLabel = unique.isNotEmpty
        ? unique.join(' · ')
        : (description?.trim().isNotEmpty == true
            ? description!.trim()
            : 'Recorrido en Morelia');

    final searchBlob = [
      name,
      baseName,
      id,
      description ?? '',
      unique.join(' '),
      transportType ?? '',
      baseName.replaceAll(RegExp(r'\d+'), ' '),
    ].join(' ').toLowerCase();

    return RouteDisplayInfo(
      baseName: baseName,
      corridors: unique,
      corridorLabel: corridorLabel,
      terminalIda: terminalIda,
      terminalVuelta: terminalVuelta,
      searchBlob: searchBlob,
    );
  }

  static ({String label, String tone}) availabilityLabel(String? status) {
    final s = (status ?? 'approved').toLowerCase();
    if (s == 'approved' || s == 'published') {
      return (label: 'Disponible', tone: 'ok');
    }
    if (s == 'needs_review') return (label: 'En revisión', tone: 'warn');
    if (s == 'rejected') return (label: 'No disponible', tone: 'bad');
    return (label: 'Publicada', tone: 'ok');
  }
}
