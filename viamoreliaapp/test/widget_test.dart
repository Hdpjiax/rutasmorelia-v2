import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:viamoreliaapp/main.dart';

void main() {
  testWidgets('Bootstrap muestra carga de catálogo', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: ViaMoreliaApp()));
    // First frame
    await tester.pump();
    expect(find.textContaining('Cargando'), findsWidgets);
    // Clear flutter_animate timers
    await tester.pump(const Duration(seconds: 3));
  });
}
