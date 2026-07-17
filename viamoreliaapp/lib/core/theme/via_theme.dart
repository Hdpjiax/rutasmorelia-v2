import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
///  Vía Morelia — sistema de diseño premium
/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
///
///  Filosofía visual:
///    Morelia es cantera rosa, cielo limpio, vegetación abundante y
///    tradición viva.  La paleta evoca el equilibrio entre lo urbano
///    y lo natural con colores profundos, cálidos y contemporáneos.
///
///  Colores principales:
///    • Petróleo   (#005B57) —  ancla, navegación, identidad
///    • Bosque     (#003F3C) —  profundidad, variante oscura
///    • Esmeralda  (#008F7A) —  secundario, frescura, confianza
///    • Dorado     (#F5B719) —  acento, calidez, atardecer
///    • Carbón     (#17302C) —  texto principal, casi negro verdoso
///    • Marfil     (#FAFAF6) —  fondo, calidez lumínica
///
///  Tipografía:
///    • Sora (Google Fonts) — titulares.  Geométrica con carácter,
///      personalidad fuerte y legible en displays.
///    • DM Sans (Google Fonts) — cuerpo.  Limpia, humanista, gran
///      legibilidad en pantalla.
///
///  Nomenclatura heredada:
///    • `mint` / `mintSoft` / `mintDark` → ahora petróleo / bosque.
///    • `violet` / `violetSoft`           → ahora esmeralda.
///    • `sky` / `skySoft`                 → ahora turquesa.
///    • `coral` se conserva (#E85D4C) para destino en mapa;
///      `coralBrand` (#D94B45) es el rojo coral de marca (error).
///    • `amber` se conserva (#E6A700) para transferencia en mapa.
///    • Todos los alias legacy (`primary`, `secondary`, `terracotta`,
///      `charcoal`, `teal`, `magenta`, `emerald`, etc.) siguen
///      compilando y apuntan a los nuevos colores de marca.
/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ViaColors {
  const ViaColors._();

  // ═══════════════════════════════════════════════════
  //  BRAND — paleta principal
  // ═══════════════════════════════════════════════════

  /// Petróleo: ancla de navegación, identidad primaria
  static const Color petroleo = Color(0xFF005B57);
  static const Color petroleoSoft = Color(0xFFE0F0EF);

  /// Bosque: variante oscura del primario
  static const Color bosque = Color(0xFF003F3C);

  /// Esmeralda: secundario, frescura y confianza
  static const Color esmeralda = Color(0xFF008F7A);
  static const Color esmeraldaSoft = Color(0xFFE0F5F1);

  /// Verde vivo: activo / éxito
  static const Color verdeVivo = Color(0xFF58A91D);

  /// Dorado Morelia: acento premium, CTA
  static const Color dorado = Color(0xFFF5B719);
  static const Color doradoSoft = Color(0xFFFEF5D6);

  /// Ámbar oscuro: variante del acento
  static const Color amberDark = Color(0xFFD98A00);

  /// Carbón verdoso: texto principal
  static const Color carbon = Color(0xFF17302C);
  static const Color carbonSoft = Color(0xFF4A6259);

  /// Marfil cálido: fondo de pantalla
  static const Color marfil = Color(0xFFFAFAF6);

  // ═══════════════════════════════════════════════════
  //  MAP-FACING — semántica de mapa
  // ═══════════════════════════════════════════════════

  /// Coral (destino mapa) — se conserva su valor original
  static const Color coral = Color(0xFFE85D4C);
  static const Color coralSoft = Color(0xFFFFE8E4);

  /// Coral de marca (error / destino brand)
  static const Color coralBrand = Color(0xFFD94B45);

  /// Ámbar (transferencia mapa) — se conserva
  static const Color amber = Color(0xFFE6A700);
  static const Color amberSoft = Color(0xFFFFF3C4);

  /// Turquesa (origen / info mapa) — reemplaza sky
  static const Color turquoise = Color(0xFF009CB5);
  static const Color turquoiseSoft = Color(0xFFD6F2FA);

  // ═══════════════════════════════════════════════════
  //  ACENTOS PREMIUM (se conservan)
  // ═══════════════════════════════════════════════════

  static const Color rose = Color(0xFFE11D48);
  static const Color roseLight = Color(0xFFFECDD3);

  // ═══════════════════════════════════════════════════
  //  GRADIENTES
  // ═══════════════════════════════════════════════════

  /// Petróleo → dorado (brand principal)
  static const LinearGradient gradientPrimary = LinearGradient(
    colors: [petroleo, dorado],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Bosque → petróleo (profundidad)
  static const LinearGradient gradientPetroleo = LinearGradient(
    colors: [bosque, petroleo],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Dorado → ámbar oscuro (cálido, atardecer)
  static const LinearGradient gradientDorado = LinearGradient(
    colors: [dorado, amberDark],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Esmeralda → esmeralda claro (naturaleza)
  static const LinearGradient gradientEmerald = LinearGradient(
    colors: [esmeralda, esmeraldaSoft],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Coral → rose (destino, error, urgencia)
  static const LinearGradient gradientRose = LinearGradient(
    colors: [Color(0xFFE11D48), Color(0xFFF43F5E)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Carbón → carbón soft (oscuro premium)
  static const LinearGradient gradientCharcoal = LinearGradient(
    colors: [carbon, carbonSoft],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ── Gradientes heredados (siguen compilando) ──────

  static const LinearGradient gradientTeal = gradientPetroleo;
  static const LinearGradient gradientMagenta = gradientEmerald;
  static const LinearGradient gradientGold = gradientDorado;

  // ═══════════════════════════════════════════════════
  //  COLORES SEMÁNTICOS DEL MAPA
  // ═══════════════════════════════════════════════════

  static const Color origin = turquoise;
  static const Color destination = coral;
  static const Color transfer = amber;
  static const Color walkToBoard = Color(0xFF3B82F6);
  static const Color walkFromAlight = Color(0xFFA855F7);
  static const Color walkTransfer = amber;

  // ═══════════════════════════════════════════════════
  //  SUPERFICIES — MODO CLARO
  // ═══════════════════════════════════════════════════

  /// Fondo base: marfil cálido
  static const Color paper = marfil;
  static const Color paperElevated = Color(0xFFFFFFFF);
  static const Color paperTint = Color(0xFFF2F2EC);

  /// Texto sobre claro
  static const Color ink = carbon;
  static const Color inkSoft = carbonSoft;
  static const Color textPrimary = ink;
  static const Color textSecondary = Color(0xFF64736F);
  static const Color textMuted = Color(0xFF8A9E98);

  /// Líneas divisorias y scrim
  static const Color hairline = Color(0xFFDCE9E4);
  static const Color hairlineStrong = Color(0xFFC5D6D0);
  static const Color scrim = Color(0x6617302C);

  // ═══════════════════════════════════════════════════
  //  SUPERFICIES — MODO OSCURO
  // ═══════════════════════════════════════════════════

  static const Color darkPaper = Color(0xFF121C1A);
  static const Color darkPaperElevated = Color(0xFF1A2825);
  static const Color darkPaperTint = Color(0xFF22322E);
  static const Color darkInk = Color(0xFFE0EDEA);
  static const Color darkInkSoft = Color(0xFFC4D8D0);
  static const Color darkTextPrimary = darkInk;
  static const Color darkTextSecondary = Color(0xFF8FA39D);
  static const Color darkTextMuted = Color(0xFF6B7F78);
  static const Color darkHairline = Color(0xFF1E2E2A);
  static const Color darkHairlineStrong = Color(0xFF2E3E3A);
  static const Color darkScrim = Color(0x99E0EDEA);

  // ═══════════════════════════════════════════════════
  //  ALIASES LEGACY NUEVA MARCA
  // ═══════════════════════════════════════════════════

  /// AHORA es petróleo (antes terracota)
  static const Color terracotta = petroleo;
  static const Color terracottaSoft = petroleoSoft;

  /// AHORA es carbón verdoso (antes carbón cálido)
  static const Color charcoal = carbon;
  static const Color charcoalSoft = carbonSoft;

  /// AHORA es dorado #F5B719 (antes #D49A2A)
  static const Color gold = dorado;
  static const Color goldSoft = doradoSoft;

  /// AHORA es petróleo (antes teal)
  static const Color teal = petroleo;
  static const Color tealSoft = petroleoSoft;
  static const Color tealDark = bosque;

  /// AHORA es esmeralda (antes magenta)
  static const Color magenta = esmeralda;
  static const Color magentaSoft = esmeraldaSoft;

  /// AHORA apunta a esmeralda de marca (antes #059669)
  static const Color emerald = esmeralda;
  static const Color emeraldLight = esmeraldaSoft;

  /// AHORA es petróleo (antes mint green)
  static const Color mint = petroleo;
  static const Color mintSoft = petroleoSoft;
  static const Color mintDark = bosque;

  /// AHORA es esmeralda (antes violeta)
  static const Color violet = esmeralda;
  static const Color violetSoft = esmeraldaSoft;

  /// AHORA es turquesa (antes azul cielo)
  static const Color sky = turquoise;
  static const Color skySoft = turquoiseSoft;

  // ═══════════════════════════════════════════════════
  //  ALIASES FUNCIONALES — compatibilidad garantizada
  // ═══════════════════════════════════════════════════

  static const Color primary = petroleo;
  static const Color secondary = esmeralda;
  static const Color accent = dorado;
  static const Color cardBg = paperElevated;
  static const Color border = hairline;
  static const Color textLight = textSecondary;
  static const Color panel = paperElevated;
  static const Color panelSolid = paperElevated;
  static const Color inkElevated = paperElevated;
  static const Color inkOnPaper = ink;
}

/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
///  RADIOS
/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ViaRadii {
  const ViaRadii._();

  static const double sm = 10;
  static const double md = 14;
  static const double lg = 18;
  static const double xl = 22;
  static const double pill = 999;

  static const double card = 16;
  static const double input = 12;
  static const double button = 12;
  static const double badge = 8;
}

/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
///  SOMBRAS / ELEVACIÓN — tono cálido
/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ViaShadow {
  const ViaShadow._();

  static const List<BoxShadow> none = [];

  static const List<BoxShadow> sm = [
    BoxShadow(
      color: Color(0x0D1E1814),
      blurRadius: 4,
      offset: Offset(0, 1),
    ),
  ];

  static const List<BoxShadow> md = [
    BoxShadow(
      color: Color(0x121E1814),
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
    BoxShadow(
      color: Color(0x081E1814),
      blurRadius: 4,
      offset: Offset(0, 1),
    ),
  ];

  static const List<BoxShadow> lg = [
    BoxShadow(
      color: Color(0x1A1E1814),
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
    BoxShadow(
      color: Color(0x0D1E1814),
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
  ];

  static const List<BoxShadow> xl = [
    BoxShadow(
      color: Color(0x241E1814),
      blurRadius: 24,
      offset: Offset(0, 8),
    ),
    BoxShadow(
      color: Color(0x101E1814),
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];

  /// Elevación dinámica — pide un nivel del 1 al 5
  static List<BoxShadow> elevation(int level) {
    final map = const [none, sm, md, lg, xl];
    return map[level.clamp(0, 4)];
  }
}

/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
///  MOVIMIENTO / ANIMACIÓN
/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
///
///  Filosofía de motion:
///    • Duración más corta que lo habitual → sensación reactiva y
///      premium (no «elástica» ni lenta).
///    • Curvas cúbicas agresivas para la entrada, suaves para la salida.
///    • Respetar la atención del usuario: nada de animaciones
///      ornamentales que compitan con el contenido.

class ViaMotion {
  const ViaMotion._();

  // ── Duraciones ──────────────────────────────────────
  /// 60 ms — feedback táctil, micro-interacciones
  static const Duration instant = Duration(milliseconds: 60);

  /// 120 ms — hover, press, toggle
  static const Duration quick = Duration(milliseconds: 120);

  /// 200 ms — transiciones de UI estándar (snappy)
  static const Duration normal = Duration(milliseconds: 200);

  /// 300 ms — sheets, paneles, modales
  static const Duration sheet = Duration(milliseconds: 300);

  /// 600 ms — splash, reveal, hero
  static const Duration splash = Duration(milliseconds: 600);

  /// 3.2 s — loop de flecha de ruta
  static const Duration arrowLoop = Duration(milliseconds: 3200);

  /// 1 s — pulso del orb
  static const Duration orbPulse = Duration(milliseconds: 1000);

  // ── Curvas ──────────────────────────────────────────
  /// Salida cúbica agresiva — para casi todo
  static const Curve easeOut = Curves.easeOutCubic;

  /// Entrada cúbica — para elementos que desaparecen
  static const Curve easeIn = Curves.easeInCubic;

  /// Salida expo — para sheets y modales (muy premium)
  static const Curve easeOutExpo = Curves.easeOutExpo;

  /// Resorte sutil (easeOutBack) — para toques de personalidad
  static const Curve bounce = Curves.easeOutBack;

  /// Resorte más contenido que bounce
  static const Curve spring = Curves.easeOutBack;

  /// Transición suave entrada/salida
  static const Curve smooth = Curves.easeInOutCubic;

  /// Rebote más pronunciado — para notificaciones / toast
  static const Curve pop = Curves.easeOutBack;
}

/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
///  TEMA
/// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ViaTheme {
  const ViaTheme._();

  // ── Texto base ──────────────────────────────────────

  static TextTheme _buildSoraDmSansTextTheme(TextTheme base) {
    final body = GoogleFonts.dmSansTextTheme(base).apply(
      bodyColor: ViaColors.textPrimary,
      displayColor: ViaColors.textPrimary,
    );
    return GoogleFonts.soraTextTheme(body);
  }

  static TextTheme _buildDarkTextTheme(TextTheme base) {
    final body = GoogleFonts.dmSansTextTheme(base).apply(
      bodyColor: ViaColors.darkTextPrimary,
      displayColor: ViaColors.darkTextPrimary,
    );
    return GoogleFonts.soraTextTheme(body);
  }

  // ── Light ───────────────────────────────────────────

  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: ViaColors.paper,
    );

    final tt = _buildSoraDmSansTextTheme(base.textTheme);

    return base.copyWith(
      colorScheme: const ColorScheme.light(
        primary: ViaColors.petroleo,
        secondary: ViaColors.esmeralda,
        tertiary: ViaColors.turquoise,
        surface: ViaColors.paperElevated,
        onSurface: ViaColors.textPrimary,
        error: ViaColors.coralBrand,
      ),
      textTheme: tt.copyWith(
        headlineLarge: tt.headlineLarge?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.8,
        ),
        headlineMedium: tt.headlineMedium?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.4,
        ),
        titleLarge: tt.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        titleMedium: tt.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        bodyMedium: tt.bodyMedium?.copyWith(height: 1.4),
        labelLarge: tt.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
      splashFactory: InkSparkle.splashFactory,
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ViaColors.petroleo,
          foregroundColor: Colors.white,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ViaRadii.md),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ViaColors.ink,
          side: const BorderSide(color: ViaColors.hairlineStrong),
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ViaRadii.md),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: ViaColors.paperTint,
        hintStyle: const TextStyle(color: ViaColors.textMuted, fontWeight: FontWeight.w500),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViaRadii.input),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViaRadii.input),
          borderSide: const BorderSide(color: ViaColors.hairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViaRadii.input),
          borderSide: const BorderSide(color: ViaColors.petroleo, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.transparent,
        modalBackgroundColor: Colors.transparent,
        elevation: 0,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: ViaColors.ink,
        contentTextStyle: const TextStyle(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ViaRadii.md)),
      ),
    );
  }

  // ── Dark ────────────────────────────────────────────

  static ThemeData get dark {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: ViaColors.darkPaper,
    );

    final tt = _buildDarkTextTheme(base.textTheme);

    return base.copyWith(
      colorScheme: const ColorScheme.dark(
        primary: ViaColors.dorado,
        secondary: ViaColors.esmeralda,
        tertiary: ViaColors.turquoise,
        surface: ViaColors.darkPaperElevated,
        onSurface: ViaColors.darkTextPrimary,
        error: ViaColors.coralBrand,
      ),
      textTheme: tt.copyWith(
        headlineLarge: tt.headlineLarge?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.8,
        ),
        headlineMedium: tt.headlineMedium?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.4,
        ),
        titleLarge: tt.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        titleMedium: tt.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        bodyMedium: tt.bodyMedium?.copyWith(height: 1.4),
        labelLarge: tt.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),
      splashFactory: InkSparkle.splashFactory,
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ViaColors.dorado,
          foregroundColor: ViaColors.darkPaper,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ViaRadii.md),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ViaColors.darkTextPrimary,
          side: const BorderSide(color: ViaColors.darkHairlineStrong),
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ViaRadii.md),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: ViaColors.darkPaperTint,
        hintStyle: const TextStyle(
          color: ViaColors.darkTextMuted,
          fontWeight: FontWeight.w500,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViaRadii.input),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViaRadii.input),
          borderSide: const BorderSide(color: ViaColors.darkHairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViaRadii.input),
          borderSide: const BorderSide(color: ViaColors.dorado, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.transparent,
        modalBackgroundColor: Colors.transparent,
        elevation: 0,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: ViaColors.darkPaperElevated,
        contentTextStyle: const TextStyle(color: ViaColors.darkTextPrimary),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ViaRadii.md)),
      ),
    );
  }

  // ── Helpers de compatibilidad ───────────────────────

  static ThemeData get lightTheme => light;
  static ThemeData get darkTheme => dark;
}
