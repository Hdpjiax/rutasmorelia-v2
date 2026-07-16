import type { Metadata } from 'next';
import { TerminosContent } from '@/components/legal/terminos-content';

export const metadata: Metadata = {
  title: 'Términos de uso — ViaMorelia',
  description:
    'Condiciones de uso de ViaMorelia: mapa de transporte público de Morelia, puntos sugeridos y limitaciones del servicio.',
};

export default function TerminosPage() {
  return <TerminosContent />;
}
