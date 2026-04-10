import { useEffect, useMemo, useState } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Navbar from '../../components/Navbar/Navbar';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getTeamMeta } from '../../utils/teamMeta';
import { getRandomDialogue } from '../../utils/loadingDialogues';

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

interface TodayMatchRow {
  id: number;
  match_date: string;
}

interface TodayPointsRow {
  user_id: string;
  match_id: number;
  points: number | null;
}

interface TodayTopUser {
  user_id: string;
  display_name: string;
  today_points: number;
}

interface TodayMatchResult {
  matchId: number;
  matchNumber: number;
  teamA: string;
  teamB: string;
  winner: string | null;
  loser: string | null;
  isWashout: boolean;
}

const getInitials = (name: string) =>
  name ? name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) : '?';

const nameFromEmail = (email?: string | null) => {
  if (!email) return null;
  const local = email.split('@')[0];
  const parts = local.replace(/[_.]+/g, ' ').split(/\s+/).filter(Boolean);
  const capitalized = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  return capitalized || null;
};
const MEDAL: Record<number, { icon: string; color: string; glow: string }> = {
  1: { icon: '🥇', color: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },
  2: { icon: '🥈', color: '#9ca3af', glow: 'rgba(156,163,175,0.25)' },
  3: { icon: '🥉', color: '#cd7f32', glow: 'rgba(205,127,50,0.25)' },
};

