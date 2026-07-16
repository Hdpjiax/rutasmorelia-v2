import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../state/app_controller.dart';

class ReportRouteDialog extends ConsumerStatefulWidget {
  const ReportRouteDialog({super.key});

  @override
  ConsumerState<ReportRouteDialog> createState() => _ReportRouteDialogState();
}

class _ReportRouteDialogState extends ConsumerState<ReportRouteDialog> {
  String _reason = 'trace_wrong';
  final _note = TextEditingController();
  bool _sending = false;

  static const reasons = {
    'trace_wrong': 'El trazo no coincide con la calle',
    'no_longer_passes': 'Ya no pasa por ahí',
    'missing_route': 'Falta una ruta',
    'wrong_name': 'Nombre incorrecto',
    'direction_wrong': 'Sentido ida/vuelta mal',
    'other': 'Otro',
  };

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: ViaColors.paperElevated,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ViaRadii.lg)),
      title: const Text('Reportar ruta', style: TextStyle(fontWeight: FontWeight.w900)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Ayúdanos a mejorar los corredores. El reporte es anónimo.',
              style: TextStyle(color: ViaColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            ...reasons.entries.map(
              (e) => RadioListTile<String>(
                dense: true,
                value: e.key,
                groupValue: _reason,
                title: Text(e.value, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                activeColor: ViaColors.mint,
                onChanged: (v) => setState(() => _reason = v!),
              ),
            ),
            TextField(
              controller: _note,
              maxLength: 500,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Detalle opcional',
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(
          onPressed: _sending
              ? null
              : () async {
                  setState(() => _sending = true);
                  final ok = await ref
                      .read(appControllerProvider.notifier)
                      .reportRoute(_reason, note: _note.text.trim());
                  if (!context.mounted) return;
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(ok ? 'Reporte enviado. Gracias.' : 'No se pudo enviar. Intenta más tarde.'),
                    ),
                  );
                },
          child: _sending
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('Enviar'),
        ),
      ],
    );
  }
}
