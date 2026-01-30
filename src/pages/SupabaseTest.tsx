import { useState, useEffect } from 'react';
import { Container, Typography, Box, Button, Alert, CircularProgress } from '@mui/material';
import { supabase } from '../config/supabaseClient';

const SupabaseTest = () => {
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testSupabaseConnection = async () => {
    setLoading(true);
    setError(null);
    setData([]);

    try {
      const { data: result, error: queryError } = await supabase
        .from('test')
        .select('*');

      if (queryError) {
        setError(`Error: ${queryError.message}`);
      } else {
        setData(result || []);
        console.log('Supabase Query Result:', result);
      }
    } catch (err: any) {
      setError(`Exception: ${err.message}`);
      console.error('Supabase Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testSupabaseConnection();
  }, []);

  return (
    <Container maxWidth="md">
      <Box sx={{ padding: '2rem', marginTop: '2rem' }}>
        <Typography variant="h4" sx={{ marginBottom: '2rem', fontWeight: 'bold' }}>
          Supabase Connection Test
        </Typography>

        {error && (
          <Alert severity="error" sx={{ marginBottom: '2rem' }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Button
              variant="contained"
              color="primary"
              onClick={testSupabaseConnection}
              sx={{ marginBottom: '2rem' }}
            >
              Test Connection
            </Button>

            {data.length > 0 && (
              <Box>
                <Typography variant="h6" sx={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                  Data from 'test' table:
                </Typography>
                <pre
                  style={{
                    backgroundColor: '#f5f5f5',
                    padding: '1rem',
                    borderRadius: '4px',
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(data, null, 2)}
                </pre>
              </Box>
            )}

            {data.length === 0 && !error && !loading && (
              <Alert severity="info">
                No data found in 'test' table. Make sure the table exists and contains data.
              </Alert>
            )}
          </>
        )}

        <Typography variant="body2" sx={{ marginTop: '2rem', color: '#999' }}>
          Make sure your .env.local file contains:
          <br />
          VITE_SUPABASE_URL=your_supabase_url
          <br />
          VITE_SUPABASE_ANON_KEY=your_anon_key
        </Typography>
      </Box>
    </Container>
  );
};

export default SupabaseTest;
