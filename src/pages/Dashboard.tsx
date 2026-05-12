import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Grid, CircularProgress } from '@mui/material';
import SportsCricketIcon from '@mui/icons-material/SportsCricket';
import Navbar from '../components/Navbar/Navbar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import MatchCard from '../components/MatchCard/MatchCard';
import type { Match, UserPrediction } from '../components/MatchCard/MatchCard';
import { getTeamMeta } from '../utils/teamMeta';
import { getRandomDialogue } from '../utils/loadingDialogues';

const Dashboard: React.FC = () => {
  const { session } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string>('');
  const [predictionsMap, setPredictionsMap] = useState<Record<string | number, UserPrediction>>({});
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [communityPredicted, setCommunityPredicted] = useState<number>(0);
  const [communityTotal, setCommunityTotal] = useState<number>(0);

  // ── Head-to-Head state ──
  const [h2hUserId, setH2hUserId] = useState<string | null>(null);
  const [h2hData, setH2hData] = useState<{ matchId: number; myPts: number; theirPts: number }[]>([]);
  const [h2hLoading, setH2hLoading] = useState(false);
  const [matchNumMap, setMatchNumMap] = useState<Record<number, number>>({});
  const [lbUsers, setLbUsers] = useState<{ user_id: string; display_name: string; total: number; rank: number }[]>([]);

  /**
   * A match is "active" (Live Soon) if it starts within the next 24 hours.
   * match_time from Supabase is "HH:MM:SS" (time without timezone),
   * match_date is "YYYY-MM-DD" — combine them as a local datetime.
   */
  const isMatchActive = (match: Match): boolean => {
    const matchDateTime = new Date(`${match.match_date}T${match.match_time}`);
    const now = new Date();
    const diffMs = matchDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 24;
  };

  /**
   * Check if match has expired (date/time in the past)
   */
  const isMatchExpired = (match: Match): boolean => {
    const matchDateTime = new Date(`${match.match_date}T${match.match_time}`);
    const now = new Date();
    return matchDateTime < now;
  };

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      setFetchError('');
      const { data, error } = await supabase
        .from('matches')
        .select('id, match_number, match_date, match_time, venue, team_a, team_b')
        .order('match_number', { ascending: true })
        .limit(74);

      if (error) {
        console.error('Error fetching matches:', error);
        setFetchError('Could not load matches. Please try again later.');
        setMatches([]);
      } else {
        setMatches((data as Match[]) || []);
      }

      // Fetch full prediction details for this user
      if (session?.user?.id) {
        const { data: predData } = await supabase
          .from('predictions')
          .select('match_id, predicted_winner, predicted_batter_name, predicted_bowler_name, predicted_mom_name, is_double_trouble')
          .eq('user_id', session.user.id);
        if (predData) {
          const map: Record<string | number, UserPrediction> = {};
          predData.forEach((r) => {
            map[r.match_id] = {
              predicted_winner: r.predicted_winner ?? null,
              predicted_batter_name: r.predicted_batter_name ?? null,
              predicted_bowler_name: r.predicted_bowler_name ?? null,
              predicted_mom_name: r.predicted_mom_name ?? null,
              is_double_trouble: r.is_double_trouble ?? false,
            };
          });
          setPredictionsMap(map);
        }
      }

      setLoading(false);

      // ── Community Pulse: count predictions for the active match ──
      if (data && data.length > 0) {
        const activeM = (data as Match[]).filter((m) => {
          const dt = new Date(`${m.match_date}T${m.match_time}`);
          const now = new Date();
          const diffH = (dt.getTime() - now.getTime()) / 3600000;
          return diffH >= 0 && diffH <= 24;
        })[0];
        if (activeM) {
          const [{ count: predCount }, { count: userCount }] = await Promise.all([
            supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('match_id', activeM.id),
            supabase.from('leaderboard').select('*', { count: 'exact', head: true }),
          ]);
          setCommunityPredicted(predCount ?? 0);
          setCommunityTotal(userCount ?? 0);
        }
      }

      // ── Motivational toast: fetch rank and pick message ──
      if (session?.user?.id) {
        const name = (session.user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
          || session.user.email?.split('@')[0] || 'Champ';

        const { data: lbData } = await supabase
          .from('leaderboard')
          .select('user_id, display_name, total_points')
          .order('total_points', { ascending: false });

        let tier: 'top' | 'middle' | 'bottom' = 'middle';
        if (lbData && lbData.length > 0) {
          const idx = lbData.findIndex((r) => r.user_id === session.user.id);
          const rank = idx === -1 ? lbData.length : idx + 1;
          const pct = rank / lbData.length;
          if (pct <= 0.33) tier = 'top';
          else if (pct <= 0.66) tier = 'middle';
          else tier = 'bottom';
        }

        const messages: Record<'top' | 'middle' | 'bottom', string[]> = {
          top: [
            `👑 ${name} bhai, tu toh Antilia ke upar se dekh raha hai leaderboard! Local train pakad ke aage nikal gaya — ab mat ruk! 🚂🔥`,
            `🦁 Aye ${name}, tu Shivaji Maharaj ki tarah chal raha hai — aage bhi, upar bhi! Bas prediction mein koi surrender nahi! ⚔️`,
            `🌊 ${name} bhai, Marine Drive pe baithke chai pi — tu deserve karta hai! Top pe hai, ab wahan se hila mat! ☕😎`,
            `🏏 ${name}, tu aaj ka Sachin hai yaar! Wankhede stadium tujhe salami de raha hai — bold predictions jaari rakh! 🏟️`,
            `🐯 ${name} bhai, tu toh Sher of leaderboard hai! CST ki tarah solid khada hai — koi train miss nahi karni ab! 🚉`,
            `🌃 ${name}, Gateway of India se apna leaderboard dekh — sab neeche hain, tu upar! Aise hi chalta reh bhai! 🗼`,
            `🎯 Aye ${name}, Dharavi ka entrepreneur bhi yahi karta hai — top pe rehta hai aur kisi ko chance nahi deta! Solid reh! 💼`,
            `🍵 ${name} bhai, Irani cafe wali cutting chai pi aur relaxed reh — tu top pe hai, bas ek solid prediction aur deal pakki! ☕`,
            `🚁 ${name}, tu toh Bandra-Kurla Complex wala boss hai — leaderboard ka CEO! Meetings cancel kar, predictions confirm kar! 💼🔥`,
            `🎪 Aye ${name} bhai, tu Ganpati Bappa ki tarah aa gaya aur sab hil gaye! Morya! Ab prediction mein bhi wahi energy daal! 🙏`,
            `🌅 ${name}, Worli seaface pe sunrise dekh — tu bhi rise kar raha hai leaderboard pe! Don't stop now bhai! 🌟`,
            `🦅 Aye ${name}, Juhu pe paragliding karte karte tu top pe pahunch gaya! Ab neeche mat aana — prediction solid rakh! 🪂`,
            `💎 ${name} bhai, tu toh Flora Fountain wala — center mein, sab ki nazar mein, ekdum shining! Keep predicting like a boss! ✨`,
          ],
          middle: [
            `🚃 ${name} bhai, Dadar station pe khada hai tu — na first class, na general! Ek sahi prediction maar aur Churchgate tak seedha ghus ja! 😤`,
            `🍱 Aye ${name}, dabbawaala bhi galat address pe kabhi nahi jaata — tu bhi apni prediction sahi jagah maar! Top 3 tera wait kar raha hai! 📦`,
            `🌊 ${name}, Bandra-Worli sea link cross karne wala hai tu — bas thoda aur speed de! Ek bold call aur seedha top pe! 🚗💨`,
            `🦀 Aye ${name} bhai, Juhu beach wali bhelpuri ki tarah spicy prediction maar — teekha, chatpata, aur ekdum winning! 🌶️`,
            `🎬 ${name}, Bollywood mein bhi interval ke baad hero wapas aata hai — tera interval khatam, ab second half mein chhaa ja! 🎥`,
            `🚕 Aye ${name} bhai, Ola-Uber nahi, Kaali-Peeli pakad aur seedha top pe ja! No detour, no traffic — direct prediction maar! 🚖`,
            `🥘 ${name}, Tardeo ke Haji Ali ki dargah pe dua karte hain sab — par tu apni prediction se khud kismat badal! 🤲✨`,
            `🎶 Aye ${name} bhai, Mohammed Rafi ki tarah smooth prediction maar — log sunenge, leaderboard hilega, tu top pe aayega! 🎵`,
            `🏊 ${name}, Breach Candy pool mein swimming karna mushkil hai — leaderboard pe upar aana usse bhi easy hai! Ek bold prediction maar! 💪`,
            `🌆 Aye ${name} bhai, Lower Parel ka redevelopment dekha? Sab kuch badal sakta hai — teri rank bhi! Ek prediction, poora game change! 🏗️`,
            `🛥️ ${name}, Gateway se Elephanta jaane ke liye ferry pakadni padti hai — top ke liye bas ek sahi prediction pakad! Ferry ready hai! ⛴️`,
            `🍜 Aye ${name} bhai, Mohammed Ali Road ka haleem ek baar milta hai — top ka chance bhi! Mat chhodna is baar! 😋🔥`,
            `🎠 ${name}, Chowpatty pe ghumte ghumte bhi log races jeet lete hain — tu toh leaderboard pe hai hi! Ek jump aur top 3 pakka! 🎡`,
          ],
          bottom: [
            `💪 ${name} bhai, Dharavi ke log zero se hero bane hain — teri kahani abhi shuru hui hai! Ek sahi prediction aur poora leaderboard palat! 🔥`,
            `🚂 Aye ${name}, local train mein general dabbe mein bhi log Churchgate pahunch jaate hain! Tu bhi pahunchega — bas prediction mat chhodna! 😂`,
            `🏏 ${name} bhai, Sachin bhi teen baar zero pe out hua tha — aur phir bhi 100 centuries maare! Tera century abhi aane wala hai! 💥`,
            `🦁 Aye ${name}, Mumbaikar kabhi haarta nahi — 26/11 ke baad bhi yeh sheher khada tha! Tu bhi uth, predict kar, aur top pe ja! 💪🌟`,
            `🌧️ ${name} bhai, 2005 ki barish mein bhi Mumbai ruka nahi tha — tu bhi mat ruk! Prediction maar aur comeback kar! ⛈️💪`,
            `🎬 Aye ${name}, Don ka dialogue yaad hai — "Don ko pakadna mushkil hi nahi, namumkin hai"? Teri comeback rokna bhi namumkin hai! 😤`,
            `🏗️ ${name} bhai, Bandra-Kurla Complex ek din mein nahi bana — patience rakh, predictions jaari rakh, aur top dekhta reh! 🔭`,
            `🌊 Aye ${name}, high tide ke baad low tide aati hai — par Mumbai ruktab nahi! Teri low tide khatam, high tide aa rahi hai! 🌊🔥`,
            `🥊 ${name} bhai, Mary Kom bhi haar ke championship jeeti thi — tu bhi haar mat! Ek prediction se story palat jaati hai! 🥇`,
            `🍋 Aye ${name}, Limbu mirchi toh negative energy rokti hai — par prediction se positive energy aayegi! Maar ek solid call! 🌶️✨`,
            `🛺 ${name} bhai, Autowaala bhi meter start karta hai bina guarantee ke — tu bhi prediction start kar! Manzil zaroor milegi! 🛺`,
            `🎯 Aye ${name}, Siddhivinayak mein dua karo aur prediction bold maaro — Bappa ke saath aur tu kahin nahi ruk sakta! 🙏🔥`,
            `🌟 ${name} bhai, Filmistan mein reject hue log bhi superstar bane hain — tera leaderboard superstar moment aa raha hai! Bas ruk mat! 🎬✨`,
          ],
        };

        // Seeded shuffle — unique message per day, no repeats until all messages shown
        const today = new Date();
        const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
        const userSeed = session.user.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const pool = messages[tier];
        // Which cycle we're in (0, 1, 2, …) — changes after every pool.length days
        const cycle = Math.floor(dayOfYear / pool.length);
        // Deterministic LCG seeded per user + year + cycle so shuffle differs each cycle & user
        const lcgSeed = userSeed + today.getFullYear() * 10000 + cycle * 97;
        const lcg = (() => { let s = lcgSeed; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; })();
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(lcg() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const idx = dayOfYear % pool.length;
        setToastMsg(shuffled[idx]);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 6500);
      }
    };

    fetchMatches();
  }, [session?.user?.id]);

  // ── Fetch leaderboard users + matchNumMap for H2H ──
  useEffect(() => {
    const loadH2hData = async () => {
      const [{ data: lbData }, { data: caData }] = await Promise.all([
        supabase.from('leaderboard').select('user_id, display_name, total_points, bonus_points').order('total_points', { ascending: false }),
        supabase.from('correct_answers').select('match_id, match_number'),
      ]);
      if (lbData) {
        const users = (lbData as { user_id: string; display_name: string | null; total_points: number; bonus_points: number | null }[])
          .map((r, i) => ({
            user_id: r.user_id,
            display_name: r.display_name || r.user_id,
            total: (r.total_points ?? 0) + (r.bonus_points ?? 0),
            rank: i + 1,
          }));
        setLbUsers(users);
      }
      if (caData) {
        const m: Record<number, number> = {};
        for (const ca of caData as { match_id: number; match_number: number | null }[]) {
          if (ca.match_number != null) m[ca.match_id] = ca.match_number;
        }
        setMatchNumMap(m);
      }
    };
    if (session?.user?.id) loadH2hData();
  }, [session?.user?.id]);

  const fetchH2H = async (rivalId: string) => {
    if (!session?.user?.id) return;
    setH2hLoading(true);
    const [{ data: myPws }, { data: theirPws }] = await Promise.all([
      supabase.from('predictions_with_points').select('match_id, points').eq('user_id', session.user.id).not('points', 'is', null),
      supabase.from('predictions_with_points').select('match_id, points').eq('user_id', rivalId).not('points', 'is', null),
    ]);
    const myMap: Record<number, number> = {};
    (myPws || []).forEach((r: { match_id: number; points: number | null }) => { myMap[Number(r.match_id)] = Number(r.points ?? 0); });
    const rivalMap: Record<number, number> = {};
    (theirPws || []).forEach((r: { match_id: number; points: number | null }) => { rivalMap[Number(r.match_id)] = Number(r.points ?? 0); });
    const allIds = [...new Set([...Object.keys(myMap), ...Object.keys(rivalMap)].map(Number))].sort((a, b) => a - b);
    setH2hData(allIds.map((mid) => ({ matchId: mid, myPts: myMap[mid] ?? 0, theirPts: rivalMap[mid] ?? 0 })));
    setH2hLoading(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f7' }}>
      {/* Motivational Toast */}
      {toastMsg && (
      <Box sx={{
        position: 'fixed',
        bottom: { xs: '24px', sm: '32px' },
        left: '50%',
        transform: 'translateX(-50%)',
        width: { xs: 'calc(100% - 32px)', sm: 'auto' },
        maxWidth: { xs: '100%', sm: 520 },
        zIndex: 9999, pointerEvents: 'none',
        animation: showToast ? 'toastIn 0.45s cubic-bezier(0.22,1,0.36,1) forwards' : 'toastOut 0.35s ease forwards',
        '@keyframes toastIn': {
          '0%': { opacity: 0, transform: 'translateX(-50%) translateY(14px) scale(0.95)' },
          '100%': { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)' },
        },
        '@keyframes toastOut': {
          '0%': { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)' },
          '100%': { opacity: 0, transform: 'translateX(-50%) translateY(10px) scale(0.95)' },
        },
      }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          background: 'linear-gradient(135deg, #0f0f13f2, #1a1a22f2)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '14px',
          px: { xs: 1.6, sm: 2.2 }, py: { xs: 1.1, sm: 1.2 },
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        }}>
          <Box sx={{
            width: { xs: 26, sm: 30 }, height: { xs: 26, sm: 30 }, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: { xs: '0.8rem', sm: '0.9rem' },
          }}>🏏</Box>
          <Typography sx={{
            fontSize: { xs: '0.72rem', sm: '0.82rem' }, fontWeight: 700,
            color: '#fff', letterSpacing: '0.01em',
            fontFamily: '"Inter", system-ui, sans-serif',
            lineHeight: 1.45,
          }}>
            {toastMsg}
          </Typography>
        </Box>
      </Box>
      )}
      <Navbar />
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        {/* Page header removed as per request */}

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', mt: 6, gap: 2 }}>
            <CircularProgress />
            <Typography sx={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.5)', fontStyle: 'italic', fontWeight: 600, maxWidth: '300px', textAlign: 'center' }}>
              {getRandomDialogue()}
            </Typography>
          </Box>
        ) : (
          <>
            {/* ── Head-to-Head ── */}
            {session?.user?.id && lbUsers.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{
                  borderRadius: '22px',
                  background: 'linear-gradient(145deg, #0d0d1a 0%, #111128 50%, #0a0d1f 100%)',
                  boxShadow: '0 16px 48px rgba(2,6,23,0.35)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  overflow: 'hidden',
                }}>
                  {/* Animated top bar */}
                  <Box sx={{ height: '2px', background: 'linear-gradient(90deg, #7c3aed, #4f46e5, #7c3aed)', backgroundSize: '200% 100%', animation: 'h2hSlide 3.5s linear infinite', '@keyframes h2hSlide': { '0%': { backgroundPosition: '0% 0%' }, '100%': { backgroundPosition: '200% 0%' } } }} />

                  {/* Header */}
                  <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 2, pb: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.5 }}>
                      <Box sx={{ width: 38, height: 38, borderRadius: '12px', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 18px rgba(124,58,237,0.4)', fontSize: '1.1rem' }}>⚔️</Box>
                      <Box>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Head-to-Head</Typography>
                        <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Compare your stats against any rival</Typography>
                      </Box>
                    </Box>
                    <Box
                      component="select"
                      value={h2hUserId ?? ''}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const v = e.target.value;
                        setH2hUserId(v || null);
                        setH2hData([]);
                        if (v) fetchH2H(v);
                      }}
                      sx={{
                        width: '100%',
                        fontSize: '0.85rem', fontWeight: 600, color: '#c4b5fd',
                        background: 'rgba(99,102,241,0.12)', border: '1.5px solid rgba(139,92,246,0.35)',
                        borderRadius: '10px', pl: 1.5, pr: 3.5, py: 1.1, cursor: 'pointer',
                        outline: 'none',
                        '& option': { background: '#1e1b4b', color: '#e2e8f0' },
                      }}
                    >
                      <option value="">Pick a rival to compare…</option>
                      {lbUsers
                        .filter((r) => r.user_id !== session.user.id)
                        .map((r) => (
                          <option key={r.user_id} value={r.user_id}>
                            #{r.rank} {r.display_name} ({r.total} pts)
                          </option>
                        ))}
                    </Box>
                  </Box>

                  {h2hUserId && (
                    <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
                      {h2hLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={26} sx={{ color: '#7c3aed' }} /></Box>
                      ) : h2hData.length === 0 ? (
                        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', py: 3 }}>No graded matches yet</Typography>
                      ) : (() => {
                        const rival = lbUsers.find((r) => r.user_id === h2hUserId);
                        const myTotal = h2hData.reduce((s, d) => s + d.myPts, 0);
                        const theirTotal = h2hData.reduce((s, d) => s + d.theirPts, 0);
                        const diff = myTotal - theirTotal;
                        const myWins = h2hData.filter((d) => d.myPts > d.theirPts).length;
                        const theirWins = h2hData.filter((d) => d.theirPts > d.myPts).length;
                        const ties = h2hData.filter((d) => d.myPts === d.theirPts).length;
                        const total = myWins + theirWins + ties || 1;
                        const iAmAhead = diff > 0;
                        const accentColor = iAmAhead ? '#4ade80' : diff < 0 ? '#f87171' : '#a78bfa';
                        const bannerBg = iAmAhead
                          ? 'linear-gradient(135deg, rgba(22,163,74,0.18), rgba(20,83,45,0.3))'
                          : diff < 0
                          ? 'linear-gradient(135deg, rgba(185,28,28,0.18), rgba(127,29,29,0.3))'
                          : 'linear-gradient(135deg, rgba(79,46,220,0.18), rgba(49,46,129,0.3))';
                        const bannerBorder = iAmAhead ? 'rgba(74,222,128,0.3)' : diff < 0 ? 'rgba(248,113,113,0.3)' : 'rgba(167,139,250,0.3)';
                        return (
                          <>
                            <Box sx={{ borderRadius: '18px', background: bannerBg, border: `1.5px solid ${bannerBorder}`, p: { xs: 2, sm: 2.5 }, mb: 3 }}>
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                                <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>You</Typography>
                                  <Typography sx={{ fontSize: { xs: '1.35rem', sm: '2.2rem' }, fontWeight: 900, color: iAmAhead ? '#4ade80' : 'rgba(255,255,255,0.7)', lineHeight: 1, letterSpacing: '-0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{myTotal > 0 ? `+${myTotal}` : myTotal}</Typography>
                                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', mt: 0.5 }}>{myWins} wins</Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center', px: { xs: 0.75, sm: 1.5 }, flexShrink: 0 }}>
                                  <Typography sx={{ fontSize: { xs: '1.2rem', sm: '1.6rem' }, fontWeight: 900, color: accentColor, lineHeight: 1, letterSpacing: '-0.04em' }}>{diff > 0 ? `+${diff}` : diff === 0 ? 'TIED' : diff}</Typography>
                                  <Typography sx={{ fontSize: '0.5rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1 }}>pts diff</Typography>
                                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                    {([{ label: 'W', val: myWins, color: '#4ade80', bg: 'rgba(74,222,128,0.12)' }, { label: 'D', val: ties, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' }, { label: 'L', val: theirWins, color: '#f87171', bg: 'rgba(248,113,113,0.12)' }] as const).map(({ label, val, color, bg }) => (
                                      <Box key={label} sx={{ borderRadius: '8px', background: bg, border: `1px solid ${color}30`, px: 0.9, py: 0.5, minWidth: 28 }}>
                                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 900, color, lineHeight: 1, textAlign: 'center' }}>{val}</Typography>
                                        <Typography sx={{ fontSize: '0.48rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', lineHeight: 1.3, textAlign: 'center' }}>{label}</Typography>
                                      </Box>
                                    ))}
                                  </Box>
                                </Box>
                                <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                                  <Typography noWrap sx={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>{rival?.display_name ?? 'Rival'}</Typography>
                                  <Typography sx={{ fontSize: { xs: '1.35rem', sm: '2.2rem' }, fontWeight: 900, color: !iAmAhead && diff !== 0 ? '#4ade80' : 'rgba(255,255,255,0.7)', lineHeight: 1, letterSpacing: '-0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{theirTotal > 0 ? `+${theirTotal}` : theirTotal}</Typography>
                                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', mt: 0.5 }}>{theirWins} wins</Typography>
                                </Box>
                              </Box>
                              <Box sx={{ height: 6, borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', mb: 0.8 }}>
                                <Box sx={{ height: '100%', background: '#4ade80', width: `${(myWins / total) * 100}%`, borderRadius: '99px 0 0 99px', transition: 'width 0.8s ease' }} />
                                <Box sx={{ height: '100%', background: '#818cf8', width: `${(ties / total) * 100}%`, transition: 'width 0.8s ease' }} />
                                <Box sx={{ height: '100%', background: '#f87171', flex: 1, borderRadius: '0 99px 99px 0' }} />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#4ade80' }}>{Math.round((myWins / total) * 100)}% win rate</Typography>
                                <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: '#f87171' }}>{Math.round((theirWins / total) * 100)}% win rate</Typography>
                              </Box>
                            </Box>
                            <Box sx={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                              <Box sx={{ display: 'grid', gridTemplateColumns: '48px 1fr 36px 1fr', alignItems: 'center', px: 1.5, py: 1, background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: 0.5 }}>
                                <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Match</Typography>
                                <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>You</Typography>
                                <Box />
                                <Typography noWrap sx={{ fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rival?.display_name ?? 'Rival'}</Typography>
                              </Box>
                              <Box sx={{ maxHeight: 340, overflowY: 'auto', '&::-webkit-scrollbar': { width: '3px' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(139,92,246,0.3)', borderRadius: '99px' } }}>
                                {[...h2hData].reverse().map(({ matchId, myPts, theirPts }) => {
                                  const iWin = myPts > theirPts;
                                  const theyWin = theirPts > myPts;
                                  const resultLabel = iWin ? 'WIN' : theyWin ? 'LOSS' : 'TIE';
                                  const resultBg = iWin ? 'rgba(74,222,128,0.18)' : theyWin ? 'rgba(248,113,113,0.18)' : 'rgba(129,140,248,0.18)';
                                  const resultColor = iWin ? '#4ade80' : theyWin ? '#f87171' : '#a78bfa';
                                  const rowBg = iWin ? 'rgba(74,222,128,0.04)' : theyWin ? 'rgba(248,113,113,0.04)' : 'transparent';
                                  const myScoreColor = iWin ? '#4ade80' : theyWin ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.55)';
                                  const thScoreColor = theyWin ? '#4ade80' : iWin ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.55)';
                                  const myScoreSize = iWin ? '0.9rem' : '0.78rem';
                                  const thScoreSize = theyWin ? '0.9rem' : '0.78rem';
                                  const myScoreWeight = iWin ? 900 : 600;
                                  const thScoreWeight = theyWin ? 900 : 600;
                                  return (
                                    <Box key={matchId} sx={{ display: 'grid', gridTemplateColumns: '48px 1fr 36px 1fr', alignItems: 'center', px: 1.5, py: 1, gap: 0.5, background: rowBg, borderBottom: '1px solid rgba(255,255,255,0.04)', '&:last-child': { borderBottom: 'none' }, '&:hover': { background: iWin ? 'rgba(74,222,128,0.07)' : theyWin ? 'rgba(248,113,113,0.07)' : 'rgba(255,255,255,0.03)' }, transition: 'background 0.15s' }}>
                                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>M{matchNumMap[matchId] ?? matchId}</Typography>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Typography sx={{ fontSize: myScoreSize, fontWeight: myScoreWeight, color: myScoreColor, letterSpacing: '-0.03em', lineHeight: 1, minWidth: 38, textAlign: 'right' }}>{myPts > 0 ? `+${myPts}` : myPts}</Typography>
                                        <Box sx={{ px: 0.7, py: 0.25, borderRadius: '5px', background: resultBg, flexShrink: 0 }}>
                                          <Typography sx={{ fontSize: '0.5rem', fontWeight: 800, color: resultColor, letterSpacing: '0.08em', lineHeight: 1.2 }}>{resultLabel}</Typography>
                                        </Box>
                                      </Box>
                                      <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: 'rgba(255,255,255,0.18)', textAlign: 'center' }}>vs</Typography>
                                      <Typography sx={{ fontSize: thScoreSize, fontWeight: thScoreWeight, color: thScoreColor, letterSpacing: '-0.03em', lineHeight: 1 }}>{theirPts > 0 ? `+${theirPts}` : theirPts}</Typography>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Box>
                          </>
                        );
                      })()}
                    </Box>
                  )}
                </Box>
              </Box>
            )}

            {/* ── Desktop-only full-width Your Pick banner ── */}
            {(() => {
              const activeMatch = matches.filter((m) => !isMatchExpired(m)).slice(0, 5).find((m) => isMatchActive(m));
              const pred = activeMatch ? predictionsMap[activeMatch.id] : null;
              if (!activeMatch || !pred) return null;
              const winnerMeta = pred.predicted_winner ? getTeamMeta(pred.predicted_winner) : null;
              return (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #0f0f0f 0%, #2a2a2a 100%)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    {/* Left accent stripe */}
                    <Box sx={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
                      background: 'linear-gradient(180deg, #4ade80 0%, #22d3ee 100%)',
                    }} />

                    <Box sx={{ pl: { xs: 2, sm: 3 }, pr: { xs: 1.5, sm: 2.5 }, pt: { xs: 1, sm: 1.5 }, pb: { xs: 1, sm: 1.5 } }}>
                      {/* Header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.75, sm: 1.25 }, flexWrap: 'wrap', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Box sx={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #4ade80, #22d3ee)',
                            boxShadow: '0 0 8px #4ade8088',
                          }} />
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                            Your Pick — Match {activeMatch.match_number}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          {pred.is_double_trouble && (
                            <Box sx={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', borderRadius: '7px', px: 0.8, py: 0.2, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                              <Typography sx={{ fontSize: '0.58rem', fontWeight: 900, color: '#fff', letterSpacing: '0.06em' }}>⚡ 2×</Typography>
                            </Box>
                          )}
                          <Box sx={{
                            borderRadius: '8px',
                            background: 'rgba(74,222,128,0.1)',
                            border: '1px solid rgba(74,222,128,0.25)',
                            px: 0.8, py: 0.3,
                            display: 'flex', alignItems: 'center', gap: 0.4,
                          }}>
                            <Typography sx={{ fontSize: '0.58rem' }}>✏️</Typography>
                            <Typography sx={{ fontSize: '0.58rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                              Change before match starts
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Pick tiles — compact 2×2 on mobile, 4-col row on desktop */}
                      <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                        gap: { xs: 0.6, sm: 1 },
                      }}>
                        {[
                          {
                            label: 'Winner',
                            value: pred.predicted_winner,
                            logo: winnerMeta?.logo ?? null,
                            color: winnerMeta?.color ?? null,
                          },
                          { label: 'Top Batter', value: pred.predicted_batter_name, logo: null, color: null },
                          { label: 'Top Bowler', value: pred.predicted_bowler_name, logo: null, color: null },
                          { label: 'MOM', value: pred.predicted_mom_name, logo: null, color: null },
                        ].map(({ label, value, logo, color }) => (
                          <Box key={label} sx={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            px: { xs: 1, sm: 1.5 }, py: { xs: 0.6, sm: 1 },
                            display: 'flex', flexDirection: 'column', gap: 0.35,
                          }}>
                            <Typography sx={{ fontSize: '0.52rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {label}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {logo && (
                                <Box sx={{
                                  width: 18, height: 18, borderRadius: '5px', flexShrink: 0,
                                  background: color || '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  overflow: 'hidden', p: '2px',
                                  boxShadow: color ? `0 2px 6px ${color}55` : 'none',
                                }}>
                                  <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </Box>
                              )}
                              <Typography sx={{
                                fontSize: { xs: '0.7rem', sm: '0.82rem' }, fontWeight: 800, color: '#fff',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {value || '—'}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            })()}

            <Grid container spacing={2}>
            {fetchError ? (
              <Grid size={{ xs: 12 }}>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    background: '#fff',
                    borderRadius: '20px',
                    border: '1px solid rgba(0,0,0,0.07)',
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: '#000', mb: 0.5 }}>
                    Something went wrong
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.45)' }}>
                    {fetchError}
                  </Typography>
                </Box>
              </Grid>
            ) : matches.length === 0 ? (
              <Grid size={{ xs: 12 }}>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 8,
                    background: '#fff',
                    borderRadius: '20px',
                    border: '1px solid rgba(0,0,0,0.07)',
                  }}
                >
                  <SportsCricketIcon sx={{ fontSize: '2.5rem', color: 'rgba(0,0,0,0.15)', mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 700, color: '#000', mb: 0.5 }}>
                    No matches scheduled
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.4)' }}>
                    Check back soon for upcoming fixtures.
                  </Typography>
                </Box>
              </Grid>
            ) : (
              matches
                .filter((m) => !isMatchExpired(m))
                .slice(0, 5)
                .map((m) => (
                  <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }} sx={{ display: 'flex', width: '100%' }}>
                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <MatchCard
                      match={m}
                      isActive={isMatchActive(m)}
                      hasPrediction={!!predictionsMap[m.id]}
                      userPrediction={predictionsMap[m.id] ?? null}
                      communityPredicted={isMatchActive(m) ? communityPredicted : undefined}
                      communityTotal={isMatchActive(m) ? communityTotal : undefined}
                    />
                    </Box>
                  </Grid>
                ))
            )}
            </Grid>
          </>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard;
