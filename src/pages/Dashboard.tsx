import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Grid, CircularProgress } from '@mui/material';
import SportsCricketIcon from '@mui/icons-material/SportsCricket';
import Navbar from '../components/Navbar/Navbar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import MatchCard from '../components/MatchCard/MatchCard';
import type { Match } from '../components/MatchCard/MatchCard';

const Dashboard: React.FC = () => {
  const { session } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string>('');
  const [predictedMatchIds, setPredictedMatchIds] = useState<Set<string | number>>(new Set());

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
        .limit(10);

      if (error) {
        console.error('Error fetching matches:', error);
        setFetchError('Could not load matches. Please try again later.');
        setMatches([]);
      } else {
        setMatches((data as Match[]) || []);
      }

      // Fetch which matches the user has already predicted
      if (session?.user?.id) {
        const { data: predData } = await supabase
          .from('predictions')
          .select('match_id')
          .eq('user_id', session.user.id);
        if (predData) {
          setPredictedMatchIds(new Set(predData.map((r) => r.match_id)));
        }
      }

      setLoading(false);
    };

    fetchMatches();
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f7' }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        {/* Page header removed as per request */}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
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
                    <MatchCard match={m} isActive={isMatchActive(m)} hasPrediction={predictedMatchIds.has(m.id)} />
                  </Grid>
                ))
            )}
          </Grid>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard;
