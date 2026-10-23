// Ride icons for the ride ladder, banners, medals and charts: walk, run, skateboard, bike, car, rocket.
import { RIDES } from '../engine/rides';

/** A ride's icon as SVG markup in a 48 x 48 box. */
export function rideIcon(tier: number, color = 'currentColor'): string {
  const st = `fill="none" stroke="${color}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"`;
  switch (RIDES[Math.max(0, Math.min(RIDES.length - 1, tier))].id) {
    case 'walk': return `<g fill="${color}"><ellipse cx="17" cy="30" rx="6" ry="8.5"/><ellipse cx="31" cy="18" rx="6" ry="8.5"/><circle cx="12" cy="18" r="2.4"/><circle cx="17" cy="15" r="2.4"/><circle cx="26" cy="7" r="2.4"/><circle cx="31" cy="5" r="2.2"/></g>`;
    case 'run': return `<g fill="${color}"><circle cx="30" cy="8" r="5"/><path d="M27,15 L20,27 L27,31 L24,42" ${st.replace('fill="none" ', '')} fill="none"/><path d="M22,19 L13,21 M27,17 L35,23 M20,27 L11,33" ${st.replace('fill="none" ', '')} fill="none"/></g><path d="M3,14 L10,14 M1,22 L8,22 M3,30 L8,30" ${st} stroke-width="2.6"/>`;
    case 'skate': return `<path d="M5,24 Q7,31 13,31 L35,31 Q41,31 43,24" ${st}/><circle cx="14" cy="38" r="4" fill="${color}"/><circle cx="34" cy="38" r="4" fill="${color}"/>`;
    case 'bike': return `<circle cx="12" cy="32" r="8" ${st}/><circle cx="36" cy="32" r="8" ${st}/><path d="M12,32 L20,18 L32,18 L36,32 M20,18 L25,32 L32,18 M30,12 L36,12" ${st}/>`;
    case 'car': return `<g fill="${color}"><circle cx="24" cy="18.5" r="4.6"/><path d="M2,29 Q2,23 8,23 L16,23 L18,26 L31,26 L33,20 L35.5,20 L36.5,23 Q45,24 46,29 L46,32 Q46,34 44,34 L43.5,34 A7.5,7.5 0 0 0 28.5,34 L19.5,34 A7.5,7.5 0 0 0 4.5,34 L4,34 Q2,34 2,32 Z"/><circle cx="12" cy="36" r="5.5"/><circle cx="36" cy="36" r="5.5"/></g>`;
    case 'rocket': return `<path d="M8,30 L18,30 L18,20 Q30,6 42,6 Q42,18 28,30 L28,40 L18,40 Z" fill="${color}"/><circle cx="31" cy="17" r="3.5" fill="#fff"/><path d="M4,40 L12,34 M8,46 L16,38" ${st} stroke-width="3"/>`;
  }
  return '';
}
