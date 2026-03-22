import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard/Leaderboard';
import Rules from './pages/Rules/Rules';
import Prediction from './pages/Prediction/Prediction';
import MyPredictions from './pages/MyPredictions';
import AdminPanel from './pages/Admin/AdminPanel';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <Leaderboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rules"
            element={
              <ProtectedRoute>
                <Rules />
              </ProtectedRoute>
            }
          />
          <Route
            path="/prediction/:matchId"
            element={
              <ProtectedRoute>
                <Prediction />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-predictions"
            element={
              <ProtectedRoute>
                <MyPredictions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route path="/rules-public" element={<Rules />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
