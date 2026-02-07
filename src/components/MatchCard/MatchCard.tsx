import React from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';

export type Match = {
  id: number;
  match_number: number;
  match_date: string; // YYYY-MM-DD
  match_time: string; // HH:MM:SS
  venue: string;
  team_a: string;
  team_b: string;
};

type Props = {
  match: Match;
  isActive: boolean;
};

const formatTime = (timeStr: string) => {
  try {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const formatDate = (dateStr: string) => {
  try {
    const dt = new Date(dateStr);
    return dt.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
    });
  } catch (e) {
    return dateStr;
  }
};

const MatchCard: React.FC<Props> = ({ match, isActive }) => {
  return (
    <Card
      variant="outlined"
      sx={{
        width: '100%',
        // maxWidth: 400,
        opacity: isActive ? 1 : 0.7,
        backgroundColor: isActive ? 'background.paper' : '#f5f5f5',
        pointerEvents: isActive ? 'auto' : 'none',
        cursor: isActive ? 'pointer' : 'not-allowed',
        borderRadius: 2,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header with match number and T20 badge */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Match {match.match_number} • {match.venue}
          </Typography>
          {/* <Chip
            label="T20"
            size="small"
            sx={{
              backgroundColor: '#424242',
              color: 'white',
              fontWeight: 600,
              height: 24,
            }}
          /> */}
        </Box>

        {/* Team A with flag */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 24,
              borderRadius: 0.5,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {/* Placeholder for flag - you can replace with actual flag image */}
            <Box
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: '#e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="caption" sx={{ fontSize: 10 }}>
                🏴
              </Typography>
            </Box>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {match.team_a}
          </Typography>
        </Box>

        {/* Team B with flag */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 32,
              height: 24,
              borderRadius: 0.5,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {/* Placeholder for flag - you can replace with actual flag image */}
            <Box
              sx={{
                width: '100%',
                height: '100%',
                backgroundColor: '#e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="caption" sx={{ fontSize: 10 }}>
                🏴
              </Typography>
            </Box>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {match.team_b}
          </Typography>
        </Box>

        {/* Date and Time */}
        <Typography
          variant="body1"
          sx={{
            color: '#FF9800',
            fontWeight: 600,
          }}
        >
        {formatDate(match.match_date)} • {formatTime(match.match_time)} IST
        </Typography>
      </CardContent>
    </Card>
  );
};

export default MatchCard;