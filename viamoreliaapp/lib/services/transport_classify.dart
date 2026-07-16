/// Alineado a lib/transport/classify.ts de la web.
class TransportClassify {
  static final _foraneoIdHint = RegExp(
    r'(^|-)(charo|atecuaro|arco-san-pedro|arroyo-colorado|chucandiro|coeneo|cointzio|jesus-del-monte|chihuerio|chiquimitio|capula|ciudad-de-hidalgo|centros-comerciales|campestre|canteras|lucio|leandro-valle|indaparapeo|san-antonio-corrales)(-|$)',
    caseSensitive: false,
  );

  static String stripAccents(String s) {
    const map = {
      'á': 'a',
      'é': 'e',
      'í': 'i',
      'ó': 'o',
      'ú': 'u',
      'ü': 'u',
      'ñ': 'n',
    };
    var t = s.toLowerCase();
    map.forEach((k, v) => t = t.replaceAll(k, v));
    return t;
  }

  /// Returns 'combi' | 'autobus'
  static String normalize(String? raw, {String? routeId, String? routeName}) {
    final s = stripAccents(raw ?? '').trim();
    if (s == 'foraneo' ||
        s == 'foraneos' ||
        s == 'bus' ||
        s == 'autobus' ||
        s == 'autobuses' ||
        s.contains('foraneo') ||
        s.contains('autobus')) {
      return 'autobus';
    }
    if (s == 'combi' || s == 'combis' || s.contains('combi')) {
      return 'combi';
    }
    final id = stripAccents(routeId ?? '');
    final name = stripAccents(routeName ?? '');
    if (id.contains('foraneo') ||
        id.contains('autobus') ||
        name.contains('foraneo') ||
        name.contains('autobus') ||
        _foraneoIdHint.hasMatch(id)) {
      return 'autobus';
    }
    return 'combi';
  }
}
