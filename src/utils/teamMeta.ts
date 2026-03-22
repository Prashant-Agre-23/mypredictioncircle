import cskLogo  from '../assets/csk.png';
import dcLogo   from '../assets/dc.png';
import gtLogo   from '../assets/gt.png';
import kkrLogo  from '../assets/kkr.png';
import lsgLogo  from '../assets/lsg.png';
import miLogo   from '../assets/mi.png';
import pbksLogo from '../assets/pbks.png';
import rcbLogo  from '../assets/rcb.png';
import rrLogo   from '../assets/rr.png';
import srhLogo  from '../assets/srh.png';

export interface TeamMeta {
  color: string;
  logo: string;
}

const TEAM_META: Array<{ keys: string[]; meta: TeamMeta }> = [
  { keys: ['chennai', 'csk'],                        meta: { color: '#f9c200', logo: cskLogo  } },
  { keys: ['mumbai', 'mi'],                          meta: { color: '#004c93', logo: miLogo   } },
  { keys: ['royal challengers', 'rcb', 'bangalore', 'bengaluru'], meta: { color: '#c8102e', logo: rcbLogo  } },
  { keys: ['kolkata', 'kkr'],                        meta: { color: '#3a225d', logo: kkrLogo  } },
  { keys: ['sunrisers', 'srh', 'hyderabad'],         meta: { color: '#f26522', logo: srhLogo  } },
  { keys: ['rajasthan', 'rr', 'royals'],             meta: { color: '#eb83b5', logo: rrLogo   } },
  { keys: ['delhi', 'dc', 'capitals'],               meta: { color: '#0078bc', logo: dcLogo   } },
  { keys: ['punjab', 'pbks', 'kings'],               meta: { color: '#aa1f30', logo: pbksLogo } },
  { keys: ['gujarat', 'gt', 'titans'],               meta: { color: '#1b4b82', logo: gtLogo   } },
  { keys: ['lucknow', 'lsg', 'super giants', 'supergiants'], meta: { color: '#a72056', logo: lsgLogo  } },
];

const FALLBACK_PALETTE = ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#2b2d42', '#3d405b', '#1b4332', '#212529'];

export const getTeamMeta = (name?: string): TeamMeta => {
  if (!name) return { color: FALLBACK_PALETTE[0], logo: '' };
  const lower = name.toLowerCase();
  for (const { keys, meta } of TEAM_META) {
    if (keys.some((k) => lower.includes(k))) return meta;
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return { color: FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length], logo: '' };
};
