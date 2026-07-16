import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

/// "Horizon Paper" — chrome claro alineado al mapa Carto Positron.
/// No negro: papel cálido-azulado + acentos de transporte.
class ViaColors {
  const ViaColors._();

  // Brand
  static const Color mint = Color(0xFF0F9F8A);
  static const Color mintSoft = Color(0xFFD8F5EF);
  static const Color coral = Color(0xFFE85D4C);
  static const Color coralSoft = Color(0xFFFFE8E4);
  static const Color violet = Color(0xFF7C6CF0);
  static const Color violetSoft = Color(0xFFEDE9FE);
  static const Color amber = Color(0xFFE6A700);
  static const Color amberSoft = Color(0xFFFFF3C4);
  static const Color sky = Color(0xFF2B9CDB);
  static const Color skySoft = Color(0xFFDDF2FC);

  // Semantic map
  static const Color origin = sky;
  static const Color destination = coral;
  static const Color transfer = amber;
  static const Color walkToBoard = Color(0xFF3B82F6);
  static const Color walkFromAlight = Color(0xFFA855F7);
  static const Color walkTransfer = amber;

  // Surfaces (light, map-parity)
  static const Color paper = Color(0xFFF4F6F8); // close to basemap
  static const Color paperElevated = Color(0xFFFFFFFF);
  static const Color paperTint = Color(0xFFEEF3F6);
  static const Color ink = Color(0xFF142033);
  static const Color inkSoft = Color(0xFF3D4F66);
  static const Color textPrimary = Color(0xFF142033);
  static const Color textSecondary = Color(0xFF5B6B7F);
  static const Color textMuted = Color(0xFF8A97A8);
  static const Color hairline = Color(0xFFD7DEE7);
  static const Color hairlineStrong = Color(0xFFC5CFDB);
  static const Color scrim = Color(0x660F172A);

  // Legacy aliases
  static const Color primary = mint;
  static const Color secondary = coral;
  static const Color accent = amber;
  static const Color cardBg = paperElevated;
  static const Color border = hairline;
  static const Color textLight = textSecondary;
  static const Color panel = paperElevated;
  static const Color panelSolid = paperElevated;
  static const Color inkElevated = paperElevated;
  static const Color inkOnPaper = ink;
}

class ViaRadii {
  const ViaRadii._();
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 18;
  static const double xl = 22;
  static const double pill = 999;
}

class ViaMotion {
  const ViaMotion._();
  static const Duration instant = Duration(milliseconds: 90);
  static const Duration quick = Duration(milliseconds: 180);
  static const Duration normal = Duration(milliseconds: 320);
  static const Duration sheet = Duration(milliseconds: 420);
  static const Duration splash = Duration(milliseconds: 900);
  static const Duration arrowLoop = Duration(milliseconds: 4200);
  static const Duration orbPulse = Duration(milliseconds: 1400);

  static const Curve easeOut = Curves.easeOutCubic;
  static const Curve easeIn = Curves.easeInCubic;
  static const Curve easeOutExpo = Curves.easeOutExpo;
  static const Curve bounce = Curves.easeOutBack;
}

class ViaTheme {
  const ViaTheme._();

  static ThemeData get light {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: ViaColors.paper,
    );

    final body = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
      bodyColor: ViaColors.textPrimary,
      displayColor: ViaColors.textPrimary,
    );
    final display = GoogleFonts.soraTextTheme(body);

    return base.copyWith(
      colorScheme: const ColorScheme.light(
        primary: ViaColors.mint,
        secondary: ViaColors.coral,
        tertiary: ViaColors.violet,
        surface: ViaColors.paperElevated,
        onSurface: ViaColors.textPrimary,
        error: Color(0xFFDC3D4A),
      ),
      textTheme: display.copyWith(
        headlineLarge: display.headlineLarge?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.8,
        ),
        headlineMedium: display.headlineMedium?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.4,
        ),
        titleLarge: display.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        titleMedium: body.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        bodyMedium: body.bodyMedium?.copyWith(height: 1.4),
        labelLarge: body.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
      splashFactory: InkSparkle.splashFactory,
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ViaColors.mint,
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
          borderRadius: BorderRadius.circular(ViaRadii.md),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViaRadii.md),
          borderSide: const BorderSide(color: ViaColors.hairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ViaRadii.md),
          borderSide: const BorderSide(color: ViaColors.mint, width: 1.5),
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

  static ThemeData get dark => light;
  static ThemeData get lightTheme => light;
}
