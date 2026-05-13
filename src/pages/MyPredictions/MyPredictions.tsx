import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Container,
  Chip,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LockIcon from '@mui/icons-material/Lock';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BoltIcon from '@mui/icons-material/Bolt';
import Navbar from '../../components/Navbar/Navbar';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getTeamMeta } from '../../utils/teamMeta';
import { getRandomDialogue } from '../../utils/loadingDialogues';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Match {
  id: string | number;
  match_number: number;
  match_date: string;
  match_time: string;
  match_start_utc?: string; // server UTC timestamp — device clock cannot affect this
  venue?: string;
  team_a?: string;
  team_b?: string;
}

interface Prediction {
  id: string | number;
  match_id: string | number;
  user_id: string;
  user_email?: string | null;
  predicted_winner: string | null;
  predicted_batter_id: string | number | null;
  predicted_batter_name?: string | null;
  predicted_bowler_id: string | number | null;
  predicted_bowler_name?: string | null;
  predicted_mom_id: string | number | null;
  predicted_mom_name?: string | null;
  is_double_trouble: boolean;
}

interface EnrichedPrediction extends Prediction {
  batterName: string | null;
  bowlerName: string | null;
  momName: string | null;
  displayEmail: string;
  display_name: string;
}

interface MatchPredictionGroup {
  match: Match;
  predictions: EnrichedPrediction[];
}

