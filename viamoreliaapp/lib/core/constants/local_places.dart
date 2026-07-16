import 'dart:math';
import 'package:latlong2/latlong.dart';
import '../../models/place_model.dart';

const List<Map<String, dynamic>> _rawCatalog = [
  { 'id': 'cat-catedral', 'name': 'Catedral de Morelia', 'description': 'Centro Histórico', 'category': 'landmark', 'coordinates': [-101.1944, 19.7026] },
  { 'id': 'cat-centro', 'name': 'Centro Histórico', 'description': 'Centro de Morelia', 'category': 'area', 'coordinates': [-101.194, 19.702] },
  { 'id': 'cat-zocalo', 'name': 'Zócalo / Plaza de Armas', 'description': 'Centro Histórico', 'category': 'landmark', 'coordinates': [-101.1948, 19.7028] },
  { 'id': 'cat-acueducto', 'name': 'Acueducto de Morelia', 'description': 'Calzada Fray Antonio de San Miguel', 'category': 'landmark', 'coordinates': [-101.1805, 19.7012] },
  { 'id': 'cat-calzada', 'name': 'Calzada Fray Antonio de San Miguel', 'description': 'Centro', 'category': 'street', 'coordinates': [-101.182, 19.701] },
  { 'id': 'cat-casa-cultura', 'name': 'Casa de la Cultura', 'description': 'Centro Histórico', 'category': 'culture', 'coordinates': [-101.1905, 19.7005] },
  { 'id': 'cat-palacio-gobierno', 'name': 'Palacio de Gobierno', 'description': 'Centro Histórico', 'category': 'landmark', 'coordinates': [-101.1935, 19.7032] },
  { 'id': 'cat-mercado-san-juan', 'name': 'Mercado San Juan', 'description': 'Centro', 'category': 'market', 'coordinates': [-101.198, 19.701] },
  { 'id': 'cat-mercado-independencia', 'name': 'Mercado Independencia', 'description': 'Centro', 'category': 'market', 'coordinates': [-101.188, 19.698] },
  { 'id': 'cat-alameda', 'name': 'Alameda de Morelia', 'description': 'Parque centro', 'category': 'park', 'coordinates': [-101.186, 19.704] },
  { 'id': 'cat-bosque-cuauhtemoc', 'name': 'Bosque Cuauhtémoc', 'description': 'Parque urbano', 'category': 'park', 'coordinates': [-101.182, 19.695] },
  { 'id': 'cat-zoo', 'name': 'Zoológico de Morelia', 'description': 'Zoológico Benito Juárez', 'category': 'park', 'coordinates': [-101.196, 19.682] },
  { 'id': 'cat-orquidario', 'name': 'Orquidario de Morelia', 'description': 'Parque Zoológico', 'category': 'park', 'coordinates': [-101.197, 19.681] },
  { 'id': 'cat-estadio', 'name': 'Estadio Morelos', 'description': 'Colonia Chapultepec Sur', 'category': 'sports', 'coordinates': [-101.208, 19.678] },
  { 'id': 'cat-umsn', 'name': 'Universidad Michoacana (UMSNH)', 'description': 'Ciudad Universitaria', 'category': 'education', 'coordinates': [-101.185, 19.687] },
  { 'id': 'cat-tecnologico', 'name': 'Instituto Tecnológico de Morelia', 'description': 'ITM', 'category': 'education', 'coordinates': [-101.185, 19.716] },
  { 'id': 'cat-tec-monterrey', 'name': 'Tec de Monterrey Campus Morelia', 'description': 'Educación', 'category': 'education', 'coordinates': [-101.17, 19.69] },
  { 'id': 'cat-hospital-civil', 'name': 'Hospital Civil de Morelia', 'description': 'Salud', 'category': 'health', 'coordinates': [-101.19, 19.695] },
  { 'id': 'cat-issste', 'name': 'Hospital ISSSTE Morelia', 'description': 'Salud', 'category': 'health', 'coordinates': [-101.175, 19.71] },
  { 'id': 'cat-imss', 'name': 'IMSS Hospital General Regional', 'description': 'Salud', 'category': 'health', 'coordinates': [-101.205, 19.71] },
  { 'id': 'cat-central-camiones', 'name': 'Central de Autobuses de Morelia', 'description': 'Transporte foráneo', 'category': 'transport', 'coordinates': [-101.178, 19.685] },
  { 'id': 'cat-aeropuerto', 'name': 'Aeropuerto Internacional de Morelia', 'description': 'Gral. Francisco J. Múgica', 'category': 'transport', 'coordinates': [-101.025, 19.85] },
  { 'id': 'cat-chapultepec', 'name': 'Colonia Chapultepec', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.205, 19.685] },
  { 'id': 'cat-felix-ireta', 'name': 'Colonia Félix Ireta', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.195, 19.69] },
  { 'id': 'cat-ventura-puente', 'name': 'Colonia Ventura Puente', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.19, 19.69] },
  { 'id': 'cat-molino', 'name': 'Colonia El Molino', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.21, 19.7] },
  { 'id': 'cat-lomas-morelia', 'name': 'Lomas de Morelia', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.22, 19.72] },
  { 'id': 'cat-satelite', 'name': 'Colonia Satélite', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.23, 19.71] },
  { 'id': 'cat-torreon', 'name': 'Torreón Nuevo', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.17, 19.72] },
  { 'id': 'cat-trincheras', 'name': 'Trincheras', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.16, 19.73] },
  { 'id': 'cat-santa-maria', 'name': 'Santa María de Guido', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.17, 19.68] },
  { 'id': 'cat-erandeni', 'name': 'Erandeni', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.15, 19.69] },
  { 'id': 'cat-metropolis', 'name': 'Metrópolis', 'description': 'Plaza / zona comercial', 'category': 'mall', 'coordinates': [-101.21, 19.71] },
  { 'id': 'cat-galerias', 'name': 'Galerías Morelia', 'description': 'Centro comercial', 'category': 'mall', 'coordinates': [-101.195, 19.72] },
  { 'id': 'cat-plaza-fiesta', 'name': 'Plaza Fiesta Camelinas', 'description': 'Centro comercial', 'category': 'mall', 'coordinates': [-101.2, 19.685] },
  { 'id': 'cat-soriana-camelinas', 'name': 'Soriana Camelinas', 'description': 'Comercio', 'category': 'shop', 'coordinates': [-101.198, 19.686] },
  { 'id': 'cat-walmart', 'name': 'Walmart Morelia', 'description': 'Comercio', 'category': 'shop', 'coordinates': [-101.19, 19.72] },
  { 'id': 'cat-costco', 'name': 'Costco Morelia', 'description': 'Comercio', 'category': 'shop', 'coordinates': [-101.21, 19.705] },
  { 'id': 'cat-puerta-sol', 'name': 'Puerta del Sol', 'description': 'Zona residencial', 'category': 'colonia', 'coordinates': [-101.14, 19.7] },
  { 'id': 'cat-lomas-universidad', 'name': 'Lomas de la Universidad', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.18, 19.68] },
  { 'id': 'cat-independencia', 'name': 'Colonia Independencia', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.2, 19.71] },
  { 'id': 'cat-electricistas', 'name': 'Colonia Electricistas', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.21, 19.69] },
  { 'id': 'cat-prados-verdes', 'name': 'Prados Verdes', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.24, 19.7] },
  { 'id': 'cat-mision-valle', 'name': 'Misión del Valle', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.23, 19.69] },
  { 'id': 'cat-villla-universidad', 'name': 'Villa Universidad', 'description': 'Morelia', 'category': 'colonia', 'coordinates': [-101.185, 19.685] },
  { 'id': 'cat-lazaro', 'name': 'Lázaro Cárdenas (Periférico)', 'description': 'Av. Lázaro Cárdenas', 'category': 'street', 'coordinates': [-101.2, 19.7] },
  { 'id': 'cat-madero', 'name': 'Avenida Francisco I. Madero', 'description': 'Centro', 'category': 'street', 'coordinates': [-101.192, 19.702] },
  { 'id': 'cat-garcia-obeso', 'name': 'Avenida García de Obeso', 'description': 'Centro', 'category': 'street', 'coordinates': [-101.196, 19.701] },
  { 'id': 'cat-camelinas', 'name': 'Avenida Camelinas', 'description': 'Sur de Morelia', 'category': 'street', 'coordinates': [-101.195, 19.685] },
  { 'id': 'cat-periodismo', 'name': 'Avenida del Periodismo', 'description': 'Morelia', 'category': 'street', 'coordinates': [-101.205, 19.7] },
  { 'id': 'cat-santiago', 'name': 'Santiago Undameo', 'description': 'Tenencia', 'category': 'area', 'coordinates': [-101.28, 19.65] },
  { 'id': 'cat-jesus-monte', 'name': 'Jesús del Monte', 'description': 'Tenencia', 'category': 'area', 'coordinates': [-101.15, 19.65] },
  { 'id': 'cat-cointzio', 'name': 'Cointzio', 'description': 'Tenencia', 'category': 'area', 'coordinates': [-101.25, 19.63] },
  { 'id': 'cat-charo', 'name': 'Charo', 'description': 'Municipio vecino', 'category': 'area', 'coordinates': [-101.05, 19.75] },
  { 'id': 'cat-tarimbaro', 'name': 'Tarímbaro', 'description': 'Municipio vecino', 'category': 'area', 'coordinates': [-101.13, 19.8] },
  { 'id': 'cat-alberca', 'name': 'Alberca Olímpica / Metrópolis', 'description': 'Deportes / zona norte', 'category': 'sports', 'coordinates': [-101.215, 19.72] },
  { 'id': 'cat-palacio-clavas', 'name': 'Palacio del Arte', 'description': 'Cultura', 'category': 'culture', 'coordinates': [-101.185, 19.702] },
  { 'id': 'cat-teatro-ocampo', 'name': 'Teatro Ocampo', 'description': 'Centro Histórico', 'category': 'culture', 'coordinates': [-101.193, 19.7015] },
  { 'id': 'cat-biblioteca', 'name': 'Biblioteca Pública Universitaria', 'description': 'Centro', 'category': 'culture', 'coordinates': [-101.191, 19.701] },
  { 'id': 'cat-plaza-revolucion', 'name': 'Plaza Morelos / Revolución', 'description': 'Centro', 'category': 'park', 'coordinates': [-101.185, 19.703] },
  { 'id': 'cat-tres-puentes', 'name': 'Tres Puentes', 'description': 'Zona', 'category': 'area', 'coordinates': [-101.16, 19.71] },
  { 'id': 'cat-la-soledad', 'name': 'La Soledad', 'description': 'Colonia / zona', 'category': 'colonia', 'coordinates': [-101.14, 19.72] },
  { 'id': 'cat-issste-soledad', 'name': 'ISSSTE / La Soledad', 'description': 'Zona oriente', 'category': 'area', 'coordinates': [-101.15, 19.715] },
  { 'id': 'cat-villas-sol', 'name': 'Villas del Sol', 'description': 'Colonia', 'category': 'colonia', 'coordinates': [-101.22, 19.68] },
  { 'id': 'cat-oken', 'name': 'Oken / zona industrial', 'description': 'Morelia', 'category': 'area', 'coordinates': [-101.24, 19.72] },
  { 'id': 'cat-manantiales', 'name': 'Manantiales', 'description': 'Colonia', 'category': 'colonia', 'coordinates': [-101.21, 19.68] },
  { 'id': 'cat-eduardo-ruiz', 'name': 'Parque Eduardo Ruiz', 'description': 'Parque', 'category': 'park', 'coordinates': [-101.188, 19.705] },
  { 'id': 'cat-jardin-rosas', 'name': 'Jardín de las Rosas', 'description': 'Centro Histórico', 'category': 'park', 'coordinates': [-101.193, 19.704] },
  { 'id': 'cat-plaza-valladolid', 'name': 'Plaza Valladolid', 'description': 'Centro comercial', 'category': 'mall', 'coordinates': [-101.2, 19.71] },
  { 'id': 'cat-arco-san-pedro', 'name': 'Arcos de San Pedro', 'description': 'Zona', 'category': 'area', 'coordinates': [-101.17, 19.69] },
  { 'id': 'cat-atecuaro', 'name': 'Atécuaro', 'description': 'Comunidad', 'category': 'area', 'coordinates': [-101.22, 19.62] }
];

