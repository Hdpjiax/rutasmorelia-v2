import type { Metadata } from 'next';
import { PrivacidadContent } from '@/components/legal/privacidad-content';

export const metadata: Metadata = {
  title: 'Política de privacidad — ViaMorelia',
  description:
    'Cómo ViaMorelia trata ubicación, micrófono, favoritos locales y telemetría anónima. Sin cuentas de pasajero.',
};

export default function PrivacidadPage() {
  return <PrivacidadContent />;
}
