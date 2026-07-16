import React from 'react';

export const TERMINOS_UPDATED = '11 de julio de 2026';

type Props = {
  onOpenPrivacidad?: () => void;
  onClose?: () => void;
};

/**
 * Cuerpo de los términos de uso (reutilizado en /terminos y en el sheet de la app).
 */
export function TerminosContent({ onOpenPrivacidad, onClose }: Props) {
  return (
    <article className="max-w-none text-slate-700">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
        Términos de uso
      </h1>
      <p className="text-sm text-slate-500">Última actualización: {TERMINOS_UPDATED}</p>

      <p className="mt-4 leading-relaxed">
        Al usar ViaMorelia (web en{' '}
        <a href="https://viamorelia.org" className="font-semibold text-emerald-700 underline">
          viamorelia.org
        </a>{' '}
        o la aplicación móvil) aceptas estos términos. Si no estás de acuerdo, no uses el
        servicio.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">1. Qué es ViaMorelia</h2>
        <p className="leading-relaxed">
          ViaMorelia es una herramienta informativa para consultar corredores de transporte
          público en Morelia y planificar viajes por <strong>origen y destino</strong>. No
          vendemos boletos, no operamos combis ni autobuses, y no garantizamos horarios en
          tiempo real de las unidades.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">2. Uso permitido</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Consultar rutas y planificar trayectos de forma personal o informativa.</li>
          <li>Compartir enlaces de viaje generados por la app.</li>
          <li>Reportar errores de trazos cuando la función esté disponible.</li>
        </ul>
        <p className="leading-relaxed">
          No está permitido abusar de las APIs, intentar saturar el servicio, extraer datos
          de forma masiva automatizada sin autorización, ni usar la app para actividades
          ilícitas.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">3. Puntos de subida y bajada</h2>
        <p className="leading-relaxed">
          Los puntos de <strong>subida, bajada y transbordo</strong> son{' '}
          <strong>sugeridos</strong> (aproximados). <strong>No son paradas oficiales</strong>.
          Debes confirmar en la calle cómo se detiene realmente el servicio y priorizar tu
          seguridad.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">4. Exactitud del mapa</h2>
        <p className="leading-relaxed">
          Los trazos se basan en datos procesados y validados con herramientas GIS, pero
          pueden contener errores, desfases o rutas en revisión. El basemap y el geocoding
          dependen de terceros y de la red. ViaMorelia se ofrece “tal cual”, sin garantía de
          exactitud total ni disponibilidad ininterrumpida.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">5. GPS y micrófono</h2>
        <p className="leading-relaxed">
          Funciones opcionales. El uso del GPS en movimiento (“Seguir mi viaje”) es una ayuda
          aproximada: no sustituye la atención al entorno ni a la señalización del transporte.
          La voz solo rellena campos de búsqueda.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">6. Cuentas y favoritos</h2>
        <p className="leading-relaxed">
          El pasajero no necesita cuenta. Favoritos y recientes son locales al dispositivo. Si
          cambias de teléfono o borras datos, no hay sincronización en la nube de pasajeros.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">7. Propiedad intelectual</h2>
        <p className="leading-relaxed">
          Marca, diseño e implementación de ViaMorelia están protegidos en la medida que
          permita la ley. Datos cartográficos de terceros (OSM, Carto, etc.) se rigen por sus
          propias licencias. No copies la app ni sus marcas sin permiso.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">8. Limitación de responsabilidad</h2>
        <p className="leading-relaxed">
          En la máxima medida permitida por la ley mexicana aplicable, ViaMorelia y sus
          colaboradores no responden por daños derivados del uso o imposibilidad de uso del
          servicio (pérdidas de tiempo, conexiones fallidas, rutas desactualizadas, decisiones
          de viaje, etc.). Viajas bajo tu propia responsabilidad.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">9. Cambios del servicio</h2>
        <p className="leading-relaxed">
          Podemos modificar, suspender o discontinuar funciones (incluyendo la app nativa o la
          web) sin aviso previo cuando sea necesario por mantenimiento, seguridad o evolución
          del producto.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">10. Ley aplicable</h2>
        <p className="leading-relaxed">
          Estos términos se interpretan conforme a las leyes de los Estados Unidos Mexicanos.
          Cualquier controversia se someterá a los tribunales competentes en Morelia,
          Michoacán, salvo normas imperativas en contrario.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">11. Privacidad</h2>
        <p className="leading-relaxed">
          El tratamiento de datos se describe en la{' '}
          {onOpenPrivacidad ? (
            <button
              type="button"
              onClick={onOpenPrivacidad}
              className="font-semibold text-emerald-700 underline cursor-pointer"
            >
              política de privacidad
            </button>
          ) : (
            <a href="/privacidad" className="font-semibold text-emerald-700 underline">
              política de privacidad
            </a>
          )}
          .
        </p>
      </section>

      <p className="mt-10 text-sm text-slate-600">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-emerald-700 underline cursor-pointer"
          >
            Volver al mapa
          </button>
        ) : (
          <a href="/" className="font-semibold text-emerald-700 underline">
            Volver al mapa
          </a>
        )}
      </p>
    </article>
  );
}
