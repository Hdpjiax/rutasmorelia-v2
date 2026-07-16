import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/via_theme.dart';
import 'ui/screens/bootstrap_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemNavigationBarColor: ViaColors.paper,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));
  runApp(const ProviderScope(child: ViaMoreliaApp()));
}

class ViaMoreliaApp extends StatelessWidget {
  const ViaMoreliaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vía Morelia',
      debugShowCheckedModeBanner: false,
      theme: ViaTheme.light,
      home: const BootstrapScreen(),
    );
  }
}
