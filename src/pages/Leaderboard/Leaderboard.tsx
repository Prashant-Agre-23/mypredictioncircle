import { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Navbar from '../../components/Navbar/Navbar';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getTeamMeta } from '../../utils/teamMeta';

interface LeaderboardRow {
  rank: number;
  user_id: string;
  email: string;
  display_name: string;
  total_points: number;
  graded_predictions: number;
}

interface MatchPoints {
  match_id: number;
  match_number: number;
  points: number | null;
  team_a: string | null;
  team_b: string | null;
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
  match_number: number | null;
  winner: string | null;
  batter_id: number | null;
  bowler_id: number | null;
  mom_id: number | null;
  is_washout: boolean | null;
}

interface MatchStreakInfo {
  streakAtMatch: number;   // running streak AFTER this match (0 if reset/fifer just awarded)
  fiferJustEarned: boolean; // did this match complete a fifer?
  winnerCorrect: boolean | null; // null = washout/no prediction
}

interface ComputedStats {
  dtCount: number;
  streak: number;     // current active streak (resets after 5 or on loss)
  fiferCount: number; // how many times the user has hit 5 consecutive wins
  matchStreaks: Record<number, MatchStreakInfo>; // keyed by match_id
  perfectMatchIds: Set<number>; // match_ids where user got all 4 correct
  missedMatchIds: Set<number>;  // match_ids where no prediction was submitted
  washoutMatchIds: Set<number>; // match_ids that were washouts
  missedPenalty: number;        // total penalty points for missed predictions
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [matchBreakdown, setMatchBreakdown] = useState<Record<string, MatchPoints[]>>({});

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
          .select('match_id, match_number, winner, batter_id, bowler_id, mom_id, is_washout'),
      ]);

      if (lbRes.error) { setError(lbRes.error.message); setLoading(false); return; }
      const lbRows = (lbRes.data ?? []) as LeaderboardRow[];
      setRows(lbRows);

      // Build stats map
      const preds = (predRes.data ?? []) as PredRow[];
      const cas = (caRes.data ?? []) as CaRow[];

      // Sort correct_answers by match_number so we iterate in match order
      const sortedCas = [...cas].sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0));

      // Stage-based penalty for missed predictions
      const stagePoints = (matchNumber: number) => {
        if (matchNumber <= 35) return 50;
        if (matchNumber <= 70) return 70;
        return 90;
      };

      const map: Record<string, ComputedStats> = {};
      for (const row of lbRows) {
        // Index this user's predictions by match_id for O(1) lookup
        const userPredMap = new Map(
          preds
            .filter((p) => p.user_id === row.user_id)
            .map((p) => [p.match_id, p])
        );

        let dtCount = 0;
        let streak = 0;
        let fiferCount = 0;
        let missedPenalty = 0;
        const matchStreaks: Record<number, MatchStreakInfo> = {};
        const perfectMatchIds = new Set<number>();
        const missedMatchIds = new Set<number>();
        const washoutMatchIds = new Set<number>();

        // Walk every graded match in order
        for (const ca of sortedCas) {
          const isWashout = ca.is_washout === true;

          // If washout: streak is unaffected (neither increment nor reset)
          if (isWashout) {
            washoutMatchIds.add(ca.match_id);
            // If user also missed this washout match → still gets penalty
            const p = userPredMap.get(ca.match_id);
            if (!p) {
              missedMatchIds.add(ca.match_id);
              missedPenalty += stagePoints(ca.match_number ?? 0);
            }
            matchStreaks[ca.match_id] = { streakAtMatch: streak, fiferJustEarned: false, winnerCorrect: null };
            continue;
          }

          const p = userPredMap.get(ca.match_id);

          // Missed match (no prediction submitted) → streak resets + penalty
          if (!p) {
            streak = 0;
            missedMatchIds.add(ca.match_id);
            missedPenalty += stagePoints(ca.match_number ?? 0);
            matchStreaks[ca.match_id] = { streakAtMatch: 0, fiferJustEarned: false, winnerCorrect: null };
            continue;
          }

          if (p.is_double_trouble) dtCount++;

          // Streak is based on correctly predicting the winner only
          const winnerCorrect = !!ca.winner && p.predicted_winner === ca.winner;
          const batterCorrect = !!ca.batter_id && p.predicted_batter_id !== null && Number(p.predicted_batter_id) === ca.batter_id;
          const bowlerCorrect = !!ca.bowler_id && p.predicted_bowler_id !== null && Number(p.predicted_bowler_id) === ca.bowler_id;
          const momCorrect = !!ca.mom_id && p.predicted_mom_id !== null && Number(p.predicted_mom_id) === ca.mom_id;
          const isPerfect = winnerCorrect && batterCorrect && bowlerCorrect && momCorrect;

          if (isPerfect) perfectMatchIds.add(ca.match_id);

          if (winnerCorrect) {
            streak += 1;
            if (streak === 5) {
              // Fifer bonus awarded — +100 pts, reset streak to 0
              fiferCount += 1;
              matchStreaks[ca.match_id] = { streakAtMatch: 5, fiferJustEarned: true, winnerCorrect: true };
              streak = 0;
            } else {
              matchStreaks[ca.match_id] = { streakAtMatch: streak, fiferJustEarned: false, winnerCorrect: true };
            }
          } else {
            // Wrong winner or ungraded → streak resets
            streak = 0;
            matchStreaks[ca.match_id] = { streakAtMatch: 0, fiferJustEarned: false, winnerCorrect: false };
          }
        }

        map[row.user_id] = { dtCount, streak, fiferCount, matchStreaks, perfectMatchIds, missedMatchIds, washoutMatchIds, missedPenalty };
      }
      setStatsMap(map);
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aDisplay = a.total_points + (statsMap[a.user_id]?.fiferCount ?? 0) * 100 - (statsMap[a.user_id]?.missedPenalty ?? 0);
      const bDisplay = b.total_points + (statsMap[b.user_id]?.fiferCount ?? 0) * 100 - (statsMap[b.user_id]?.missedPenalty ?? 0);
      return bDisplay - aDisplay;
    });
  }, [rows, statsMap]);

  // Fetch per-match breakdown lazily when accordion opens
  const handleToggleRow = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (matchBreakdown[userId]) return; // already fetched

    // Fetch all graded matches (correct_answers) — so missed + washout show too
    const { data: caData } = await supabase
      .from('correct_answers')
      .select('match_id, match_number, is_washout')
      .order('match_number', { ascending: true });

    const allCaRows = (caData ?? []) as { match_id: number; match_number: number; is_washout: boolean | null }[];
    const allMatchIds = allCaRows.map((r) => r.match_id);

    // Fetch points for matches the user DID predict
    const { data: pwpData } = await supabase
      .from('predictions_with_points')
      .select('match_id, match_number, points')
      .eq('user_id', userId)
      .order('match_number', { ascending: true });

    const pwpRows = (pwpData ?? []) as { match_id: number; match_number: number; points: number | null }[];
    const pwpByMatchId = new Map(pwpRows.map((r) => [r.match_id, r]));

    // Fetch team names for all graded match IDs
    const teamMap: Record<number, { team_a: string | null; team_b: string | null }> = {};
    if (allMatchIds.length > 0) {
      const { data: matchData } = await supabase
        .from('matches')
        .select('id, team_a, team_b')
        .in('id', allMatchIds);
      for (const m of matchData ?? []) {
        teamMap[m.id] = { team_a: m.team_a ?? null, team_b: m.team_b ?? null };
      }
    }

    // Build merged list: predicted rows use real pts; missed rows use null pts; washouts use 0
    const merged: MatchPoints[] = allCaRows.map((ca) => {
      const pwp = pwpByMatchId.get(ca.match_id);
      return {
        match_id: ca.match_id,
        match_number: ca.match_number,
        points: ca.is_washout ? 0 : (pwp?.points ?? null), // null = missed
        team_a: teamMap[ca.match_id]?.team_a ?? null,
        team_b: teamMap[ca.match_id]?.team_b ?? null,
      };
    });

    setMatchBreakdown((prev) => ({ ...prev, [userId]: merged }));
  };

  const myRow = sorted.find((r) => r.user_id === session?.user?.id);
  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);

  const streakLabel = (streak: number, fiferCount: number) => {
    // Fifer earned + still has active streak
    if (fiferCount > 0 && streak > 0)
      return { text: `🔥×${fiferCount}  ⚡${streak}`, color: '#fb923c', title: `${fiferCount} Fifer${fiferCount > 1 ? 's' : ''} earned (+${fiferCount * 100} pts). Current streak: ${streak}` };
    if (fiferCount > 0 && streak === 0)
      return { text: `🔥×${fiferCount}`, color: '#fb923c', title: `${fiferCount} Fifer bonus${fiferCount > 1 ? 'es' : ''} earned (+${fiferCount * 100} pts).` };
    // No fifer yet
    if (streak >= 4)
      return { text: `⚡${streak}`, color: '#fbbf24', title: `${streak} win streak — ${5 - streak > 0 ? `${5 - streak} more for Fifer!` : 'Fifer bonus earned!'}` };
    if (streak >= 2)
      return { text: `⚡${streak}`, color: '#60a5fa', title: `${streak} win streak` };
    if (streak === 1)
      return { text: `⚡1`, color: 'rgba(255,255,255,0.55)', title: '1 win streak' };
    return { text: '—', color: 'rgba(255,255,255,0.2)', title: 'No active streak' };
  };

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f5f7', pb: 8 }}>
      <Navbar />

      {/* ── Header ────────────────────────────────────────── */}
      <Box
        sx={{
          background: '#000',
          pt: 3.5,
          pb: 4,
          px: 2,
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
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
              Season rankings · All matches
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* ── Loading / Error ───────────────────────────────── */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'rgba(0,0,0,0.3)' }} />
        </Box>
      )}
      {error && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ color: '#dc2626', fontSize: '0.9rem' }}>{error}</Typography>
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
              background: '#111',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
            }}
          >
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '0.78rem', color: '#fff', flexShrink: 0,
              }}
            >
              {getInitials(myRow.display_name)}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#fff', lineHeight: 1.2 }}>
                {myRow.display_name}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                {myRow.graded_predictions} graded predictions
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', lineHeight: 1 }}>
                #{myRow.rank}
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
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
              border: '1px solid rgba(255,255,255,0.08)',
              background: '#111',
              boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Column headers */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr 52px 62px 72px 28px',
                alignItems: 'center',
                px: 2,
                py: 1.1,
                background: '#000',
                borderBottom: '1px solid rgba(0,0,0,0.07)',
              }}
            >
              {[
                { label: '#', align: 'center' },
                { label: 'Player', align: 'left' },
                { label: 'DT', align: 'center' },
                { label: 'Streak', align: 'center' },
                { label: 'Points', align: 'right' },
                { label: '', align: 'center' },
              ].map(({ label, align }) => (
                <Typography
                  key={label}
                  sx={{
                    fontWeight: 800,
                    fontSize: '0.58rem',
                    color: 'rgba(255,255,255,0.6)',
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
              const stats = statsMap[row.user_id];
              const fiferBonus = (stats?.fiferCount ?? 0) * 100;
              const missedPenalty = stats?.missedPenalty ?? 0;
              const displayPts = row.total_points + fiferBonus - missedPenalty;
              const maxDisplayPts = (sorted[0]?.total_points ?? 1) + ((statsMap[sorted[0]?.user_id]?.fiferCount ?? 0) * 100) - (statsMap[sorted[0]?.user_id]?.missedPenalty ?? 0);
              const barPct = Math.max(4, Math.round((displayPts / Math.max(maxDisplayPts, 1)) * 100));
              const isLast = idx === visible.length - 1;
              const isExpanded = expandedUserId === row.user_id;
              const breakdown = matchBreakdown[row.user_id] ?? [];

              return (
                <Box key={row.user_id}>
                  {/* ── Main row (clickable) ── */}
                  <Box
                    onClick={() => handleToggleRow(row.user_id)}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '44px 1fr 52px 62px 72px 28px',
                      alignItems: 'center',
                      px: 2,
                      py: 1.4,
                      borderBottom: isExpanded ? 'none' : isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      background: isExpanded ? 'rgba(255,255,255,0.05)' : '#111',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.15s',
                      '&:hover': { background: 'rgba(255,255,255,0.05)' },
                      ...(isMe && {
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0, top: '18%', bottom: '18%',
                          width: '3px',
                          borderRadius: '0 3px 3px 0',
                          background: '#fff',
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
                        <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
                          {row.rank}
                        </Typography>
                      )}
                    </Box>

                    {/* Name + progress bar */}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: isMe ? 800 : 600,
                          fontSize: '0.84rem',
                          color: '#fff',
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
                      <Box sx={{ height: '3px', borderRadius: '99px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', maxWidth: '160px' }}>
                        <Box
                          sx={{
                            height: '100%',
                            width: `${barPct}%`,
                            borderRadius: '99px',
                            background: medal
                              ? `linear-gradient(90deg, ${medal.color}, ${medal.color}80)`
                              : 'linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.15))',
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
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, px: 0.7, py: 0.25, borderRadius: '6px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' }}>
                              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#d97706' }}>⚡{dt}</Typography>
                            </Box>
                          ) : (
                            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>—</Typography>
                          )}
                        </Box>
                      );
                    })()}

                    {/* Streak + fifer */}
                    {(() => {
                      const s = stats?.streak ?? 0;
                      const f = stats?.fiferCount ?? 0;
                      const sl = streakLabel(s, f);
                      return (
                        <Box sx={{ textAlign: 'center' }} title={sl.title}>
                          <Typography sx={{ fontWeight: 800, fontSize: '0.72rem', color: sl.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                            {sl.text}
                          </Typography>
                        </Box>
                      );
                    })()}

                    {/* Points chip */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.3 }}>
                        <Box
                          sx={{
                            px: 1.1, py: 0.35, borderRadius: '9px',
                            background: medal ? medal.glow : 'rgba(255,255,255,0.1)',
                            border: medal ? `1px solid ${medal.color}60` : '1px solid rgba(255,255,255,0.15)',
                          }}
                        >
                          <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: medal ? medal.color : '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                            {displayPts}
                          </Typography>
                        </Box>

                    </Box>

                    {/* Chevron */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box
                        sx={{
                          width: 20, height: 20, borderRadius: '6px',
                          background: isExpanded ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.15s',
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.6rem',
                            color: isExpanded ? '#fff' : 'rgba(255,255,255,0.4)',
                            lineHeight: 1,
                            transition: 'transform 0.2s, color 0.15s',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            display: 'block',
                          }}
                        >
                          ▾
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* ── Accordion: vertical match list ── */}
                  {isExpanded && (
                    <Box
                      sx={{
                        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
                        background: '#fff',
                      }}
                    >
                      {breakdown.length === 0 ? (
                        <Box sx={{ px: 2, py: 1.5 }}>
                          <Typography sx={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' }}>
                            No graded matches yet
                          </Typography>
                        </Box>
                      ) : (
                        <>
                          {/* Accordion column headers */}
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: '52px 1fr 48px 64px',
                              px: 2,
                              pt: 1,
                              pb: 0.4,
                              borderBottom: '1px solid rgba(0,0,0,0.06)',
                            }}
                          >
                            {['Match', 'Teams', 'Streak', 'Pts'].map((h, i) => (
                              <Typography key={h} sx={{ fontSize: '0.52rem', fontWeight: 800, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: i >= 2 ? 'center' : 'left', ...(i === 3 && { textAlign: 'right' }) }}>
                                {h}
                              </Typography>
                            ))}
                          </Box>

                          {/* Match rows */}
                          {breakdown.map((m, mIdx) => {
                            const stats = statsMap[row.user_id];
                            const isWashoutMatch = stats?.washoutMatchIds?.has(m.match_id) ?? false;
                            const isMissedOnWashout = isWashoutMatch && (stats?.missedMatchIds?.has(m.match_id) ?? false);
                            const isMissed = m.points === null && !isWashoutMatch;
                            const isPerfect = stats?.perfectMatchIds?.has(m.match_id) ?? false;
                            const missedPenaltyPts = (isMissed || isMissedOnWashout) ? (() => {
                              const mn = m.match_number;
                              if (mn <= 35) return 50;
                              if (mn <= 70) return 70;
                              return 90;
                            })() : 0;
                            const pts = (isMissed || isMissedOnWashout) ? -missedPenaltyPts : (m.points ?? 0);
                            const positive = pts > 0;
                            const zero = pts === 0;
                            const ptsColor = positive ? '#16a34a' : zero ? 'rgba(0,0,0,0.25)' : '#dc2626';
                            const rowBg = isMissedOnWashout ? 'rgba(220,38,38,0.05)' : isMissed ? 'rgba(220,38,38,0.04)' : isWashoutMatch ? 'rgba(148,163,184,0.06)' : isPerfect ? 'rgba(167,139,250,0.06)' : 'transparent';
                            const metaA = getTeamMeta(m.team_a ?? undefined);
                            const metaB = getTeamMeta(m.team_b ?? undefined);
                            const abbrTeam = (name: string | null) => {
                              if (!name) return '?';
                              const lower = name.toLowerCase();
                              if (lower.includes('chennai') || lower.includes('csk')) return 'CSK';
                              if (lower.includes('mumbai') || lower.includes('mi')) return 'MI';
                              if (lower.includes('royal') || lower.includes('rcb') || lower.includes('bangalore') || lower.includes('bengaluru')) return 'RCB';
                              if (lower.includes('kolkata') || lower.includes('kkr')) return 'KKR';
                              if (lower.includes('sunrisers') || lower.includes('srh') || lower.includes('hyderabad')) return 'SRH';
                              if (lower.includes('rajasthan') || lower.includes('rr')) return 'RR';
                              if (lower.includes('delhi') || lower.includes('dc') || lower.includes('capitals')) return 'DC';
                              if (lower.includes('punjab') || lower.includes('pbks') || lower.includes('kings')) return 'PBKS';
                              if (lower.includes('gujarat') || lower.includes('gt') || lower.includes('titans')) return 'GT';
                              if (lower.includes('lucknow') || lower.includes('lsg') || lower.includes('super giants')) return 'LSG';
                              return name.slice(0, 3).toUpperCase();
                            };
                            const isLastMatch = mIdx === breakdown.length - 1;
                            // Per-match streak info
                            const msi = statsMap[row.user_id]?.matchStreaks?.[m.match_id];
                            const winCorrect = msi?.winnerCorrect;
                            const streakAfter = msi?.streakAtMatch ?? 0;
                            const fiferEarned = msi?.fiferJustEarned ?? false;
                            return (
                              <Box
                                key={m.match_id}
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: '52px 1fr 48px 64px',
                                  alignItems: 'center',
                                  px: 2,
                                  py: 0.75,
                                  borderBottom: isLastMatch ? 'none' : '1px solid rgba(0,0,0,0.045)',
                                  background: rowBg,
                                }}
                              >
                                {/* Match number badge */}
                                <Box
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 32,
                                    height: 20,
                                    borderRadius: '5px',
                                    background: 'rgba(0,0,0,0.06)',
                                    border: '1px solid rgba(0,0,0,0.1)',
                                  }}
                                >
                                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(0,0,0,0.45)', letterSpacing: '0.02em' }}>
                                    M{m.match_number}
                                  </Typography>
                                </Box>

                                {/* Teams */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                  {/* Team A pill */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.7, py: 0.25, borderRadius: '5px', background: `${metaA.color}22`, border: `1px solid ${metaA.color}40`, flexShrink: 0 }}>
                                    {metaA.logo && <img src={metaA.logo} alt={m.team_a ?? ''} style={{ width: 12, height: 12, objectFit: 'contain' }} />}
                                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: metaA.color, letterSpacing: '0.02em' }}>
                                      {abbrTeam(m.team_a)}
                                    </Typography>
                                  </Box>
                                  <Typography sx={{ fontSize: '0.55rem', color: 'rgba(0,0,0,0.25)', fontWeight: 700, flexShrink: 0 }}>vs</Typography>
                                  {/* Team B pill */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.7, py: 0.25, borderRadius: '5px', background: `${metaB.color}22`, border: `1px solid ${metaB.color}40`, flexShrink: 0 }}>
                                    {metaB.logo && <img src={metaB.logo} alt={m.team_b ?? ''} style={{ width: 12, height: 12, objectFit: 'contain' }} />}
                                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: metaB.color, letterSpacing: '0.02em' }}>
                                      {abbrTeam(m.team_b)}
                                    </Typography>
                                  </Box>
                                </Box>

                                {/* Per-match streak + perfect indicator */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.1 }}>
                                  {/* Perfect + Fifer on same match — show both */}
                                  {isPerfect && fiferEarned ? (
                                    <>
                                      <Box sx={{ display: 'flex', gap: 0.2 }}>
                                        <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>🏆</Typography>
                                        <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>🔥</Typography>
                                      </Box>
                                      <Typography sx={{ fontSize: '0.42rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>PERFECT+FIFER</Typography>
                                    </>
                                  ) : isPerfect ? (
                                    <>
                                      <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>🏆</Typography>
                                      <Typography sx={{ fontSize: '0.42rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>PERFECT</Typography>
                                    </>
                                  ) : isMissedOnWashout ? (
                                    <>
                                      <Box sx={{ display: 'flex', gap: 0.2 }}>
                                        <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>🌧</Typography>
                                        <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>🚫</Typography>
                                      </Box>
                                      <Typography sx={{ fontSize: '0.42rem', fontWeight: 800, color: '#b91c1c', lineHeight: 1 }}>MISSED+WO</Typography>
                                    </>
                                  ) : isWashoutMatch ? (
                                    <>
                                      <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>🌧</Typography>
                                      <Typography sx={{ fontSize: '0.42rem', fontWeight: 800, color: '#64748b', lineHeight: 1 }}>WASHOUT</Typography>
                                    </>
                                  ) : isMissed ? (
                                    <>
                                      <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>🚫</Typography>
                                      <Typography sx={{ fontSize: '0.42rem', fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>MISSED</Typography>
                                    </>
                                  ) : fiferEarned ? (
                                    <>
                                      <Typography sx={{ fontSize: '0.78rem', lineHeight: 1 }}>🔥</Typography>
                                      <Typography sx={{ fontSize: '0.47rem', fontWeight: 800, color: '#c2410c', lineHeight: 1 }}>FIFER!</Typography>
                                    </>
                                  ) : winCorrect ? (
                                    <>
                                      <Typography sx={{ fontSize: '0.65rem', lineHeight: 1, color: '#16a34a', fontWeight: 900 }}>✓</Typography>
                                      {streakAfter >= 2 && (
                                        <Typography sx={{ fontSize: '0.47rem', fontWeight: 800, color: streakAfter >= 4 ? '#f59e0b' : '#16a34a', lineHeight: 1 }}>
                                          ×{streakAfter}
                                        </Typography>
                                      )}
                                    </>
                                  ) : (
                                    <Typography sx={{ fontSize: '0.65rem', lineHeight: 1, color: '#dc2626', fontWeight: 900 }}>✗</Typography>
                                  )}
                                </Box>

                                {/* Points */}
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <Box
                                    sx={{
                                      px: 0.9, py: 0.3, borderRadius: '6px',
                                      background: positive ? 'rgba(22,163,74,0.1)' : zero ? 'rgba(0,0,0,0.04)' : 'rgba(220,38,38,0.1)',
                                      border: positive ? '1px solid rgba(22,163,74,0.25)' : zero ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(220,38,38,0.25)',
                                    }}
                                  >
                                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: ptsColor, fontVariantNumeric: 'tabular-nums' }}>
                                      {pts > 0 ? `+${pts}` : pts}
                                    </Typography>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })}
                          {/* Perfect Match bonus row */}
                          {(statsMap[row.user_id]?.perfectMatchIds?.size ?? 0) > 0 && (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: 2, py: 0.85,
                                mt: 0.25,
                                mx: 1.5,
                                borderRadius: '8px',
                                background: 'rgba(167,139,250,0.1)',
                                border: '1px solid rgba(167,139,250,0.3)',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: '0.75rem' }}>🏆</Typography>
                                <Box>
                                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#6d28d9', lineHeight: 1.2 }}>
                                    Perfect Match ×{statsMap[row.user_id]?.perfectMatchIds?.size}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.58rem', color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>
                                    All 4 predictions correct · +150 pts each
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ px: 0.9, py: 0.3, borderRadius: '6px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)' }}>
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#6d28d9', fontVariantNumeric: 'tabular-nums' }}>
                                  +{(statsMap[row.user_id]?.perfectMatchIds?.size ?? 0) * 150}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                          {/* Fifer bonus row */}
                          {(statsMap[row.user_id]?.fiferCount ?? 0) > 0 && (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: 2, py: 0.85,
                                mt: 0.25,
                                mx: 1.5,
                                mb: 1,
                                borderRadius: '8px',
                                background: 'rgba(251,146,60,0.1)',
                                border: '1px solid rgba(251,146,60,0.3)',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: '0.75rem' }}>🔥</Typography>
                                <Box>
                                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#c2410c', lineHeight: 1.2 }}>
                                    Fifer Bonus ×{statsMap[row.user_id]?.fiferCount}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.58rem', color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>
                                    5 consecutive correct winner predictions
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ px: 0.9, py: 0.3, borderRadius: '6px', background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.35)' }}>
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#c2410c', fontVariantNumeric: 'tabular-nums' }}>
                                  +{(statsMap[row.user_id]?.fiferCount ?? 0) * 100}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                          {/* Missed penalty summary row */}
                          {(statsMap[row.user_id]?.missedMatchIds?.size ?? 0) > 0 && (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: 2, py: 0.85,
                                mt: 0.25,
                                mx: 1.5,
                                borderRadius: '8px',
                                background: 'rgba(220,38,38,0.07)',
                                border: '1px solid rgba(220,38,38,0.2)',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: '0.75rem' }}>🚫</Typography>
                                <Box>
                                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#b91c1c', lineHeight: 1.2 }}>
                                    Missed ×{statsMap[row.user_id]?.missedMatchIds?.size}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.58rem', color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>
                                    No prediction submitted · stage-based penalty
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ px: 0.9, py: 0.3, borderRadius: '6px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)' }}>
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                                  −{statsMap[row.user_id]?.missedPenalty ?? 0}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                          {/* Washout info row */}
                          {(statsMap[row.user_id]?.washoutMatchIds?.size ?? 0) > 0 && (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: 2, py: 0.85,
                                mt: 0.25,
                                mx: 1.5,
                                borderRadius: '8px',
                                background: 'rgba(100,116,139,0.07)',
                                border: '1px solid rgba(100,116,139,0.2)',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ fontSize: '0.75rem' }}>🌧</Typography>
                                <Box>
                                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', lineHeight: 1.2 }}>
                                    Washout ×{statsMap[row.user_id]?.washoutMatchIds?.size}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.58rem', color: 'rgba(0,0,0,0.4)', fontWeight: 500 }}>
                                    Match abandoned · 0 pts · no penalty
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ px: 0.9, py: 0.3, borderRadius: '6px', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)' }}>
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                                  0
                                </Typography>
                              </Box>
                            </Box>
                          )}
                          {/* bottom spacing */}
                          <Box sx={{ pb: 0.5 }} />
                        </>
                      )}
                    </Box>
                  )}
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
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  cursor: 'pointer', userSelect: 'none',
                  transition: 'background 0.15s, border-color 0.15s',
                  '&:hover': { background: '#f0f0f0', borderColor: 'rgba(0,0,0,0.18)' },
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'rgba(0,0,0,0.6)' }}>
                  {showAll ? 'Show less' : `Show all ${sorted.length} players`}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.3)' }}>
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
          <Typography sx={{ color: 'rgba(0,0,0,0.3)', fontSize: '0.9rem', fontWeight: 600 }}>
            No data yet. Make some predictions!
          </Typography>
        </Container>
      )}
    </Box>
  );
};

export default Leaderboard;
