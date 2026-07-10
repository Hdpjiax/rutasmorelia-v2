/** DOM markers de origen/destino para MapLibre */

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
