import { Box, Paper, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SportsCricketIcon from '@mui/icons-material/SportsCricket';
import { getTeamMeta } from '../../utils/teamMeta';

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
  const isLive = isActive;
  const navigate = useNavigate();
  const metaA = match.team_a ? getTeamMeta(match.team_a) : { color: '#1a1a2e', logo: '' };
  const metaB = match.team_b ? getTeamMeta(match.team_b) : { color: '#2b2d42', logo: '' };
  const colorA = metaA.color;
  const colorB = metaB.color;

  const handleCardClick = () => {
    if (isLive) navigate(`/prediction/${match.id}`);
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* ── Your Pick banner — mobile only ── */}
      {isLive && hasPrediction && userPrediction && (
        <Box sx={{
          mb: 1, mx: 0.5,
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #0f0f0f 0%, #2a2a2a 100%)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          position: 'relative',
          display: { xs: 'block', sm: 'none' },
        }}>
          <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'linear-gradient(180deg, #4ade80 0%, #22d3ee 100%)' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.1, pb: 0.6, pl: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #22d3ee)', boxShadow: '0 0 6px #4ade8088' }} />
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Your Pick</Typography>
            </Box>
            {userPrediction.is_double_trouble && (
              <Box sx={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', borderRadius: '6px', px: 0.8, py: 0.2, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <Typography sx={{ fontSize: '0.58rem', fontWeight: 900, color: '#fff', letterSpacing: '0.06em' }}>⚡ DOUBLE TROUBLE</Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ px: 1.5, pb: 0.8, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
            {[
              { label: 'Winner', value: userPrediction.predicted_winner, logo: userPrediction.predicted_winner ? getTeamMeta(userPrediction.predicted_winner).logo : null, color: getTeamMeta(userPrediction.predicted_winner ?? '').color },
              { label: 'Top Batter', value: userPrediction.predicted_batter_name, logo: null, color: null },
              { label: 'Top Bowler', value: userPrediction.predicted_bowler_name, logo: null, color: null },
              { label: 'Player of the Match', value: userPrediction.predicted_mom_name, logo: null, color: null },
            ].map(({ label, value, logo, color }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
                {logo ? (
                  <Box sx={{ width: 18, height: 18, borderRadius: '5px', flexShrink: 0, background: color || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', p: '2px', boxShadow: color ? `0 2px 6px ${color}66` : 'none' }}>
                    <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </Box>
                ) : (
                  <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                )}
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.04em', minWidth: 96, flexShrink: 0 }}>{label}</Typography>
                <Box sx={{ flex: 1, height: '1px', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 3px, transparent 3px, transparent 7px)' }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', letterSpacing: '0.01em', textAlign: 'right', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '—'}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ mx: 1.5, mb: 1, ml: 2.5, borderRadius: '8px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', px: 1, py: 0.55, display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Typography sx={{ fontSize: '0.65rem' }}>✏️</Typography>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>You can change your prediction before the match starts</Typography>
          </Box>
        </Box>
      )}

      {/* ── Main Card ── */}
      {/* Animated gradient border wrapper for active cards */}
      {isLive && (
        <Box sx={{
          position: 'absolute',
          inset: -2,
          borderRadius: '22px',
          background: `linear-gradient(270deg, ${colorA}, ${colorB}, ${colorA})`,
          backgroundSize: '300% 300%',
          animation: 'borderShift 4s ease infinite',
          zIndex: 0,
          '@keyframes borderShift': {
            '0%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
            '100%': { backgroundPosition: '0% 50%' },
          },
        }} />
      )}
      <Paper
        elevation={0}
        onClick={handleCardClick}
        sx={{
          borderRadius: '20px',
          overflow: 'hidden',
          cursor: isLive ? 'pointer' : 'default',
          border: isLive ? 'none' : '1px solid rgba(0,0,0,0.09)',
          background: '#fff',
          position: 'relative',
          zIndex: 1,
          transition: 'transform 0.22s ease, box-shadow 0.22s ease',
          boxShadow: isLive
            ? `0 4px 28px ${colorA}33, 0 4px 28px ${colorB}22`
            : '0 2px 20px rgba(0,0,0,0.08)',
          '&:hover': isLive ? {
            transform: 'translateY(-5px)',
            boxShadow: `0 16px 48px ${colorA}44, 0 16px 48px ${colorB}33`,
          } : {},
        }}
      >
        {/* ── Hero: clean white bg with barely-there team colour tint ── */}
        <Box sx={{ position: 'relative', overflow: 'hidden', pb: 0 }}>
          {/* Very faint team colour wash — almost white, just a whisper of colour */}
          <Box sx={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(105deg, ${colorA}0f 0%, #ffffff 45%, #ffffff 55%, ${colorB}0f 100%)`,
          }} />

          {/* Match number + status row */}
          <Box sx={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2, pt: 1.5, pb: 0,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}>
              <SportsCricketIcon sx={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.35)' }} />
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(0,0,0,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                IPL 2026 · Match {match.match_number}
              </Typography>
            </Box>

            {isLive ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '20px', px: 1, py: 0.28 }}>
                <Box sx={{ position: 'relative', width: 6, height: 6, flexShrink: 0 }}>
                  <Box sx={{
                    position: 'absolute', inset: 0, borderRadius: '50%', background: '#16a34a',
                    animation: 'mcPulse 1.6s ease-in-out infinite',
                    '@keyframes mcPulse': {
                      '0%': { transform: 'scale(1)', opacity: 1 },
                      '60%': { transform: 'scale(2.5)', opacity: 0 },
                      '100%': { transform: 'scale(1)', opacity: 0 },
                    },
                  }} />
                  <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#16a34a' }} />
                </Box>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#15803d', letterSpacing: '0.04em' }}>Predict Now</Typography>
              </Box>
            ) : (
              <Box sx={{ background: 'rgba(0,0,0,0.05)', borderRadius: '20px', px: 1, py: 0.28 }}>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(0,0,0,0.35)' }}>Coming Soon</Typography>
              </Box>
            )}
          </Box>

          {/* Teams row */}
          {match.team_a && match.team_b ? (
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', px: 2, pt: 1.75, pb: 2 }}>
              {/* Team A */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.6 }}>
                <Box sx={{
                  width: 68, height: 68, borderRadius: '18px',
                  background: colorA,
                  boxShadow: `0 0 0 2px ${colorA}60, 0 6px 20px ${colorA}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  p: '6px',
                }}>
                  {metaA.logo ? (
                    <img src={metaA.logo} alt={match.team_a} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }} />
                  ) : (
                    <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: colorA }}>{abbr(match.team_a ?? '')}</Typography>
                  )}
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: '0.72rem', color: '#111', textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                  {match.team_a}
                </Typography>
              </Box>

              {/* VS */}
              <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 1.5, gap: 0.25 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                  <Typography sx={{ fontSize: '0.58rem', fontWeight: 900, color: '#fff', letterSpacing: '0.06em' }}>VS</Typography>
                </Box>
              </Box>

              {/* Team B */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.6 }}>
                <Box sx={{
                  width: 68, height: 68, borderRadius: '18px',
                  background: colorB,
                  boxShadow: `0 0 0 2px ${colorB}60, 0 6px 20px ${colorB}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  p: '6px',
                }}>
                  {metaB.logo ? (
                    <img src={metaB.logo} alt={match.team_b} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }} />
                  ) : (
                    <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: colorB }}>{abbr(match.team_b ?? '')}</Typography>
                  )}
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: '0.72rem', color: '#111', textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                  {match.team_b}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ py: 3.5, textAlign: 'center', position: 'relative' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'rgba(0,0,0,0.25)' }}>Teams TBA</Typography>
            </Box>
          )}
        </Box>

        {/* ── Divider ── */}
        <Box sx={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.07) 20%, rgba(0,0,0,0.07) 80%, transparent)' }} />

        {/* ── Date / Time / Venue row ── */}
        <Box sx={{
          display: 'flex', alignItems: 'center',
          px: 2, py: 1.1, gap: 0,
          background: '#fafafa',
        }}>
          {/* Date */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55, flex: 1 }}>
            <Typography sx={{ fontSize: '0.8rem' }}>📅</Typography>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#333', letterSpacing: '-0.01em' }}>
              {formatDate(match.match_date)}
            </Typography>
          </Box>

          {/* Dot separator */}
          <Box sx={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(0,0,0,0.18)', mx: 1, flexShrink: 0 }} />

          {/* Time */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55, flex: 1, justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '0.8rem' }}>🕐</Typography>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#333', letterSpacing: '-0.01em' }}>
              {formatTime(match.match_time)}
            </Typography>
          </Box>

          {/* Dot separator */}
          {match.venue && <Box sx={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(0,0,0,0.18)', mx: 1, flexShrink: 0 }} />}

          {/* Venue */}
          {match.venue && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flex: 1.4, minWidth: 0, justifyContent: 'flex-end' }}>
              <LocationOnIcon sx={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.35)', flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(0,0,0,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {match.venue}
              </Typography>
            </Box>
          )}
        </Box>

        {/* ── Divider ── */}
        <Box sx={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.07) 20%, rgba(0,0,0,0.07) 80%, transparent)' }} />

        {/* ── CTA ── */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Box sx={{
            borderRadius: '12px',
            background: isLive ? '#111' : 'rgba(0,0,0,0.04)',
            py: 0.85, px: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.7,
            transition: 'background 0.18s, transform 0.18s',
            '&:hover': isLive ? { background: '#000', transform: 'scale(1.01)' } : {},
          }}>
            {isLive && hasPrediction && <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>✅</Typography>}
            <Typography sx={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.025em', color: isLive ? '#fff' : 'rgba(0,0,0,0.25)' }}>
              {isLive
                ? hasPrediction ? 'Edit Prediction  ✏️' : 'Make Your Prediction  →'
                : 'Prediction Opens Soon'}
            </Typography>
          </Box>
          {isLive && !hasPrediction && (
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 500, color: 'rgba(0,0,0,0.28)', textAlign: 'center', mt: 0.65, letterSpacing: '0.01em' }}>
              Pick winner · batter · bowler · player of the match
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default MatchCard;
