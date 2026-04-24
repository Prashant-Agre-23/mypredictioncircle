import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  CircularProgress,
  TextField,
  Button,
  Autocomplete,
  Divider,
  Snackbar,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SportsCricketIcon from '@mui/icons-material/SportsCricket';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WaterIcon from '@mui/icons-material/Water';
import EditCalendarIcon from '@mui/icons-material/EditCalendar';
import Navbar from '../../components/Navbar/Navbar';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getTeamMeta } from '../../utils/teamMeta';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Match {
  id: number;
  match_number: number;
  match_date: string;
  match_time: string;
  team_a?: string;
  team_b?: string;
  venue?: string;
}

interface Player {
  id: number;
  name: string;
  team: string;
}

interface CorrectAnswer {
  id?: number;
  match_id: number;
  winner: string | null;
  batter_id: number | null;
  batter_name: string | null;
  bowler_id: number | null;
  bowler_name: string | null;
  mom_id: number | null;
  mom_name: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const teamAbbr = (name?: string) => {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 3);
};

// ─── Component ────────────────────────────────────────────────────────────────

const AdminPanel = () => {
  const navigate = useNavigate();
  const { session, isAdmin } = useAuth();
    const [displayName, setDisplayName] = useState<string | null>(null);

    useEffect(() => {
      let mounted = true;
      const fetchName = async () => {
        if (!session?.user?.id) return;
        const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', session.user.id).single();
        if (!mounted) return;
        if (prof?.display_name) setDisplayName(prof.display_name);
        else {
          const { data: lb } = await supabase.from('leaderboard').select('display_name').eq('user_id', session.user.id).single();
          if (!mounted) return;
          if (lb?.display_name) setDisplayName(lb.display_name);
        }
      };
      fetchName();
      return () => { mounted = false; };
    }, [session?.user?.id]);

  const [matches, setMatches] = useState<Match[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]); // all matches for time-edit picker
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingAnswer, setExistingAnswer] = useState<CorrectAnswer | null>(null);

  // Form state
  const [winner, setWinner] = useState<string | null>(null);
  const [batter, setBatter] = useState<Player | null>(null);
  const [bowler, setBowler] = useState<Player | null>(null);

  // ── Edit match time state ──
  const [timeMatch, setTimeMatch] = useState<Match | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [savingTime, setSavingTime] = useState(false);

  // ── Washout state ──
  const [washoutMatch, setWashoutMatch] = useState<Match | null>(null);
  const [washoutDialogOpen, setWashoutDialogOpen] = useState(false);
  const [savingWashout, setSavingWashout] = useState(false);
  const [mom, setMom] = useState<Player | null>(null);

  // ── Bonus results admin state ──
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [bonusTopScorer, setBonusTopScorer] = useState<string>('');
  const [bonusTopWicket, setBonusTopWicket] = useState<string>('');
  const [bonusPOT, setBonusPOT] = useState<string>('');
  const [bonusMostSixes, setBonusMostSixes] = useState<string>('');
  const [bonusMostFours, setBonusMostFours] = useState<string>('');
  const [bonusSemiFinalists, setBonusSemiFinalists] = useState<string[]>([]);
  const [bonusFinalists, setBonusFinalists] = useState<string[]>([]);
  const [bonusWinner, setBonusWinner] = useState<string>('');
  const [bonusLocked, setBonusLocked] = useState(false);
  const [savingBonus, setSavingBonus] = useState(false);
  const [calculatingBonus, setCalculatingBonus] = useState(false);
  const [bonusResultId, setBonusResultId] = useState<number | null>(null);

  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin]);

  // Fetch all matches; separate into ended (for result entry) and all (for time editing)
  useEffect(() => {
    const loadMatches = async () => {
      setLoading(true);
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('matches')
        .select('id, match_number, match_date, match_time, team_a, team_b, venue')
        .order('match_number', { ascending: true });
      const all = (data || []) as Match[];
      const ended = all.filter(
        (m) => new Date(`${m.match_date}T${m.match_time}`) <= new Date(now)
      );
      setAllMatches(all);
      setMatches(ended);

      // Load all players for bonus autocomplete
      const { data: playersData } = await supabase.from('players').select('id, name, team').order('name');
      setAllPlayers((playersData || []) as Player[]);

      // Load existing bonus results
      const { data: br } = await supabase.from('bonus_results').select('*').limit(1).maybeSingle();
      if (br) {
        setBonusResultId(br.id);
        setBonusTopScorer(br.top_scorer ?? '');
        setBonusTopWicket(br.top_wicket_taker ?? '');
        setBonusPOT(br.player_of_tournament ?? '');
        setBonusMostSixes(br.most_sixes ?? '');
        setBonusMostFours(br.most_fours ?? '');
        setBonusSemiFinalists(br.semi_finalists ?? []);
        setBonusFinalists(br.finalists ?? []);
        setBonusWinner(br.winner ?? '');
        setBonusLocked(br.predictions_locked ?? false);
      }

      setLoading(false);
    };
    loadMatches();
  }, []);

  // When match is selected, fetch players + existing answer
  useEffect(() => {
    if (!selectedMatch) {
      setPlayers([]);
      resetForm();
      return;
    }

    const loadMatchData = async () => {
      // Players
      if (selectedMatch.team_a && selectedMatch.team_b) {
        const { data: playersData } = await supabase
          .from('players')
          .select('id, name, team')
          .in('team', [selectedMatch.team_a, selectedMatch.team_b])
          .order('name');
        setPlayers((playersData || []) as Player[]);
      }

      // Existing correct answer
      const { data: answerData } = await supabase
        .from('correct_answers')
        .select('*')
        .eq('match_id', selectedMatch.id)
        .maybeSingle();

      if (answerData) {
        setExistingAnswer(answerData as CorrectAnswer);
        setWinner(answerData.winner || null);
      } else {
        setExistingAnswer(null);
        resetForm();
      }
    };

    loadMatchData();
  }, [selectedMatch]);

  // Sync batter/bowler/mom once players are loaded and existingAnswer is set
  useEffect(() => {
    if (!existingAnswer || players.length === 0) return;
    setBatter(players.find((p) => p.id === existingAnswer.batter_id) || null);
    setBowler(players.find((p) => p.id === existingAnswer.bowler_id) || null);
    setMom(players.find((p) => p.id === existingAnswer.mom_id) || null);
  }, [existingAnswer, players]);

  const resetForm = () => {
    setWinner(null);
    setBatter(null);
    setBowler(null);
    setMom(null);
  };

  const handleSave = async () => {
    if (!selectedMatch || !session) return;
    if (!winner || !batter || !bowler || !mom) {
      setToast({ open: true, message: 'Please fill all 4 fields before saving.', severity: 'error' });
      return;
    }
    setSaving(true);

    const payload = {
      match_id: selectedMatch.id,
      match_number: selectedMatch.match_number,
      winner,
      batter_id: batter.id,
      batter_name: batter.name,
      bowler_id: bowler.id,
      bowler_name: bowler.name,
      mom_id: mom.id,
      mom_name: mom.name,
      entered_by: session.user.email,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('correct_answers')
      .upsert([payload], { onConflict: 'match_id' });

    setSaving(false);

    if (error) {
      setToast({ open: true, message: `Error: ${error.message}`, severity: 'error' });
    } else {
      setToast({ open: true, message: 'Correct answers saved! Points will be calculated automatically.', severity: 'success' });
      setExistingAnswer({ ...payload } as CorrectAnswer);
    }
  };

  const handleSaveTime = async () => {
    if (!timeMatch || !editDate || !editTime) return;
    setSavingTime(true);

    // Build match_start_utc: treat editDate + editTime as IST (UTC+5:30).
    // Parse as UTC first by appending 'Z', then add 5h30m to shift IST → UTC.
    // This avoids any browser local-timezone interference.
    const [yyyy, mm, dd] = editDate.split('-').map(Number);
    const [hh, min] = editTime.split(':').map(Number);
    // Treat as UTC wall clock, then subtract 5h30m to get actual UTC
    const utcMs = Date.UTC(yyyy, mm - 1, dd, hh, min, 0) - (5 * 60 + 30) * 60 * 1000;
    const matchStartUtc = new Date(utcMs).toISOString();

    const { error } = await supabase
      .from('matches')
      .update({
        match_date: editDate,
        match_time: editTime,
        match_start_utc: matchStartUtc,
      })
      .eq('id', timeMatch.id);
    setSavingTime(false);
    if (error) {
      setToast({ open: true, message: `Error: ${error.message}`, severity: 'error' });
    } else {
      setAllMatches((prev) =>
        prev.map((m) => m.id === timeMatch.id ? { ...m, match_date: editDate, match_time: editTime } : m)
      );
      setMatches((prev) =>
        prev.map((m) => m.id === timeMatch.id ? { ...m, match_date: editDate, match_time: editTime } : m)
      );
      setTimeMatch((prev) => prev ? { ...prev, match_date: editDate, match_time: editTime } : prev);
      setToast({ open: true, message: `Match ${timeMatch.match_number} time updated! UTC: ${matchStartUtc.replace('T', ' ').slice(0, 19)}`, severity: 'success' });
    }
  };

  const handleWashout = async () => {
    if (!washoutMatch || !session) return;
    setSavingWashout(true);
    const payload = {
      match_id: washoutMatch.id,
      match_number: washoutMatch.match_number,
      winner: null,
      batter_id: null,
      batter_name: null,
      bowler_id: null,
      bowler_name: null,
      mom_id: null,
      mom_name: null,
      is_washout: true,
      entered_by: session.user.email,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('correct_answers')
      .upsert([payload], { onConflict: 'match_id' });
    setSavingWashout(false);
    setWashoutDialogOpen(false);
    if (error) {
      setToast({ open: true, message: `Error: ${error.message}`, severity: 'error' });
    } else {
      setToast({ open: true, message: `Match ${washoutMatch.match_number} marked as washout — all users get 0 pts.`, severity: 'success' });
      setWashoutMatch(null);
    }
  };

  const handleSaveBonusResults = async () => {
    setSavingBonus(true);
    const payload = {
      top_scorer: bonusTopScorer || null,
      top_wicket_taker: bonusTopWicket || null,
      player_of_tournament: bonusPOT || null,
      most_sixes: bonusMostSixes || null,
      most_fours: bonusMostFours || null,
      semi_finalists: bonusSemiFinalists,
      finalists: bonusFinalists,
      winner: bonusWinner || null,
      predictions_locked: bonusLocked,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (bonusResultId) {
      ({ error } = await supabase.from('bonus_results').update(payload).eq('id', bonusResultId));
    } else {
      const { data, error: insertError } = await supabase.from('bonus_results').insert([payload]).select('id').single();
      error = insertError;
      if (data) setBonusResultId((data as { id: number }).id);
    }
    setSavingBonus(false);
    if (error) {
      setToast({ open: true, message: `Error: ${error.message}`, severity: 'error' });
    } else {
      setToast({ open: true, message: 'Bonus results saved!', severity: 'success' });
    }
  };

  const handleCalculateBonusPoints = async () => {
    setCalculatingBonus(true);
    // Fetch all bonus predictions
    const { data: preds, error: predErr } = await supabase.from('bonus_predictions').select('*');
    if (predErr || !preds) {
      setToast({ open: true, message: `Error fetching predictions: ${predErr?.message}`, severity: 'error' });
      setCalculatingBonus(false);
      return;
    }
    // For each user, calculate points
    let updated = 0;
    for (const pred of preds) {
      let pts = 0;
      if (bonusTopScorer && pred.top_scorer === bonusTopScorer) pts += 100;
      if (bonusTopWicket && pred.top_wicket_taker === bonusTopWicket) pts += 100;
      if (bonusPOT && pred.player_of_tournament === bonusPOT) pts += 150;
      if (bonusMostSixes && pred.most_sixes === bonusMostSixes) pts += 50;
      if (bonusMostFours && pred.most_fours === bonusMostFours) pts += 50;
      // Semi-finalists
      const correctSemis = (pred.semi_finalists || []).filter((t: string) => bonusSemiFinalists.includes(t));
      pts += correctSemis.length * 100;
      // Finalists
      const correctFinals = (pred.finalists || []).filter((t: string) => bonusFinalists.includes(t));
      pts += correctFinals.length * 150;
      // Winner
      if (bonusWinner && pred.winner === bonusWinner) pts += 200;

      // Upsert into user_bonus_points table
      await supabase.from('user_bonus_points').upsert(
        { user_id: pred.user_id, bonus_points: pts, updated_at: new Date().toISOString() },
        { onConflict: 'user_id', ignoreDuplicates: false }
      );
      updated++;
    }
    setCalculatingBonus(false);
    setToast({ open: true, message: `Bonus points calculated for ${updated} users!`, severity: 'success' });
  };

  if (!isAdmin) return null;

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f5f5f7' }}>
        <Navbar />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 64px)' }}>
          <CircularProgress sx={{ color: '#000' }} />
        </Box>
      </Box>
    );
  }

  const metaA = getTeamMeta(selectedMatch?.team_a);
  const metaB = getTeamMeta(selectedMatch?.team_b);
  const colorA = metaA.color;
  const colorB = metaB.color;

  const stagePoints = (mn: number) => {
    if (mn <= 35) return { winner: 50, player: 60 };
    if (mn <= 70) return { winner: 70, player: 80 };
    return { winner: 90, player: 100 };
  };
  const { winner: winnerPts, player: playerPts } = selectedMatch
    ? stagePoints(selectedMatch.match_number)
    : { winner: 50, player: 60 };

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f5f7', pb: 6 }}>
      <Navbar />

      {/* ── Header ── */}
      <Box sx={{ background: '#000', pt: 2.5, pb: 3, px: 2, position: 'relative', overflow: 'hidden',
        '&::after': { content: '""', position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)', pointerEvents: 'none' },
      }}>
        <Container maxWidth="sm" disableGutters sx={{ px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AdminPanelSettingsIcon sx={{ fontSize: '1.1rem', color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: '#fff', lineHeight: 1.15 }}>Admin Panel</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Enter results · Edit timings · Mark washouts</Typography>
            </Box>
          </Box>
          <Chip
            label={displayName || session?.user?.email}
            size="small"
            sx={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', fontWeight: 700, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)' }}
          />
        </Container>
      </Box>

      <Container maxWidth="sm" sx={{ py: 3, px: { xs: 2, sm: 3 } }}>

        {/* ── Match selector ── */}
        <Box sx={{ background: '#fff', borderRadius: '18px', p: 2.5, mb: 2.5, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.7rem', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.5 }}>
            Select Match
          </Typography>
          <Autocomplete
            options={matches}
            getOptionLabel={(m) =>
              `M${m.match_number} · ${teamAbbr(m.team_a)} vs ${teamAbbr(m.team_b)}`
            }
            value={selectedMatch}
            onChange={(_, val) => setSelectedMatch(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search matches…"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.25)' },
                    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 1.5 },
                  },
                }}
              />
            )}
            renderOption={(props, m) => {
              const mA = getTeamMeta(m.team_a);
              const mB = getTeamMeta(m.team_b);
              return (
                <Box component="li" {...props} sx={{ py: 1.25, px: 1.75, display: 'flex', alignItems: 'center', gap: 1.25, '&:not(:last-child)': { borderBottom: '1px solid rgba(0,0,0,0.05)' } }}>
                  {/* Team A badge */}
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', background: mA.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '4px' }}>
                    {mA.logo
                      ? <img src={mA.logo} alt={m.team_a} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                      : <Typography sx={{ fontSize: '0.58rem', fontWeight: 900, color: '#fff' }}>{teamAbbr(m.team_a)}</Typography>}
                  </Box>
                  {/* Label */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#000', lineHeight: 1.2 }}>
                      {teamAbbr(m.team_a)} vs {teamAbbr(m.team_b)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.38)', fontWeight: 600 }}>
                      Match {m.match_number}{m.venue ? ` · ${m.venue}` : ''}
                    </Typography>
                  </Box>
                  {/* Team B badge */}
                  <Box sx={{ width: 32, height: 32, borderRadius: '8px', background: mB.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '4px' }}>
                    {mB.logo
                      ? <img src={mB.logo} alt={m.team_b} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                      : <Typography sx={{ fontSize: '0.58rem', fontWeight: 900, color: '#fff' }}>{teamAbbr(m.team_b)}</Typography>}
                  </Box>
                </Box>
              );
            }}
          />

          {/* Existing answer badge */}
          {existingAnswer && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5, px: 1.25, py: 0.75, background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <CheckCircleIcon sx={{ fontSize: '0.9rem', color: '#16a34a' }} />
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803d' }}>
                Correct answers already saved — you can update them below
              </Typography>
            </Box>
          )}
        </Box>

        {/* ── Result entry form ── */}
        {selectedMatch && (
          <Box sx={{ background: '#fff', borderRadius: '18px', p: 2.5, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <SportsCricketIcon sx={{ fontSize: '1rem', color: 'rgba(0,0,0,0.4)' }} />
              <Typography sx={{ fontWeight: 800, fontSize: '0.7rem', color: 'rgba(0,0,0,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Match {selectedMatch.match_number} Results
              </Typography>
            </Box>

            {/* ── Winner ── */}
            <SectionLabel label="Match Winner" points={winnerPts} />
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
              {[
                { team: selectedMatch.team_a, color: colorA, logo: metaA.logo },
                { team: selectedMatch.team_b, color: colorB, logo: metaB.logo },
              ].map(({ team, color, logo }) => {
                if (!team) return null;
                const selected = winner === team;
                return (
                  <Box
                    key={team}
                    onClick={() => setWinner(selected ? null : team)}
                    sx={{
                      flex: 1,
                      py: 1.75,
                      px: 1,
                      borderRadius: '16px',
                      border: selected ? `2px solid ${color}` : '2px solid rgba(0,0,0,0.07)',
                      background: selected ? `${color}14` : '#fafafa',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.75,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      '&:hover': { background: selected ? `${color}1e` : '#f3f3f3', borderColor: selected ? color : 'rgba(0,0,0,0.14)' },
                    }}
                  >
                    {/* Logo badge */}
                    <Box sx={{ width: 48, height: 48, borderRadius: '13px', background: selected ? color : 'rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: '6px', transition: 'all 0.18s ease', boxShadow: selected ? `0 4px 14px ${color}44` : 'none' }}>
                      {logo
                        ? <img src={logo} alt={team} style={{ width: 36, height: 36, objectFit: 'contain', opacity: selected ? 1 : 0.5 }} />
                        : <Typography sx={{ fontWeight: 900, fontSize: '0.9rem', color: selected ? '#fff' : 'rgba(0,0,0,0.3)' }}>{teamAbbr(team)}</Typography>}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: selected ? color : 'rgba(0,0,0,0.55)', textAlign: 'center', lineHeight: 1.2 }}>{team}</Typography>
                    {selected && <CheckCircleIcon sx={{ fontSize: '0.85rem', color }} />}
                  </Box>
                );
              })}
            </Box>

            <Divider sx={{ mb: 2.5, borderColor: 'rgba(0,0,0,0.06)' }} />

            {/* ── Batter ── */}
            <SectionLabel label="Top Batter" points={playerPts} />
            <PlayerAutoComplete players={players} value={batter} onChange={setBatter} placeholder="Select top batter…" />

            <Divider sx={{ my: 2.5, borderColor: 'rgba(0,0,0,0.06)' }} />

            {/* ── Bowler ── */}
            <SectionLabel label="Top Bowler" points={playerPts} />
            <PlayerAutoComplete players={players} value={bowler} onChange={setBowler} placeholder="Select top bowler…" />

            <Divider sx={{ my: 2.5, borderColor: 'rgba(0,0,0,0.06)' }} />

            {/* ── MOM ── */}
            <SectionLabel label="Man of the Match" points={playerPts} />
            <PlayerAutoComplete players={players} value={mom} onChange={setMom} placeholder="Select MOM…" />

            {/* ── Save button ── */}
            <Box sx={{ mt: 3 }}>
              <Button
                fullWidth
                variant="contained"
                disabled={saving || !winner || !batter || !bowler || !mom}
                onClick={handleSave}
                startIcon={<EmojiEventsIcon />}
                sx={{
                  py: 1.4,
                  borderRadius: '14px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  letterSpacing: '0.03em',
                  background: '#000',
                  color: '#fff',
                  boxShadow: 'none',
                  textTransform: 'none',
                  '&:hover': { background: '#222', boxShadow: 'none' },
                  '&.Mui-disabled': { background: 'rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.3)' },
                }}
              >
                {saving ? 'Saving…' : existingAnswer ? 'Update Correct Answers' : 'Save Correct Answers'}
              </Button>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(0,0,0,0.35)', fontWeight: 600, textAlign: 'center', mt: 1 }}>
                Points will automatically be calculated for all users on this match.
              </Typography>
            </Box>
          </Box>
        )}

        {/* ════════════════════════════════════════════════════
            ── Edit Match Time ──
        ════════════════════════════════════════════════════ */}
        <Box sx={{ background: '#fff', borderRadius: '18px', p: 2.5, mt: 2.5, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ width: 30, height: 30, borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AccessTimeIcon sx={{ fontSize: '1rem', color: '#2563eb' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#000', lineHeight: 1.2 }}>Edit Match Timing</Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Update date / time for delayed matches</Typography>
            </Box>
          </Box>

          {/* Match picker — all matches */}
          <Autocomplete
            options={allMatches}
            getOptionLabel={(m) => `M${m.match_number} · ${teamAbbr(m.team_a)} vs ${teamAbbr(m.team_b)}`}
            value={timeMatch}
            onChange={(_, val) => {
              setTimeMatch(val);
              setEditDate(val?.match_date ?? '');
              setEditTime(val?.match_time ?? '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select a match…"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                    '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.25)' },
                    '&.Mui-focused fieldset': { borderColor: '#2563eb', borderWidth: 1.5 },
                  },
                }}
              />
            )}
            renderOption={(props, m) => {
              const mA = getTeamMeta(m.team_a);
              const mB = getTeamMeta(m.team_b);
              return (
                <Box component="li" {...props} sx={{ py: 1.25, px: 1.75, display: 'flex', alignItems: 'center', gap: 1.25, '&:not(:last-child)': { borderBottom: '1px solid rgba(0,0,0,0.05)' } }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '7px', background: mA.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '3px' }}>
                    {mA.logo ? <img src={mA.logo} alt={m.team_a} style={{ width: 22, height: 22, objectFit: 'contain' }} /> : <Typography sx={{ fontSize: '0.52rem', fontWeight: 900, color: '#fff' }}>{teamAbbr(m.team_a)}</Typography>}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#000', lineHeight: 1.2 }}>{teamAbbr(m.team_a)} vs {teamAbbr(m.team_b)}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.38)', fontWeight: 600 }}>
                      Match {m.match_number} · {m.match_date} {m.match_time}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 28, height: 28, borderRadius: '7px', background: mB.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '3px' }}>
                    {mB.logo ? <img src={mB.logo} alt={m.team_b} style={{ width: 22, height: 22, objectFit: 'contain' }} /> : <Typography sx={{ fontSize: '0.52rem', fontWeight: 900, color: '#fff' }}>{teamAbbr(m.team_b)}</Typography>}
                  </Box>
                </Box>
              );
            }}
          />

          {timeMatch && (
            <Box sx={{ mt: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(0,0,0,0.5)', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</Typography>
                <TextField
                  type="date"
                  size="small"
                  fullWidth
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                      '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
                      '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.25)' },
                      '&.Mui-focused fieldset': { borderColor: '#2563eb', borderWidth: 1.5 },
                    },
                  }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(0,0,0,0.5)', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Time</Typography>
                <TextField
                  type="time"
                  size="small"
                  fullWidth
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                      '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
                      '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.25)' },
                      '&.Mui-focused fieldset': { borderColor: '#2563eb', borderWidth: 1.5 },
                    },
                  }}
                />
              </Box>
            </Box>
          )}

          {timeMatch && (
            <Button
              fullWidth
              variant="contained"
              disabled={savingTime || !editDate || !editTime}
              onClick={handleSaveTime}
              startIcon={<EditCalendarIcon />}
              sx={{
                mt: 2, py: 1.3, borderRadius: '14px', fontWeight: 800, fontSize: '0.85rem',
                background: '#2563eb', color: '#fff', boxShadow: 'none', textTransform: 'none',
                '&:hover': { background: '#1d4ed8', boxShadow: 'none' },
                '&.Mui-disabled': { background: 'rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.3)' },
              }}
            >
              {savingTime ? 'Saving…' : 'Update Match Timing'}
            </Button>
          )}
        </Box>

        {/* ════════════════════════════════════════════════════
            ── Mark Washout ──
        ════════════════════════════════════════════════════ */}
        <Box sx={{ background: '#fff', borderRadius: '18px', p: 2.5, mt: 2.5, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ width: 30, height: 30, borderRadius: '8px', background: '#eff8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WaterIcon sx={{ fontSize: '1rem', color: '#0891b2' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#000', lineHeight: 1.2 }}>Mark Match as Washout</Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Rain/cancelled — 0 pts for all, DT is used but no penalty</Typography>
            </Box>
          </Box>

          {/* Match picker — ended matches only (only graded matches make sense) */}
          <Autocomplete
            options={matches}
            getOptionLabel={(m) => `M${m.match_number} · ${teamAbbr(m.team_a)} vs ${teamAbbr(m.team_b)}`}
            value={washoutMatch}
            onChange={(_, val) => setWashoutMatch(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select a match…"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                    '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.25)' },
                    '&.Mui-focused fieldset': { borderColor: '#0891b2', borderWidth: 1.5 },
                  },
                }}
              />
            )}
            renderOption={(props, m) => {
              const mA = getTeamMeta(m.team_a);
              const mB = getTeamMeta(m.team_b);
              return (
                <Box component="li" {...props} sx={{ py: 1.25, px: 1.75, display: 'flex', alignItems: 'center', gap: 1.25, '&:not(:last-child)': { borderBottom: '1px solid rgba(0,0,0,0.05)' } }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '7px', background: mA.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '3px' }}>
                    {mA.logo ? <img src={mA.logo} alt={m.team_a} style={{ width: 22, height: 22, objectFit: 'contain' }} /> : <Typography sx={{ fontSize: '0.52rem', fontWeight: 900, color: '#fff' }}>{teamAbbr(m.team_a)}</Typography>}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#000', lineHeight: 1.2 }}>{teamAbbr(m.team_a)} vs {teamAbbr(m.team_b)}</Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.38)', fontWeight: 600 }}>Match {m.match_number}</Typography>
                  </Box>
                  <Box sx={{ width: 28, height: 28, borderRadius: '7px', background: mB.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '3px' }}>
                    {mB.logo ? <img src={mB.logo} alt={m.team_b} style={{ width: 22, height: 22, objectFit: 'contain' }} /> : <Typography sx={{ fontSize: '0.52rem', fontWeight: 900, color: '#fff' }}>{teamAbbr(m.team_b)}</Typography>}
                  </Box>
                </Box>
              );
            }}
          />

          {washoutMatch && (
            <Box sx={{ mt: 2, p: 1.5, borderRadius: '12px', background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1' }}>
                ⚠️ All users get <strong>0 points</strong> for Match {washoutMatch.match_number}. DT will be consumed but <strong>no negative penalty</strong> applied.
              </Typography>
            </Box>
          )}

          <Button
            fullWidth
            variant="contained"
            disabled={!washoutMatch}
            onClick={() => setWashoutDialogOpen(true)}
            startIcon={<WaterIcon />}
            sx={{
              mt: 2, py: 1.3, borderRadius: '14px', fontWeight: 800, fontSize: '0.85rem',
              background: '#0891b2', color: '#fff', boxShadow: 'none', textTransform: 'none',
              '&:hover': { background: '#0e7490', boxShadow: 'none' },
              '&.Mui-disabled': { background: 'rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.3)' },
            }}
          >
            Mark as Washout
          </Button>
        </Box>

        {/* ════════════════════════════════════════════════════
            ── Bonus Stage Admin ──
        ════════════════════════════════════════════════════ */}
        <Box sx={{ background: '#fff', borderRadius: '18px', p: 2.5, mt: 2.5, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ width: 30, height: 30, borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EmojiEventsIcon sx={{ fontSize: '1rem', color: '#d97706' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#000', lineHeight: 1.2 }}>Bonus Stage Results</Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>Enter correct answers · Lock predictions · Calculate bonus pts</Typography>
            </Box>
          </Box>

          {/* Lock toggle */}
          <Box
            onClick={() => setBonusLocked((v) => !v)}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 1.5, py: 1, borderRadius: '12px', mb: 2,
              background: bonusLocked ? 'rgba(220,38,38,0.07)' : 'rgba(0,0,0,0.04)',
              border: bonusLocked ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(0,0,0,0.08)',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: bonusLocked ? '#dc2626' : 'rgba(0,0,0,0.5)' }}>
              {bonusLocked ? '🔒 Predictions Locked' : '🔓 Predictions Open (users can edit)'}
            </Typography>
            <Box sx={{ width: 36, height: 20, borderRadius: '10px', background: bonusLocked ? '#dc2626' : 'rgba(0,0,0,0.15)', position: 'relative', transition: 'background 0.2s' }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: bonusLocked ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </Box>
          </Box>

          {/* Player fields */}
          {[
            { label: 'Top Run Scorer (100 pts)', value: bonusTopScorer, setter: setBonusTopScorer },
            { label: 'Top Wicket Taker (100 pts)', value: bonusTopWicket, setter: setBonusTopWicket },
            { label: 'Player of Tournament (150 pts)', value: bonusPOT, setter: setBonusPOT },
            { label: 'Most Sixes (50 pts)', value: bonusMostSixes, setter: setBonusMostSixes },
            { label: 'Most Fours (50 pts)', value: bonusMostFours, setter: setBonusMostFours },
          ].map(({ label, value, setter }) => (
            <Box key={label} sx={{ mb: 1.75 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(0,0,0,0.45)', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</Typography>
              <Autocomplete
                options={allPlayers}
                getOptionLabel={(p) => `${p.name} (${p.team})`}
                value={allPlayers.find((p) => p.name === value) ?? null}
                onChange={(_, val) => setter(val?.name ?? '')}
                groupBy={(p) => p.team}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Search player…" size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600, '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#d97706', borderWidth: 1.5 } } }} />
                )}
                renderOption={(props, p) => {
                  const meta = getTeamMeta(p.team);
                  return (
                    <Box component="li" {...props} sx={{ py: 0.8, px: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85 }}>
                        <Box sx={{ width: 20, height: 20, borderRadius: '5px', background: meta.color, p: '2px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {meta.logo && <img src={meta.logo} alt={p.team} style={{ width: 16, height: 16, objectFit: 'contain' }} />}
                        </Box>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>{p.name}</Typography>
                      </Box>
                    </Box>
                  );
                }}
              />
            </Box>
          ))}

          {/* Semi-finalists (4 teams) */}
          <Box sx={{ mb: 1.75 }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(0,0,0,0.45)', mb: 0.85, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Semi-Finalists — {bonusSemiFinalists.length}/4</Typography>
            <Autocomplete
              multiple
              options={['Chennai Super Kings','Mumbai Indians','Royal Challengers Bengaluru','Kolkata Knight Riders','Sunrisers Hyderabad','Rajasthan Royals','Delhi Capitals','Punjab Kings','Gujarat Titans','Lucknow Super Giants']}
              value={bonusSemiFinalists}
              onChange={(_, val) => setBonusSemiFinalists(val.slice(0, 4))}
              renderInput={(params) => <TextField {...params} placeholder="Select 4 teams…" size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600, '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#d97706', borderWidth: 1.5 } } }} />}
              renderTags={(val, getTagProps) => val.map((team, idx) => { const meta = getTeamMeta(team); const tagProps = getTagProps({ index: idx }); return <Chip {...tagProps} label={team.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0,3)} size="small" sx={{ background: meta.color, color: '#fff', fontWeight: 800, fontSize: '0.65rem', borderRadius: '6px' }} />; })}
              renderOption={(props, team) => {
                const meta = getTeamMeta(team);
                const { key, ...restProps } = props as { key?: React.Key } & React.HTMLAttributes<HTMLLIElement>;
                return (
                  <Box component="li" key={key} {...restProps} sx={{ py: 0.85, px: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 22, height: 22, borderRadius: '5px', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '2px' }}>
                        {meta.logo ? <img src={meta.logo} alt={team} style={{ width: 18, height: 18, objectFit: 'contain' }} /> : <Typography sx={{ fontSize: '0.45rem', fontWeight: 900, color: '#fff' }}>{team.slice(0,3).toUpperCase()}</Typography>}
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{team}</Typography>
                    </Box>
                  </Box>
                );
              }}
            />
          </Box>

          {/* Finalists (2 teams — any team, not limited to semis) */}
          <Box sx={{ mb: 1.75 }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(0,0,0,0.45)', mb: 0.85, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Finalists — {bonusFinalists.length}/2</Typography>
            <Autocomplete
              multiple
              options={['Chennai Super Kings','Mumbai Indians','Royal Challengers Bengaluru','Kolkata Knight Riders','Sunrisers Hyderabad','Rajasthan Royals','Delhi Capitals','Punjab Kings','Gujarat Titans','Lucknow Super Giants']}
              value={bonusFinalists}
              onChange={(_, val) => setBonusFinalists(val.slice(0, 2))}
              renderInput={(params) => <TextField {...params} placeholder="Select 2 finalists…" size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600, '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#d97706', borderWidth: 1.5 } } }} />}
              renderTags={(val, getTagProps) => val.map((team, idx) => { const meta = getTeamMeta(team); const tagProps = getTagProps({ index: idx }); return <Chip {...tagProps} label={team.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0,3)} size="small" sx={{ background: meta.color, color: '#fff', fontWeight: 800, fontSize: '0.65rem', borderRadius: '6px' }} />; })}
              renderOption={(props, team) => {
                const meta = getTeamMeta(team);
                const { key, ...restProps } = props as { key?: React.Key } & React.HTMLAttributes<HTMLLIElement>;
                return (
                  <Box component="li" key={key} {...restProps} sx={{ py: 0.85, px: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 22, height: 22, borderRadius: '5px', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '2px' }}>
                        {meta.logo ? <img src={meta.logo} alt={team} style={{ width: 18, height: 18, objectFit: 'contain' }} /> : <Typography sx={{ fontSize: '0.45rem', fontWeight: 900, color: '#fff' }}>{team.slice(0,3).toUpperCase()}</Typography>}
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{team}</Typography>
                    </Box>
                  </Box>
                );
              }}
            />
          </Box>

          {/* Winner — any team */}
          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(0,0,0,0.45)', mb: 0.85, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tournament Winner</Typography>
            <Autocomplete
              options={['Chennai Super Kings','Mumbai Indians','Royal Challengers Bengaluru','Kolkata Knight Riders','Sunrisers Hyderabad','Rajasthan Royals','Delhi Capitals','Punjab Kings','Gujarat Titans','Lucknow Super Giants']}
              value={bonusWinner || null}
              onChange={(_, val) => setBonusWinner(val ?? '')}
              renderInput={(params) => <TextField {...params} placeholder="Select winner…" size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600, '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' }, '&.Mui-focused fieldset': { borderColor: '#d97706', borderWidth: 1.5 } } }} />}
              renderOption={(props, team) => {
                const meta = getTeamMeta(team);
                const { key, ...restProps } = props as { key?: React.Key } & React.HTMLAttributes<HTMLLIElement>;
                return (
                  <Box component="li" key={key} {...restProps} sx={{ py: 0.85, px: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 22, height: 22, borderRadius: '5px', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '2px' }}>
                        {meta.logo ? <img src={meta.logo} alt={team} style={{ width: 18, height: 18, objectFit: 'contain' }} /> : <Typography sx={{ fontSize: '0.45rem', fontWeight: 900, color: '#fff' }}>{team.slice(0,3).toUpperCase()}</Typography>}
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{team}</Typography>
                    </Box>
                  </Box>
                );
              }}
            />
          </Box>

          {/* Save + Calculate buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button
              fullWidth
              variant="contained"
              disabled={savingBonus}
              onClick={handleSaveBonusResults}
              sx={{ py: 1.3, borderRadius: '14px', fontWeight: 800, fontSize: '0.82rem', background: '#d97706', color: '#fff', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#b45309', boxShadow: 'none' }, '&.Mui-disabled': { background: 'rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.3)' } }}
            >
              {savingBonus ? 'Saving…' : 'Save Bonus Results'}
            </Button>
            <Button
              fullWidth
              variant="contained"
              disabled={calculatingBonus}
              onClick={handleCalculateBonusPoints}
              sx={{ py: 1.3, borderRadius: '14px', fontWeight: 800, fontSize: '0.82rem', background: '#000', color: '#fff', boxShadow: 'none', textTransform: 'none', '&:hover': { background: '#222', boxShadow: 'none' }, '&.Mui-disabled': { background: 'rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.3)' } }}
            >
              {calculatingBonus ? 'Calculating…' : '⚡ Calculate Bonus Points'}
            </Button>
          </Box>
        </Box>
      </Container>

      {/* ── Washout confirmation dialog ── */}
      <Dialog
        open={washoutDialogOpen}
        onClose={() => setWashoutDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1rem', pb: 0.5 }}>
          Confirm Washout
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.6)' }}>
            Mark <strong>Match {washoutMatch?.match_number} ({teamAbbr(washoutMatch?.team_a)} vs {teamAbbr(washoutMatch?.team_b)})</strong> as a washout?
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.5)', mt: 1 }}>
            All users will receive <strong>0 points</strong>. Double Trouble will be counted as used but no negative points will be deducted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setWashoutDialogOpen(false)}
            sx={{ borderRadius: '10px', fontWeight: 700, textTransform: 'none', color: 'rgba(0,0,0,0.5)' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingWashout}
            onClick={handleWashout}
            sx={{ borderRadius: '10px', fontWeight: 800, textTransform: 'none', background: '#0891b2', '&:hover': { background: '#0e7490' }, boxShadow: 'none' }}
          >
            {savingWashout ? 'Saving…' : 'Yes, Mark Washout'}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          sx={{ borderRadius: '14px', fontWeight: 700, fontSize: '0.82rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const SectionLabel = ({ label, points }: { label: string; points: number }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
    <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: '#000' }}>{label}</Typography>
    <Chip
      label={`+${points} pts`}
      size="small"
      sx={{ height: 20, fontSize: '0.62rem', fontWeight: 800, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
    />
  </Box>
);

const PlayerAutoComplete = ({
  players, value, onChange, placeholder,
}: {
  players: Player[];
  value: Player | null;
  onChange: (p: Player | null) => void;
  placeholder: string;
}) => (
  <Autocomplete
    options={players}
    getOptionLabel={(p) => `${p.name} (${p.team})`}
    value={value}
    onChange={(_, val) => onChange(val)}
    renderInput={(params) => (
      <TextField
        {...params}
        placeholder={placeholder}
        size="small"
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 600,
            '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
            '&:hover fieldset': { borderColor: 'rgba(0,0,0,0.25)' },
            '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 1.5 },
          },
        }}
      />
    )}
    renderOption={(props, p) => {
      const meta = getTeamMeta(p.team);
      return (
        <Box component="li" {...props} sx={{ py: 1, px: 1.75, '&:not(:last-child)': { borderBottom: '1px solid rgba(0,0,0,0.04)' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 26, height: 26, borderRadius: '6px', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '3px' }}>
              {meta.logo
                ? <img src={meta.logo} alt={p.team} style={{ width: 20, height: 20, objectFit: 'contain' }} />
                : <Typography sx={{ fontSize: '0.48rem', fontWeight: 900, color: '#fff' }}>{p.team.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 3)}</Typography>}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#000' }}>{p.name}</Typography>
          </Box>
        </Box>
      );
    }}
    groupBy={(p) => p.team}
    renderGroup={(params) => {
      const meta = getTeamMeta(params.group);
      return (
        <Box key={params.key}>
          <Box sx={{ px: 1.75, py: 0.9, background: '#f8f8f8', position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', gap: 0.75, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <Box sx={{ width: 20, height: 20, borderRadius: '5px', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '2px', flexShrink: 0 }}>
              {meta.logo && <img src={meta.logo} alt={params.group} style={{ width: 16, height: 16, objectFit: 'contain' }} />}
            </Box>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(0,0,0,0.55)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {params.group}
            </Typography>
          </Box>
          {params.children}
        </Box>
      );
    }}
  />
);

export default AdminPanel;