final List<PlaceModel> localCatalog = _rawCatalog.map((p) {
  final coords = (p['coordinates'] as List).map((e) => (e as num).toDouble()).toList();
  return PlaceModel(
    id: p['id'] as String,
    name: p['name'] as String,
    description: p['description'] as String?,
    category: p['category'] as String,
    coordinates: LatLng(coords[1], coords[0]), // [lng, lat] → LatLng
    source: PlaceSource.catalog,
  );
}).toList();

String _normalize(String s) {
  return s
      .toLowerCase()
      .replaceAll(RegExp(r'[áàäâ]'), 'a')
      .replaceAll(RegExp(r'[éèëê]'), 'e')
      .replaceAll(RegExp(r'[íìïî]'), 'i')
      .replaceAll(RegExp(r'[óòöô]'), 'o')
      .replaceAll(RegExp(r'[úùüû]'), 'u')
      .replaceAll(RegExp(r'[ñ]'), 'n')
      .trim();
}

int _levenshteinDistance(String s1, String s2) {
  final m = s1.length;
  final n = s2.length;
  final dp = List.generate(m + 1, (_) => List.filled(n + 1, 0));

  for (var i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (var j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (var i = 1; i <= m; i++) {
    for (var j = 1; j <= n; j++) {
      if (s1[i - 1] == s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = min(
          dp[i - 1][j] + 1, // delete
          min(
            dp[i][j - 1] + 1, // insert
            dp[i - 1][j - 1] + 1, // substitute
          ),
        );
      }
    }
  }
  return dp[m][n];
}

String _phoneticCode(String word) {
  var w = _normalize(word);
  if (w.isEmpty) return '';

  w = w.replaceAll('ch', 'X'); // Preserve ch
  w = w.replaceAll('h', ''); // Silent H
  w = w.replaceAll('X', 'ch');

  w = w.replaceAll('v', 'b'); // v -> b
  w = w.replaceAll('ll', 'y'); // ll -> y

  w = w.replaceAll(RegExp(r'c(?=[ei])'), 's'); // soft c -> s
  w = w.replaceAll('z', 's'); // z -> s

  w = w.replaceAll(RegExp(r'c(?=[aou])'), 'k'); // hard c -> k
  w = w.replaceAll(RegExp(r'c$'), 'k');
  w = w.replaceAll('q', 'k');

  w = w.replaceAll(RegExp(r'g(?=[ei])'), 'j'); // soft g -> j
  w = w.replaceAll('x', 's');

  // Remove consecutive duplicates
  if (w.isEmpty) return '';
  final cleaned = StringBuffer();
  var prev = '';
  for (var i = 0; i < w.length; i++) {
    final c = w[i];
    if (c != prev) {
      cleaned.write(c);
      prev = c;
    }
  }
  return cleaned.toString();
}

double _scorePlace(String query, PlaceModel place) {
  final q = _normalize(query);
  if (q.isEmpty) return 0;
  final name = _normalize(place.name);
  final desc = _normalize(place.description ?? '');
  final cat = _normalize(place.category);
  final nameTokens = name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  double score = 0;

  // 1) Strict match
  if (name == q) {
    score += 500;
  } else if (name.startsWith(q)) {
    score += 320;
  } else if (nameTokens.any((w) => w == q)) {
    score += 280;
  } else if (name.contains(q)) {
    score += 160;
  } else if (desc.contains(q)) {
    score += 90;
  } else if (cat.contains(q)) {
    score += 40;
  }

  final qTokens = q.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  double tokenHits = 0;
  for (final t in qTokens) {
    if (t.length < 2) continue;
    if (nameTokens.any((n) => n.startsWith(t) || n.contains(t))) {
      tokenHits++;
    } else if (desc.contains(t)) {
      tokenHits += 0.5;
    }
  }
  if (qTokens.isNotEmpty) {
    score += (tokenHits / qTokens.length) * 80;
  }

  // 2) Phonetic matching
  final qPhonetic = _phoneticCode(q);
  final namePhonetic = _phoneticCode(name);

  if (qPhonetic == namePhonetic) {
    score += 180;
  } else if (namePhonetic.startsWith(qPhonetic)) {
    score += 90;
  }

  final qPhoneticTokens = qTokens.where((w) => w.length >= 3).map(_phoneticCode).toList();
  final namePhoneticTokens = nameTokens.where((w) => w.length >= 3).map(_phoneticCode).toList();

  double phoneticHits = 0;
  for (final qP in qPhoneticTokens) {
    if (namePhoneticTokens.any((nP) => nP == qP)) {
      phoneticHits += 1.0;
    } else {
      for (final nP in namePhoneticTokens) {
        if ((qP.length - nP.length).abs() <= 2) {
          final dist = _levenshteinDistance(qP, nP);
          if (dist == 1) {
            phoneticHits += 0.75;
          } else if (dist == 2) {
            phoneticHits += 0.35;
          }
        }
      }
    }
  }
  if (qPhoneticTokens.isNotEmpty) {
    score += (phoneticHits / qPhoneticTokens.length) * 100;
  }

  // 3) Partial typos
  for (final word in nameTokens) {
    if (word.length < 3 || q.length < 3) continue;
    if (word.contains(q) || q.contains(word)) {
      score += 25;
      break;
    }
    if (word.substring(0, min(3, word.length)) == q.substring(0, min(3, q.length))) {
      score += 12;
    }
  }

  return score;
}

List<PlaceModel> searchLocalPlaces(String query, {int limit = 20}) {
  final q = query.trim();
  if (q.isEmpty) {
    return localCatalog.take(limit).toList();
  }

  final scored = localCatalog
      .map((p) => _ScoredPlace(place: p, score: _scorePlace(q, p)))
      .where((x) => x.score > 12)
      .toList();

  scored.sort((a, b) => b.score.compareTo(a.score));

  return scored.map((x) => x.place).take(limit).toList();
}

class _ScoredPlace {
  final PlaceModel place;
  final double score;

  _ScoredPlace({required this.place, required this.score});
}
