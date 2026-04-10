import { Navigate } from 'react-router-dom';
import { CircularProgress, Box, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getRandomDialogue } from '../utils/loadingDialogues';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.5)', fontStyle: 'italic', fontWeight: 600, maxWidth: '300px', textAlign: 'center' }}>
          {getRandomDialogue()}
        </Typography>
      </Box>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
