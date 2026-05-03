import { Box, Paper, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SportsCricketIcon from '@mui/icons-material/SportsCricket';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { getTeamMeta } from '../../utils/teamMeta';

// Inject Inter font (Google Fonts) once
if (typeof document !== 'undefined' && !document.getElementById('mc-inter-font')) {
  const link = document.createElement('link');
  link.id = 'mc-inter-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap';
  document.head.appendChild(link);
}

const FONT = '"Inter", system-ui, -apple-system, sans-serif';

export interface Match {
  id: string | number;
  match_number: number;
  match_date: string;
  match_time: string;
  team_a?: string;
  team_b?: string;
  venue?: string;
}

export interface UserPrediction {
  predicted_winner: string | null;
  predicted_batter_name: string | null;
  predicted_bowler_name: string | null;
  predicted_mom_name: string | null;
  is_double_trouble: boolean;
}

interface MatchCardProps {
  match: Match;
  isActive: boolean;
  hasPrediction?: boolean;
  userPrediction?: UserPrediction | null;
}

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatTime = (timeStr: string) => {
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const abbr = (name: string) => {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 3);
};

const MatchCard = ({ match, isActive, hasPrediction = false, userPrediction = null }: MatchCardProps) => {
  const navigate = useNavigate();
  const metaA = match.team_a ? getTeamMeta(match.team_a) : { color: '#1a1a2e', logo: '' };
  const metaB = match.team_b ? getTeamMeta(match.team_b) : { color: '#2b2d42', logo: '' };
  const colorA = metaA.color;
  const colorB = metaB.color;

  const handleCardClick = () => {
    if (isActive) navigate(`/prediction/${match.id}`);
  };

  if (isActive) {
    // ── ACTIVE card: dark premium design ──────────────────────────────────
    return (
      <Box sx={{ position: 'relative', height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Outer glow halo — breathing pulse */}
        <Box sx={{
          position: 'absolute', inset: -3, borderRadius: '26px', zIndex: 0,
          background: `linear-gradient(135deg, ${colorA}, ${colorB})`,
          filter: 'blur(10px)',
          width: 'calc(100% + 6px)',
          animation: 'haloBreath 3s ease-in-out infinite',
          '@keyframes haloBreath': {
            '0%,100%': { opacity: 0.45, transform: 'scale(1)' },
            '50%': { opacity: 0.7, transform: 'scale(1.03)' },
          },
        }} />

        {/* Animated gradient border */}
        <Box sx={{
          position: 'absolute', inset: -1.5, borderRadius: '24px', zIndex: 1,
          background: `linear-gradient(270deg, ${colorA}, ${colorB}, ${colorA})`,
          backgroundSize: '400% 400%',
          animation: 'borderFlow 5s ease infinite',
          '@keyframes borderFlow': {
            '0%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
            '100%': { backgroundPosition: '0% 50%' },
          },
        }} />

        <Paper
          elevation={0}
          onClick={handleCardClick}
          sx={{
            position: 'relative', zIndex: 2,
            borderRadius: '23px',
            overflow: 'hidden',
            cursor: 'pointer',
            width: '100%',
            background: 'linear-gradient(160deg, #0f0f13 0%, #1a1a22 60%, #111117 100%)',
            transition: 'transform 0.22s ease',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            animation: 'cardEnter 0.55s cubic-bezier(0.22,1,0.36,1) both',
            '@keyframes cardEnter': {
              '0%': { opacity: 0, transform: 'translateY(18px) scale(0.97)' },
              '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
            '&:hover': { transform: 'translateY(-4px)' },
          }}
        >
          {/* Subtle noise texture overlay */}
          <Box sx={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', pointerEvents: 'none', zIndex: 0 }} />

          {/* Shimmer sweep — diagonal light moving across the card */}
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: '23px',
          }}>
            <Box sx={{
              position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.045) 50%, transparent 70%)',
              animation: 'shimmerSweep 4s ease-in-out infinite',
              '@keyframes shimmerSweep': {
                '0%': { left: '-80%' },
                '60%,100%': { left: '140%' },
              },
            }} />
          </Box>

          {/* ── Top header bar ── */}
          <Box sx={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2, pt: 1.6, pb: 1,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <SportsCricketIcon sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }} />
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: FONT }}>
                IPL 2026 · Match {match.match_number}
              </Typography>
            </Box>
            {/* Live open badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '20px', px: 1, py: 0.3 }}>
              <Box sx={{ position: 'relative', width: 6, height: 6, flexShrink: 0 }}>
                <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80', animation: 'livePing 1.8s ease-out infinite', '@keyframes livePing': { '0%': { transform: 'scale(1)', opacity: 0.8 }, '100%': { transform: 'scale(2.8)', opacity: 0 } } }} />
                <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80' }} />
              </Box>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#4ade80', letterSpacing: '0.06em' }}>
                {hasPrediction ? 'PREDICTED ✓' : 'OPEN'}
              </Typography>
            </Box>
          </Box>

          {/* ── Teams section ── */}
          <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'stretch', minHeight: 110, flex: 1 }}>
            {/* Team A half — subtle color wash */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.9, py: 2.2, px: 1.5, position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 70% 50%, ${colorA}35 0%, transparent 70%)`, pointerEvents: 'none', animation: 'glowShiftA 4s ease-in-out infinite', '@keyframes glowShiftA': { '0%,100%': { opacity: 0.7, transform: 'scale(1)' }, '50%': { opacity: 1, transform: 'scale(1.1)' } } }} />
              <Box sx={{
                width: 64, height: 64, borderRadius: '18px',
                background: `linear-gradient(145deg, ${colorA}ee, ${colorA}99)`,
                border: `1.5px solid ${colorA}88`,
                boxShadow: `0 4px 20px ${colorA}55, inset 0 1px 0 rgba(255,255,255,0.15)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: '7px',
                animation: 'floatA 3.5s ease-in-out infinite',
                '@keyframes floatA': {
                  '0%,100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-5px)' },
                },
              }}>
                {metaA.logo
                  ? <img src={metaA.logo} alt={match.team_a} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  : <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{abbr(match.team_a ?? '')}</Typography>
                }
              </Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#ffffff', textAlign: 'center', lineHeight: 1.2, textShadow: '0 1px 6px rgba(0,0,0,0.7)', fontFamily: FONT, letterSpacing: '-0.01em' }}>
                {match.team_a ?? 'TBA'}
              </Typography>
              {/* color underline */}
              <Box sx={{
                height: 2.5, borderRadius: '2px', background: colorA, boxShadow: `0 0 8px ${colorA}`,
                animation: 'underlineA 2.4s ease-in-out infinite',
                '@keyframes underlineA': {
                  '0%,100%': { width: '18px', opacity: 0.75 },
                  '50%': { width: '30px', opacity: 1, boxShadow: `0 0 14px ${colorA}` },
                },
              }} />
            </Box>

            {/* VS divider */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 0.5, gap: 0.5, position: 'relative', zIndex: 1 }}>
              {/* vertical gradient line top */}
              <Box sx={{ width: 1, flex: 1, background: `linear-gradient(to bottom, transparent, ${colorA}60)` }} />
              <Box sx={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e1e28, #2a2a36)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'vsPulse 2.5s ease-in-out infinite',
                '@keyframes vsPulse': {
                  '0%,100%': { boxShadow: '0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)' },
                  '50%': { boxShadow: `0 0 0 4px ${colorA}30, 0 0 0 7px ${colorB}15, 0 2px 12px rgba(0,0,0,0.5)` },
                },
              }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>VS</Typography>
              </Box>
              {/* vertical gradient line bottom */}
              <Box sx={{ width: 1, flex: 1, background: `linear-gradient(to bottom, ${colorB}60, transparent)` }} />
            </Box>

            {/* Team B half */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.9, py: 2.2, px: 1.5, position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%, ${colorB}35 0%, transparent 70%)`, pointerEvents: 'none', animation: 'glowShiftB 4s ease-in-out infinite 0.5s', '@keyframes glowShiftB': { '0%,100%': { opacity: 0.7, transform: 'scale(1)' }, '50%': { opacity: 1, transform: 'scale(1.1)' } } }} />
              <Box sx={{
                width: 64, height: 64, borderRadius: '18px',
                background: `linear-gradient(145deg, ${colorB}ee, ${colorB}99)`,
                border: `1.5px solid ${colorB}88`,
                boxShadow: `0 4px 20px ${colorB}55, inset 0 1px 0 rgba(255,255,255,0.15)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: '7px',
                animation: 'floatB 3.5s ease-in-out infinite 0.7s',
                '@keyframes floatB': {
                  '0%,100%': { transform: 'translateY(0px)' },
                  '50%': { transform: 'translateY(-5px)' },
                },
              }}>
                {metaB.logo
                  ? <img src={metaB.logo} alt={match.team_b} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  : <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{abbr(match.team_b ?? '')}</Typography>
                }
              </Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#ffffff', textAlign: 'center', lineHeight: 1.2, textShadow: '0 1px 6px rgba(0,0,0,0.7)', fontFamily: FONT, letterSpacing: '-0.01em' }}>
                {match.team_b ?? 'TBA'}
              </Typography>
              <Box sx={{
                height: 2.5, borderRadius: '2px', background: colorB, boxShadow: `0 0 8px ${colorB}`,
                animation: 'underlineB 2.4s ease-in-out infinite 0.6s',
                '@keyframes underlineB': {
                  '0%,100%': { width: '18px', opacity: 0.75 },
                  '50%': { width: '30px', opacity: 1, boxShadow: `0 0 14px ${colorB}` },
                },
              }} />
            </Box>
          </Box>

          {/* ── Date / Time / Venue strip ── */}
          <Box sx={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 1.5, px: 2, py: 0.9,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.03)',
            flexWrap: 'wrap',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <CalendarTodayIcon sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)' }} />
              <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: '#ffffff', fontFamily: FONT, letterSpacing: '0.01em' }}>{formatDate(match.match_date)}</Typography>
            </Box>
            <Box sx={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <AccessTimeIcon sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)' }} />
              <Typography sx={{ fontSize: '0.66rem', fontWeight: 600, color: '#ffffff', fontFamily: FONT, letterSpacing: '0.01em' }}>{formatTime(match.match_time)}</Typography>
            </Box>
            {match.venue && (
              <>
                <Box sx={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, minWidth: 0 }}>
                  <LocationOnIcon sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: { xs: 110, sm: 180 } }}>{match.venue}</Typography>
                </Box>
              </>
            )}
          </Box>

          {/* ── CTA bar ── */}
          <Box sx={{ position: 'relative', zIndex: 1, px: 1.75, py: 1.5 }}>
            {hasPrediction ? (
              /* Already predicted */
              <Box>
                {/* winner chip */}
                {userPrediction?.predicted_winner && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1, px: 0.5 }}>
                    <Box sx={{ width: 22, height: 22, borderRadius: '7px', background: getTeamMeta(userPrediction.predicted_winner).color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: '2px', flexShrink: 0, boxShadow: `0 2px 8px ${getTeamMeta(userPrediction.predicted_winner).color}66` }}>
                      <img src={getTeamMeta(userPrediction.predicted_winner).logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                      Picked <Box component="span" sx={{ color: '#fff', fontWeight: 900 }}>{userPrediction.predicted_winner}</Box> to win
                      {userPrediction.is_double_trouble && <Box component="span" sx={{ ml: 0.6, color: '#fbbf24', fontWeight: 900 }}>⚡ 2×</Box>}
                    </Typography>
                  </Box>
                )}
                <Box sx={{
                  borderRadius: '14px',
                  background: `linear-gradient(135deg, ${colorA}22, ${colorB}22)`,
                  border: `1px solid rgba(255,255,255,0.1)`,
                  py: 1, px: 1.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 900, color: '#0a0a0a' }}>✓</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', fontFamily: FONT }}>Prediction saved</Typography>
                  </Box>
                  <Box sx={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', px: 1, py: 0.35 }}>
                    <Typography sx={{ fontSize: '0.64rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Edit ✏️</Typography>
                  </Box>
                </Box>
              </Box>
            ) : (
              /* No prediction yet */
              <Box sx={{
                borderRadius: '14px',
                background: `linear-gradient(135deg, ${colorA}, ${colorB}, ${colorA})`,
                backgroundSize: '250% 250%',
                py: 1.15, px: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: `0 6px 24px ${colorA}55, 0 6px 24px ${colorB}33`,
                cursor: 'pointer',
                position: 'relative', overflow: 'hidden',
                animation: 'btnGradFlow 3s ease infinite',
                '@keyframes btnGradFlow': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' },
                },
                '&::after': {
                  content: '""',
                  position: 'absolute', inset: 0, borderRadius: '14px',
                  background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)',
                  animation: 'btnShine 2.8s ease-in-out infinite',
                  '@keyframes btnShine': {
                    '0%': { transform: 'translateX(-100%)' },
                    '55%,100%': { transform: 'translateX(160%)' },
                  },
                },
              }}>
                <Box>
                  <Typography sx={{ fontSize: '0.76rem', fontWeight: 800, color: '#fff', letterSpacing: '0.01em', textShadow: '0 1px 3px rgba(0,0,0,0.3)', fontFamily: FONT }}>Make Your Prediction</Typography>
                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.8)', mt: 0.15, fontFamily: FONT }}>Winner · Batter · Bowler · MOM</Typography>
                </Box>
                <Box sx={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}>
                  <Typography sx={{ fontSize: '0.9rem', color: '#fff', fontWeight: 900, lineHeight: 1, mt: '1px' }}>→</Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    );
  }

  // ── INACTIVE card: premium light design matching active card structure ────
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: '16px',
        overflow: 'hidden',
        cursor: 'default',
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.1, borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#fafafa' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <SportsCricketIcon sx={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.25)' }} />
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(0,0,0,0.3)', letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: FONT }}>IPL 2026 · Match {match.match_number}</Typography>
        </Box>
        <Box sx={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '20px', px: 0.9, py: 0.25 }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(0,0,0,0.28)', letterSpacing: '0.04em', fontFamily: FONT }}>Coming Soon</Typography>
        </Box>
      </Box>

      {/* Teams — same height as active card teams section */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 2.2, gap: 1, flex: 1 }}>
        {/* Team A */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: '18px',
            background: `linear-gradient(145deg, ${colorA}cc, ${colorA}88)`,
            border: `1.5px solid ${colorA}44`,
            boxShadow: `0 4px 14px ${colorA}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: '7px',
          }}>
            {metaA.logo
              ? <img src={metaA.logo} alt={match.team_a} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.85 }} />
              : <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#fff' }}>{abbr(match.team_a ?? '')}</Typography>
            }
          </Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#333', textAlign: 'center', lineHeight: 1.2, fontFamily: FONT }}>{match.team_a ?? 'TBA'}</Typography>
          <Box sx={{ width: 18, height: 2.5, borderRadius: '2px', background: `${colorA}88` }} />
        </Box>

        {/* VS */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 0.5, gap: 0.5 }}>
          <Box sx={{ width: 1, height: 24, background: `linear-gradient(to bottom, transparent, ${colorA}40)` }} />
          <Box sx={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #f5f5f5, #e8e8e8)',
            border: '1px solid rgba(0,0,0,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: '0.52rem', fontWeight: 900, color: 'rgba(0,0,0,0.35)', letterSpacing: '0.06em' }}>VS</Typography>
          </Box>
          <Box sx={{ width: 1, height: 24, background: `linear-gradient(to bottom, ${colorB}40, transparent)` }} />
        </Box>

        {/* Team B */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: '18px',
            background: `linear-gradient(145deg, ${colorB}cc, ${colorB}88)`,
            border: `1.5px solid ${colorB}44`,
            boxShadow: `0 4px 14px ${colorB}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: '7px',
          }}>
            {metaB.logo
              ? <img src={metaB.logo} alt={match.team_b} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.85 }} />
              : <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#fff' }}>{abbr(match.team_b ?? '')}</Typography>
            }
          </Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#333', textAlign: 'center', lineHeight: 1.2, fontFamily: FONT }}>{match.team_b ?? 'TBA'}</Typography>
          <Box sx={{ width: 18, height: 2.5, borderRadius: '2px', background: `${colorB}88` }} />
        </Box>
      </Box>

      {/* Date/Time/Venue */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.9, borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#fafafa', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <CalendarTodayIcon sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.3)' }} />
          <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'rgba(0,0,0,0.5)', fontFamily: FONT }}>{formatDate(match.match_date)}</Typography>
        </Box>
        <Box sx={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(0,0,0,0.18)', flexShrink: 0 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <AccessTimeIcon sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.3)' }} />
          <Typography sx={{ fontSize: '0.63rem', fontWeight: 600, color: 'rgba(0,0,0,0.5)', fontFamily: FONT }}>{formatTime(match.match_time)}</Typography>
        </Box>
        {match.venue && (
          <>
            <Box sx={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(0,0,0,0.18)', flexShrink: 0 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, minWidth: 0 }}>
              <LocationOnIcon sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.28)', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'rgba(0,0,0,0.4)', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: { xs: 120, sm: 160 } }}>{match.venue}</Typography>
            </Box>
          </>
        )}
      </Box>

      {/* Footer CTA — matches active card CTA bar height */}
      <Box sx={{ px: 1.75, py: 1.5 }}>
        <Box sx={{
          borderRadius: '14px',
          background: 'linear-gradient(135deg, #f5f5f5, #efefef)',
          border: '1px solid rgba(0,0,0,0.07)',
          py: 1.15, px: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(0,0,0,0.35)', fontFamily: FONT }}>Prediction Opens Soon</Typography>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 500, color: 'rgba(0,0,0,0.25)', mt: 0.15, fontFamily: FONT }}>Winner · Batter · Bowler · MOM</Typography>
          </Box>
          <Box sx={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(0,0,0,0.05)',
            border: '1.5px solid rgba(0,0,0,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.2)', fontWeight: 900, lineHeight: 1, mt: '1px' }}>→</Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
};

export default MatchCard;
