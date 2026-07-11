import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de privacidad — ViaMorelia',
  description:
    'Cómo ViaMorelia trata ubicación, micrófono, favoritos locales y telemetría anónima. Sin cuentas de pasajero.',
};

const UPDATED = '11 de julio de 2026';

export default function PrivacidadPage() {
  return (
    <article className="prose prose-slate prose-sm max-w-none">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
        Política de privacidad
      </h1>
      <p className="text-sm text-slate-500">Última actualización: {UPDATED}</p>

      <p className="mt-4 leading-relaxed text-slate-700">
        ViaMorelia es una aplicación web y móvil para consultar y planificar viajes en el
        transporte público de Morelia (origen → destino). Esta política describe de forma
        clara qué datos se usan y con qué fin.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">1. Resumen</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-slate-700">
          <li>
            <strong>No pedimos cuenta</strong> de pasajero (ni Google ni correo) para usar el
            mapa y planificar viajes.
          </li>
          <li>
            <strong>Favoritos y recientes</strong> se guardan solo en tu dispositivo
            (almacenamiento local del navegador o app).
          </li>
          <li>
            <strong>Ubicación (GPS)</strong> y <strong>micrófono</strong> solo se usan si tú
            los activas (botones de GPS o búsqueda por voz).
          </li>
          <li>
            Puede enviarse <strong>telemetría anónima</strong> de uso (sin nombre ni email) para
            mejorar la app.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">2. Responsable</h2>
        <p className="text-slate-700 leading-relaxed">
          El servicio se ofrece bajo la marca <strong>ViaMorelia</strong>, orientado a usuarios
          en Morelia, Michoacán, México. Sitio principal:{' '}
          <a href="https://viamorelia.org" className="font-semibold text-emerald-700 underline">
            viamorelia.org
          </a>
          .
        </p>
        <p className="text-slate-700 leading-relaxed">
          Para consultas sobre privacidad puedes usar el canal de contacto publicado en el
          sitio o en las fichas de tiendas cuando estén disponibles.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">3. Datos que tratamos</h2>

        <h3 className="text-base font-semibold text-slate-800">3.1 En tu dispositivo</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-slate-700">
          <li>Rutas y direcciones marcadas como favoritas.</li>
          <li>Búsquedas y lugares recientes.</li>
          <li>Último viaje buscado (si aplica) y preferencias de UI.</li>
          <li>
            Caché de catálogo de rutas / archivos GeoJSON (Service Worker e IndexedDB) para uso
            con poca o sin conexión.
          </li>
        </ul>
        <p className="text-slate-700 leading-relaxed">
          Estos datos <strong>no se suben a una cuenta de usuario</strong>. Si borras datos del
          sitio/app o desinstalas, se pierden.
        </p>

        <h3 className="mt-4 text-base font-semibold text-slate-800">3.2 Ubicación (GPS)</h3>
        <p className="text-slate-700 leading-relaxed">
          Solo con tu permiso del sistema o del navegador. Se usa para “mi ubicación”,
          centrar el mapa y, si activas “Seguir mi viaje”, avisar cerca del punto de bajada
          sugerido. No hacemos seguimiento en segundo plano de forma permanente fuera de esa
          función en pantalla.
        </p>

        <h3 className="mt-4 text-base font-semibold text-slate-800">3.3 Micrófono</h3>
        <p className="text-slate-700 leading-relaxed">
          Solo si usas la búsqueda por voz. El audio se procesa en el dispositivo/navegador
          (reconocimiento de voz del sistema o del motor del WebView) para rellenar origen o
          destino. No almacenamos grabaciones de audio en nuestros servidores.
        </p>

        <h3 className="mt-4 text-base font-semibold text-slate-800">3.4 Búsquedas de lugares</h3>
        <p className="text-slate-700 leading-relaxed">
          El texto que escribes puede enviarse a servicios de geocodificación (por ejemplo
          OpenStreetMap / Nominatim u otros configurados) para proponer direcciones en Morelia.
          Evita escribir datos personales innecesarios en el buscador.
        </p>

        <h3 className="mt-4 text-base font-semibold text-slate-800">3.5 Telemetría anónima</h3>
        <p className="text-slate-700 leading-relaxed">
          Podemos registrar eventos técnicos sin identificarte (por ejemplo: panel abierto,
          plan de viaje vacío o con resultados, error al cargar una ruta, modo offline). No
          incluyen tu nombre, email ni el contenido de favoritos.
        </p>

        <h3 className="mt-4 text-base font-semibold text-slate-800">3.6 Reportes de rutas</h3>
        <p className="text-slate-700 leading-relaxed">
          Si envías un reporte sobre una ruta, se transmite la información que indiques en ese
          formulario (motivo, id de ruta) para mejorar el mapa. No uses datos personales de
          terceros.
        </p>

        <h3 className="mt-4 text-base font-semibold text-slate-800">3.7 Administración</h3>
        <p className="text-slate-700 leading-relaxed">
          El panel de control de calidad (`/admin`) es solo para personal autorizado y puede
          usar autenticación (p. ej. Supabase). Eso no aplica a los pasajeros que solo usan el
          mapa.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">4. Bases y finalidades</h2>
        <p className="text-slate-700 leading-relaxed">
          Tratamos datos para prestar el servicio de consulta de rutas, mejorar la estabilidad
          y la calidad del mapa, y cumplir obligaciones legales aplicables. La ubicación y el
          micrófono se basan en tu <strong>consentimiento</strong> (permisos del sistema).
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">5. Terceros y mapa</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-slate-700">
          <li>
            <strong>Mapa base</strong> (p. ej. estilos Carto Positron / teselas abiertas): el
            proveedor puede recibir la IP y solicitudes de tiles al mostrar el mapa.
          </li>
          <li>
            <strong>Alojamiento</strong> (p. ej. Vercel) y, si aplica,{' '}
            <strong>Supabase</strong> para funciones de admin o backend.
          </li>
          <li>
            <strong>Geocodificación / ruteo peatonal</strong> vía APIs del propio sitio o
            proveedores de datos abiertos.
          </li>
        </ul>
        <p className="text-slate-700 leading-relaxed">
          No vendemos tus datos personales a terceros con fines publicitarios.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">6. Conservación</h2>
        <p className="text-slate-700 leading-relaxed">
          Los datos en tu dispositivo permanecen hasta que los borres o desinstales. La
          telemetría en servidor, si se almacena, se retiene solo el tiempo necesario para
          diagnóstico y mejora (típicamente de forma agregada o con rotación corta).
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">7. Tus opciones</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-slate-700">
          <li>Denegar o revocar GPS y micrófono en los ajustes del sistema o del navegador.</li>
          <li>
            Borrar datos del sitio (Chrome: Configuración del sitio → Borrar datos) o
            desinstalar la app.
          </li>
          <li>Usar “Limpiar” en la app para borrar el viaje actual del mapa.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">8. Menores</h2>
        <p className="text-slate-700 leading-relaxed">
          El servicio está pensado para uso general de transporte. Si eres menor de edad,
          úsalo con supervisión de un adulto cuando la ley lo requiera.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">9. Cambios</h2>
        <p className="text-slate-700 leading-relaxed">
          Podemos actualizar esta política. La fecha de “última actualización” indica la
          versión vigente. El uso continuado tras cambios relevantes implica que has podido
          revisarlos en esta página.
        </p>
      </section>

      <p className="mt-10 text-sm text-slate-600">
        También puedes consultar los{' '}
        <Link href="/terminos" className="font-semibold text-emerald-700 underline">
          términos de uso
        </Link>
        .
      </p>
    </article>
  );
}
