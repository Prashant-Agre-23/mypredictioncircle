import { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Navbar from '../../components/Navbar/Navbar';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';

interface LeaderboardRow {
  rank: number;
  user_id: string;
  email: string;
  display_name: string;
  total_points: number;
  graded_predictions: number;
}

interface PredRow {
  user_id: string;
  match_id: number;
  is_double_trouble: boolean;
  predicted_winner: string | null;
  predicted_batter_id: number | null;
  predicted_bowler_id: number | null;
  predicted_mom_id: number | null;
}

interface CaRow {
  match_id: number;
  winner: string | null;
  batter_id: number | null;
  bowler_id: number | null;
  mom_id: number | null;
}

interface ComputedStats {
  dtCount: number;
  streak: number; // current active streak (resets after 5 or on loss)
}

const getInitials = (name: string) =>
  name ? name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) : '?';

const MEDAL: Record<number, { icon: string; color: string; glow: string }> = {
  1: { icon: '🥇', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
  2: { icon: '🥈', color: '#9ca3af', glow: 'rgba(156,163,175,0.25)' },
  3: { icon: '🥉', color: '#cd7f32', glow: 'rgba(205,127,50,0.25)' },
};

const PAGE_SIZE = 10;

const Leaderboard = () => {
  const { session } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [statsMap, setStatsMap] = useState<Record<string, ComputedStats>>({});

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);

      const [lbRes, predRes, caRes] = await Promise.all([
        supabase
          .from('leaderboard')
          .select('rank, user_id, email, display_name, total_points, graded_predictions')
          .order('total_points', { ascending: false }),
        supabase
          .from('predictions')
          .select('user_id, match_id, is_double_trouble, predicted_winner, predicted_batter_id, predicted_bowler_id, predicted_mom_id'),
        supabase
          .from('correct_answers')
          .select('match_id, winner, batter_id, bowler_id, mom_id'),
      ]);

      if (lbRes.error) { setError(lbRes.error.message); setLoading(false); return; }
      const lbRows = (lbRes.data ?? []) as LeaderboardRow[];
      setRows(lbRows);

      // Build stats map
      const preds = (predRes.data ?? []) as PredRow[];
      const cas = (caRes.data ?? []) as CaRow[];
      const caMap = new Map(cas.map((c) => [c.match_id, c]));

      const map: Record<string, ComputedStats> = {};
      for (const row of lbRows) {
        const userPreds = preds
          .filter((p) => p.user_id === row.user_id)
          .sort((a, b) => a.match_id - b.match_id);

        let dtCount = 0;
        let streak = 0;

        for (const p of userPreds) {
          const ca = caMap.get(p.match_id);
          if (!ca) continue;
          if (p.is_double_trouble) dtCount++;

          const won =
            !!ca.winner && p.predicted_winner === ca.winner &&
            !!ca.batter_id && Number(p.predicted_batter_id) === ca.batter_id &&
            !!ca.bowler_id && Number(p.predicted_bowler_id) === ca.bowler_id &&
            !!ca.mom_id && Number(p.predicted_mom_id) === ca.mom_id;

          const anyCorrect =
            (!!ca.winner && p.predicted_winner === ca.winner) ||
            (!!ca.batter_id && Number(p.predicted_batter_id) === ca.batter_id) ||
            (!!ca.bowler_id && Number(p.predicted_bowler_id) === ca.bowler_id) ||
            (!!ca.mom_id && Number(p.predicted_mom_id) === ca.mom_id);

          if (anyCorrect) {
            streak = streak >= 5 ? 1 : streak + 1; // reset after hitting 5
          } else {
            streak = 0; // loss resets streak
          }
          void won;
        }

        map[row.user_id] = { dtCount, streak };
      }
      setStatsMap(map);
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.total_points - a.total_points),
    [rows]
  );

  const myRow = sorted.find((r) => r.user_id === session?.user?.id);
  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);
  const maxPts = sorted[0]?.total_points ?? 1;

  const streakLabel = (n: number) => {
    if (n === 0) return { text: '—', color: 'rgba(255,255,255,0.2)' };
    if (n >= 5) return { text: `🔥${n}`, color: '#f97316' };
    if (n >= 3) return { text: `⚡${n}`, color: '#facc15' };
    return { text: `${n}`, color: 'rgba(255,255,255,0.55)' };
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#0a0a0f', pb: 8 }}>
      <Navbar />

      {/* ── Header ────────────────────────────────────────── */}
      <Box
        sx={{
          background: 'linear-gradient(160deg, #0a0a0f 0%, #130826 55%, #0a0a0f 100%)',
          pt: 3.5,
          pb: 4,
          px: 2,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '500px',
            height: '260px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.14) 0%, transparent 70%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="md" disableGutters>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 28px rgba(245,158,11,0.45)',
                mb: 0.5,
              }}
            >
              <EmojiEventsIcon sx={{ fontSize: '1.65rem', color: '#fff' }} />
            </Box>
            <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: '#fff', letterSpacing: '-0.02em' }}>
              Leaderboard
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>
              Season rankings · All matches
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* ── Loading / Error ───────────────────────────────── */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#a78bfa' }} />
        </Box>
      )}
      {error && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ color: '#f87171', fontSize: '0.9rem' }}>{error}</Typography>
        </Box>
      )}

      {/* ── My rank pill (if outside top 3) ─────────────── */}
      {!loading && !error && myRow && myRow.rank > 3 && (
        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2 } }}>
          <Box
            sx={{
              mt: 2,
              px: 2,
              py: 1.25,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(109,40,217,0.08))',
              border: '1.5px solid rgba(167,139,250,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
            }}
          >
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: '#7c3aed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '0.78rem', color: '#fff', flexShrink: 0,
              }}
            >
              {getInitials(myRow.display_name)}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#e9d5ff', lineHeight: 1.2 }}>
                {myRow.display_name}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>
                {myRow.graded_predictions} graded predictions
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#a78bfa', lineHeight: 1 }}>
                #{myRow.rank}
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', color: 'rgba(255,255,255,0.38)' }}>
                {myRow.total_points} pts
              </Typography>
            </Box>
          </Box>
        </Container>
      )}

      {/* ── Table ─────────────────────────────────────────── */}
      {!loading && !error && sorted.length > 0 && (
        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2 }, mt: 3 }}>

          {/* Outer card */}
          <Box
            sx={{
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.015)',
            }}
          >
            {/* Column headers */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr 52px 62px 80px',
                alignItems: 'center',
                px: 2,
                py: 1.1,
                background: 'rgba(255,255,255,0.04)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {[
                { label: '#', align: 'center' },
                { label: 'Player', align: 'left' },
                { label: 'DT', align: 'center' },
                { label: 'Streak', align: 'center' },
                { label: 'Points', align: 'right' },
              ].map(({ label, align }) => (
                <Typography
                  key={label}
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.58rem',
                    color: 'rgba(255,255,255,0.28)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    textAlign: align as 'center' | 'left' | 'right',
                  }}
                >
                  {label}
                </Typography>
              ))}
            </Box>

            {/* Rows */}
            {visible.map((row, idx) => {
              const isMe = row.user_id === session?.user?.id;
              const medal = MEDAL[row.rank];
              const barPct = Math.max(4, Math.round((row.total_points / maxPts) * 100));
              const isLast = idx === visible.length - 1;

              return (
                <Box
                  key={row.user_id}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr 52px 62px 80px',
                    alignItems: 'center',
                    px: 2,
                    py: 1.4,
                    borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.045)',
                    background: isMe
                      ? 'linear-gradient(90deg, rgba(124,58,237,0.14) 0%, rgba(109,40,217,0.05) 100%)'
                      : 'transparent',
                    position: 'relative',
                    transition: 'background 0.15s',
                    '&:hover': {
                      background: isMe
                        ? 'linear-gradient(90deg, rgba(124,58,237,0.2) 0%, rgba(109,40,217,0.1) 100%)'
                        : 'rgba(255,255,255,0.025)',
                    },
                    ...(isMe && {
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0, top: '18%', bottom: '18%',
                        width: '3px',
                        borderRadius: '0 3px 3px 0',
                        background: '#7c3aed',
                      },
                    }),
                  }}
                >
                  {/* Rank / Medal */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {medal ? (
                      <Typography sx={{ fontSize: '1.2rem', lineHeight: 1, filter: `drop-shadow(0 0 5px ${medal.glow})` }}>
                        {medal.icon}
                      </Typography>
                    ) : (
                      <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: isMe ? '#a78bfa' : 'rgba(255,255,255,0.22)', fontVariantNumeric: 'tabular-nums' }}>
                        {row.rank}
                      </Typography>
                    )}
                  </Box>

                  {/* Name + progress bar */}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontWeight: isMe ? 800 : 700,
                        fontSize: '0.84rem',
                        color: isMe ? '#e9d5ff' : '#e5e7eb',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.2,
                        mb: 0.55,
                      }}
                    >
                      {row.display_name}
                    </Typography>
                    {/* Progress bar */}
                    <Box sx={{ height: '3px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', maxWidth: '160px' }}>
                      <Box
                        sx={{
                          height: '100%',
                          width: `${barPct}%`,
                          borderRadius: '99px',
                          background: medal
                            ? `linear-gradient(90deg, ${medal.color}, ${medal.color}80)`
                            : isMe
                            ? 'linear-gradient(90deg, #7c3aed, #a78bfa)'
                            : 'linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))',
                        }}
                      />
                    </Box>
                  </Box>

                  {/* DT count */}
                  {(() => {
                    const dt = statsMap[row.user_id]?.dtCount ?? 0;
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {dt > 0 ? (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, px: 0.7, py: 0.25, borderRadius: '6px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#fbbf24' }}>⚡{dt}</Typography>
                          </Box>
                        ) : (
                          <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>—</Typography>
                        )}
                      </Box>
                    );
                  })()}

                  {/* Streak */}
                  {(() => {
                    const s = statsMap[row.user_id]?.streak ?? 0;
                    const sl = streakLabel(s);
                    return (
                      <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: sl.color, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                        {sl.text}
                      </Typography>
                    );
                  })()}

                  {/* Points chip */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Box
                      sx={{
                        px: 1.1, py: 0.35, borderRadius: '9px',
                        background: medal ? medal.glow : isMe ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.05)',
                        border: medal ? `1px solid ${medal.color}50` : isMe ? '1px solid rgba(167,139,250,0.38)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: medal ? medal.color : isMe ? '#a78bfa' : '#f3f4f6', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                        {row.total_points}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Show all / Show less */}
          {sorted.length > PAGE_SIZE && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Box
                onClick={() => setShowAll((v) => !v)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.75,
                  px: 2.5, py: 1.1, borderRadius: '14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', userSelect: 'none',
                  transition: 'background 0.15s, border-color 0.15s',
                  '&:hover': { background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.18)' },
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>
                  {showAll ? 'Show less' : `Show all ${sorted.length} players`}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                  {showAll ? '↑' : '↓'}
                </Typography>
              </Box>
            </Box>
          )}
        </Container>
      )}

      {/* Empty state */}
      {!loading && !error && sorted.length === 0 && (
        <Container maxWidth="md" sx={{ px: 2, mt: 6, textAlign: 'center' }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.9rem', fontWeight: 600 }}>
            No data yet. Make some predictions!
          </Typography>
        </Container>
      )}
    </Box>
  );
};

export default Leaderboard;