interface CorrectAnswer {
  match_id: number;
  winner: string | null;
  batter_id: number | null;
  bowler_id: number | null;
  mom_id: number | null;
  is_washout?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const abbr = (name?: string) => {
  if (!name) return '?';
  const w = name.trim().split(/\s+/);
  if (w.length === 1) return w[0].slice(0, 3).toUpperCase();
  return w.map((x) => x[0]).join('').toUpperCase().slice(0, 3);
};

const formatDate = (dateStr: string, timeStr: string) => {
  const dt = new Date(`${dateStr}T${timeStr}`);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const nameFromEmail = (email?: string | null) => {
  if (!email) return null;
  const local = email.split('@')[0];
  // replace dots, underscores and other separators with space
  const parts = local.replace(/[_\.]+/g, ' ').split(/\s+/).filter(Boolean);
  const capitalized = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  return capitalized || null;
};

const isMatchLocked = (match: Match): boolean => {
  // Use match_start_utc (server UTC) when available — device clock/timezone cannot affect this
  const lockTime = match.match_start_utc
    ? new Date(match.match_start_utc).getTime()
    : new Date(`${match.match_date}T${match.match_time}`).getTime();
  return Date.now() >= lockTime;
};


// ─── Table primitives ─────────────────────────────────────────────────────────

const thBase: React.CSSProperties = { padding: '10px 14px', fontWeight: 800, fontSize: '0.63rem', color: 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#f8f8f8' };

const Th = ({ children, align = 'left', sticky = false }: { children: React.ReactNode; align?: 'left' | 'center'; sticky?: boolean }) => (
  <th style={{ ...thBase, textAlign: align, ...(sticky ? { position: 'sticky', left: 0, zIndex: 2, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' } : {}) }}>
    {children}
  </th>
);

const Td = ({ children, align = 'left', highlight = false, correct = false, sticky = false }: { children: React.ReactNode; align?: 'left' | 'center'; highlight?: boolean; correct?: boolean; sticky?: boolean }) => (
  <td style={{ padding: '11px 14px', textAlign: align, verticalAlign: 'middle', background: correct ? '#f0fdf4' : highlight ? '#efefef' : '#fff', ...(sticky ? { position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 4px rgba(0,0,0,0.06)' } : {}) }}>
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

const EmptyCell = () => (
  <Typography sx={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.2)', fontWeight: 600 }}>—</Typography>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const MyPredictions = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [groups, setGroups] = useState<MatchPredictionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMatch, setExpandedMatch] = useState<string | number | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState<CorrectAnswer[]>([]);
  const [allUsers, setAllUsers] = useState<{ user_id: string; display_name: string }[]>([]);
  const [playerNameMap, setPlayerNameMap] = useState<Record<number, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id, match_number, match_date, match_time, match_start_utc, venue, team_a, team_b')
        .order('match_number', { ascending: false });

      if (matchError) { setLoading(false); return; }

      const allLockedMatches = ((matchData || []) as Match[]).filter(isMatchLocked);
      if (allLockedMatches.length === 0) { setGroups([]); setLoading(false); return; }

      // Show only the latest 10 locked matches to stay within Supabase row limits
      const lockedMatches = allLockedMatches.slice(0, 10);

      const matchIds = lockedMatches.map((m) => Number(m.id));

      const { data: predsData } = await supabase
        .from('predictions')
        .select('id, match_id, user_id, user_email, predicted_winner, predicted_batter_id, predicted_batter_name, predicted_bowler_id, predicted_bowler_name, predicted_mom_id, predicted_mom_name, is_double_trouble')
        .in('match_id', matchIds);

      // Fetch all registered users for missed-prediction list
      const { data: usersData } = await supabase
        .from('leaderboard')
        .select('user_id, display_name, email');

      const users = (usersData ?? []) as { user_id: string; display_name: string | null; email?: string | null }[];
      const isEmailLike = (s?: string | null) => !!s && /\S+@\S+\.\S+/.test(s);
      const missingIds = users.filter(u => !u.display_name || isEmailLike(u.display_name)).map(u => u.user_id);
      let profMap: Record<string, string> = {};
      if (missingIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', missingIds);
        for (const p of profs ?? []) profMap[p.id] = p.display_name;
      }

      const mergedUsers = users.map(u => ({
        user_id: u.user_id,
        display_name: (u.display_name && !isEmailLike(u.display_name)) ? u.display_name : (profMap[u.user_id] || nameFromEmail(u.email) || u.user_id),
      }));
      setAllUsers(mergedUsers as { user_id: string; display_name: string }[]);

      const predictions = (predsData || []) as Prediction[];

      // Player names are stored directly on each prediction row — no extra query needed

      const grouped: MatchPredictionGroup[] = lockedMatches.map((match) => {
        const preds: EnrichedPrediction[] = predictions
          .filter((p) => Number(p.match_id) === Number(match.id))
            .map((p) => {
            // Find display_name from mergedUsers (local, not stale state)
            const user = mergedUsers.find(u => u.user_id === p.user_id);
            const fallbackFromEmail = nameFromEmail(p.user_email) || (p.user_id === session?.user?.id ? nameFromEmail(session?.user?.email ?? undefined) : null);
            return {
              ...p,
              displayEmail: p.user_email || (p.user_id === session?.user?.id ? session?.user?.email ?? p.user_id : p.user_id),
              batterName: p.predicted_batter_name || null,
              bowlerName: p.predicted_bowler_name || null,
              momName: p.predicted_mom_name || null,
              display_name: user?.display_name || fallbackFromEmail || p.user_id,
            };
          });

        // Current user always first, then alphabetical by display_name
        preds.sort((a, b) => {
          if (a.user_id === session?.user?.id) return -1;
          if (b.user_id === session?.user?.id) return 1;
          return a.display_name.localeCompare(b.display_name);
        });

        return { match, predictions: preds };
      });

      setGroups(grouped);
      setExpandedMatch(lockedMatches[0].id);

      // Fetch correct answers for all locked matches
      const { data: caData } = await supabase
        .from('correct_answers')
        .select('match_id, winner, batter_id, bowler_id, mom_id, is_washout')
        .in('match_id', matchIds);
      const caRows = (caData || []) as CorrectAnswer[];
      setCorrectAnswers(caRows);

      // Fetch player names for correct answer display
      const playerIds = [...new Set(
        caRows.flatMap((c) => [c.batter_id, c.bowler_id, c.mom_id].filter((id): id is number => id != null))
      )];
      if (playerIds.length > 0) {
        const { data: playerData } = await supabase
          .from('players')
          .select('id, name')
          .in('id', playerIds);
        const map: Record<number, string> = {};
        (playerData || []).forEach((pl: { id: number; name: string }) => { map[pl.id] = pl.name; });
        setPlayerNameMap(map);
      }

      setLoading(false);
    };

    fetchData();
  }, [session]);

  // ── CSV Download ────────────────────────────────────────────────────────
  const downloadMatchReport = (group: MatchPredictionGroup) => {
    const { match, predictions } = group;
    const ca = correctAnswers.find((c) => Number(c.match_id) === Number(match.id)) || null;
    const { winner: wPts, player: pPts } = (() => {
      const mn = match.match_number;
      if (mn <= 35) return { winner: 50, player: 60 };
      if (mn <= 70) return { winner: 70, player: 80 };
      return { winner: 90, player: 100 };
    })();
    const computePts = (pred: EnrichedPrediction): number | null => {
      if (!ca) return null;
      let pts = 0;
      if (pred.predicted_winner === ca.winner) pts += wPts;
      if (ca.batter_id && Number(pred.predicted_batter_id) === ca.batter_id) pts += pPts;
      if (ca.bowler_id && Number(pred.predicted_bowler_id) === ca.bowler_id) pts += pPts;
      if (ca.mom_id && Number(pred.predicted_mom_id) === ca.mom_id) pts += pPts;
      const allCorrect = pred.predicted_winner === ca.winner &&
        ca.batter_id && Number(pred.predicted_batter_id) === ca.batter_id &&
        ca.bowler_id && Number(pred.predicted_bowler_id) === ca.bowler_id &&
        ca.mom_id && Number(pred.predicted_mom_id) === ca.mom_id;
      if (allCorrect) pts += 150;
      if (pred.is_double_trouble) pts *= 2;
      return pts;
    };
    const predictedUserIds = new Set(predictions.map((p) => p.user_id));
    const missedUsers = allUsers.filter((u) => !predictedUserIds.has(u.user_id));
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // SpreadsheetML XML — opens in Excel, Numbers, Google Sheets (mobile-friendly)
    const S = {
      header:    'font-weight:700;font-size:13pt;background:#0f172a;color:#ffffff',
      subheader: 'font-weight:700;font-size:10pt;background:#1e3a5f;color:#ffffff',
      colHead:   'font-weight:700;font-size:9pt;background:#1e293b;color:#94a3b8',
      correct:   'background:#f0fdf4;color:#15803d;font-weight:700',
      alt:       'background:#f9fafb',
      normal:    'background:#ffffff',
      missed:    'background:#fff5f5;color:#ef4444',
      missedHead:'font-weight:700;background:#fef2f2;color:#dc2626',
      pts_pos:   'font-weight:800;color:#15803d',
      pts_neg:   'font-weight:800;color:#dc2626',
      pts_null:  'color:#9ca3af',
      dt:        'color:#b45309;font-weight:700',
    };
    const cell = (val: string, style?: string, type = 'String') =>
      `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="${type}">${esc(val)}</Data></Cell>`;
    const numCell = (val: number, style?: string) =>
      `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="Number">${val}</Data></Cell>`;

    const styleBlock = Object.entries(S).map(([id, css]) => {
      const parts = css.split(';').filter(Boolean);
      const fg = parts.find(p => p.startsWith('color:'))?.split(':')[1]?.trim();
      const bg = parts.find(p => p.startsWith('background:'))?.split(':')[1]?.trim();
      const bold = parts.some(p => p === 'font-weight:700' || p === 'font-weight:800');
      const size = parts.find(p => p.startsWith('font-size:'))?.replace('font-size:','').replace('pt','').trim();
      return `<Style ss:ID="${id}">
        <Font${bold ? ' ss:Bold="1"' : ''}${fg ? ` ss:Color="${fg}"` : ''}${size ? ` ss:Size="${size}"` : ''}/>
        ${bg ? `<Interior ss:Color="${bg}" ss:Pattern="Solid"/>` : ''}
      </Style>`;
    }).join('\n');

    const matchTitle = `Match ${match.match_number} - ${abbr(match.team_a)} vs ${abbr(match.team_b)}`;
    const matchDate = formatDate(match.match_date, match.match_time);

    const predRows = predictions.map((pred, idx) => {
      const pts = computePts(pred);
      const winnerOk = !!(ca && pred.predicted_winner === ca.winner);
      const batterOk = !!(ca && ca.batter_id && Number(pred.predicted_batter_id) === ca.batter_id);
      const bowlerOk = !!(ca && ca.bowler_id && Number(pred.predicted_bowler_id) === ca.bowler_id);
      const momOk = !!(ca && ca.mom_id && Number(pred.predicted_mom_id) === ca.mom_id);
      const perfect = winnerOk && batterOk && bowlerOk && momOk;
      const rowStyle = idx % 2 === 0 ? 'normal' : 'alt';
      const ptsLabel = pts === null ? '' : pts > 0 ? `+${pts}${pred.is_double_trouble ? ' 2x' : ''}` : String(pts);
      const ptsStyle = pts === null ? 'pts_null' : pts > 0 ? 'pts_pos' : 'pts_neg';
      return `<Row>
        ${numCell(idx + 1, rowStyle)}
        ${cell(pred.display_name + (perfect ? ' [Perfect!]' : ''), rowStyle)}
        ${cell(pred.predicted_winner ?? '', winnerOk ? 'correct' : rowStyle)}
        ${cell(pred.batterName ?? '', batterOk ? 'correct' : rowStyle)}
        ${cell(pred.bowlerName ?? '', bowlerOk ? 'correct' : rowStyle)}
        ${cell(pred.momName ?? '', momOk ? 'correct' : rowStyle)}
        ${cell(pred.is_double_trouble ? 'Yes (2x)' : '-', pred.is_double_trouble ? 'dt' : rowStyle)}
        ${cell(ptsLabel, ptsStyle)}
      </Row>`;
    }).join('');

    const missedRows = missedUsers.map((u, mi) => `<Row>
      ${numCell(predictions.length + mi + 1, 'missed')}
      ${cell(u.display_name, 'missed')}
      ${cell('MISSED', 'missed')}
      ${cell('-', 'missed')}
      ${cell('-', 'missed')}
      ${cell('-', 'missed')}
      ${cell('-', 'missed')}
      ${cell(ca ? `-${wPts}` : '-', 'pts_neg')}
    </Row>`).join('');

    const caRow = ca
      ? `<Row>${cell(`Correct: Winner=${ca.winner ?? '-'}`, 'subheader')}<Cell ss:MergeAcross="6"/></Row>`
      : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    ${styleBlock}
  </Styles>
  <Worksheet ss:Name="Predictions">
    <Table ss:DefaultColumnWidth="120">
      <Column ss:Width="40"/>
      <Column ss:Width="150"/>
      <Column ss:Width="130"/>
      <Column ss:Width="140"/>
      <Column ss:Width="140"/>
      <Column ss:Width="140"/>
      <Column ss:Width="70"/>
      <Column ss:Width="70"/>
      <Row ss:Height="32">
        ${cell(matchTitle, 'header')}<Cell ss:MergeAcross="6"/>
      </Row>
      <Row>
        ${cell(`${matchDate}  |  ${predictions.length} predictions`, 'subheader')}<Cell ss:MergeAcross="6"/>
      </Row>
      <Row/>
      ${caRow}
      <Row>
        ${cell('#', 'colHead')}
        ${cell('Name', 'colHead')}
        ${cell('Winner', 'colHead')}
        ${cell('Batter', 'colHead')}
        ${cell('Bowler', 'colHead')}
        ${cell('MOM', 'colHead')}
        ${cell('DT', 'colHead')}
        ${cell('Pts', 'colHead')}
      </Row>
      ${predRows}
      ${missedUsers.length > 0 ? `<Row><Cell ss:MergeAcross="7"/></Row>
      <Row>${cell(`MISSED (${missedUsers.length})${ca ? ` — -${wPts} pts each` : ''}`, 'missedHead')}<Cell ss:MergeAcross="6"/></Row>
      ${missedRows}` : ''}
    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Match_${match.match_number}_${abbr(match.team_a)}_vs_${abbr(match.team_b)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Points calculator ────────────────────────────────────────────────────
  const getCorrectAnswer = (matchId: string | number): CorrectAnswer | null =>
    correctAnswers.find((ca) => Number(ca.match_id) === Number(matchId)) || null;

  const stagePoints = (matchNumber: number) => {
    if (matchNumber <= 35) return { winner: 50, player: 60 };
    if (matchNumber <= 70) return { winner: 70, player: 80 };
    return { winner: 90, player: 100 };
  };

  const calcPoints = (pred: EnrichedPrediction, ca: CorrectAnswer | null, matchNumber: number): number | null => {
    if (!ca) return null;
    if (ca.is_washout) return 0;  // washout: 0 pts for all; DT is consumed but no penalty
    const { winner: wPts, player: pPts } = stagePoints(matchNumber);
    const wCorrect = !!ca.winner && pred.predicted_winner === ca.winner;
    const bCorrect = !!ca.batter_id && Number(pred.predicted_batter_id) === ca.batter_id;
    const bowCorrect = !!ca.bowler_id && Number(pred.predicted_bowler_id) === ca.bowler_id;
    const mCorrect = !!ca.mom_id && Number(pred.predicted_mom_id) === ca.mom_id;
    const allCorrect = wCorrect && bCorrect && bowCorrect && mCorrect;

    const basePts =
      (wCorrect ? wPts : 0) +
      (bCorrect ? pPts : 0) +
      (bowCorrect ? pPts : 0) +
      (mCorrect ? pPts : 0);

    let pts: number;
    if (pred.is_double_trouble) {
      // DT: all earned pts ×2; wrong winner → penalty of -winner_pts×2
      pts = basePts * 2 - (!wCorrect ? wPts * 2 : 0);
    } else {
      // Non-DT: wrong winner → subtract winner_pts as penalty
      pts = basePts - (!wCorrect ? wPts : 0);
    }

    if (allCorrect) pts += 150;
    return pts;
  };

  const isFieldCorrect = (pred: EnrichedPrediction, ca: CorrectAnswer | null, field: 'winner' | 'batter' | 'bowler' | 'mom'): boolean => {
    if (!ca) return false;
    if (field === 'winner') return !!ca.winner && pred.predicted_winner === ca.winner;
    if (field === 'batter') return !!ca.batter_id && Number(pred.predicted_batter_id) === ca.batter_id;
    if (field === 'bowler') return !!ca.bowler_id && Number(pred.predicted_bowler_id) === ca.bowler_id;
    if (field === 'mom') return !!ca.mom_id && Number(pred.predicted_mom_id) === ca.mom_id;
    return false;
  };

  // ── Loading ──────────────────────────────────────────────────────────────────────────────────────
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

  // ── No locked matches ────────────────────────────────────────────────────────
  if (groups.length === 0) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f5f5f7' }}>
        <Navbar />
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Box sx={{ textAlign: 'center', py: 10, background: '#fff', borderRadius: '20px', border: '1px solid rgba(0,0,0,0.07)' }}>
            <LockIcon sx={{ fontSize: '2.5rem', color: 'rgba(0,0,0,0.12)', mb: 1.5 }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#000', mb: 0.5 }}>No locked matches yet</Typography>
            <Typography sx={{ fontSize: '0.84rem', color: 'rgba(0,0,0,0.4)' }}>Predictions appear here once a match starts.</Typography>
          </Box>
        </Container>
      </Box>
    );
  }

  // ── Results banner helpers (for latest match) ────────────────────────
  const latestGroup = groups[0]; // already sorted desc by match_number
  const latestCa = latestGroup ? getCorrectAnswer(latestGroup.match.id) : null;
  const myLatestPred = latestGroup?.predictions.find((p) => p.user_id === session?.user?.id) ?? null;

  const buildBannerData = () => {
    if (!latestCa || !myLatestPred || !latestGroup) return null;
    if (latestCa.is_washout) {
      return {
        total: 0, cats: [], isDT: myLatestPred.is_double_trouble, allOk: false, isWashout: true,
      };
    }
    const mn = latestGroup.match.match_number;
    const { winner: wPts, player: pPts } = stagePoints(mn);
    const wOk = !!latestCa.winner && myLatestPred.predicted_winner === latestCa.winner;
    const bOk = !!latestCa.batter_id && Number(myLatestPred.predicted_batter_id) === latestCa.batter_id;
    const bowOk = !!latestCa.bowler_id && Number(myLatestPred.predicted_bowler_id) === latestCa.bowler_id;
    const mOk = !!latestCa.mom_id && Number(myLatestPred.predicted_mom_id) === latestCa.mom_id;
    const allOk = wOk && bOk && bowOk && mOk;
    const isDT = myLatestPred.is_double_trouble;
    const base = (wOk ? wPts : 0) + (bOk ? pPts : 0) + (bowOk ? pPts : 0) + (mOk ? pPts : 0);
    let total = isDT
      ? base * 2 - (!wOk ? wPts * 2 : 0)
      : base - (!wOk ? wPts : 0);
    if (allOk) total += 150;
    // Penalty amount shown in banner chips
    const wPenalty = !wOk ? (isDT ? wPts * 2 : wPts) : 0;
    return {
      total,
      cats: [
        { label: 'Winner', ok: wOk, pts: wOk ? (isDT ? wPts * 2 : wPts) : -wPenalty, penalty: wPenalty },
        { label: 'Batter', ok: bOk, pts: bOk ? (isDT ? pPts * 2 : pPts) : 0 },
        { label: 'Bowler', ok: bowOk, pts: bowOk ? (isDT ? pPts * 2 : pPts) : 0 },
        { label: 'MOM', ok: mOk, pts: mOk ? (isDT ? pPts * 2 : pPts) : 0 },
      ],
      isDT,
      allOk,
      isWashout: false,
    };
  };
  const bannerData = buildBannerData();

  // ── Derived stats for scorecard strip, timeline, streak ──────────────────
  const myPredsByMatch = groups.map((g) => ({
    match: g.match,
    pred: g.predictions.find((p) => p.user_id === session?.user?.id) ?? null,
    ca: getCorrectAnswer(g.match.id),
  }));

  const streakInfo = (() => {
    let streak = 0;
    let type: 'win' | 'loss' | null = null;
    for (const { pred, ca } of myPredsByMatch) {
      if (!pred || !ca) break;
      const wOk = isFieldCorrect(pred, ca, 'winner');
      if (type === null) { type = wOk ? 'win' : 'loss'; streak = 1; }
      else if ((type === 'win') === wOk) streak++;
      else break;
    }
    return { streak, type };
  })();

  const timelineData = [...myPredsByMatch]
    .reverse()
    .filter(({ pred, ca }) => pred !== null && ca !== null)
    .map(({ match, pred, ca }) => ({
      matchNum: match.match_number,
      pts: calcPoints(pred!, ca!, match.match_number) ?? 0,
    }));

  return (
    <Box sx={{ minHeight: '100vh', background: '#f5f5f7', pb: 6 }}>
      <Navbar />

      {/* ── Black header ── */}
      <Box sx={{ background: '#000', pt: 2.5, pb: 3, px: 2, position: 'relative', overflow: 'hidden',
        '&::after': { content: '""', position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)', pointerEvents: 'none' },
      }}>
        <Container maxWidth="md" disableGutters sx={{ px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box onClick={() => navigate(-1)} sx={{ width: 32, height: 32, borderRadius: '10px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', '&:hover': { background: 'rgba(255,255,255,0.18)' } }}>
              <ArrowBackIcon sx={{ fontSize: '1rem', color: '#fff' }} />
            </Box>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Community Predictions
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', color: '#fff', lineHeight: 1.15 }}>Predictions</Typography>
            </Box>
            <Box sx={{ background: 'rgba(255,255,255,0.1)', borderRadius: '14px', px: 1.5, py: 0.75, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#fff', lineHeight: 1 }}>{groups.length}</Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Matches</Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ── Points Timeline ── */}
      {timelineData.length > 1 && (() => {
        // Latest match first
        const reversed = [...timelineData].reverse();
        const maxAbs = Math.max(...reversed.map((d) => Math.abs(d.pts)), 1);
        const totalPts = reversed.reduce((s, d) => s + d.pts, 0);
        const wins = reversed.filter((d) => d.pts > 0).length;
        return (
          <Box sx={{
            background: 'linear-gradient(160deg, #0d0d12 0%, #131320 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            px: 2, pt: 1.8, pb: 2,
          }}>
            <Container maxWidth="md" disableGutters>
              {/* Header row */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 3, height: 14, borderRadius: '2px', background: 'linear-gradient(180deg, #a78bfa, #6366f1)' }} />
                  <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    Form · Last {reversed.length} Matches
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ px: 1, py: 0.25, borderRadius: '6px', background: wins > reversed.length / 2 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${wins > reversed.length / 2 ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}` }}>
                    <Typography sx={{ fontSize: '0.52rem', fontWeight: 800, color: wins > reversed.length / 2 ? '#4ade80' : '#f87171', letterSpacing: '0.04em' }}>
                      {wins}W · {reversed.length - wins}L
                    </Typography>
                  </Box>
                  <Box sx={{ px: 1, py: 0.25, borderRadius: '6px', background: totalPts >= 0 ? 'rgba(99,102,241,0.15)' : 'rgba(248,113,113,0.1)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, color: totalPts >= 0 ? '#a78bfa' : '#f87171' }}>
                      {totalPts > 0 ? `+${totalPts}` : totalPts} pts
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Bar chart */}
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: 72, position: 'relative' }}>
                {reversed.map(({ matchNum, pts }, i) => {
                  const isLatest = i === 0;
                  const barH = Math.max(6, Math.round((Math.abs(pts) / maxAbs) * 52));
                  const isPos = pts > 0;
                  const isZero = pts === 0;
                  const barColor = isZero ? 'rgba(255,255,255,0.1)' : isPos ? '#1db954' : '#e8334a';
                  const glowColor = isPos ? 'rgba(29,185,84,0.5)' : 'rgba(232,51,74,0.5)';
                  return (
                    <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', position: 'relative' }}>
                      {/* Pts label */}
                      <Typography sx={{
                        fontSize: isLatest ? '0.52rem' : '0.44rem',
                        fontWeight: 900,
                        color: isZero ? 'rgba(255,255,255,0.2)' : isPos ? '#4edd80' : '#ff6b7a',
                        lineHeight: 1,
                        letterSpacing: '-0.01em',
                      }}>
                        {pts > 0 ? `+${pts}` : pts === 0 ? '·' : pts}
                      </Typography>

                      {/* Bar */}
                      <Box sx={{
                        width: '100%',
                        height: `${barH}px`,
                        borderRadius: '5px 5px 2px 2px',
                        background: barColor,
                        boxShadow: isLatest && !isZero ? `0 0 10px ${glowColor}, 0 0 20px ${glowColor}` : 'none',
                        border: isLatest ? `1px solid ${isPos ? 'rgba(29,185,84,0.7)' : 'rgba(232,51,74,0.7)'}` : '1px solid transparent',
                        transition: 'height 0.5s cubic-bezier(0.34,1.56,0.64,1)',
                        position: 'relative',
                        overflow: 'hidden',
                        '&::after': isLatest ? {
                          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
                          borderRadius: '5px 5px 0 0',
                        } : {},
                      }} />

                      {/* Match label */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                        {isLatest && (
                          <Box sx={{ px: 0.6, py: 0.15, borderRadius: '4px', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', mb: '1px' }}>
                            <Typography sx={{ fontSize: '0.34rem', fontWeight: 900, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1 }}>NEW</Typography>
                          </Box>
                        )}
                        <Typography sx={{
                          fontSize: '0.42rem',
                          fontWeight: isLatest ? 900 : 600,
                          color: `${isLatest ? '#ffffff' : 'rgba(255,255,255,0.55)'} !important`,
                          lineHeight: 1,
                        }}>
                          M{matchNum}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Container>
          </Box>
        );
      })()}

      {/* ── Results Banner for latest match ── */}
      {bannerData && latestGroup && (() => {
        const { total, cats, isDT, allOk, isWashout } = bannerData;
        const positive = total > 0;
        const metaA = getTeamMeta(latestGroup.match.team_a);
        const metaB = getTeamMeta(latestGroup.match.team_b);
        const ptColor = isWashout ? '#94a3b8' : positive ? '#4ade80' : total < 0 ? '#f87171' : '#fbbf24';
        return (
          <Box sx={{
            background: isWashout
              ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
              : positive
              ? 'linear-gradient(135deg, #052e16 0%, #14532d 100%)'
              : total < 0
              ? 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)'
              : 'linear-gradient(135deg, #1c1400 0%, #451a03 100%)',
            px: 2, py: 2,
          }}>
            <Container maxWidth="md" disableGutters>
              {/* Row: logo · label+pts · logo */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
                {/* Team A logo */}
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: metaA.color, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '4px', flexShrink: 0 }}>
                  {metaA.logo && <img src={metaA.logo} alt={latestGroup.match.team_a} style={{ width: 32, height: 32, objectFit: 'contain' }} />}
                </Box>
                {/* Centre: label + points */}
                <Box sx={{ flex: 1, textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', mb: 0.25 }}>
                    Match {latestGroup.match.match_number} · Your Result
                  </Typography>
                  {isWashout ? (
                    <>
                      <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', lineHeight: 1.1, color: '#94a3b8', letterSpacing: '-0.01em' }}>🌧 Washout</Typography>
                      <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', mt: 0.25 }}>Match abandoned · 0 pts · DT consumed if used</Typography>
                    </>
                  ) : (
                    <>
                      <Typography sx={{ fontWeight: 900, fontSize: '2.4rem', lineHeight: 1, color: ptColor, letterSpacing: '-0.02em' }}>
                        {total > 0 ? `+${total}` : total}
                      </Typography>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>pts</Typography>
                    </>
                  )}
                </Box>
                {/* Team B logo */}
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', background: metaB.color, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '4px', flexShrink: 0 }}>
                  {metaB.logo && <img src={metaB.logo} alt={latestGroup.match.team_b} style={{ width: 32, height: 32, objectFit: 'contain' }} />}
                </Box>
              </Box>
              {/* Category chips */}
              {!isWashout && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                  {cats.map(({ label, ok, pts, penalty }) => (
                    <Box key={label} sx={{
                      px: 1, py: 0.35, borderRadius: '8px',
                      background: ok ? 'rgba(74,222,128,0.15)' : penalty ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${ok ? 'rgba(74,222,128,0.3)' : penalty ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: ok ? '#4ade80' : penalty ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
                        {ok ? `✓ ${label} +${Math.abs(pts)}` : penalty ? `✗ ${label} −${penalty}` : `– ${label}`}
                      </Typography>
                    </Box>
                  ))}
                  {isDT && (
                    <Box sx={{ px: 1, py: 0.35, borderRadius: '8px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#fbbf24' }}>⚡ 2× DT</Typography>
                    </Box>
                  )}
                  {allOk && (
                    <Box sx={{ px: 1, py: 0.35, borderRadius: '8px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)' }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#a78bfa' }}>🏆 Perfect +150</Typography>
                    </Box>
                  )}
                </Box>
              )}
              {isWashout && isDT && (
                <Box sx={{ display: 'flex', gap: 0.6 }}>
                  <Box sx={{ px: 1, py: 0.35, borderRadius: '8px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#fbbf24' }}>⚡ DT consumed · not returned</Typography>
                  </Box>
                </Box>
              )}
            </Container>
          </Box>
        );
      })()}

      {/* ── Match blocks ── */}
      <Container maxWidth="md" sx={{ py: 3, px: { xs: 1.5, sm: 3 } }}>
        {groups.map((group) => {
          const { match, predictions } = group;
          const isExpanded = expandedMatch === match.id;
          const metaA = getTeamMeta(match.team_a);
          const metaB = getTeamMeta(match.team_b);
          const colorA = metaA.color;
          const colorB = metaB.color;

          return (
            <Box key={match.id} sx={{ mb: 3 }}>

              {/* Accordion header */}
              <Box
                onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                sx={{
                  background: '#000', borderRadius: isExpanded ? '18px 18px 0 0' : '18px',
                  px: 2, py: 1.75, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-radius 0.2s ease',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '9px', background: colorA, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.12)', p: '4px', flexShrink: 0 }}>
                    {metaA.logo
                      ? <img src={metaA.logo} alt={match.team_a} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                      : <Typography sx={{ fontWeight: 900, fontSize: '0.6rem', color: '#fff' }}>{abbr(match.team_a)}</Typography>}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>
                      {abbr(match.team_a)} vs {abbr(match.team_b)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                      Match {match.match_number} · {formatDate(match.match_date, match.match_time)}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 32, height: 32, borderRadius: '9px', background: colorB, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.12)', p: '4px', flexShrink: 0 }}>
                    {metaB.logo
                      ? <img src={metaB.logo} alt={match.team_b} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                      : <Typography sx={{ fontWeight: 900, fontSize: '0.6rem', color: '#fff' }}>{abbr(match.team_b)}</Typography>}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ display: { xs: 'none', sm: 'block' }, background: 'rgba(255,255,255,0.1)', borderRadius: '8px', px: 1, py: 0.4 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
                      {predictions.length} picks
                    </Typography>
                  </Box>
                  <Box
                    onClick={(e) => { e.stopPropagation(); downloadMatchReport(group); }}
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.4, background: '#ffffff', borderRadius: '8px', px: 1.2, py: 0.5, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.18)', '&:hover': { background: '#f0f4ff' } }}
                  >
                    <Typography sx={{ fontSize: '0.65rem', lineHeight: 1, color: '#1e3a5f' }}>⬇</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.62rem', color: '#1e3a5f' }}>Download</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', display: 'inline-block', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</Typography>
                </Box>
              </Box>

              {/* Table */}
              {isExpanded && (
                <Box sx={{ background: '#fff', borderRadius: '0 0 18px 18px', border: '1px solid rgba(0,0,0,0.08)', borderTop: 'none', overflow: 'hidden' }}>
                  {predictions.length === 0 ? (
                    <Box sx={{ py: 5, textAlign: 'center' }}>
                      <EmojiEventsIcon sx={{ fontSize: '2rem', color: 'rgba(0,0,0,0.1)', mb: 1 }} />
                      <Typography sx={{ fontSize: '0.84rem', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>No predictions for this match yet</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <Th>Player</Th>
                            <Th sticky>Name</Th>
                            <Th>Winner</Th>
                            <Th>Batter</Th>
                            <Th>Bowler</Th>
                            <Th>MOM</Th>
                            <Th align="center">DT</Th>
                            <Th align="center">PM</Th>
                            <Th align="center">Pts</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* ─── Top Picks row ─── */}
                          {(() => {
                            const total = predictions.length;
                            if (total === 0) return null;

                            const winnerCounts: Record<string, number> = {};
                            predictions.forEach((p) => { if (p.predicted_winner) winnerCounts[p.predicted_winner] = (winnerCounts[p.predicted_winner] ?? 0) + 1; });
                            const topWinner = Object.entries(winnerCounts).sort((a, b) => b[1] - a[1])[0];

                            const batterCounts: Record<string, number> = {};
                            predictions.forEach((p) => { if (p.batterName) batterCounts[p.batterName] = (batterCounts[p.batterName] ?? 0) + 1; });
                            const topBatter = Object.entries(batterCounts).sort((a, b) => b[1] - a[1])[0];

                            const bowlerCounts: Record<string, number> = {};
                            predictions.forEach((p) => { if (p.bowlerName) bowlerCounts[p.bowlerName] = (bowlerCounts[p.bowlerName] ?? 0) + 1; });
                            const topBowler = Object.entries(bowlerCounts).sort((a, b) => b[1] - a[1])[0];

                            const momCounts: Record<string, number> = {};
                            predictions.forEach((p) => { if (p.momName) momCounts[p.momName] = (momCounts[p.momName] ?? 0) + 1; });
                            const topMom = Object.entries(momCounts).sort((a, b) => b[1] - a[1])[0];

                            const ca = getCorrectAnswer(match.id);

                            const pct = (count: number) => Math.round((count / total) * 100);

                            // Check correctness per field
                            const wCorrect = ca && topWinner && ca.winner === topWinner[0];
                            const bCorrect = ca && topBatter && predictions.some((p) => p.batterName === topBatter[0] && ca.batter_id && Number(p.predicted_batter_id) === ca.batter_id);
                            const bowCorrect = ca && topBowler && predictions.some((p) => p.bowlerName === topBowler[0] && ca.bowler_id && Number(p.predicted_bowler_id) === ca.bowler_id);
                            const mCorrect = ca && topMom && predictions.some((p) => p.momName === topMom[0] && ca.mom_id && Number(p.predicted_mom_id) === ca.mom_id);

                            const PickCell = ({ name, count, isWinner = false, correct = false }: { name: string; count: number; isWinner?: boolean; correct?: boolean }) => {
                              const p = pct(count);
                              const meta = isWinner ? getTeamMeta(name) : null;
                              return (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {isWinner && meta && (
                                      <Box sx={{ width: 16, height: 16, borderRadius: '4px', background: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '2px', flexShrink: 0 }}>
                                        {meta.logo && <img src={meta.logo} alt={name} style={{ width: 12, height: 12, objectFit: 'contain' }} />}
                                      </Box>
                                    )}
                                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: correct ? '#15803d' : '#1e3a5f', whiteSpace: 'nowrap' }}>
                                      {isWinner ? abbr(name) : name}{correct ? ' ✓' : ''}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Box sx={{ flex: 1, height: 3, borderRadius: '2px', background: 'rgba(59,130,246,0.15)', overflow: 'hidden', minWidth: 32 }}>
                                      <Box sx={{ height: '100%', borderRadius: '2px', width: `${p}%`, background: correct ? '#16a34a' : '#3b82f6', transition: 'width 0.4s ease' }} />
                                    </Box>
                                    <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: correct ? '#15803d' : '#374151', whiteSpace: 'nowrap' }}>{p}%</Typography>
                                  </Box>
                                </Box>
                              );
                            };

                            return (
                              <>
                                {/* Label row */}
                                {/* Data row */}
                                <tr style={{ borderBottom: '2px solid rgba(59,130,246,0.12)' }}>
                                  {/* # placeholder */}
                                  <td style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.04)', verticalAlign: 'middle' }}>
                                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(59,130,246,0.5)' }}>📊</Typography>
                                  </td>
                                  {/* Name — sticky */}
                                  <td style={{ padding: '8px 14px', background: 'rgba(219,234,254,1)', position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 4px rgba(0,0,0,0.06)', verticalAlign: 'middle' }}>
                                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 900, color: '#1e40af', whiteSpace: 'nowrap' }}>Top Pick</Typography>
                                  </td>
                                  {/* Winner */}
                                  <td style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.04)', verticalAlign: 'middle' }}>
                                    {topWinner ? <PickCell name={topWinner[0]} count={topWinner[1]} isWinner correct={!!wCorrect} /> : <Typography sx={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.2)' }}>—</Typography>}
                                  </td>
                                  {/* Batter */}
                                  <td style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.04)', verticalAlign: 'middle' }}>
                                    {topBatter ? <PickCell name={topBatter[0]} count={topBatter[1]} correct={!!bCorrect} /> : <Typography sx={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.2)' }}>—</Typography>}
                                  </td>
                                  {/* Bowler */}
                                  <td style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.04)', verticalAlign: 'middle' }}>
                                    {topBowler ? <PickCell name={topBowler[0]} count={topBowler[1]} correct={!!bowCorrect} /> : <Typography sx={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.2)' }}>—</Typography>}
                                  </td>
                                  {/* MOM */}
                                  <td style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.04)', verticalAlign: 'middle' }}>
                                    {topMom ? <PickCell name={topMom[0]} count={topMom[1]} correct={!!mCorrect} /> : <Typography sx={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.2)' }}>—</Typography>}
                                  </td>
                                  {/* DT / PM / Pts — empty */}
                                  {[0,1,2].map((i) => (
                                    <td key={i} style={{ padding: '8px 14px', background: 'rgba(59,130,246,0.04)', textAlign: 'center', verticalAlign: 'middle' }}>
                                      <Typography sx={{ fontSize: '0.7rem', color: 'rgba(59,130,246,0.2)' }}>—</Typography>
                                    </td>
                                  ))}
                                </tr>
                                {/* Divider before user rows */}
                                <tr>
                                  <td colSpan={9} style={{ padding: '5px 14px 3px', background: '#f8f8f8', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                    <Typography sx={{ fontSize: '0.55rem', fontWeight: 900, color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                      Predictions
                                    </Typography>
                                  </td>
                                </tr>
                                {/* Correct Answer row — shown only when graded */}
                                {ca && (() => {
                                  const caWinner = ca.winner ?? null;
                                  const caBatter = ca.batter_id ? (playerNameMap[ca.batter_id] ?? null) : null;
                                  const caBowler = ca.bowler_id ? (playerNameMap[ca.bowler_id] ?? null) : null;
                                  const caMom = ca.mom_id ? (playerNameMap[ca.mom_id] ?? null) : null;
                                  const caWinnerMeta = caWinner ? getTeamMeta(caWinner) : null;
                                  const CaCell = ({ val, isWinner = false }: { val: string | null; isWinner?: boolean }) => (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      {isWinner && caWinnerMeta && (
                                        <Box sx={{ width: 16, height: 16, borderRadius: '4px', background: caWinnerMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '2px', flexShrink: 0 }}>
                                          {caWinnerMeta.logo && <img src={caWinnerMeta.logo} alt={val!} style={{ width: 12, height: 12, objectFit: 'contain' }} />}
                                        </Box>
                                      )}
                                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: val ? '#15803d' : 'rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}>
                                        {val ? (isWinner ? abbr(val) : val) : '—'}
                                      </Typography>
                                    </Box>
                                  );
                                  return (
                                    <tr style={{ borderBottom: '2px solid rgba(22,163,74,0.2)', background: 'rgba(240,253,244,0.8)' }}>
                                      <td style={{ padding: '7px 0 7px 0', verticalAlign: 'middle', borderLeft: '3px solid #16a34a' }}>
                                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 900, color: '#16a34a', textAlign: 'center' }}>✓</Typography>
                                      </td>
                                      <td style={{ padding: '7px 14px', background: 'rgba(220,252,231,0.9)', position: 'sticky', left: 0, zIndex: 1, boxShadow: '2px 0 4px rgba(0,0,0,0.06)', verticalAlign: 'middle' }}>
                                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 900, color: '#15803d', whiteSpace: 'nowrap' }}>✅ Correct Ans</Typography>
                                      </td>
                                      <td style={{ padding: '7px 14px', verticalAlign: 'middle' }}><CaCell val={caWinner} isWinner /></td>
                                      <td style={{ padding: '7px 14px', verticalAlign: 'middle' }}><CaCell val={caBatter} /></td>
                                      <td style={{ padding: '7px 14px', verticalAlign: 'middle' }}><CaCell val={caBowler} /></td>
                                      <td style={{ padding: '7px 14px', verticalAlign: 'middle' }}><CaCell val={caMom} /></td>
                                      {[0,1,2].map((i) => <td key={i} style={{ padding: '7px 14px', textAlign: 'center', verticalAlign: 'middle' }}><Typography sx={{ fontSize: '0.7rem', color: 'rgba(22,163,74,0.3)' }}>—</Typography></td>)}
                                    </tr>
                                  );
                                })()}
                              </>
                            );
                          })()}
                          {/* ─── Predicted rows ─── */}
                          {[...predictions].sort((a, b) => {
                            const aMe = a.user_id === session?.user?.id ? -1 : 0;
                            const bMe = b.user_id === session?.user?.id ? -1 : 0;
                            return aMe - bMe;
                          }).map((pred, idx) => {
                            const isMe = pred.user_id === session?.user?.id;
                            const ca = getCorrectAnswer(match.id);
                            const pts = calcPoints(pred, ca, match.match_number);
                            const winnerCorrect = isFieldCorrect(pred, ca, 'winner');
                            const batterCorrect = isFieldCorrect(pred, ca, 'batter');
                            const bowlerCorrect = isFieldCorrect(pred, ca, 'bowler');
                            const momCorrect = isFieldCorrect(pred, ca, 'mom');
                            const isPerfectMatch = winnerCorrect && batterCorrect && bowlerCorrect && momCorrect;
                            // Row accent color based on grading
                            const accentColor = !ca ? 'transparent' : winnerCorrect ? '#16a34a' : '#dc2626';
                            const rowBg = isPerfectMatch ? 'rgba(167,139,250,0.06)' : undefined;
                            return (
                              <tr key={pred.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: rowBg }}>

                                {/* # */}
                                <td style={{ padding: '11px 0 11px 0', textAlign: 'left', verticalAlign: 'middle', background: rowBg ?? (ca && winnerCorrect ? 'rgba(240,253,244,0.5)' : ca ? 'rgba(254,242,242,0.4)' : '#fff'), borderLeft: `3px solid ${accentColor}` }}>
                                  <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'rgba(0,0,0,0.3)', textAlign: 'center' }}>{idx + 1}</Typography>
                                </td>

                                {/* Name — sticky */}
                                <Td highlight={isMe} sticky>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 90 }}>
                                    <Box>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#000', whiteSpace: 'nowrap' }}>
                                          {pred.display_name}
                                        </Typography>
                                        {isMe && (
                                          <Chip label="You" size="small" sx={{ height: 16, fontSize: '0.52rem', fontWeight: 800, background: '#000', color: '#fff', borderRadius: '4px', '& .MuiChip-label': { px: 0.6 } }} />
                                        )}
                                        {isMe && streakInfo.streak >= 2 && (
                                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.2, px: 0.55, py: 0.15, borderRadius: '5px', background: streakInfo.type === 'win' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)', border: `1px solid ${streakInfo.type === 'win' ? 'rgba(239,68,68,0.25)' : 'rgba(59,130,246,0.25)'}` }}>
                                            <Typography sx={{ fontSize: '0.48rem', lineHeight: 1 }}>{streakInfo.type === 'win' ? '🔥' : '❄️'}</Typography>
                                            <Typography sx={{ fontSize: '0.52rem', fontWeight: 900, color: streakInfo.type === 'win' ? '#dc2626' : '#2563eb', lineHeight: 1 }}>{streakInfo.streak}{streakInfo.type === 'win' ? 'W' : 'L'}</Typography>
                                          </Box>
                                        )}
                                      </Box>
                                    </Box>
                                  </Box>
                                </Td>

                                {/* Winner */}
                                <Td highlight={isMe} correct={winnerCorrect}>
                                  {pred.predicted_winner ? <WinnerCell team={pred.predicted_winner} /> : <EmptyCell />}
                                </Td>

                                {/* Batter */}
                                <Td highlight={isMe} correct={batterCorrect}>
                                  {pred.batterName ? <NameCell name={pred.batterName} /> : <EmptyCell />}
                                </Td>

                                {/* Bowler */}
                                <Td highlight={isMe} correct={bowlerCorrect}>
                                  {pred.bowlerName ? <NameCell name={pred.bowlerName} /> : <EmptyCell />}
                                </Td>

                                {/* MOM */}
                                <Td highlight={isMe} correct={momCorrect}>
                                  {pred.momName ? <NameCell name={pred.momName} /> : <EmptyCell />}
                                </Td>

                                {/* DT */}
                                <Td align="center" highlight={isMe}>
                                  {pred.is_double_trouble ? (
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.3, borderRadius: '6px', background: '#fef3c7', border: '1px solid #fde68a' }}>
                                      <BoltIcon sx={{ fontSize: '0.65rem', color: '#b45309' }} />
                                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#b45309' }}>2×</Typography>
                                    </Box>
                                  ) : (
                                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.18)', fontWeight: 600 }}>—</Typography>
                                  )}
                                </Td>

                                {/* PM — Perfect Match */}
                                <Td align="center" highlight={isMe}>
                                  {isPerfectMatch ? (
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.3, px: 0.7, py: 0.3, borderRadius: '6px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.45)' }}>
                                      <Typography sx={{ fontSize: '0.72rem', lineHeight: 1 }}>🏆</Typography>
                                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#6d28d9', lineHeight: 1 }}>+150</Typography>
                                    </Box>
                                  ) : (
                                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.18)', fontWeight: 600 }}>—</Typography>
                                  )}
                                </Td>

                                {/* Pts */}
                                <Td align="center" highlight={isMe} correct={pts !== null && pts > 0}>
                                  {pts !== null ? (
                                    <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: pts > 0 ? '#15803d' : pts < 0 ? '#dc2626' : 'rgba(0,0,0,0.35)' }}>
                                      {pts > 0 ? `+${pts}` : pts}
                                    </Typography>
                                  ) : (
                                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.18)', fontWeight: 600 }}>—</Typography>
                                  )}
                                </Td>
                              </tr>
                            );
                          })}

                          {/* ─── Missed rows ─── */}
                          {(() => {
                            const predictedUserIds = new Set(predictions.map((p) => p.user_id));
                            const missed = allUsers.filter((u) => !predictedUserIds.has(u.user_id));
                            const ca = getCorrectAnswer(match.id);
                            const penalty = stagePoints(match.match_number).winner;
                            if (missed.length === 0) return null;
                            return (
                              <>
                                <tr>
                                  <td colSpan={9} style={{ padding: '6px 14px 4px', background: '#fafafa', borderTop: '2px solid rgba(220,38,38,0.15)' }}>
                                    <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: 'rgba(220,38,38,0.55)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                      Missed ({missed.length}){ca ? ` · −${penalty} pts each` : ''}
                                    </Typography>
                                  </td>
                                </tr>
                                {missed.map((u, mi) => (
                                  <tr key={u.user_id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', background: 'rgba(220,38,38,0.025)' }}>
                                    {/* # */}
                                    <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                                      <Typography sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'rgba(220,38,38,0.4)' }}>{predictions.length + mi + 1}</Typography>
                                    </td>
                                    {/* Name — sticky */}
                                    <td style={{ padding: '9px 14px', verticalAlign: 'middle', position: 'sticky', left: 0, zIndex: 1, background: 'rgba(255,245,245,1)', boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 90 }}>
                                        <Box sx={{ width: 22, height: 22, borderRadius: '6px', background: 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                          <Typography sx={{ fontSize: '0.58rem', fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>
                                            {u.display_name.charAt(0).toUpperCase()}
                                          </Typography>
                                        </Box>
                                        <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'rgba(220,38,38,0.6)', whiteSpace: 'nowrap' }}>
                                          {u.display_name}
                                        </Typography>
                                      </Box>
                                    </td>
                                    {/* Empty cells for Winner/Batter/Bowler/MOM/DT/PM */}
                                    {[0,1,2,3,4,5].map((ci) => (
                                      <td key={ci} style={{ padding: '9px 14px', textAlign: 'center', verticalAlign: 'middle', background: 'rgba(255,245,245,0.7)' }}>
                                        <Typography sx={{ fontSize: '0.7rem', color: 'rgba(220,38,38,0.25)', fontWeight: 600 }}>—</Typography>
                                      </td>
                                    ))}
                                    {/* Pts — penalty */}
                                    <td style={{ padding: '9px 14px', textAlign: 'center', verticalAlign: 'middle', background: 'rgba(255,245,245,0.7)' }}>
                                      {ca ? (
                                        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#dc2626' }}>
                                          −{penalty}
                                        </Typography>
                                      ) : (
                                        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(220,38,38,0.3)', fontWeight: 600 }}>—</Typography>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </Box>
                  )}

                </Box>
              )}
            </Box>
          );
        })}
      </Container>
    </Box>
  );
};

export default MyPredictions;
