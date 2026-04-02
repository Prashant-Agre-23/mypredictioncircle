import { Box, Paper, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
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

const formatDate = (dateStr: string) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const formatTime = (timeStr: string) => {
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

/** Short abbreviation — initials of each word, up to 3 chars */
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

  // Helper: break team name into two lines (first word, rest)
  const splitTeamName = (name?: string) => {
    if (!name) return '';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0];
    return words[0] + '\n' + words.slice(1).join(' ');
  };

  const handleCardClick = () => {
    if (isLive) navigate(`/prediction/${match.id}`);
  };

  return (
    <Box>
      {/* ── Your Pick banner — mobile only (desktop handled in Dashboard) ── */}
      {isLive && hasPrediction && userPrediction && (
        <Box
          sx={{
            mb: 1,
            mx: 0.5,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #0f0f0f 0%, #2a2a2a 100%)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
            overflow: 'hidden',
            position: 'relative',
            display: { xs: 'block', sm: 'none' },
          }}
        >
          {/* Subtle left accent stripe */}
          <Box sx={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: 'linear-gradient(180deg, #4ade80 0%, #22d3ee 100%)',
          }} />

          {/* Header row */}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2, pt: 1.1, pb: 0.6, pl: 2.5,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                boxShadow: '0 0 6px #4ade8088',
              }} />
              <Typography sx={{
                fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                Your Pick
              </Typography>
            </Box>
            {userPrediction.is_double_trouble && (
              <Box sx={{
                background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                borderRadius: '6px', px: 0.8, py: 0.2,
                display: 'flex', alignItems: 'center', gap: 0.4,
              }}>
                <Typography sx={{ fontSize: '0.58rem', fontWeight: 900, color: '#fff', letterSpacing: '0.06em' }}>
                  ⚡ DOUBLE TROUBLE
                </Typography>
              </Box>
            )}
          </Box>

          {/* Pick rows */}
          <Box sx={{ px: 1.5, pb: 0.8, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
            {[
              {
                label: 'Winner',
                value: userPrediction.predicted_winner,
                logo: userPrediction.predicted_winner ? getTeamMeta(userPrediction.predicted_winner).logo : null,
                color: getTeamMeta(userPrediction.predicted_winner ?? '').color,
              },
              { label: 'Top Batter', value: userPrediction.predicted_batter_name,  logo: null, color: null },
              { label: 'Top Bowler', value: userPrediction.predicted_bowler_name,  logo: null, color: null },
              { label: 'Player of the Match', value: userPrediction.predicted_mom_name, logo: null, color: null },
            ].map(({ label, value, logo, color }) => (
              <Box
                key={label}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}
              >
                {/* Icon */}
                {logo ? (
                  <Box sx={{
                    width: 18, height: 18, borderRadius: '5px', flexShrink: 0,
                    background: color || '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', p: '2px',
                    boxShadow: color ? `0 2px 6px ${color}66` : 'none',
                  }}>
                    <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </Box>
                ) : (
                  <Box sx={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)', flexShrink: 0,
                  }} />
                )}
                {/* Label */}
                <Typography sx={{
                  fontSize: '0.6rem', fontWeight: 700,
                  color: 'rgba(255,255,255,0.75)', letterSpacing: '0.04em',
                  minWidth: 96, flexShrink: 0,
                }}>
                  {label}
                </Typography>
                {/* Dotted separator */}
                <Box sx={{
                  flex: 1, height: '1px',
                  backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 3px, transparent 3px, transparent 7px)',
                }} />
                {/* Value */}
                <Typography sx={{
                  fontSize: '0.72rem', fontWeight: 800, color: '#fff',
                  letterSpacing: '0.01em', textAlign: 'right',
                  maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {value || '—'}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Editable hint */}
          <Box sx={{
            mx: 1.5, mb: 1, ml: 2.5,
            borderRadius: '8px',
            background: 'rgba(74,222,128,0.1)',
            border: '1px solid rgba(74,222,128,0.25)',
            px: 1, py: 0.55,
            display: 'flex', alignItems: 'center', gap: 0.6,
          }}>
            <Typography sx={{ fontSize: '0.65rem' }}>✏️</Typography>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
              You can change your prediction before the match starts
            </Typography>
          </Box>
        </Box>
      )}

    <Paper
      elevation={0}
      onClick={handleCardClick}
      sx={{
        borderRadius: '24px',
        background: '#fff',
        cursor: isLive ? 'pointer' : 'default',
        border: isLive ? '1.5px solid rgba(0,0,0,0.14)' : '1px solid rgba(0,0,0,0.07)',
        boxShadow: isLive
          ? '0 8px 32px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07)'
          : '0 2px 16px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.22s ease, transform 0.22s ease',
        overflow: 'hidden',
        '&:hover': {
          boxShadow: '0 12px 40px rgba(0,0,0,0.13), 0 3px 10px rgba(0,0,0,0.07)',
          transform: 'translateY(-3px)',
        },
      }}
    >
      {/* ── Top accent bar ───────────────────────────────── */}
      <Box
        sx={{
          height: 4,
          background: isLive
            ? 'linear-gradient(90deg, #000 0%, #444 100%)'
            : 'linear-gradient(90deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.04) 100%)',
        }}
      />

      {/* ── Header: match label + status badge ───────────── */}
      <Box
        sx={{
          px: 2,
          pt: 1.5,
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <SportsCricketIcon sx={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.35)' }} />
          <Typography
            sx={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'rgba(0,0,0,0.45)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Match {match.match_number}
          </Typography>
        </Box>

        {isLive ? (
          <Box
            sx={{
              background: '#000',
              borderRadius: '20px',
              px: 1.2,
              py: 0.3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
            }}
          >
            <Box sx={{ position: 'relative', width: 7, height: 7, flexShrink: 0 }}>
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: '#4ade80',
                  animation: 'livePulse 1.6s ease-in-out infinite',
                  '@keyframes livePulse': {
                    '0%': { transform: 'scale(1)', opacity: 1 },
                    '60%': { transform: 'scale(2.4)', opacity: 0 },
                    '100%': { transform: 'scale(1)', opacity: 0 },
                  },
                }}
              />
              <Box sx={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4ade80' }} />
            </Box>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: '#fff' }}>
              Live
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              background: '#f0f0f0',
              borderRadius: '20px',
              px: 1.2,
              py: 0.3,
            }}
          >
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: 'rgba(0,0,0,0.4)' }}>
              Coming Soon
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── Teams battle zone ────────────────────────────── */}
      {match.team_a && match.team_b ? (
        <Box
          sx={{
            mx: 2,
            mb: 1.75,
            borderRadius: '16px',
            background: '#f8f8f8',
            border: '1px solid rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Team A */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 1.75,
              px: 1,
              gap: 0.75,
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '16px',
                background: colorA,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 14px ${colorA}66`,
                p: 0.5,
              }}
            >
              {metaA.logo ? (
                <img
                  src={metaA.logo}
                  alt={match.team_a}
                  style={{ width: 40, height: 40, objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#fff', letterSpacing: '-0.01em' }}>
                  {abbr(match.team_a)}
                </Typography>
              )}
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                color: 'rgba(0,0,0,0.55)',
                textAlign: 'center',
                lineHeight: 1.15,
                px: 0.5,
                whiteSpace: 'pre-line',
              }}
            >
              {splitTeamName(match.team_a)}
            </Typography>
          </Box>

          {/* VS divider */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
              px: 0.5,
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ fontWeight: 900, fontSize: '0.58rem', color: '#fff', letterSpacing: '0.05em' }}>
                VS
              </Typography>
            </Box>
          </Box>

          {/* Team B */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 1.75,
              px: 1,
              gap: 0.75,
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '16px',
                background: colorB,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 14px ${colorB}66`,
                p: 0.5,
              }}
            >
              {metaB.logo ? (
                <img
                  src={metaB.logo}
                  alt={match.team_b}
                  style={{ width: 40, height: 40, objectFit: 'contain', display: 'block' }}
                />
              ) : (
                <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#fff', letterSpacing: '-0.01em' }}>
                  {abbr(match.team_b)}
                </Typography>
              )}
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                color: 'rgba(0,0,0,0.55)',
                textAlign: 'center',
                lineHeight: 1.15,
                px: 0.5,
                whiteSpace: 'pre-line',
              }}
            >
              {splitTeamName(match.team_b)}
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            mx: 2,
            mb: 1.75,
            py: 2.5,
            borderRadius: '16px',
            background: '#f8f8f8',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: 'rgba(0,0,0,0.3)' }}>
            Teams TBA
          </Typography>
        </Box>
      )}

      {/* ── Info chips ───────────────────────────────────── */}
      <Box sx={{ px: 2, pb: 1.5, display: 'flex', alignItems: 'center', gap: 0.55, flexWrap: 'wrap' }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.45,
            background: '#f5f5f7',
            borderRadius: '8px',
            px: 0.9,
            py: 0.4,
          }}
        >
          <CalendarTodayIcon sx={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.4)' }} />
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(0,0,0,0.6)' }}>
            {formatDate(match.match_date)}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.45,
            background: '#f5f5f7',
            borderRadius: '8px',
            px: 0.9,
            py: 0.4,
          }}
        >
          <AccessTimeIcon sx={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.4)' }} />
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(0,0,0,0.6)' }}>
            {formatTime(match.match_time)}
          </Typography>
        </Box>

        {match.venue && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.45,
              background: '#f5f5f7',
              borderRadius: '8px',
              px: 0.9,
              py: 0.4,
              minWidth: 0,
            }}
          >
            <LocationOnIcon sx={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.4)', flexShrink: 0 }} />
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'rgba(0,0,0,0.5)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {match.venue}
            </Typography>
          </Box>
        )}
      </Box>

      {/* ── CTA footer ───────────────────────────────────── */}
      <Box
        sx={{
          mx: 2,
          mb: 2,
          borderRadius: '14px',
          background: isLive ? '#000' : 'rgba(0,0,0,0.04)',
          py: isLive && !hasPrediction ? 0.85 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.25,
          cursor: isLive ? 'pointer' : 'default',
          transition: 'background 0.18s ease, transform 0.15s ease',
          '&:hover': isLive ? { background: '#222', transform: 'scale(1.01)' } : {},
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          {isLive && hasPrediction && (
            <Typography sx={{ fontSize: '0.78rem' }}>✅</Typography>
          )}
          <Typography
            sx={{
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.03em',
              color: isLive ? '#fff' : 'rgba(0,0,0,0.28)',
            }}
          >
            {isLive
              ? hasPrediction ? 'Edit Prediction  ✏️' : 'Make Your Prediction  →'
              : 'Prediction Opens Soon'}
          </Typography>
        </Box>
        {isLive && !hasPrediction && (
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.01em' }}>
            Pick winner · batter · bowler · player of the match
          </Typography>
        )}
      </Box>
    </Paper>
    </Box>
  );
};

export default MatchCard;
