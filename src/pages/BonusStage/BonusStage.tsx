import { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Autocomplete,
  TextField,
  Button,
  Divider,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import SportsCricketIcon from '@mui/icons-material/SportsCricket';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Navbar from '../../components/Navbar/Navbar';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getTeamMeta } from '../../utils/teamMeta';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_TEAMS = [
  'Chennai Super Kings',
  'Mumbai Indians',
  'Royal Challengers Bengaluru',
  'Kolkata Knight Riders',
  'Sunrisers Hyderabad',
  'Rajasthan Royals',
  'Delhi Capitals',
  'Punjab Kings',
  'Gujarat Titans',
  'Lucknow Super Giants',
];

// 26 April 2026 11:00 AM IST = 05:30 UTC
const DEADLINE = new Date('2026-04-27T05:30:00Z');

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: number;
  name: string;
  team: string;
}

interface BonusPrediction {
  top_scorer: string | null;
  top_wicket_taker: string | null;
  player_of_tournament: string | null;
  most_sixes: string | null;
  most_fours: string | null;
  semi_finalists: string[];
  finalists: string[];
  winner: string | null;
}

interface UserBonusPrediction extends BonusPrediction {
  user_id: string;
  user_email?: string;
  display_name?: string;
}

interface BonusResult {
  predictions_locked: boolean;
  top_scorer: string | null;
  top_wicket_taker: string | null;
  player_of_tournament: string | null;
  most_sixes: string | null;
  most_fours: string | null;
  semi_finalists: string[];
  finalists: string[];
  winner: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calculateBonusPoints = (pred: UserBonusPrediction, results: BonusResult | null): number => {
  if (!results) return 0;
  
  let points = 0;
  
  // Player predictions - 100 pts each for top scorer and top wicket taker
  if (results.top_scorer && pred.top_scorer === results.top_scorer) points += 100;
  if (results.top_wicket_taker && pred.top_wicket_taker === results.top_wicket_taker) points += 100;
  
  // Player of tournament - 150 pts
  if (results.player_of_tournament && pred.player_of_tournament === results.player_of_tournament) points += 150;
  
  // Most sixes and most fours - 50 pts each
  if (results.most_sixes && pred.most_sixes === results.most_sixes) points += 50;
  if (results.most_fours && pred.most_fours === results.most_fours) points += 50;
  
  // Qualifying teams - 100 pts per correct team (max 400)
  if (results.semi_finalists && pred.semi_finalists) {
    const correctQualifiers = pred.semi_finalists.filter(t => results.semi_finalists.includes(t)).length;
    points += correctQualifiers * 100;
  }
  
  // Finalists - 150 pts per correct team (max 300)
  if (results.finalists && pred.finalists) {
    const correctFinalists = pred.finalists.filter(t => results.finalists.includes(t)).length;
    points += correctFinalists * 150;
  }
  
  // Tournament winner - 200 pts
  if (results.winner && pred.winner === results.winner) points += 200;
  
  return points;
};

const abbr = (name?: string) => {
  if (!name) return '?';
  const w = name.trim().split(/\s+/);
  if (w.length === 1) return w[0].slice(0, 3).toUpperCase();
  return w.map((x) => x[0]).join('').toUpperCase().slice(0, 3);
};

// ─── Table Components ─────────────────────────────────────────────────────────

const thBase: React.CSSProperties = { padding: '10px 14px', fontWeight: 800, fontSize: '0.63rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#111' };

const Th = ({ children, align = 'left', sticky = false }: { children: React.ReactNode; align?: 'left' | 'center'; sticky?: boolean }) => (
  <th style={{ ...thBase, textAlign: align, ...(sticky ? { position: 'sticky', left: 0, zIndex: 2, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' } : {}) }}>
    {children}
  </th>
);

const Td = ({ children, align = 'left', highlight = false, correct = false, sticky = false }: { children: React.ReactNode; align?: 'left' | 'center'; highlight?: boolean; correct?: boolean; sticky?: boolean }) => (
  <td style={{ padding: '11px 14px', textAlign: align, verticalAlign: 'middle', background: correct ? '#f0fdf4' : (highlight ? '#fff' : '#fff'), ...(sticky ? { position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 4px rgba(0,0,0,0.06)', background: highlight ? '#fffbeb' : '#fff' } : {}), borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
    {children}
  </td>
);

const NameCell = ({ name }: { name: string }) => (
  <Typography sx={{ fontWeight: 600, fontSize: '0.78rem', color: '#111', whiteSpace: 'nowrap' }}>
    {name}
  </Typography>
);

const WinnerCell = ({ team }: { team: string }) => {
  const meta = getTeamMeta(team);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
      <Box
        sx={{
          width: 20, height: 20, borderRadius: '5px',
          background: meta.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, p: '2px',
        }}
      >
        {meta.logo
          ? <img src={meta.logo} alt={team} style={{ width: 16, height: 16, objectFit: 'contain' }} />
          : null}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#111', whiteSpace: 'nowrap' }}>
        {abbr(team)}
      </Typography>
    </Box>
  );
};

const TeamsCell = ({ teams }: { teams: string[] }) => (
  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap' }}>
    {teams.map((team) => {
      const meta = getTeamMeta(team);
      return (
        <Box
          key={team}
          sx={{
            width: 20, height: 20, borderRadius: '5px',
            background: meta.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, p: '2px',
          }}
        >
          {meta.logo ? <img src={meta.logo} alt={team} style={{ width: 16, height: 16, objectFit: 'contain' }} /> : null}
        </Box>
      );
    })}
  </Box>
);

const EmptyCell = () => (
  <Typography sx={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.2)', fontWeight: 600 }}>—</Typography>
);

// ─── Static sub-components (MUST be outside main component to avoid remount) ──

const PtsBadge = ({ pts, color = '#1d4ed8' }: { pts: number; color?: string }) => (
  <Box sx={{
    display: 'inline-flex', alignItems: 'center',
    px: 1.5, py: 0.4, borderRadius: '20px',
    background: color === '#ea580c' ? 'rgba(234,88,12,0.1)' : 'rgba(29,78,216,0.1)',
    border: `1.5px solid ${color === '#ea580c' ? 'rgba(234,88,12,0.3)' : 'rgba(29,78,216,0.3)'}`,
  }}>
    <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color, letterSpacing: '0.04em' }}>
      +{pts} pts
    </Typography>
  </Box>
);

const SectionCard = ({
  title, icon, accentColor, children,
}: {
  title: string; icon: React.ReactNode; accentColor: string; children: React.ReactNode;
}) => (
  <Box sx={{
    background: '#fff', borderRadius: '24px',
    border: '1px solid rgba(0,0,0,0.07)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)', overflow: 'hidden',
  }}>
    <Box sx={{
      px: 2.5, pt: 2.25, pb: 2, borderBottom: '1px solid rgba(0,0,0,0.06)',
      background: `linear-gradient(135deg, ${accentColor}0a 0%, transparent 70%)`,
      display: 'flex', alignItems: 'center', gap: 1.25,
    }}>
      <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: accentColor, letterSpacing: '-0.01em' }}>{title}</Typography>
    </Box>
    <Box sx={{ p: 2.5 }}>{children}</Box>
  </Box>
);

const RowItem = ({
  label, pts, ptsColor, hint, children,
}: {
  label: string; pts: number; ptsColor?: string; hint?: string; children: React.ReactNode;
}) => (
  <Box sx={{ mb: 2.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#111', lineHeight: 1.3 }}>{label}</Typography>
        {hint && <Typography sx={{ fontSize: '0.66rem', color: 'rgba(0,0,0,0.38)', fontWeight: 600, mt: 0.15 }}>{hint}</Typography>}
      </Box>
      <PtsBadge pts={pts} color={ptsColor} />
    </Box>
    {children}
  </Box>
);

interface PlayerSelectProps {
  value: Player | null;
  onChange: (p: Player | null) => void;
  placeholder: string;
  disabled?: boolean;
  options: Player[];
  correct?: string | null;
}

const PlayerSelect = ({ value, onChange, placeholder, disabled, options, correct }: PlayerSelectProps) => {
  const hasResult = correct != null;
  const isCorrect = hasResult && value?.name === correct;
  const isWrong = hasResult && value?.name !== correct;
  return (
    <Box>
      <Box sx={{ position: 'relative' }}>
        <Autocomplete
          options={options}
          getOptionLabel={(p) => `${p.name} (${p.team})`}
          value={value}
          onChange={(_, val) => onChange(val)}
          disabled={disabled}
          groupBy={(p) => p.team}
          renderInput={(params) => (
            <TextField {...params} placeholder={placeholder} size="small" sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                background: isCorrect ? 'rgba(34,197,94,0.07)' : '#fafafa',
                '& fieldset': {
                  borderColor: isCorrect ? '#22c55e' : isWrong ? 'rgba(239,68,68,0.4)' : 'rgba(0,0,0,0.1)',
                  borderWidth: isCorrect || isWrong ? '1.5px' : '1px',
                },
                '&:hover fieldset': { borderColor: isCorrect ? '#22c55e' : 'rgba(0,0,0,0.22)' },
                '&.Mui-focused fieldset': { borderColor: '#1d4ed8', borderWidth: 1.5 },
              },
            }} />
          )}
          renderOption={(props, p) => {
            const meta = getTeamMeta(p.team);
            const { key, ...restProps } = props as { key?: React.Key } & React.HTMLAttributes<HTMLLIElement>;
            return (
              <Box component="li" key={key} {...restProps} sx={{ py: 0.85, px: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 22, height: 22, borderRadius: '5px', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, p: '2px' }}>
                    {meta.logo ? <img src={meta.logo} alt={p.team} style={{ width: 18, height: 18, objectFit: 'contain' }} /> : <Typography sx={{ fontSize: '0.45rem', fontWeight: 900, color: '#fff' }}>{p.team.slice(0, 3).toUpperCase()}</Typography>}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{p.name}</Typography>
                </Box>
              </Box>
            );
          }}
          renderGroup={(params) => (
            <Box key={params.key}>{params.children}</Box>
          )}
        />
        {isCorrect && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
            <CheckCircleIcon sx={{ fontSize: '0.75rem', color: '#16a34a' }} />
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#16a34a' }}>Correct! Points earned ✓</Typography>
          </Box>
        )}
        {isWrong && correct && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mt: 0.75, px: 1, py: 0.4, borderRadius: '8px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', width: 'fit-content' }}>
            <CheckCircleIcon sx={{ fontSize: '0.65rem', color: '#16a34a' }} />
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, color: '#16a34a' }}>Answer: {correct}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

interface TeamGridProps {
  selected: string[];
  onToggle: (t: string) => void;
  maxSelect: number;
  fromPool?: string[];
  correctTeams?: string[];
}

const TeamGrid = ({ selected, onToggle, maxSelect, fromPool, correctTeams }: TeamGridProps) => {
  const pool = fromPool ?? ALL_TEAMS;
  const hasResults = correctTeams != null && correctTeams.length > 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 1.5 }}>
        {Array.from({ length: maxSelect }).map((_, i) => (
          <Box key={i} sx={{ flex: 1, height: 3, borderRadius: '3px', background: i < selected.length ? '#ea580c' : 'rgba(0,0,0,0.09)', transition: 'background 0.2s' }} />
        ))}
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(0,0,0,0.35)', ml: 0.25, flexShrink: 0 }}>
          {selected.length}/{maxSelect}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
        {pool.map((team) => {
          const meta = getTeamMeta(team);
          const isSelected = selected.includes(team);
          const isCorrect = hasResults && (correctTeams ?? []).includes(team);
          const isCorrectPick = isSelected && isCorrect;   // user got it right ✓
          const isMissedCorrect = !isSelected && isCorrect; // correct answer user didn't pick
          const isDisabled = !isSelected && selected.length >= maxSelect;
          const shortName = team.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 3);
          return (
            <Box
              key={team}
              onClick={() => !isDisabled && onToggle(team)}
              sx={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                py: 1.25, px: 0.5, borderRadius: '14px', gap: 0.6,
                border: isCorrectPick
                  ? '2px solid #22c55e'
                  : isMissedCorrect
                  ? '2px dashed rgba(34,197,94,0.55)'
                  : isSelected ? `2px solid ${meta.color}` : '2px solid rgba(0,0,0,0.07)',
                background: isCorrectPick
                  ? 'linear-gradient(160deg, rgba(34,197,94,0.14) 0%, rgba(34,197,94,0.05) 100%)'
                  : isMissedCorrect
                  ? 'rgba(34,197,94,0.05)'
                  : isSelected ? `linear-gradient(160deg, ${meta.color}22 0%, ${meta.color}0a 100%)` : '#fafafa',
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: hasResults && !isCorrect && !isSelected ? 0.28 : isDisabled ? 0.32 : 1,
                transition: 'all 0.14s ease',
                '&:hover': !isDisabled ? {
                  background: isCorrectPick
                    ? 'rgba(34,197,94,0.18)'
                    : isSelected ? `linear-gradient(160deg, ${meta.color}2e 0%, ${meta.color}12 100%)` : '#f0f0f0',
                  transform: 'translateY(-2px)',
                } : {},
              }}
            >
              {/* correct pick badge */}
              {isCorrectPick && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircleIcon sx={{ fontSize: '0.65rem', color: '#fff' }} />
                </Box>
              )}
              {/* selected but wrong — show team color badge */}
              {isSelected && !isCorrectPick && hasResults && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircleIcon sx={{ fontSize: '0.65rem', color: '#fff' }} />
                </Box>
              )}
              {/* non-results mode selected badge */}
              {isSelected && !hasResults && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircleIcon sx={{ fontSize: '0.65rem', color: '#fff' }} />
                </Box>
              )}
              <Box sx={{
                width: 38, height: 38, borderRadius: '50%', background: '#fff',
                boxShadow: isCorrectPick
                  ? '0 0 0 2px #22c55e70, 0 3px 10px rgba(34,197,94,0.25)'
                  : isSelected ? `0 0 0 2px ${meta.color}70, 0 3px 10px ${meta.color}25` : '0 1px 6px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', p: '6px',
              }}>
                {meta.logo ? <img src={meta.logo} alt={team} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Typography sx={{ fontWeight: 900, fontSize: '0.65rem', color: meta.color }}>{shortName}</Typography>}
              </Box>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.03em', color: isCorrectPick ? '#16a34a' : isMissedCorrect ? '#16a34a' : isSelected ? meta.color : 'rgba(0,0,0,0.5)', lineHeight: 1 }}>
                {shortName}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const BonusStage = () => {
  const { session } = useAuth();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });
  const [topScorer, setTopScorer] = useState<Player | null>(null);
  const [topWicketTaker, setTopWicketTaker] = useState<Player | null>(null);
  const [playerOfTournament, setPlayerOfTournament] = useState<Player | null>(null);
  const [mostSixes, setMostSixes] = useState<Player | null>(null);
  const [mostFours, setMostFours] = useState<Player | null>(null);
  const [semiFinalists, setSemiFinalists] = useState<string[]>([]);
  const [finalists, setFinalists] = useState<string[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; mins: number; secs: number } | null>(null);
  const [bonusResults, setBonusResults] = useState<BonusResult | null>(null);
  const [allPredictions, setAllPredictions] = useState<UserBonusPrediction[]>([]);

  useEffect(() => {
    const tick = () => {
      const diff = DEADLINE.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: playersData } = await supabase.from('players').select('id, name, team').order('name');
      setAllPlayers((playersData || []) as Player[]);
      const { data: resultData } = await supabase.from('bonus_results').select('*').limit(1).maybeSingle();
      const br = resultData as BonusResult | null;
      setBonusResults(br);
      setLocked(br?.predictions_locked ?? false);
      if (session?.user?.id) {
        const { data: predData } = await supabase.from('bonus_predictions').select('*').eq('user_id', session.user.id).maybeSingle();
        if (predData) {
          const p = predData as BonusPrediction;
          setExisting(true);
          const findPlayer = (name: string | null) => (playersData as Player[] | null)?.find((pl) => pl.name === name) ?? null;
          setTopScorer(findPlayer(p.top_scorer));
          setTopWicketTaker(findPlayer(p.top_wicket_taker));
          setPlayerOfTournament(findPlayer(p.player_of_tournament));
          setMostSixes(findPlayer(p.most_sixes));
          setMostFours(findPlayer(p.most_fours));
          setSemiFinalists(p.semi_finalists ?? []);
          setFinalists(p.finalists ?? []);
          setWinner(p.winner ?? null);
        }
      }

      // Fetch all users' predictions if deadline passed
      const isPastDeadline = Date.now() >= DEADLINE.getTime();
      if (isPastDeadline || br?.predictions_locked) {
        const { data: allPredsData } = await supabase
          .from('bonus_predictions')
          .select('*')
          .order('created_at', { ascending: true });

        if (allPredsData && allPredsData.length > 0) {
          // Fetch user display names from leaderboard
          const { data: usersData } = await supabase
            .from('leaderboard')
            .select('user_id, display_name, email');

          const userMap = new Map(
            (usersData || []).map((u: any) => [u.user_id, u.display_name || u.email?.split('@')[0] || 'Unknown'])
          );

          const enriched = allPredsData.map((pred: any) => ({
            ...pred,
            display_name: userMap.get(pred.user_id) || pred.user_id,
          }));

          setAllPredictions(enriched as UserBonusPrediction[]);
        }
      }

      setLoading(false);
    };
    load();
  }, [session?.user?.id]);

  const isValid = topScorer && topWicketTaker && playerOfTournament && mostSixes && mostFours && semiFinalists.length === 4 && finalists.length === 2 && winner;

  const validationError = (): string | null => {
    if (!topScorer) return 'Please select Top Run Scorer';
    if (!topWicketTaker) return 'Please select Top Wicket Taker';
    if (!playerOfTournament) return 'Please select Player of the Tournament';
    if (!mostSixes) return 'Please select Most Sixes hitter';
    if (!mostFours) return 'Please select Most Fours hitter';
    if (semiFinalists.length !== 4) return 'Please select exactly 4 qualifying teams';
    if (finalists.length !== 2) return 'Please select exactly 2 finalist teams';
    if (!winner) return 'Please select the tournament winner';
    return null;
  };

  const handleSubmit = async () => {
    if (effectiveLocked) return;
    const err = validationError();
    if (err) { setToast({ open: true, message: err, severity: 'error' }); return; }
    if (!session?.user?.id) return;
    setSaving(true);
    const payload = {
      user_id: session.user.id,
      top_scorer: topScorer!.name,
      top_wicket_taker: topWicketTaker!.name,
      player_of_tournament: playerOfTournament!.name,
      most_sixes: mostSixes!.name,
      most_fours: mostFours!.name,
      semi_finalists: semiFinalists,
      finalists,
      winner,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('bonus_predictions').upsert([payload], { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      setToast({ open: true, message: `Error: ${error.message}`, severity: 'error' });
    } else {
      setExisting(true);
      setToast({ open: true, message: existing ? 'Bonus predictions updated! 🎉' : 'Bonus predictions submitted! 🎉', severity: 'success' });
    }
  };

  const isPastDeadline = Date.now() >= DEADLINE.getTime();
  const effectiveLocked = locked || isPastDeadline;

  const toggleSemiFinalist = (team: string) => setSemiFinalists((prev) => prev.includes(team) ? prev.filter((t) => t !== team) : prev.length < 4 ? [...prev, team] : prev);
  const toggleFinalist = (team: string) => setFinalists((prev) => prev.includes(team) ? prev.filter((t) => t !== team) : prev.length < 2 ? [...prev, team] : prev);
  const toggleWinner = (team: string) => setWinner((prev) => prev === team ? null : team);

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

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f5f7', pb: 5 }}>
      <Navbar />

      {/* ── Hero ── */}
      <Box sx={{
        background: 'linear-gradient(160deg, #0f0f1a 0%, #1a2e50 100%)',
        pt: 2.5, pb: 3, px: 2, position: 'relative', overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', top: -50, right: -50,
          width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251,191,36,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        },
      }}>
        <Container maxWidth="md" disableGutters sx={{ px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(251,191,36,0.08) 100%)',
              border: '1px solid rgba(251,191,36,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <EmojiEventsIcon sx={{ fontSize: '1.5rem', color: '#fbbf24' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', color: '#fff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>Bonus Stage</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600, mt: 0.2 }}>Tournament-level predictions · Earn big points</Typography>
            </Box>
          </Box>

          {effectiveLocked && (
            <Box sx={{ mb: 1.25, display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderRadius: '12px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)' }}>
              <LockIcon sx={{ fontSize: '0.9rem', color: '#f87171' }} />
              <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: '#f87171' }}>
                {isPastDeadline ? 'Deadline has passed — predictions are now locked' : 'Predictions are locked — no further changes allowed'}
              </Typography>
            </Box>
          )}
          {existing && !effectiveLocked && (
            <Box sx={{ mb: 1.25, display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderRadius: '12px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)' }}>
              <CheckCircleIcon sx={{ fontSize: '0.9rem', color: '#4ade80' }} />
              <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: '#4ade80' }}>Predictions saved — you can still edit until the deadline</Typography>
            </Box>
          )}

          {/* ── Deadline countdown — dark glass card matching hero ── */}
          {!effectiveLocked && (
            <Box sx={{
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              overflow: 'hidden',
            }}>
              {/* top row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.75, py: 1.1 }}>
                <AccessTimeIcon sx={{ fontSize: '0.85rem', color: '#fbbf24', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                  Deadline:
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 900, color: '#fbbf24', lineHeight: 1.4 }}>
                  27 Apr 2026, 11:00 AM IST
                </Typography>
              </Box>
              {/* countdown row */}
              {timeLeft && (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {[{ v: timeLeft.days, l: 'Days' }, { v: timeLeft.hours, l: 'Hrs' }, { v: timeLeft.mins, l: 'Min' }, { v: timeLeft.secs, l: 'Sec' }].map(({ v, l }, i) => (
                    <Box key={l} sx={{
                      textAlign: 'center', py: 1,
                      borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    }}>
                      <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {String(v).padStart(2, '0')}
                      </Typography>
                      <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', mt: 0.25 }}>{l}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 2.5, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Tournament Statistics */}
          {!effectiveLocked && (
            <SectionCard title="Tournament Statistics" icon={<SportsCricketIcon sx={{ fontSize: '1.1rem', color: '#1d4ed8' }} />} accentColor="#1d4ed8">
              <RowItem label="Top Run Scorer" pts={100} hint="Who will score the most runs this season?">
                <PlayerSelect value={topScorer} onChange={setTopScorer} placeholder="Search player…" disabled={effectiveLocked} options={allPlayers} correct={bonusResults?.top_scorer} />
              </RowItem>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(0,0,0,0.05)' }} />
              <RowItem label="Top Wicket Taker" pts={100} hint="Who will take the most wickets?">
                <PlayerSelect value={topWicketTaker} onChange={setTopWicketTaker} placeholder="Search player…" disabled={effectiveLocked} options={allPlayers} correct={bonusResults?.top_wicket_taker} />
              </RowItem>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(0,0,0,0.05)' }} />
              <RowItem label="Player of the Tournament" pts={150} hint="The standout performer across the season">
                <PlayerSelect value={playerOfTournament} onChange={setPlayerOfTournament} placeholder="Search player…" disabled={effectiveLocked} options={allPlayers} correct={bonusResults?.player_of_tournament} />
              </RowItem>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(0,0,0,0.05)' }} />
              <RowItem label="Most Sixes" pts={50} hint="Who will hit the most sixes?">
                <PlayerSelect value={mostSixes} onChange={setMostSixes} placeholder="Search player…" disabled={effectiveLocked} options={allPlayers} correct={bonusResults?.most_sixes} />
              </RowItem>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(0,0,0,0.05)' }} />
              <RowItem label="Most Fours" pts={50} hint="Who will hit the most fours?">
                <PlayerSelect value={mostFours} onChange={setMostFours} placeholder="Search player…" disabled={effectiveLocked} options={allPlayers} correct={bonusResults?.most_fours} />
              </RowItem>
            </SectionCard>
          )}

          {/* Tournament Progression */}
          {!effectiveLocked && (
            <SectionCard title="Tournament Progression" icon={<StarIcon sx={{ fontSize: '1.1rem', color: '#ea580c' }} />} accentColor="#ea580c">
              <RowItem label="4 Qualifying Teams" pts={100} ptsColor="#ea580c" hint="Pick 4 teams that reach the semi-finals (each correct = +100 pts)">
                <TeamGrid selected={semiFinalists} onToggle={effectiveLocked ? () => {} : toggleSemiFinalist} maxSelect={4} correctTeams={bonusResults?.semi_finalists} />
              </RowItem>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(0,0,0,0.05)' }} />
              <RowItem label="2 Finalists" pts={150} ptsColor="#ea580c" hint="Which 2 teams will play the final? (each correct = +150 pts)">
                <TeamGrid selected={finalists} onToggle={effectiveLocked ? () => {} : toggleFinalist} maxSelect={2} correctTeams={bonusResults?.finalists} />
              </RowItem>
              <Divider sx={{ mb: 2.5, borderColor: 'rgba(0,0,0,0.05)' }} />
              <RowItem label="Tournament Winner" pts={200} ptsColor="#ea580c" hint="Pick the IPL 2026 champion">
                <TeamGrid selected={winner ? [winner] : []} onToggle={effectiveLocked ? () => {} : toggleWinner} maxSelect={1} correctTeams={bonusResults?.winner ? [bonusResults.winner] : undefined} />
              </RowItem>
            </SectionCard>
          )}

          {/* Submit */}
          {!effectiveLocked && (
            <Box>
              <Button
                fullWidth variant="contained"
                disabled={saving || !isValid}
                onClick={handleSubmit}
                startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <EmojiEventsIcon />}
                sx={{
                  py: 1.6, borderRadius: '16px', fontWeight: 900, fontSize: '0.92rem',
                  letterSpacing: '0.02em', textTransform: 'none',
                  background: 'linear-gradient(135deg, #111 0%, #1e3a5f 100%)',
                  color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                  '&:hover': { background: 'linear-gradient(135deg, #222 0%, #2a4f7c 100%)', boxShadow: '0 6px 24px rgba(0,0,0,0.22)' },
                  '&.Mui-disabled': { background: 'rgba(0,0,0,0.09)', color: 'rgba(0,0,0,0.28)', boxShadow: 'none' },
                }}
              >
                {saving ? 'Saving…' : existing ? 'Update Bonus Predictions' : 'Submit Bonus Predictions'}
              </Button>
              {!isValid && (
                <Box sx={{ mt: 1.5, px: 2, py: 1.5, borderRadius: '14px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }}>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(0,0,0,0.4)', mb: 0.75, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Still needed:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                    {[
                      { label: 'Top Run Scorer', done: !!topScorer },
                      { label: 'Top Wicket Taker', done: !!topWicketTaker },
                      { label: 'Player of Tournament', done: !!playerOfTournament },
                      { label: 'Most Sixes', done: !!mostSixes },
                      { label: 'Most Fours', done: !!mostFours },
                      { label: '4 Qualifying Teams', done: semiFinalists.length === 4 },
                      { label: '2 Finalists', done: finalists.length === 2 },
                      { label: 'Tournament Winner', done: !!winner },
                    ].filter(({ done }) => !done).map(({ label }) => (
                      <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: '8px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.12)' }}>
                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.66rem', color: '#dc2626', fontWeight: 700 }}>{label}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* ── My Bonus Result Card (after deadline, when results are in) ── */}
          {effectiveLocked && bonusResults && (() => {
            const myPred = allPredictions.find(p => p.user_id === session?.user?.id);
            if (!myPred) return null;

            const fields = [
              { label: 'Top Run Scorer', pred: myPred.top_scorer, result: bonusResults.top_scorer, pts: 100 },
              { label: 'Top Wicket Taker', pred: myPred.top_wicket_taker, result: bonusResults.top_wicket_taker, pts: 100 },
              { label: 'Player of Tournament', pred: myPred.player_of_tournament, result: bonusResults.player_of_tournament, pts: 150 },
              { label: 'Most Sixes', pred: myPred.most_sixes, result: bonusResults.most_sixes, pts: 50 },
              { label: 'Most Fours', pred: myPred.most_fours, result: bonusResults.most_fours, pts: 50 },
            ];

            const qualifiersCorrect = bonusResults.semi_finalists && myPred.semi_finalists
              ? myPred.semi_finalists.filter(t => bonusResults.semi_finalists.includes(t)).length : 0;
            const finalistsCorrect = bonusResults.finalists && myPred.finalists
              ? myPred.finalists.filter(t => bonusResults.finalists.includes(t)).length : 0;
            const winnerCorrect = !!(bonusResults.winner && myPred.winner === bonusResults.winner);

            const totalPts = calculateBonusPoints(myPred, bonusResults);
            const positive = totalPts > 0;

            return (
              <Box sx={{
                borderRadius: '20px', overflow: 'hidden', mb: 2.5,
                border: '1px solid rgba(0,0,0,0.07)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              }}>
                {/* Dark header with total */}
                <Box sx={{
                  background: positive
                    ? 'linear-gradient(135deg, #052e16 0%, #14532d 100%)'
                    : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  px: 2.5, py: 2.5,
                }}>
                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 0.5 }}>
                    Bonus Stage · Your Result
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: '3rem', lineHeight: 1, color: positive ? '#4ade80' : 'rgba(255,255,255,0.4)', letterSpacing: '-0.02em' }}>
                        {positive ? `+${totalPts}` : totalPts}
                      </Typography>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>pts</Typography>
                    </Box>
                    <EmojiEventsIcon sx={{ fontSize: '2.5rem', color: positive ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)' }} />
                  </Box>
                </Box>

                {/* Chips */}
                <Box sx={{ background: '#fff', px: 2, py: 1.75, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {fields.map(({ label, pred, result, pts }) => {
                    const hasResult = !!result;
                    const ok = hasResult && pred === result;
                    return (
                      <Box key={label} sx={{
                        px: 1.25, py: 0.5, borderRadius: '10px',
                        background: !hasResult ? 'rgba(0,0,0,0.03)' : ok ? 'rgba(74,222,128,0.12)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${!hasResult ? 'rgba(0,0,0,0.07)' : ok ? 'rgba(74,222,128,0.35)' : 'rgba(0,0,0,0.09)'}`,
                      }}>
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: !hasResult ? 'rgba(0,0,0,0.25)' : ok ? '#16a34a' : 'rgba(0,0,0,0.45)' }}>
                          {!hasResult ? `– ${label}` : ok ? `✓ ${label} +${pts}` : `✗ ${label}`}
                        </Typography>
                      </Box>
                    );
                  })}

                  {/* Qualifiers chip */}
                  {bonusResults.semi_finalists?.length > 0 && (
                    <Box sx={{
                      px: 1.25, py: 0.5, borderRadius: '10px',
                      background: qualifiersCorrect > 0 ? 'rgba(74,222,128,0.12)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${qualifiersCorrect > 0 ? 'rgba(74,222,128,0.35)' : 'rgba(0,0,0,0.09)'}`,
                    }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: qualifiersCorrect > 0 ? '#16a34a' : 'rgba(0,0,0,0.45)' }}>
                        {qualifiersCorrect > 0 ? `✓ Qualifiers ${qualifiersCorrect}/4 +${qualifiersCorrect * 100}` : '✗ Qualifiers 0/4'}
                      </Typography>
                    </Box>
                  )}

                  {/* Finalists chip */}
                  {bonusResults.finalists?.length > 0 && (
                    <Box sx={{
                      px: 1.25, py: 0.5, borderRadius: '10px',
                      background: finalistsCorrect > 0 ? 'rgba(74,222,128,0.12)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${finalistsCorrect > 0 ? 'rgba(74,222,128,0.35)' : 'rgba(0,0,0,0.09)'}`,
                    }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: finalistsCorrect > 0 ? '#16a34a' : 'rgba(0,0,0,0.45)' }}>
                        {finalistsCorrect > 0 ? `✓ Finalists ${finalistsCorrect}/2 +${finalistsCorrect * 150}` : '✗ Finalists 0/2'}
                      </Typography>
                    </Box>
                  )}

                  {/* Winner chip */}
                  {bonusResults.winner && (
                    <Box sx={{
                      px: 1.25, py: 0.5, borderRadius: '10px',
                      background: winnerCorrect ? 'rgba(74,222,128,0.12)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${winnerCorrect ? 'rgba(74,222,128,0.35)' : 'rgba(0,0,0,0.09)'}`,
                    }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: winnerCorrect ? '#16a34a' : 'rgba(0,0,0,0.45)' }}>
                        {winnerCorrect ? '✓ Winner +200' : '✗ Winner'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })()}

          {/* All Users' Predictions (after deadline) */}
          {effectiveLocked && allPredictions.length > 0 && (
            <Box sx={{ background: '#fff', borderRadius: '20px', p: 2.5, border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2 }}>
                <EmojiEventsIcon sx={{ fontSize: '1rem', color: '#fbbf24' }} />
                <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#111' }}>All Predictions ({allPredictions.length})</Typography>
              </Box>
              <Box sx={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                  <thead>
                    <tr style={{ borderRadius: '12px 12px 0 0' }}>
                      <Th sticky>#</Th>
                      <Th sticky>Player</Th>
                      <Th>Top Scorer</Th>
                      <Th>Top Wickets</Th>
                      <Th>POTT</Th>
                      <Th>Most 6s</Th>
                      <Th>Most 4s</Th>
                      <Th>Qualifiers</Th>
                      <Th>Finalists</Th>
                      <Th>Winner</Th>
                      <Th align="center">Points</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {allPredictions.map((pred, idx) => {
                      const isMe = pred.user_id === session?.user?.id;
                      
                      // Check correct answers
                      const topScorerCorrect = bonusResults?.top_scorer && pred.top_scorer === bonusResults.top_scorer;
                      const topWicketCorrect = bonusResults?.top_wicket_taker && pred.top_wicket_taker === bonusResults.top_wicket_taker;
                      const pottCorrect = bonusResults?.player_of_tournament && pred.player_of_tournament === bonusResults.player_of_tournament;
                      const mostSixesCorrect = bonusResults?.most_sixes && pred.most_sixes === bonusResults.most_sixes;
                      const mostFoursCorrect = bonusResults?.most_fours && pred.most_fours === bonusResults.most_fours;
                      
                      // Check team arrays - partial credit for qualifiers and finalists
                      const qualifiersCount = bonusResults?.semi_finalists && pred.semi_finalists
                        ? pred.semi_finalists.filter(t => bonusResults.semi_finalists.includes(t)).length
                        : 0;
                      const finalistsCount = bonusResults?.finalists && pred.finalists
                        ? pred.finalists.filter(t => bonusResults.finalists.includes(t)).length
                        : 0;
                      const winnerCorrect = bonusResults?.winner && pred.winner === bonusResults.winner;
                      
                      // Calculate total points
                      const totalPoints = calculateBonusPoints(pred, bonusResults);
                      
                      return (
                        <tr key={pred.user_id}>
                          <Td highlight={isMe} sticky>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'rgba(0,0,0,0.3)' }}>{idx + 1}</Typography>
                          </Td>
                          <Td highlight={isMe} sticky>
                            <NameCell name={pred.display_name || 'Unknown'} />
                          </Td>
                          <Td highlight={isMe} correct={topScorerCorrect}>
                            {pred.top_scorer ? <NameCell name={pred.top_scorer} /> : <EmptyCell />}
                          </Td>
                          <Td highlight={isMe} correct={topWicketCorrect}>
                            {pred.top_wicket_taker ? <NameCell name={pred.top_wicket_taker} /> : <EmptyCell />}
                          </Td>
                          <Td highlight={isMe} correct={pottCorrect}>
                            {pred.player_of_tournament ? <NameCell name={pred.player_of_tournament} /> : <EmptyCell />}
                          </Td>
                          <Td highlight={isMe} correct={mostSixesCorrect}>
                            {pred.most_sixes ? <NameCell name={pred.most_sixes} /> : <EmptyCell />}
                          </Td>
                          <Td highlight={isMe} correct={mostFoursCorrect}>
                            {pred.most_fours ? <NameCell name={pred.most_fours} /> : <EmptyCell />}
                          </Td>
                          <Td highlight={isMe} correct={qualifiersCount > 0}>
                            {pred.semi_finalists && pred.semi_finalists.length > 0 ? <TeamsCell teams={pred.semi_finalists} /> : <EmptyCell />}
                          </Td>
                          <Td highlight={isMe} correct={finalistsCount > 0}>
                            {pred.finalists && pred.finalists.length > 0 ? <TeamsCell teams={pred.finalists} /> : <EmptyCell />}
                          </Td>
                          <Td highlight={isMe} correct={winnerCorrect}>
                            {pred.winner ? <WinnerCell team={pred.winner} /> : <EmptyCell />}
                          </Td>
                          <Td align="center" highlight={isMe}>
                            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                              <Box sx={{
                                px: 1.5, py: 0.5, borderRadius: '12px',
                                background: totalPoints > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.03)',
                                border: totalPoints > 0 ? '1.5px solid rgba(16,185,129,0.3)' : '1px solid rgba(0,0,0,0.08)',
                              }}>
                                <Typography sx={{
                                  fontSize: '0.8rem', fontWeight: 900,
                                  color: totalPoints > 0 ? '#059669' : 'rgba(0,0,0,0.3)',
                                }}>
                                  {totalPoints}
                                </Typography>
                              </Box>
                            </Box>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </Box>
          )}
        </Box>
      </Container>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ borderRadius: '14px', fontWeight: 700, fontSize: '0.82rem', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BonusStage;
