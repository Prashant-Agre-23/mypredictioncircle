import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Grid, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar/Navbar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabaseClient';
import MatchCard from '../components/MatchCard/MatchCard';
import type { Match } from '../components/MatchCard/MatchCard';

const Dashboard: React.FC = () => {
  const { session } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const isMatchActive = (match: Match): boolean => {
    const matchDateTime = new Date(`${match.match_date}T${match.match_time}`);
    const now = new Date();
    const diffMs = matchDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours <= 24 && diffHours >= 0; // Active if within 24 hours and not past
  };

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('match_number', { ascending: true });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Error fetching matches:', error);
        setMatches([]);
      } else {
        setMatches((data as Match[]) || []);
      }

      setLoading(false);
    };

    fetchMatches();
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            My Prediction Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            Welcome, {session?.user?.email}
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={2}>
            {matches.length === 0 ? (
              <Grid item xs={12}>
                <Typography color="text.secondary">No matches available.</Typography>
              </Grid>
            ) : (
              matches.map((m) => (
                <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <MatchCard match={m} isActive={isMatchActive(m)} />
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
