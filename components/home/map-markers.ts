/** DOM markers de origen/destino / GPS en vivo para MapLibre */

export function createOrbElement(kind: 'origin' | 'dest') {
  const wrap = document.createElement('div');
  wrap.className = `vm-orb-wrap ${kind === 'origin' ? 'vm-orb-origin' : 'vm-orb-dest'}`;
  wrap.innerHTML = `
    <span class="vm-orb-ring"></span>
    <span class="vm-orb-ring delay"></span>
    <span class="vm-orb-core"></span>
  `;
  return wrap;
}

/** Punto azul de “mi ubicación” en seguimiento continuo */
export function createLiveGpsElement() {
  const wrap = document.createElement('div');
  wrap.className = 'vm-live-gps';
  wrap.setAttribute('aria-label', 'Tu ubicación en vivo');
  wrap.innerHTML = `
    <span class="vm-live-gps-pulse"></span>
    <span class="vm-live-gps-dot"></span>
  `;
  return wrap;
}
