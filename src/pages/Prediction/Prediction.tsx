import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
  Container,
  Dialog,
  DialogContent,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import Navbar from '../../components/Navbar/Navbar';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getTeamMeta } from '../../utils/teamMeta';
import { getRandomDialogue } from '../../utils/loadingDialogues';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchDetail {
  id: string | number;
  match_number: number;
  match_date: string;
  match_time: string;
  match_start_utc: string; // server-stored UTC timestamp — device clock/timezone cannot affect this
  venue?: string;
  team_a?: string;
  team_b?: string;
}

interface Player {
  id: string | number;
  name: string;
  team: string;
}

interface CorrectAnswer {
  winner: string | null;
  batter_id: number | null;
  bowler_id: number | null;
  mom_id: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const teamAbbreviations: Record<string, string> = {
  'mumbai indians': 'MI',
  'royal challengers bangalore': 'RCB',
  'royal bengal challengers': 'RCB',
  'royal challengers bengaluru': 'RCB',
  'chennai super kings': 'CSK',
  'delhi capitals': 'DC',
  'sunrisers hyderabad': 'SRH',
  'sunrise hyderabad': 'SRH',
  'rajasthan royals': 'RR',
  'lucknow super giants': 'LSG',
  'lucknow supergiants': 'LSG',
  'kolkata knight riders': 'KKR',
  'gujarat titans': 'GT',
  'punjab kings': 'PBKS',
  'kings xi punjab': 'PBKS',
};

const abbr = (name?: string) => {
  if (!name) return '?';
  return teamAbbreviations[name.toLowerCase()] || name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase();
};



const splitName = (name?: string) => {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) return words.join('\n');
  // Always split into 2 lines: first word on line 1, rest on line 2
  const mid = Math.ceil(words.length / 2);
  return words.slice(0, mid).join(' ') + '\n' + words.slice(mid).join(' ');
};

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'winner', label: 'Winner' },
  { key: 'batter', label: 'Batter' },
  { key: 'bowler', label: 'Bowler' },
  { key: 'mom', label: 'MOM' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ─── PlayerCard ───────────────────────────────────────────────────────────────

const PlayerCard = ({
  player,
  selected,
  onSelect,
  color,
  isCorrect = null,
}: {
  player: Player;
  selected: boolean;
  onSelect: () => void;
  color: string;
  isCorrect?: boolean | null;
}) => (
  <Box
    onClick={onSelect}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 0.75,
      px: 1,
      py: 1,
      borderRadius: '12px',
      border: isCorrect ? '2px solid #16a34a' : selected ? `2px solid ${color}` : '2px solid transparent',
      background: isCorrect ? '#f0fdf4' : selected ? `${color}12` : '#fff',
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      boxShadow: isCorrect
        ? '0 4px 16px rgba(22,163,74,0.25)'
        : selected
        ? `0 4px 16px ${color}30`
        : '0 1px 4px rgba(0,0,0,0.05)',
      '&:hover': {
        background: isCorrect ? '#dcfce7' : selected ? `${color}18` : '#fafafa',
        transform: 'translateY(-1px)',
      },
      mb: 0.75,
    }}
  >
    {/* Coloured left accent bar instead of avatar */}
    <Box
      sx={{
        width: 3,
        height: 28,
        borderRadius: '2px',
        background: isCorrect ? '#16a34a' : selected ? color : 'rgba(0,0,0,0.1)',
        flexShrink: 0,
        transition: 'background 0.18s ease',
      }}
    />
    <Typography
      sx={{
        flex: 1,
        minWidth: 0,
        fontWeight: 700,
        fontSize: '0.68rem',
        color: isCorrect ? '#15803d' : selected ? color : '#000',
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: 'color 0.18s ease',
      }}
    >
      {player.name}
    </Typography>
    {isCorrect && (
      <CheckCircleIcon sx={{ fontSize: '0.95rem', color: '#16a34a', flexShrink: 0 }} />
    )}
    {!isCorrect && selected && (
      <CheckCircleIcon sx={{ fontSize: '0.95rem', color, flexShrink: 0 }} />
    )}
  </Box>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const Prediction = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('winner');

  // ── Server time offset ────────────────────────────────────────────────────
  // Fetched once on mount. serverNow() = Date.now() + offset.
  // This makes ALL lock checks immune to device clock / timezone manipulation.
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const serverNow = () => Date.now() + serverTimeOffset;

  // Selections: one per tab
  const [selections, setSelections] = useState<Record<TabKey, string | number | null>>({
    winner: null,
    batter: null,
    bowler: null,
    mom: null,
  });

  const allSelected = Object.values(selections).every((v) => v !== null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [correctAnswer, setCorrectAnswer] = useState<CorrectAnswer | null>(null);
  const [notAccessible, setNotAccessible] = useState(false); // match too far in future

  // ── Fetch server time once on mount to guard against device clock tampering ──
  useEffect(() => {
    const fetchServerTime = async () => {
      const { data } = await supabase.rpc('get_server_time');
      if (data) {
        const serverMs = new Date(data as string).getTime();
        setServerTimeOffset(serverMs - Date.now());
      }
    };
    fetchServerTime();
  }, []);

  // ── Countdown timer ────────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    if (!match) return;
    // Use match_start_utc — server UTC timestamp, unaffected by device clock or timezone
    // NULL guard: fall back to match_date+match_time if column not yet populated
    const matchDateTime = match.match_start_utc
      ? new Date(match.match_start_utc)
      : new Date(`${match.match_date}T${match.match_time}`);

    const tick = () => {
      const diff = matchDateTime.getTime() - serverNow();
      if (diff <= 0) {
        setCountdown(null); // match started
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      const parts: string[] = [];
      if (h > 0) parts.push(`${h}h`);
      if (h > 0 || m > 0) parts.push(`${m}m`);
      parts.push(`${s}s`);
      setCountdown(parts.join(' ') + ' remaining');
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match]);

  // ── Double Trouble ─────────────────────────────────────────────────────────
  const [useDoubleTrouble, setUseDoubleTrouble] = useState(false);
  const [dtUsedInStage, setDtUsedInStage] = useState(0);        // how many DT already used in this stage (other matches)

  // Determine which stage the match belongs to and the DT quota for that stage
  const getStageInfo = (matchNumber: number): { stage: number; from: number; to: number; quota: number } => {
    if (matchNumber <= 35) return { stage: 1, from: 1, to: 35, quota: 7 };
    if (matchNumber <= 70) return { stage: 2, from: 36, to: 70, quota: 7 };
    return { stage: 3, from: 71, to: 74, quota: 2 };
  };

  const stageInfo = match ? getStageInfo(match.match_number) : null;
  // dtUsedInStage = DT used in this stage by OTHER matches (current match excluded via .neq)
  // dtRemaining = how many slots are still free (not counting the current prediction's toggle)
  const dtRemaining = stageInfo ? stageInfo.quota - dtUsedInStage : 0;
  // User can toggle DT on if: there are free slots, OR this prediction already has DT on (re-toggling off is always allowed)
  const canUseDT = dtRemaining > 0;

  const { session } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchDisplayName = async () => {
      if (!session?.user?.id) return;
      const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).single();
      if (!mounted) return;
      if (prof?.display_name) { setDisplayName(prof.display_name); return; }
      const { data: lb } = await supabase.from('leaderboard').select('display_name').eq('user_id', session.user.id).single();
      if (!mounted) return;
      if (lb?.display_name && !/\S+@\S+\.\S+/.test(lb.display_name)) { setDisplayName(lb.display_name); return; }
      // derive from email
      const email = session.user.email ?? '';
      const local = email.split('@')[0];
      const parts = local.replace(/[_.]+/g, ' ').split(/\s+/).filter(Boolean);
      const derived = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      if (derived) setDisplayName(derived);
    };
    fetchDisplayName();
    return () => { mounted = false; };
  }, [session?.user?.id]);

  // ── Match lock: uses serverNow() — immune to device clock/timezone manipulation ──
  const isMatchStarted = (m: MatchDetail | null): boolean => {
    if (!m) return false;
    const lockTime = m.match_start_utc
      ? new Date(m.match_start_utc).getTime()
      : new Date(`${m.match_date}T${m.match_time}`).getTime();
    return serverNow() >= lockTime;  // serverNow() = Date.now() + server offset
  };
  const matchLocked = isMatchStarted(match);

  // Resolve player id → name for preview
  const playerName = (id: string | number | null) =>
    players.find((p) => Number(p.id) === Number(id))?.name ?? String(id);

  // ── Refresh DT count for the stage (used on load + after save) ────────────
  const refreshDtCount = async (currentMatchId: string | number, matchNumber: number) => {
    if (!session?.user?.id) return;
    const mn = matchNumber;
    const stage_from = mn <= 35 ? 1 : mn <= 70 ? 36 : 71;
    const stage_to   = mn <= 35 ? 35 : mn <= 70 ? 70 : 74;

    const { data: stageMatches } = await supabase
      .from('matches')
      .select('id')
      .gte('match_number', stage_from)
      .lte('match_number', stage_to)
      .neq('id', currentMatchId);

    const stageMatchIds = (stageMatches ?? []).map((m: { id: number }) => m.id);
    if (stageMatchIds.length === 0) { setDtUsedInStage(0); return; }

    const { data: dtData } = await supabase
      .from('predictions')
      .select('match_id')
      .eq('user_id', session.user.id)
      .eq('is_double_trouble', true)
      .in('match_id', stageMatchIds);
    setDtUsedInStage((dtData ?? []).length);
  };

  // ── Save / Update to Supabase (upsert = one entry per user per match) ─────
  const handleSave = async () => {
    if (!match || !session) return;
    // Re-check lock at save time using server UTC — device clock cannot bypass this
    if (isMatchStarted(match)) {
      setShowPreview(false);
      setToast({ open: true, message: 'Predictions are closed — match has already started.' });
      return;
    }
    setSaving(true);
    const payload = {
      match_id: match.id,
      match_number: match.match_number,
      match_name: `${match.team_a} vs ${match.team_b}`,
      match_time: match.match_time,
      match_date: match.match_date,
      user_id: session.user.id,
      user_email: session.user.email,
      predicted_winner: selections.winner,
      predicted_batter_id: selections.batter,
      predicted_batter_name: playerName(selections.batter),
      predicted_bowler_id: selections.bowler,
      predicted_bowler_name: playerName(selections.bowler),
      predicted_mom_id: selections.mom,
      predicted_mom_name: playerName(selections.mom),
      is_double_trouble: useDoubleTrouble,
      submitted_at: new Date().toISOString(),
    };
    // upsert on (match_id, user_id) unique constraint — updates if row exists
    const { error } = await supabase
      .from('predictions')
      .upsert([payload], { onConflict: 'match_id,user_id' });
    setSaving(false);
    if (!error) {
      const wasEditing = isEditing;
      setSaved(true);
      setIsEditing(false);
      setShowPreview(false);
      setToast({ open: true, message: wasEditing ? 'Prediction updated successfully!' : 'Prediction saved successfully!' });
      // Refresh DT count so the toggle reflects the saved state (including washout matches)
      if (match) refreshDtCount(match.id, match.match_number);
    } else {
      alert(`Error saving: ${error.message}`);
    }
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch match details
      const { data: matchData } = await supabase
        .from('matches')
        .select('id, match_number, match_date, match_time, match_start_utc, venue, team_a, team_b')
        .eq('id', matchId)
        .single();

      if (matchData) setMatch(matchData as MatchDetail);

      // ── Access gate: only allow if match starts within next 24h or has already started ──
      // Uses match_start_utc (server UTC) — device timezone/clock cannot affect this
      if (matchData) {
        const matchStartMs = matchData.match_start_utc
          ? new Date(matchData.match_start_utc).getTime()
          : new Date(`${matchData.match_date}T${matchData.match_time}`).getTime();
        const diffHours = (matchStartMs - serverNow()) / (1000 * 60 * 60);
        // diffHours < 0 → already started; 0–24 → prediction window open; > 24 → too early
        if (diffHours > 24) {
          setNotAccessible(true);
          setLoading(false);
          return;
        }
      }
      if (matchData?.team_a && matchData?.team_b) {
        const { data: playersData } = await supabase
          .from('players')
          .select('id, name, team')
          .in('team', [matchData.team_a, matchData.team_b])
          .order('name', { ascending: true });

        setPlayers((playersData as Player[]) || []);
      }

      // Fetch existing prediction for this user + match (to pre-populate)
      if (session?.user.id && matchData?.id) {
        const { data: existingData } = await supabase
          .from('predictions')
          .select('id, predicted_winner, predicted_batter_id, predicted_bowler_id, predicted_mom_id, is_double_trouble')
          .eq('match_id', matchData.id)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (existingData) {
          setSaved(true);
          setSelections({
            winner: existingData.predicted_winner ?? null,
            batter: existingData.predicted_batter_id != null ? Number(existingData.predicted_batter_id) : null,
            bowler: existingData.predicted_bowler_id != null ? Number(existingData.predicted_bowler_id) : null,
            mom: existingData.predicted_mom_id != null ? Number(existingData.predicted_mom_id) : null,
          });
          const dtVal = !!(existingData.is_double_trouble);
          setUseDoubleTrouble(dtVal);
        }

        // Count DT used in this stage via the shared helper
        if (matchData?.match_number) {
          await refreshDtCount(matchData.id, matchData.match_number);
        }
      }

      // Fetch correct answers for this match (if admin has entered them)
      if (matchData?.id) {
        const { data: caData } = await supabase
          .from('correct_answers')
          .select('winner, batter_id, bowler_id, mom_id')
          .eq('match_id', matchData.id)
          .maybeSingle();
        if (caData) {
          setCorrectAnswer({
            winner: caData.winner || null,
            batter_id: caData.batter_id ? Number(caData.batter_id) : null,
            bowler_id: caData.bowler_id ? Number(caData.bowler_id) : null,
            mom_id: caData.mom_id ? Number(caData.mom_id) : null,
          });
        }
      }

      setLoading(false);
    };

    if (matchId) fetchData();
  }, [matchId, session?.user?.id]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const teamA = match?.team_a;
  const teamB = match?.team_b;
  const metaA = getTeamMeta(teamA);
  const metaB = getTeamMeta(teamB);
  const colorA = metaA.color;
  const colorB = metaB.color;

  const playersA = players.filter((p) => p.team === teamA);
  const playersB = players.filter((p) => p.team === teamB);

  // ── Correct answer helpers ─────────────────────────────────────────────────
  const correctWinner = correctAnswer?.winner ?? null;
  const correctBatterId = correctAnswer?.batter_id ?? null;
  const correctBowlerId = correctAnswer?.bowler_id ?? null;
  const correctMomId = correctAnswer?.mom_id ?? null;

  const hasResults = correctAnswer !== null;

  const selectPlayer = (tab: TabKey, id: string | number) => {
    const numId = Number(id);
    if (saved) setIsEditing(true);
    setSelections((prev) => ({
      ...prev,
      [tab]: prev[tab] === numId ? null : numId,
    }));
  };

  const selectWinner = (team: string) => {
    if (saved) setIsEditing(true);
    setSelections((prev) => ({
      ...prev,
      winner: prev.winner === team ? null : team,
    }));
  };

  // ── Tab indicator colour ────────────────────────────────────────────────────

  const tabDone = (key: TabKey) => selections[key] !== null;

  // ── Swipe gesture for tab navigation ──────────────────────────────────────
  const TAB_KEYS: TabKey[] = ['winner', 'batter', 'bowler', 'mom'];
  const swipeTouchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeTouchStart.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swipeTouchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeTouchStart.current.x;
    const dy = t.clientY - swipeTouchStart.current.y;
    swipeTouchStart.current = null;
    // Only trigger if horizontal swipe dominates and is >= 50px
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    const idx = TAB_KEYS.indexOf(activeTab);
    if (dx < 0 && idx < TAB_KEYS.length - 1) setActiveTab(TAB_KEYS[idx + 1]); // swipe left → next
    if (dx > 0 && idx > 0) setActiveTab(TAB_KEYS[idx - 1]);                    // swipe right → prev
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f5f5f7' }}>
        <Navbar />
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 64px)', gap: 2 }}>
          <CircularProgress sx={{ color: '#000' }} />
          <Typography sx={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.5)', fontStyle: 'italic', fontWeight: 600, maxWidth: '300px', textAlign: 'center' }}>
            {getRandomDialogue()}
          </Typography>
        </Box>
      </Box>
    );
  }

  // Match is not yet in the prediction window
  if (notAccessible) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f5f5f7' }}>
        <Navbar />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 64px)',
            px: 3,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '22px',
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2.5,
              boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
            }}
          >
            <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>🔒</Typography>
          </Box>
          <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#000', mb: 0.75, letterSpacing: '-0.02em' }}>
            Predictions Not Open Yet
          </Typography>
          <Typography sx={{ fontSize: '0.88rem', color: 'rgba(0,0,0,0.45)', maxWidth: 300, lineHeight: 1.65, mb: 3 }}>
            Predictions for this match open 24 hours before it starts. Check back closer to match day.
          </Typography>
          {match && (
            <Box
              sx={{
                px: 2,
                py: 1.25,
                borderRadius: '14px',
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.08)',
                mb: 3,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}
            >
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(0,0,0,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', mb: 0.4 }}>
                Match {match.match_number}
              </Typography>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: 800, color: '#000' }}>
                {match.team_a} vs {match.team_b}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.45)', mt: 0.3 }}>
                {match.match_date} · {match.match_time}
              </Typography>
            </Box>
          )}
          <Box
            onClick={() => navigate('/dashboard')}
            sx={{
              px: 3,
              py: 1.25,
              borderRadius: '14px',
              background: '#000',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              '&:hover': { background: '#222' },
              transition: 'background 0.15s ease',
            }}
          >
            <ArrowBackIcon sx={{ fontSize: '0.9rem', color: '#fff' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>Back to Dashboard</Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f5f7', pb: '88px' }}>
      <Navbar />

      {/* ── Match header ─────────────────────────────────── */}
      <Box
        sx={{
          background: '#000',
          pt: 2,
          pb: 3,
          px: 2,
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 80% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="md" disableGutters sx={{ px: 2 }}>
          {/* Back + label row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box
              onClick={() => navigate(-1)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                '&:hover': { background: 'rgba(255,255,255,0.18)' },
              }}
            >
              <ArrowBackIcon sx={{ fontSize: '1rem', color: '#fff' }} />
            </Box>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Match {match?.match_number} · Make Prediction
            </Typography>
          </Box>

          {/* Teams row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            {/* Team A */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '16px',
                  background: colorA,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 18px ${colorA}80`,
                  border: '2px solid rgba(255,255,255,0.15)',
                  p: '6px',
                }}
              >
                {metaA.logo ? (
                  <img src={metaA.logo} alt={teamA} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                ) : (
                  <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{abbr(teamA)}</Typography>
                )}
              </Box>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  color: '#fff',
                  textAlign: 'center',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.2,
                }}
              >
                {splitName(teamA)}
              </Typography>
            </Box>

            {/* VS */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3 }}>
              <Typography sx={{ fontWeight: 900, fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>VS</Typography>
            </Box>

            {/* Team B */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '16px',
                  background: colorB,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 18px ${colorB}80`,
                  border: '2px solid rgba(255,255,255,0.15)',
                  p: '6px',
                }}
              >
                {metaB.logo ? (
                  <img src={metaB.logo} alt={teamB} style={{ width: 40, height: 40, objectFit: 'contain' }} />
                ) : (
                  <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{abbr(teamB)}</Typography>
                )}
              </Box>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  color: '#fff',
                  textAlign: 'center',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.2,
                }}
              >
                {splitName(teamB)}
              </Typography>
            </Box>
          </Box>

          {/* Countdown timer — centred below team names */}
          {countdown && !matchLocked && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.6,
                  py: 0.65,
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(251,146,60,0.22), rgba(234,179,8,0.18))',
                  border: '1px solid rgba(251,146,60,0.45)',
                  boxShadow: '0 2px 14px rgba(251,146,60,0.2)',
                }}
              >
                {/* Pulsing dot */}
                <Box
                  sx={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: '#fb923c',
                    boxShadow: '0 0 7px #fb923c',
                    animation: 'cdPulse 1.2s ease-in-out infinite',
                    '@keyframes cdPulse': {
                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                      '50%': { opacity: 0.35, transform: 'scale(0.75)' },
                    },
                  }}
                />
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: 'linear-gradient(90deg, #fb923c, #facc15)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                  }}
                >
                  ⏱ {countdown}
                </Typography>
              </Box>
            </Box>
          )}
        </Container>
      </Box>

      {/* ── Tab bar ───────────────────────────────────────── */}
      <Box sx={{ background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)', position: 'sticky', top: 58, zIndex: 10 }}>
        <Container maxWidth="md" disableGutters>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v as TabKey)}
            variant="fullWidth"
            TabIndicatorProps={{ style: { display: 'none' } }}
            sx={{
              minHeight: 44,
              '& .MuiTab-root': {
                minHeight: 44,
                fontWeight: 700,
                fontSize: '0.72rem',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'rgba(0,0,0,0.4)',
                gap: 0.5,
                px: 1,
                transition: 'color 0.18s ease',
                '&.Mui-selected': { color: '#000' },
                '&:focus': { outline: 'none' },
                '&:focus-visible': { outline: 'none' },
              },
            }}
          >
            {TABS.map(({ key, label }) => {
              const done = tabDone(key);
              const isActive = activeTab === key;
              return (
                <Tab
                  key={key}
                  value={key}
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                        <span style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>{label}</span>
                        {done && (
                          <Box sx={{
                            width: 14, height: 14, borderRadius: '50%',
                            background: isActive ? '#000' : 'rgba(0,0,0,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s ease',
                          }}>
                            <Typography sx={{ fontSize: '0.52rem', color: '#fff', fontWeight: 900, lineHeight: 1 }}>✓</Typography>
                          </Box>
                        )}
                      </Box>
                      {/* active underline bar */}
                      <Box sx={{
                        height: 3, width: isActive ? 20 : done ? 12 : 8,
                        borderRadius: '3px',
                        background: isActive ? '#000' : done ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)',
                        transition: 'all 0.25s ease',
                      }} />
                    </Box>
                  }
                  sx={{
                    pt: 1,
                    borderBottom: isActive ? '2.5px solid #000' : '2.5px solid transparent',
                  }}
                />
              );
            })}
          </Tabs>
        </Container>
      </Box>

      {/* ── Tab content ───────────────────────────────────── */}
      <Container
        maxWidth="md"
        sx={{ py: 3, px: { xs: 2, sm: 3 }, pb: 10 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* ────── WINNER ────── */}
        {activeTab === 'winner' && (
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 2 }}>
              Who will win this match?
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              {[
                { team: teamA, color: colorA },
                { team: teamB, color: colorB },
              ].map(({ team, color }) => {
                const selected = selections.winner === team;
                return (
                  <Box
                    key={team}
                    onClick={() => !matchLocked && team && selectWinner(team)}
                    sx={{
                      borderRadius: '20px',
                      border: (hasResults && correctWinner === team) ? '2.5px solid #16a34a' : selected ? `2.5px solid ${color}` : '2px solid rgba(0,0,0,0.08)',
                      background: (hasResults && correctWinner === team) ? '#f0fdf4' : selected ? `${color}10` : '#fff',
                      p: { xs: 1.75, sm: 2.25 },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                      cursor: matchLocked ? 'default' : 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: matchLocked && !selected ? 0.5 : 1,
                      boxShadow: (hasResults && correctWinner === team) ? '0 6px 24px rgba(22,163,74,0.3)' : selected ? `0 6px 24px ${color}30` : '0 2px 8px rgba(0,0,0,0.05)',
                      '&:hover': !matchLocked ? {
                        transform: 'translateY(-2px)',
                        boxShadow: (hasResults && correctWinner === team) ? '0 10px 30px rgba(22,163,74,0.35)' : selected ? `0 10px 30px ${color}35` : '0 6px 20px rgba(0,0,0,0.09)',
                      } : {},
                    }}
                  >
                    {(() => { const m = getTeamMeta(team); return (
                    <Box
                      sx={{
                        width: { xs: 52, sm: 60 },
                        height: { xs: 52, sm: 60 },
                        borderRadius: '16px',
                        background: selected || (hasResults && correctWinner === team) ? m.color : 'rgba(0,0,0,0.07)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: selected ? `0 6px 20px ${m.color}55` : 'none',
                        transition: 'all 0.2s ease',
                        p: '6px',
                      }}
                    >
                      {m.logo ? (
                        <img src={m.logo} alt={team} style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: selected || (hasResults && correctWinner === team) ? 1 : 0.35, transition: 'opacity 0.2s ease' }} />
                      ) : (
                        <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.3rem', sm: '1.5rem' }, color: selected ? '#fff' : 'rgba(0,0,0,0.3)', transition: 'color 0.2s ease' }}>
                          {abbr(team)}
                        </Typography>
                      )}
                    </Box>
                    ); })()}
                    <Typography
                      sx={{
                        fontWeight: 800,
                        fontSize: { xs: '0.82rem', sm: '0.88rem' },
                        color: selected ? color : '#000',
                        textAlign: 'center',
                        whiteSpace: 'pre-line',
                        lineHeight: 1.25,
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {splitName(team)}
                    </Typography>
                    {selected && (
                      <Chip
                        label="Selected"
                        size="small"
                        icon={<CheckCircleIcon sx={{ fontSize: '0.9rem !important', color: `${color} !important` }} />}
                        sx={{
                          background: `${color}18`,
                          color,
                          fontWeight: 700,
                          fontSize: '0.62rem',
                          height: 22,
                          border: `1px solid ${color}40`,
                        }}
                      />
                    )}
                    {/* Correct answer badge */}
                    {hasResults && correctWinner === team && (
                      <Chip
                        label="✓ Correct Answer"
                        size="small"
                        sx={{ background: '#dcfce7', color: '#16a34a', fontWeight: 800, fontSize: '0.6rem', height: 20, border: '1px solid #86efac' }}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* ────── BATTER / BOWLER / MOM — two-column player picker ────── */}
        {(activeTab === 'batter' || activeTab === 'bowler' || activeTab === 'mom') && (
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 2 }}>
              {activeTab === 'batter' && 'Pick the top batter'}
              {activeTab === 'bowler' && 'Pick the top bowler'}
              {activeTab === 'mom' && 'Pick the Man of the Match'}
            </Typography>

            {players.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 8,
                  background: '#fff',
                  borderRadius: '20px',
                  border: '1px solid rgba(0,0,0,0.07)',
                }}
              >
                <PersonIcon sx={{ fontSize: '2.5rem', color: 'rgba(0,0,0,0.12)', mb: 1.5 }} />
                <Typography sx={{ fontWeight: 700, color: '#000', mb: 0.4 }}>No players found</Typography>
                <Typography sx={{ fontSize: '0.82rem', color: 'rgba(0,0,0,0.4)' }}>Players will be listed once the squad is announced.</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, alignItems: 'start' }}>
                {/* Team A column */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, px: 0.5 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        background: colorA,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        p: '4px',
                        boxShadow: `0 2px 8px ${colorA}55`,
                      }}
                    >
                      {metaA.logo ? (
                        <img src={metaA.logo} alt={teamA} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                      ) : (
                        <Typography sx={{ fontWeight: 900, fontSize: '0.62rem', color: '#fff', letterSpacing: '0.04em' }}>{abbr(teamA)}</Typography>
                      )}
                    </Box>
                  </Box>
                  {playersA.length === 0 ? (
                    <Box sx={{ py: 3, textAlign: 'center', borderRadius: '12px', background: '#fff', border: '1px dashed rgba(0,0,0,0.1)' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>Squad TBA</Typography>
                    </Box>
                  ) : (
                    playersA.map((p) => (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        selected={Number(selections[activeTab]) === Number(p.id)}
                        onSelect={() => selectPlayer(activeTab, p.id)}
                        color={colorA}
                        isCorrect={hasResults && (
                          (activeTab === 'batter' && Number(p.id) === correctBatterId) ||
                          (activeTab === 'bowler' && Number(p.id) === correctBowlerId) ||
                          (activeTab === 'mom' && Number(p.id) === correctMomId)
                        ) || false}
                      />
                    ))
                  )}
                </Box>

                {/* Team B column */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, px: 0.5 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        background: colorB,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        p: '4px',
                        boxShadow: `0 2px 8px ${colorB}55`,
                      }}
                    >
                      {metaB.logo ? (
                        <img src={metaB.logo} alt={teamB} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                      ) : (
                        <Typography sx={{ fontWeight: 900, fontSize: '0.62rem', color: '#fff', letterSpacing: '0.04em' }}>{abbr(teamB)}</Typography>
                      )}
                    </Box>
                  </Box>
                  {playersB.length === 0 ? (
                    <Box sx={{ py: 3, textAlign: 'center', borderRadius: '12px', background: '#fff', border: '1px dashed rgba(0,0,0,0.1)' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.3)', fontWeight: 600 }}>Squad TBA</Typography>
                    </Box>
                  ) : (
                    playersB.map((p) => (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        selected={Number(selections[activeTab]) === Number(p.id)}
                        onSelect={() => selectPlayer(activeTab, p.id)}
                        color={colorB}
                        isCorrect={hasResults && (
                          (activeTab === 'batter' && Number(p.id) === correctBatterId) ||
                          (activeTab === 'bowler' && Number(p.id) === correctBowlerId) ||
                          (activeTab === 'mom' && Number(p.id) === correctMomId)
                        ) || false}
                      />
                    ))
                  )}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Container>

      {/* ── Sticky Save footer ────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          px: 2,
          py: 1.5,
        }}
      >
        <Container maxWidth="md" disableGutters>
          {/* ── Mini selection summary ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75, mb: 1.25 }}>
            {TABS.map(({ key, label }) => {
              const val = selections[key];
              const done = val !== null;
              const isActive = activeTab === key;
              const displayVal = done
                ? (key === 'winner' ? String(val) : playerName(val))
                : null;
              const color = done
                ? (key === 'winner'
                  ? (val === teamA ? colorA : colorB)
                  : (players.find((p) => Number(p.id) === Number(val))?.team === teamA ? colorA : colorB))
                : null;
              return (
                <Box
                  key={key}
                  onClick={() => setActiveTab(key)}
                  sx={{
                    borderRadius: '10px',
                    px: 0.75,
                    py: 0.6,
                    background: isActive ? '#000' : done ? `${color}12` : 'rgba(0,0,0,0.04)',
                    border: isActive ? '1.5px solid #000' : done ? `1.5px solid ${color}40` : '1.5px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    minWidth: 0,
                    overflow: 'hidden',
                  }}
                >
                  <Typography sx={{
                    fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: isActive ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.35)',
                    lineHeight: 1.2, mb: 0.2,
                  }}>
                    {label}
                  </Typography>
                  <Typography sx={{
                    fontSize: '0.65rem', fontWeight: 800,
                    color: isActive ? '#fff' : done ? '#000' : 'rgba(0,0,0,0.2)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}>
                    {done ? (displayVal ?? '') : '—'}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Save button */}
          {matchLocked ? (
            // Match started — predictions locked
            <Box
              sx={{
                borderRadius: '16px',
                background: 'rgba(0,0,0,0.06)',
                border: '1.5px solid rgba(0,0,0,0.1)',
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: 'rgba(0,0,0,0.35)' }}>
                🔒 Predictions Closed · Match Started
              </Typography>
            </Box>
          ) : saved && !isEditing ? (
            // Prediction saved — show saved state + Edit button
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Box
                sx={{
                  flex: 1,
                  borderRadius: '16px',
                  border: '2px solid rgba(0,0,0,0.1)',
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  '&:hover': { background: '#f5f5f7' },
                }}
                onClick={() => setIsEditing(true)}
              >
                <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#000' }}>✏️ Edit</Typography>
              </Box>
              <Box
                sx={{
                  flex: 2,
                  borderRadius: '16px',
                  background: '#1b4332',
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.75,
                }}
              >
                <EmojiEventsIcon sx={{ fontSize: '1rem', color: '#fff' }} />
                <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff' }}>✓ Prediction Saved</Typography>
              </Box>
            </Box>
          ) : (
            // Normal / edit mode — Review & Save
            <Box
              onClick={allSelected ? () => setShowPreview(true) : undefined}
              sx={{
                borderRadius: '16px',
                background: allSelected ? '#000' : 'rgba(0,0,0,0.1)',
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                cursor: allSelected ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s ease, transform 0.15s ease',
                '&:hover': allSelected ? { background: '#222', transform: 'translateY(-1px)' } : {},
              }}
            >
              <EmojiEventsIcon sx={{ fontSize: '1rem', color: allSelected ? '#fff' : 'rgba(0,0,0,0.3)' }} />
              <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.04em', color: allSelected ? '#fff' : 'rgba(0,0,0,0.3)' }}>
                {isEditing
                  ? allSelected ? 'Review & Update' : `${Object.values(selections).filter((v) => v !== null).length} / 4 Selected`
                  : allSelected ? 'Review & Save' : `${Object.values(selections).filter((v) => v !== null).length} / 4 Selected`}
              </Typography>
            </Box>
          )}
        </Container>
      </Box>

      {/* ── Preview Modal ─────────────────────────────────── */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 0,
            overflow: 'hidden',
          },
        }}
      >
        {/* Modal header */}
        <Box sx={{ background: '#000', px: 2.5, pt: 2.5, pb: 2 }}>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: '0.95rem', sm: '1.1rem' }, color: '#fff', mb: 0.4 }}>
            {isEditing ? 'Update Prediction' : 'Confirm Prediction'}
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.65rem', sm: '0.72rem' }, color: 'rgba(255,255,255,0.45)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Match {match?.match_number} · {match?.team_a} vs {match?.team_b}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', mt: 0.3 }}>
            {match?.match_date} · {match?.match_time}
          </Typography>
        </Box>

        <DialogContent sx={{ p: 0 }}>
          {/* Prediction rows */}
          {[
            { label: 'Match Winner', value: String(selections.winner ?? ''), isTeam: true },
            { label: 'Top Batter', value: playerName(selections.batter), isTeam: false },
            { label: 'Top Bowler', value: playerName(selections.bowler), isTeam: false },
            { label: 'Man of the Match', value: playerName(selections.mom), isTeam: false },
          ].map((row, i) => (
            <Box key={i}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 1.4 }}>
                <Typography sx={{ fontSize: { xs: '0.6rem', sm: '0.68rem' }, fontWeight: 700, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, mr: 1 }}>
                  {row.label}
                </Typography>
                <Typography sx={{ fontSize: { xs: '0.78rem', sm: '0.88rem' }, fontWeight: 800, color: '#000', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>
                  {row.value}
                </Typography>
              </Box>
              {i < 3 && <Divider sx={{ mx: 2.5 }} />}
            </Box>
          ))}

          {/* User info */}
          <Box sx={{ mx: 2.5, mb: 2, mt: 1, px: 2, py: 1.25, background: '#f5f5f7', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.3 }}>
              Submitting as
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.72rem', sm: '0.8rem' }, fontWeight: 700, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName || session?.user.email}
            </Typography>
          </Box>

          {/* ── Double Trouble toggle ── */}
          <Box sx={{ mx: 2.5, mb: 2.5 }}>
            <Box
              onClick={() => {
                if (!canUseDT && !useDoubleTrouble) return; // can't toggle on if no DT left
                setUseDoubleTrouble((prev) => !prev);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.5,
                borderRadius: '14px',
                border: useDoubleTrouble ? '2px solid #b45309' : '2px solid rgba(0,0,0,0.1)',
                background: useDoubleTrouble ? '#fef3c720' : (!canUseDT ? 'rgba(0,0,0,0.03)' : '#fff'),
                cursor: (!canUseDT && !useDoubleTrouble) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: (!canUseDT && !useDoubleTrouble) ? 0.5 : 1,
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                  <Typography sx={{ fontSize: '1rem' }}>⚡</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: '0.78rem', sm: '0.85rem' }, color: useDoubleTrouble ? '#b45309' : '#000' }}>
                    Double Trouble
                  </Typography>
                  {useDoubleTrouble && (
                    <Chip
                      label="ON"
                      size="small"
                      sx={{ height: 18, fontSize: '0.58rem', fontWeight: 800, background: '#b45309', color: '#fff', px: 0.5 }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>
                  {!canUseDT && !useDoubleTrouble
                    ? `Stage ${stageInfo?.stage ?? ''} quota used (${stageInfo?.quota ?? 0}/${stageInfo?.quota ?? 0})`
                    : useDoubleTrouble
                    ? `${dtRemaining - 1} of ${stageInfo?.quota ?? 0} remaining in Stage ${stageInfo?.stage ?? ''}`
                    : `${dtRemaining} of ${stageInfo?.quota ?? 0} remaining in Stage ${stageInfo?.stage ?? ''}`
                  }
                </Typography>
              </Box>
              {/* Toggle pill */}
              <Box
                sx={{
                  width: 44,
                  height: 24,
                  borderRadius: '12px',
                  background: useDoubleTrouble ? '#b45309' : 'rgba(0,0,0,0.15)',
                  position: 'relative',
                  transition: 'background 0.2s ease',
                  flexShrink: 0,
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 3,
                    left: useDoubleTrouble ? 23 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, px: 2.5, pb: 2.5 }}>
            <Box
              onClick={() => setShowPreview(false)}
              sx={{
                flex: 1,
                py: 1.4,
                borderRadius: '14px',
                border: '2px solid rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                '&:hover': { background: '#f5f5f7' },
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#000' }}>Edit</Typography>
            </Box>
            <Box
              onClick={(saving || matchLocked) ? undefined : handleSave}
              sx={{
                flex: 2,
                py: 1.4,
                borderRadius: '14px',
                background: (saving || matchLocked) ? 'rgba(0,0,0,0.35)' : '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (saving || matchLocked) ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease',
                '&:hover': (saving || matchLocked) ? {} : { background: '#222' },
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: (saving || matchLocked) ? 'rgba(255,255,255,0.5)' : '#fff' }}>
                {saving ? 'Saving…' : matchLocked ? 'Predictions Closed' : 'Confirm & Save'}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* ── Toast notification ───────────────────────────── */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: { xs: 16, sm: 24 } }}
      >
        <Alert
          onClose={() => setToast({ open: false, message: '' })}
          severity="success"
          variant="filled"
          sx={{
            borderRadius: '14px',
            fontWeight: 700,
            fontSize: '0.82rem',
            background: '#1b4332',
            color: '#fff',
            '& .MuiAlert-icon': { color: '#fff' },
            '& .MuiAlert-action': { color: '#fff' },
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Prediction;
