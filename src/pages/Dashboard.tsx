import { Container, Typography, Box } from '@mui/material';
import Navbar from '../components/Navbar/Navbar';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { session } = useAuth();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 70px)',
            gap: 2,
          }}
        >
          <Typography variant="h2" component="h1" sx={{ fontWeight: 'bold' }}>
            My Prediction Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: '#666' }}>
            Welcome, {session?.user?.email}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Dashboard;
