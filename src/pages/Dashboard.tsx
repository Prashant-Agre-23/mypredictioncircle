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

      // ── Motivational toast: fetch rank and pick message ──
      if (session?.user?.id) {
        const name = (session.user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
          || session.user.email?.split('@')[0] || 'Champ';

        const { data: lbData } = await supabase
          .from('leaderboard_entries')
          .select('user_id, total_points')
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
