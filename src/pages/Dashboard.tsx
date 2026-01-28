import { Container, Typography, Box } from '@mui/material';

const Dashboard = () => {
  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Typography variant="h2" component="h1" sx={{ fontWeight: 'bold' }}>
          My Prediction Dashboard Login
        </Typography>
      </Box>
    </Container>
  );
};

export default Dashboard;