// ── Match commentary generator ──────────────────────────────────────────────
// Returns a short, funny, cricket-flavoured sentence about the day's result.
const getMatchCommentary = (results: TodayMatchResult[]): string => {
  if (results.length === 0) return '';

  // Each entry: keywords to match against loser name, plus joke lines.
  // {w} = winner name, {l} = loser name
  const teamJokes: Array<{ keys: string[]; lines: string[] }> = [
    {
      keys: ['kolkata', 'kkr'],
      lines: [
        '{w} walked into Eden Gardens and just… took it. KKR were guests at their own party 🏟️😶',
        "KKR's batting collapsed so fast, even their fans couldn't process it in time ⚡📉",
        "{w} made KKR look like they were playing their first ever game of cricket 🏏😬",
        "KKR bowled, batted, and still lost — {w} didn't even break a sweat 💅",
        'Eden Gardens went dead silent when {w} finished the job. The pigeons left too 🕊️',
      ],
    },
    {
      keys: ['chennai', 'csk'],
      lines: [
        "{w} silenced the yellow army today. Even Thala's whistle couldn't save them 🦁📢",
        'CSK tried the vintage comeback script — {w} had not read it ✂️📜',
        '{w} cooked CSK in their own yellow kitchen. The vada pav was cold by the end 🍛',
        'CSK played their hearts out, but {w} played better cricket. Simple as that 🏏',
        'Dhoni watched. {w} won. MS said nothing — his face said it all 😐🏆',
      ],
    },
    {
      keys: ['royal challengers', 'rcb', 'bangalore', 'bengaluru'],
      lines: [
        '{w} handed RCB a reality check. Bengaluru fans stress-refreshing the scorecard 😭📲',
        'RCB: "This is our year." {w}: "Absolutely not." 👋',
        'Another RCB heartbreak for the scrapbook — {w} added a fresh page 📖',
        "{w} did what RCB's batting couldn't — actually finish the job 🏏✅",
        'RCB brought the atmosphere, the jerseys, the fans. {w} brought the runs 🏆',
      ],
    },
    {
      keys: ['mumbai', 'mi'],
      lines: [
        '{w} visited Wankhede and left with all the points. MI left with nothing 🌊',
        "MI's famous second-half comeback? {w} shredded it in the first 10 overs ✋",
        "{w} reminded MI that past trophies don't actually bat for you 🏆➡️🗑️",
        'Mumbai went full throttle — in reverse — and {w} capitalized beautifully 🚗💨',
        '{w} proved MI fans right about one thing: it is not always their year 😅',
      ],
    },
    {
      keys: ['sunrisers', 'srh', 'hyderabad'],
      lines: [
        '{w} ran through SRH like a spicy Hyderabadi biryani — fast, fiery, no survivors 🌶️',
        "SRH forgot to inform their batting order there was a match today — {w} noticed 👀",
        "{w} torched SRH and we're definitely talking about the cricket 🔥",
        'SRH wore orange but batted in invisible ink. {w} read it perfectly 🍚',
        'SRH had the colours of fire. {w} had actual fire 🔥🏆',
      ],
    },
    {
      keys: ['rajasthan', 'rr', 'royals'],
      lines: [
        '{w} proved fairytales have plot twists — and RR got the bad ending 🏰👹',
        "RR's royal chase fell apart like a sandcastle at high tide ⛳🌊",
        'Rajasthan Royals today? More like Rajasthan Reluctant Participants 😂',
        '{w} had RR crying into their pink jerseys by the 15th over 💗😢',
        "RR batted like they were protecting a 400 target. They weren't. {w} cruised 🚀",
      ],
    },
    {
      keys: ['delhi', 'dc', 'capitals'],
      lines: [
        '{w} stormed the capital and DC had zero defence plan whatsoever 🏛️💥',
        'Delhi Capitals: great city, absolutely leaky batting order — {w} drove straight through 🚦',
        '{w} swept Delhi quicker than a Monday morning Uber clears the lanes 🚖',
        'DC showed up. {w} showed up AND played cricket. Big difference 🏏',
        "Delhi added 'lost to {w}' to the city's long list of things that didn't go to plan 🗿",
      ],
    },
    {
      keys: ['punjab', 'pbks', 'kings'],
      lines: [
        "{w} put Punjab Kings out of their misery before the powerplay ended 😮‍💨",
        '{w} said "Not today" and PBKS had no answer to that 🦁🚫',
        "Punjab couldn't buy a wicket, a boundary, or a win today. {w} took all three 🏏💸",
        '{w} chopped through PBKS like a Dhaba chef through Sunday prep 🍽️',
        "PBKS fans are still waiting for the year it all clicks. {w} made sure it's not today 😄",
      ],
    },
    {
      keys: ['gujarat', 'gt', 'titans'],
      lines: [
        '{w} grounded the Titans. Even the heavens shrugged at Gujarat today ⚡🏟️',
        'Gujarat Titans lost the plot — {w} wrote a much better one 📖',
        '{w} dismantled GT faster than assembling a flatpack shelf 🔧',
        'Titans? More like Titanics today. {w} was the iceberg 🚢🌊',
        'GT came in confident. They left quietly. {w} made sure of that 🤫',
      ],
    },
    {
      keys: ['lucknow', 'lsg', 'super giants', 'supergiants'],
      lines: [
        '{w} dominated LSG so thoroughly, Lucknow forgot it had a team in this tournament 🏟️😶',
        "LSG's 'Super Giants' nickname took some serious damage from {w} today 🦸‍♂️➡️🤡",
        '{w} treated the LSG game like a warm-up session. LSG did not enjoy that 💪',
        '{w} brought a full batting lineup and used every bit of it against LSG 🔫',
        'Lucknow Super Giants: super in name only today — {w} made that very clear ✍️',
      ],
    },
  ];

  const fallbackLines = (winner: string, loser: string) => [
    `${winner} absolutely dismantled ${loser} today. Zero contest, full domination 🏆`,
    `${loser} tried hard. ${winner} tried harder — and the scoreboard showed it 🏏`,
    `${winner} left ${loser} with nothing but a polite round of applause 👏`,
    `${loser} had their chances. ${winner} had more — and took every single one 💪`,
    `${winner} made it look easy against ${loser}. Textbook stuff 😎`,
  ];

  const washoutLines = (teamA: string, teamB: string) => [
    `${teamA} vs ${teamB} — rain played hero today. Duckworth-Lewis says hi 🌧️`,
    `Weather cancelled ${teamA} vs ${teamB}. At least someone's batting average stayed intact ☔`,
    `Even the clouds didn't fancy watching ${teamA} vs ${teamB} today 🌧️😅`,
    `${teamA} vs ${teamB} washed out. The only winner today was the groundsman 💧`,
  ];

  const noResultLines = (teamA: string, teamB: string) => [
    `${teamA} vs ${teamB} is live today — predictions in, fingers crossed! 🍿`,
    `${teamA} and ${teamB} are going head-to-head right now 🏏 Who ya got?`,
    `Today's clash: ${teamA} 🆚 ${teamB} — it's all on the line!`,
  ];

  const seeded = (arr: string[], seed: number) => arr[Math.abs(seed) % arr.length];

  const graded = results.filter(r => !r.isWashout && r.winner !== null);
  const washouts = results.filter(r => r.isWashout);
  const lines: string[] = [];

  if (graded.length > 0) {
    const r = graded[0];
    const winner = r.winner!;
    const loser = r.loser || (r.teamA.toLowerCase() === winner.toLowerCase() ? r.teamB : r.teamA);
    const loserLower = loser.toLowerCase();
    const matched = teamJokes.find(({ keys }) => keys.some(k => loserLower.includes(k)));
    const template = matched
      ? seeded(matched.lines, r.matchId)
      : seeded(fallbackLines(winner, loser), r.matchId);
    lines.push(template.replace(/\{w\}/g, winner).replace(/\{l\}/g, loser));
  } else if (washouts.length > 0) {
    const r = washouts[0];
    lines.push(seeded(washoutLines(r.teamA, r.teamB), r.matchId));
  } else {
    const r = results[0];
    lines.push(seeded(noResultLines(r.teamA, r.teamB), r.matchId));
  }

  return lines[0];
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
  const [topTodayUsers, setTopTodayUsers] = useState<TodayTopUser[]>([]);
  const [topTodayPoints, setTopTodayPoints] = useState<number | null>(null);
  const [todayMatchResults, setTodayMatchResults] = useState<TodayMatchResult[]>([]);
  const [celebrationState, setCelebrationState] = useState<'win' | 'loss' | 'washout' | 'missed' | null>(null);

  const getTodayDateKeys = () => {
    const now = new Date();
    const localKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const utcKey = now.toISOString().slice(0, 10);
    return Array.from(new Set([localKey, utcKey]));
  };

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
      let lbRows = (lbRes.data ?? []) as LeaderboardRow[];

      // Normalise display_name: prefer profiles, then derive from email, for any row with missing/email-like name
      const isEmailLike = (s?: string | null) => !!s && /\S+@\S+\.\S+/.test(s);
      const needsName = lbRows.filter(r => !r.display_name || isEmailLike(r.display_name));
      const missingIds = needsName.map(r => r.user_id);
      const profMap: Record<string, string> = {};
      if (missingIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', missingIds);
        for (const p of profs ?? []) if (p.display_name) profMap[p.id] = p.display_name;
      }
      lbRows = lbRows.map(r => ({
        ...r,
        display_name: (!r.display_name || isEmailLike(r.display_name))
          ? (profMap[r.user_id] || nameFromEmail(r.email) || r.user_id)
          : r.display_name,
      }));
      setRows(lbRows);

      const todayDateKeys = getTodayDateKeys();
      const { data: todayMatchesData } = await supabase
        .from('matches')
        .select('id, match_date')
        .in('match_date', todayDateKeys);

      const todayMatchIds = ((todayMatchesData ?? []) as TodayMatchRow[])
        .map((m) => Number(m.id))
        .filter((id) => Number.isFinite(id));

      if (todayMatchIds.length > 0) {
        // Fetch match team names + winner info for today's matches
        const [todayMatchInfoRes, todayCARes] = await Promise.all([
          supabase.from('matches').select('id, match_number, team_a, team_b').in('id', todayMatchIds),
          supabase.from('correct_answers').select('match_id, winner, is_washout').in('match_id', todayMatchIds),
        ]);
        const matchInfoMap = new Map<number, { match_number: number; team_a: string; team_b: string }>();
        for (const m of todayMatchInfoRes.data ?? []) matchInfoMap.set(Number(m.id), { match_number: m.match_number ?? 0, team_a: m.team_a ?? '', team_b: m.team_b ?? '' });
        const caMap = new Map<number, { winner: string | null; is_washout: boolean }>();
        for (const ca of todayCARes.data ?? []) caMap.set(Number(ca.match_id), { winner: ca.winner ?? null, is_washout: !!ca.is_washout });

        const results: TodayMatchResult[] = todayMatchIds.map((mid) => {
          const info = matchInfoMap.get(mid);
          const ca = caMap.get(mid);
          const winner = ca?.winner ?? null;
          const isWashout = ca?.is_washout ?? false;
          const loser = winner && info ? (info.team_a.toLowerCase() === winner.toLowerCase() ? info.team_b : info.team_a) : null;
          return {
            matchId: mid,
            matchNumber: info?.match_number ?? 0,
            teamA: info?.team_a ?? '',
            teamB: info?.team_b ?? '',
            winner,
            loser,
            isWashout,
          };
        }).filter(r => r.teamA || r.teamB);
        setTodayMatchResults(results);

        // ── Determine celebration state based on user's latest today-match prediction ──
        // Find the latest graded today's match (highest match_number that has a CA entry)
        const currentUserId = session?.user?.id;
        const gradedTodayMatchIds = todayMatchIds.filter(mid => caMap.has(mid));
        if (currentUserId && gradedTodayMatchIds.length > 0) {
          // Sort by match_number descending to get the latest
          const latestMatchId = gradedTodayMatchIds.sort((a, b) => {
            const aNum = matchInfoMap.get(a)?.match_number ?? 0;
            const bNum = matchInfoMap.get(b)?.match_number ?? 0;
            return bNum - aNum;
          })[0];

          const latestCA = caMap.get(latestMatchId);
          // Fetch user's prediction for the latest match
          const { data: userPredData } = await supabase
            .from('predictions')
            .select('predicted_winner')
            .eq('user_id', currentUserId)
            .eq('match_id', latestMatchId)
            .maybeSingle();

          let newCelebration: 'win' | 'loss' | 'washout' | 'missed' | null = null;
          let celebDuration = 7500;

          if (latestCA?.is_washout) {
            // Washout match — show rain regardless of prediction
            newCelebration = 'washout';
            celebDuration = 7000;
          } else if (!userPredData) {
            // User didn't submit a prediction
            newCelebration = 'missed';
            celebDuration = 7000;
          } else if (latestCA?.winner && userPredData.predicted_winner) {
            // Compare predicted_winner to actual winner (case-insensitive)
            const predicted = (userPredData.predicted_winner ?? '').toLowerCase().trim();
            const actual = (latestCA.winner ?? '').toLowerCase().trim();
            newCelebration = predicted === actual ? 'win' : 'loss';
            celebDuration = newCelebration === 'win' ? 7500 : 7000;
          }

          if (newCelebration) {
            setCelebrationState(newCelebration);
            setTimeout(() => setCelebrationState(null), celebDuration);
          }
        }

        const { data: todayPtsData } = await supabase
          .from('predictions_with_points')
          .select('user_id, match_id, points')
          .in('match_id', todayMatchIds)
          .not('points', 'is', null);

        const todayRows = (todayPtsData ?? []) as TodayPointsRow[];
        const uniqueScoredMatchIds = new Set<number>();
        const pointsByUser = new Map<string, number>();

        todayRows.forEach((row) => {
          if (row.points === null) return;
          uniqueScoredMatchIds.add(Number(row.match_id));
          pointsByUser.set(row.user_id, (pointsByUser.get(row.user_id) ?? 0) + Number(row.points));
        });

        if (pointsByUser.size > 0) {
          const maxPoints = Math.max(...Array.from(pointsByUser.values()));
          const nameMap = new Map(lbRows.map((r) => [r.user_id, r.display_name]));

          const toppers: TodayTopUser[] = Array.from(pointsByUser.entries())
            .filter(([, points]) => points === maxPoints)
            .map(([userId, points]) => ({
              user_id: userId,
              display_name: nameMap.get(userId) ?? userId,
              today_points: points,
            }))
            .sort((a, b) => a.display_name.localeCompare(b.display_name));

          setTopTodayPoints(maxPoints);
          setTopTodayUsers(toppers);
        } else {
          setTopTodayPoints(null);
          setTopTodayUsers([]);
        }
      } else {
        setTopTodayPoints(null);
        setTopTodayUsers([]);
        setTodayMatchResults([]);
      }

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
            const p = userPredMap.get(ca.match_id);
            if (!p) {
              // Missed a washout match → still gets penalty
              missedMatchIds.add(ca.match_id);
              missedPenalty += stagePoints(ca.match_number ?? 0);
            } else if (p.is_double_trouble) {
              // DT was used on a washout — counts as consumed
              dtCount++;
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
  }, [session?.user?.id]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aDisplay = a.total_points + (statsMap[a.user_id]?.fiferCount ?? 0) * 100 - (statsMap[a.user_id]?.missedPenalty ?? 0);
      const bDisplay = b.total_points + (statsMap[b.user_id]?.fiferCount ?? 0) * 100 - (statsMap[b.user_id]?.missedPenalty ?? 0);
      return bDisplay - aDisplay;
    });
  }, [rows, statsMap]);

  // Competition ranking: same effective points → same rank; next rank skips (1,1,3,4,4,6…)
  const rankMap = useMemo(() => {
    const map: Record<string, number> = {};
    let rank = 1;
    for (let i = 0; i < sorted.length; i++) {
      const effectivePoints = (pts: typeof sorted[0]) =>
        pts.total_points + (statsMap[pts.user_id]?.fiferCount ?? 0) * 100 - (statsMap[pts.user_id]?.missedPenalty ?? 0);
      if (i === 0) {
        map[sorted[i].user_id] = 1;
      } else {
        if (effectivePoints(sorted[i]) === effectivePoints(sorted[i - 1])) {
          map[sorted[i].user_id] = map[sorted[i - 1].user_id];
        } else {
          rank = i + 1;
          map[sorted[i].user_id] = rank;
        }
      }
    }
    return map;
  }, [sorted, statsMap]);

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
  const myRank = myRow ? (rankMap[myRow.user_id] ?? null) : null;
  const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);

  // ── Celebration particles ─────────────────────────────────────────────────
  // Lazy useState initialisers — Math.random() runs once on mount, ESLint-safe.
  type Particle = { id: number; left: number; animDelay: number; animDur: number; size: number; color: string; rotate: number; drift: number; shape: string };

  // 🎉 WIN — vibrant multicolour confetti
  const [winParticles] = useState<Particle[]>(() => {
    const c = ['#f59e0b','#a855f7','#22d3ee','#f43f5e','#4ade80','#fbbf24','#818cf8','#fb7185','#34d399','#f97316'];
    return Array.from({ length: 80 }, (_, i) => ({
      id: i, left: Math.random() * 100, animDelay: Math.random() * 1.8,
      animDur: 2.4 + Math.random() * 2.0, size: 8 + Math.random() * 12,
      color: c[i % c.length], rotate: Math.random() * 360,
      drift: (Math.random() - 0.5) * 160, shape: ['🎊','🎉','⭐','✨','🏆','🌟','💥','🎯'][i % 8],
    }));
  });

  // 😔 LOSS — red particles
  const [lossParticles] = useState<Particle[]>(() => {
    const c = ['#ef4444','#dc2626','#fca5a5','#b91c1c','#f87171'];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i, left: Math.random() * 100, animDelay: Math.random() * 1.4,
      animDur: 1.8 + Math.random() * 1.4, size: 14 + Math.random() * 10,
      color: c[i % c.length], rotate: Math.random() * 180,
      drift: (Math.random() - 0.5) * 80, shape: ['💔','😭','💔','😢','🥺','💔','😔','😩','💔','😿'][i % 10],
    }));
  });

  // 🌧️ WASHOUT — blue-grey rain drops
  const [washoutParticles] = useState<Particle[]>(() => {
    const c = ['#60a5fa','#93c5fd','#bfdbfe','#3b82f6','#a5b4fc','#7dd3fc'];
    return Array.from({ length: 55 }, (_, i) => ({
      id: i, left: Math.random() * 100, animDelay: Math.random() * 1.6,
      animDur: 1.2 + Math.random() * 1.0, size: 12 + Math.random() * 10,
      color: c[i % c.length], rotate: 0,
      drift: (Math.random() - 0.5) * 20, shape: ['🌧️','💧','☔','🌨️','⛈️'][i % 5],
    }));
  });

  // ❓ MISSED — warning / clock / question mark particles
  const [missedParticles] = useState<Particle[]>(() => {
    const c = ['#fbbf24','#f97316','#ef4444','#facc15','#fb923c'];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i, left: Math.random() * 100, animDelay: Math.random() * 1.6,
      animDur: 2.0 + Math.random() * 1.6, size: 14 + Math.random() * 10,
      color: c[i % c.length], rotate: Math.random() * 360,
      drift: (Math.random() - 0.5) * 120, shape: ['❓','⏰','📋','😬','🤦','⚠️','🙈'][i % 7],
    }));
  });

  const PARTICLES: Particle[] =
    celebrationState === 'win'     ? winParticles :
    celebrationState === 'loss'    ? lossParticles :
    celebrationState === 'washout' ? washoutParticles :
    celebrationState === 'missed'  ? missedParticles : [];

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

      {/* ── Celebration overlay ───────────────────────────── */}
      {celebrationState && (() => {
        // Per-state config
        const cfg = {
          win: {
            tint: 'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.15) 0%, transparent 65%)',
            bannerBg: 'linear-gradient(135deg, rgba(109,40,217,0.92) 0%, rgba(245,158,11,0.88) 100%)',
            bannerBorder: '1px solid rgba(196,181,253,0.55)',
            bannerShadow: '0 20px 56px rgba(124,58,237,0.65)',
            icon: '🏆🎉',
            title: 'Nailed it! Correct pick!',
            sub: 'Your prediction was spot on 🔥 Keep the streak going!',
            anim: 'confettiFall',
            dur: 7.5,
          },
          loss: {
            tint: 'radial-gradient(ellipse at 50% 30%, rgba(239,68,68,0.18) 0%, transparent 65%)',
            bannerBg: 'linear-gradient(135deg, rgba(185,28,28,0.92) 0%, rgba(239,68,68,0.88) 100%)',
            bannerBorder: '1px solid rgba(252,165,165,0.4)',
            bannerShadow: '0 12px 36px rgba(220,38,38,0.55)',
            icon: '💔😭',
            title: 'Wrong prediction this time',
            sub: 'Every legend has a bad day — come back stronger next match! 💪🔥',
            anim: 'floatDown',
            dur: 7.0,
          },
          washout: {
            tint: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.18) 0%, transparent 65%)',
            bannerBg: 'linear-gradient(135deg, rgba(30,58,138,0.92) 0%, rgba(59,130,246,0.82) 100%)',
            bannerBorder: '1px solid rgba(147,197,253,0.4)',
            bannerShadow: '0 14px 40px rgba(59,130,246,0.5)',
            icon: '☔🌧️',
            title: 'Match washed out!',
            sub: 'Rain wins today — your prediction energy is saved for the next one! 🌈',
            anim: 'rainDrop',
            dur: 7.0,
          },
          missed: {
            tint: 'radial-gradient(ellipse at 50% 30%, rgba(234,179,8,0.15) 0%, transparent 65%)',
            bannerBg: 'linear-gradient(135deg, rgba(120,53,15,0.92) 0%, rgba(234,179,8,0.82) 100%)',
            bannerBorder: '1px solid rgba(251,191,36,0.4)',
            bannerShadow: '0 14px 40px rgba(234,179,8,0.4)',
            icon: '⏰😬',
            title: 'Prediction missed!',
            sub: 'Set a reminder — you\'re one prediction away from climbing the board! ⚡',
            anim: 'floatDown',
            dur: 7.0,
          },
        }[celebrationState];

        return (
          <Box
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              pointerEvents: 'none',
              overflow: 'hidden',
              background: cfg.tint,
              // ── Keyframes for all 4 states ──
              '@keyframes confettiFall': {
                '0%':   { transform: 'translateY(-10vh) translateX(0) rotate(0deg)', opacity: 1 },
                '80%':  { opacity: 0.9 },
                '100%': { transform: 'translateY(115vh) translateX(var(--drift)) rotate(900deg)', opacity: 0 },
              },
              '@keyframes rainDrop': {
                '0%':   { transform: 'translateY(-8vh) scaleY(0.8)', opacity: 0.9 },
                '60%':  { opacity: 0.75 },
                '100%': { transform: 'translateY(112vh) scaleY(1.4)', opacity: 0 },
              },
              '@keyframes floatDown': {
                '0%':   { transform: 'translateY(-8vh) translateX(0) rotate(0deg)', opacity: 1 },
                '70%':  { opacity: 0.85 },
                '100%': { transform: 'translateY(112vh) translateX(var(--drift)) rotate(360deg)', opacity: 0 },
              },
              '@keyframes bannerIn': {
                '0%':   { transform: 'translateX(-50%) translateY(-90px) scale(0.85)', opacity: 0 },
                '12%':  { transform: 'translateX(-50%) translateY(0)     scale(1.04)', opacity: 1 },
                '18%':  { transform: 'translateX(-50%) translateY(0)     scale(1)',    opacity: 1 },
                '78%':  { transform: 'translateX(-50%) translateY(0)     scale(1)',    opacity: 1 },
                '100%': { transform: 'translateX(-50%) translateY(-90px) scale(0.85)', opacity: 0 },
              },
            }}
          >
            {/* ── Particles ── */}
            {PARTICLES.map((p: Particle) => (
              <Box
                key={p.id}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: `${p.left}%`,
                  fontSize: { xs: `${Math.round(p.size * 0.82)}px`, sm: `${p.size}px` },
                  color: p.color,
                  animation: `${cfg.anim} ${p.animDur}s ${p.animDelay}s ease-in forwards`,
                  transform: `rotate(${p.rotate}deg)`,
                  userSelect: 'none',
                  lineHeight: 1,
                  // CSS custom property for horizontal drift (used in keyframe)
                  ['--drift' as string]: `${p.drift}px`,
                }}
              >
                {p.shape}
              </Box>
            ))}

            {/* ── Banner ── */}
            <Box
              sx={{
                position: 'absolute',
                top: { xs: '16%', sm: '13%' },
                left: '50%',
                // transform handled in keyframe; initial shift set here for layout
                transform: 'translateX(-50%)',
                animation: `bannerIn ${cfg.dur}s cubic-bezier(0.34,1.56,0.64,1) forwards`,
                textAlign: 'center',
                px: { xs: 2.5, sm: 3.5 },
                py: { xs: 1.5, sm: 2 },
                borderRadius: { xs: '18px', sm: '24px' },
                backdropFilter: 'blur(20px)',
                background: cfg.bannerBg,
                border: cfg.bannerBorder,
                boxShadow: cfg.bannerShadow,
                minWidth: { xs: '220px', sm: '280px' },
                maxWidth: { xs: 'calc(100vw - 48px)', sm: '400px' },
              }}
            >
              <Typography sx={{ fontSize: { xs: '2rem', sm: '2.4rem' }, lineHeight: 1.1, mb: 0.5 }}>
                {cfg.icon}
              </Typography>
              <Typography sx={{
                fontWeight: 900,
                fontSize: { xs: '1rem', sm: '1.2rem' },
                color: '#fff',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}>
                {cfg.title}
              </Typography>
              <Typography sx={{
                fontSize: { xs: '0.72rem', sm: '0.8rem' },
                color: 'rgba(255,255,255,0.78)',
                fontWeight: 600,
                mt: 0.5,
                lineHeight: 1.4,
              }}>
                {cfg.sub}
              </Typography>
            </Box>
          </Box>
        );
      })()}

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
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', py: 8, gap: 2 }}>
          <CircularProgress sx={{ color: 'rgba(0,0,0,0.3)' }} />
          <Typography sx={{ fontSize: '0.82rem', color: 'rgba(0,0,0,0.45)', fontStyle: 'italic', fontWeight: 600, maxWidth: '320px', textAlign: 'center' }}>
            {getRandomDialogue()}
          </Typography>
        </Box>
      )}
      {error && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ color: '#dc2626', fontSize: '0.9rem' }}>{error}</Typography>
        </Box>
      )}

      {!loading && !error && topTodayPoints !== null && topTodayPoints >= 100 && (() => {
        const gradedResult = todayMatchResults.find(r => !r.isWashout && r.winner !== null);
        const winnerMeta = gradedResult ? getTeamMeta(gradedResult.winner ?? undefined) : null;
        const winColor = winnerMeta?.color ?? '#7c3aed';
        const commentary = getMatchCommentary(todayMatchResults);
        
        // Helper to get team abbreviation
        const getTeamAbbr = (team: string): string => {
          const t = team.toLowerCase();
          if (t.includes('kolkata') || t.includes('kkr')) return 'KKR';
          if (t.includes('chennai') || t.includes('csk')) return 'CSK';
          if (t.includes('bangalore') || t.includes('bengaluru') || t.includes('rcb')) return 'RCB';
          if (t.includes('mumbai') || t.includes('mi')) return 'MI';
          if (t.includes('hyderabad') || t.includes('sunrisers') || t.includes('srh')) return 'SRH';
          if (t.includes('rajasthan') || t.includes('royals') || t.includes('rr')) return 'RR';
          if (t.includes('delhi') || t.includes('dc') || t.includes('capitals')) return 'DC';
          if (t.includes('punjab') || t.includes('pbks') || t.includes('kings')) return 'PBKS';
          if (t.includes('gujarat') || t.includes('titans') || t.includes('gt')) return 'GT';
          if (t.includes('lucknow') || t.includes('lsg') || t.includes('super giants')) return 'LSG';
          return team.substring(0, 3).toUpperCase();
        };
        return (
        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2 }, mt: 2.2 }}>
          <Box
            sx={{
              borderRadius: '22px',
              // Aurora mesh: deep navy base with shifting violet + gold + teal orbs
              background: `
                radial-gradient(ellipse at 15% 50%, rgba(124,58,237,0.45) 0%, transparent 55%),
                radial-gradient(ellipse at 85% 20%, rgba(245,158,11,0.3) 0%, transparent 50%),
                radial-gradient(ellipse at 60% 90%, rgba(20,184,166,0.25) 0%, transparent 50%),
                linear-gradient(145deg, #0d0d1a 0%, #111128 50%, #0a0d1f 100%)
              `,
              boxShadow: `0 14px 44px rgba(124,58,237,0.35), 0 2px 0 rgba(255,255,255,0.07) inset`,
              border: '1px solid rgba(139,92,246,0.3)',
              overflow: 'hidden',
              position: 'relative',
              transition: 'transform 0.24s ease, box-shadow 0.24s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 24px 56px rgba(124,58,237,0.5)',
              },
              // Soft winner-team colour bleed from the right
              '&::after': {
                content: '""',
                position: 'absolute',
                right: '-8%',
                top: '-20%',
                width: 280,
                height: 280,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${winColor}40 0%, transparent 60%)`,
                pointerEvents: 'none',
              },
              // Shimmer sweep
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: '-35%',
                width: '28%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                transform: 'skewX(-20deg)',
                animation: 'topperShine 3.6s ease-in-out infinite',
              },
              '@keyframes topperShine': {
                '0%':   { left: '-35%' },
                '55%':  { left: '115%' },
                '100%': { left: '115%' },
              },
            }}
          >
            <Box
              sx={{
                px: { xs: 1.5, sm: 2.2 },
                py: { xs: 1.5, sm: 1.8 },
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 1.4,
                alignItems: { xs: 'stretch', md: 'center' },
                justifyContent: 'space-between',
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.15rem',
                    boxShadow: '0 6px 16px rgba(124,58,237,0.5)',
                    animation: 'trophyPulse 1.8s ease-in-out infinite',
                    '@keyframes trophyPulse': {
                      '0%': { transform: 'scale(1)', boxShadow: '0 6px 14px rgba(124,58,237,0.35)' },
                      '50%': { transform: 'scale(1.08)', boxShadow: '0 10px 22px rgba(124,58,237,0.55)' },
                      '100%': { transform: 'scale(1)', boxShadow: '0 6px 14px rgba(124,58,237,0.35)' },
                    },
                  }}
                >
                  🏆
                </Box>
                <Box>
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      color: 'rgba(255,255,255,0.55)',
                      letterSpacing: '0.11em',
                      textTransform: 'uppercase',
                      lineHeight: 1.2,
                    }}
                  >
                    {topTodayUsers.length > 1 ? "Today's Top Performers" : "Today's Top Performer"}
                  </Typography>
                  <Typography sx={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', lineHeight: 1.25 }}>
                    {topTodayPoints} pts
                  </Typography>
                  {gradedResult && (
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3, mt: 0.4 }}>
                      Match {gradedResult.matchNumber} · {getTeamAbbr(gradedResult.teamA)} vs {getTeamAbbr(gradedResult.teamB)}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                {topTodayUsers.map((user) => (
                  <Box
                    key={user.user_id}
                    sx={{
                      px: 1.2,
                      py: 0.6,
                      borderRadius: '999px',
                      background: 'rgba(139,92,246,0.2)',
                      border: '1px solid rgba(167,139,250,0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      backdropFilter: 'blur(8px)',
                      transition: 'transform 0.18s ease, background 0.18s ease, border-color 0.18s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        background: 'rgba(139,92,246,0.32)',
                        borderColor: 'rgba(196,181,253,0.6)',
                      },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.8rem' }}>⭐</Typography>
                    <Typography sx={{ fontSize: '0.77rem', fontWeight: 800, color: '#f7f7f7ff' }}>
                      {user.display_name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box
              sx={{
                px: { xs: 1.5, sm: 2.2 },
                pb: 1.4,
                mt: 0,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {/* Divider line */}
              <Box sx={{ height: '1px', background: 'rgba(139,92,246,0.25)', mb: 1 }} />
              {commentary && (
                <Typography
                  sx={{
                    fontSize: { xs: '0.72rem', sm: '0.78rem' },
                    color: 'rgba(233,213,255,0.9)',
                    fontWeight: 600,
                    fontStyle: 'italic',
                    lineHeight: 1.55,
                    letterSpacing: '0.01em',
                  }}
                >
                  {commentary}
                </Typography>
              )}
            </Box>
          </Box>
        </Container>
        );
      })()}

      {/* ── My rank pill (if outside top 3) ─────────────── */}
      {!loading && !error && myRow && myRank !== null && myRank > 3 && (
        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2 } }}>
          <Box
            sx={{
              mt: 2,
              px: 2.1,
              py: 1.3,
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #0f172a 0%, #111827 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: '0 14px 28px rgba(0,0,0,0.3)',
              },
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
                #{myRank}
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                {myRow.total_points + (statsMap[myRow.user_id]?.fiferCount ?? 0) * 100 - (statsMap[myRow.user_id]?.missedPenalty ?? 0)} pts
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
              background: 'linear-gradient(180deg, #0f1117 0%, #101217 100%)',
              boxShadow: '0 8px 34px rgba(0,0,0,0.42)',
            }}
          >
            {/* Column headers */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 48px 58px 68px',
                alignItems: 'center',
                px: 0.5,
                py: 1.5,
                background: 'linear-gradient(180deg, #050607 0%, #000 100%)',
                borderBottom: '1px solid rgba(0,0,0,0.07)',
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
                    color: 'rgba(255,255,255,0.9)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    textAlign: align as 'center' | 'left' | 'right',
                    ...(label === 'Points' && { pr: 1.5 }),
                  }}
                >
                  {label}
                </Typography>
              ))}
            </Box>

            {/* Rows */}
            {visible.map((row, idx) => {
              const isMe = row.user_id === session?.user?.id;
              const displayRank = rankMap[row.user_id] ?? (sorted.findIndex(r => r.user_id === row.user_id) + 1);
              const medal = MEDAL[displayRank];
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
                      gridTemplateColumns: '40px 1fr 48px 58px 68px',
                      alignItems: 'center',
                      px: 0.5,
                      py: 1.5,
                      borderBottom: isExpanded ? 'none' : isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      background: isExpanded ? 'rgba(255,255,255,0.06)' : 'transparent',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease',
                      '&:hover': {
                        background: 'rgba(255,255,255,0.045)',
                        transform: 'translateY(-1px)',
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
                      },
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
                          {displayRank}
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
                            transition: 'width 0.55s ease',
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.3, pr: 1.5 }}>
                        <Box
                          sx={{
                            px: 1.1, py: 0.35, borderRadius: '9px',
                            background: medal ? medal.glow : 'rgba(255,255,255,0.1)',
                            border: medal ? `1px solid ${medal.color}60` : '1px solid rgba(255,255,255,0.15)',
                            transition: 'transform 0.18s ease, background 0.18s ease',
                          }}
                        >
                          <Typography sx={{ fontWeight: 900, fontSize: '0.85rem', color: medal ? medal.color : '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                            {displayPts}
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
                              if (lower.includes('rajasthan') || lower.includes('royals') || lower === 'rr' || lower.startsWith('rr ')) return 'RR';
                              if (lower.includes('royal challengers') || lower.includes('rcb') || lower.includes('bangalore') || lower.includes('bengaluru') || lower === 'rc' || lower.startsWith('rc ')) return 'RCB';
                              if (lower.includes('kolkata') || lower.includes('kkr')) return 'KKR';
                              if (lower.includes('sunrisers') || lower.includes('srh') || lower.includes('hyderabad')) return 'SRH';
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
