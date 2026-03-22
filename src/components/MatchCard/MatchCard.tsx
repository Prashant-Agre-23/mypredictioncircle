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

interface MatchCardProps {
  match: Match;
  isActive: boolean;
  hasPrediction?: boolean;
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



const MatchCard = ({ match, isActive, hasPrediction = false }: MatchCardProps) => {
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
          background: isLive
            ? hasPrediction ? '#1b4332' : '#000'
            : 'rgba(0,0,0,0.04)',
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.6,
          cursor: isLive ? 'pointer' : 'default',
          transition: 'background 0.18s ease, transform 0.15s ease',
          '&:hover': isLive ? { background: hasPrediction ? '#2d6a4f' : '#222', transform: 'scale(1.01)' } : {},
        }}
      >
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
            ? hasPrediction ? 'Predicted · Edit  ✏️' : 'Make Prediction  →'
            : 'Prediction Opens Soon'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default MatchCard;
