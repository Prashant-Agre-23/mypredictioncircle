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
    };

    fetchMatches();
  }, [session?.user?.id]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f7' }}>
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
                <Box sx={{ display: { xs: 'none', sm: 'block' }, mb: 2 }}>
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

                    <Box sx={{ pl: 3, pr: 2.5, pt: 1.5, pb: 1.5 }}>
                      {/* Header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {pred.is_double_trouble && (
                            <Box sx={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)', borderRadius: '7px', px: 1, py: 0.25, display: 'flex', alignItems: 'center', gap: 0.4 }}>
                              <Typography sx={{ fontSize: '0.62rem', fontWeight: 900, color: '#fff', letterSpacing: '0.06em' }}>⚡ DOUBLE TROUBLE</Typography>
                            </Box>
                          )}
                          <Box sx={{
                            borderRadius: '8px',
                            background: 'rgba(74,222,128,0.1)',
                            border: '1px solid rgba(74,222,128,0.25)',
                            px: 1, py: 0.4,
                            display: 'flex', alignItems: 'center', gap: 0.5,
                          }}>
                            <Typography sx={{ fontSize: '0.62rem' }}>✏️</Typography>
                            <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                              Change before match starts
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Pick columns — horizontal layout on desktop */}
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        {[
                          {
                            label: 'Winner',
                            value: pred.predicted_winner,
                            logo: winnerMeta?.logo ?? null,
                            color: winnerMeta?.color ?? null,
                          },
                          { label: 'Top Batter', value: pred.predicted_batter_name, logo: null, color: null },
                          { label: 'Top Bowler', value: pred.predicted_bowler_name, logo: null, color: null },
                          { label: 'Player of the Match', value: pred.predicted_mom_name, logo: null, color: null },
                        ].map(({ label, value, logo, color }) => (
                          <Box key={label} sx={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            px: 1.5, py: 1,
                            display: 'flex', flexDirection: 'column', gap: 0.6,
                          }}>
                            <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              {label}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                              {logo && (
                                <Box sx={{
                                  width: 22, height: 22, borderRadius: '6px', flexShrink: 0,
                                  background: color || '#fff',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  overflow: 'hidden', p: '2px',
                                  boxShadow: color ? `0 2px 8px ${color}66` : 'none',
                                }}>
                                  <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                </Box>
                              )}
                              <Typography sx={{
                                fontSize: '0.82rem', fontWeight: 800, color: '#fff',
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
                  <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <MatchCard
                      match={m}
                      isActive={isMatchActive(m)}
                      hasPrediction={!!predictionsMap[m.id]}
                      userPrediction={predictionsMap[m.id] ?? null}
                    />
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
