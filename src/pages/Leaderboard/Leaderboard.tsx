import { Container, Typography, Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Navbar from '../../components/Navbar/Navbar';
import styles from './Leaderboard.module.css';

interface LeaderboardEntry {
  rank: number;
  name: string;
  email: string;
  score: number;
  predictions: number;
  accuracy: number;
}

/**
 * Mock leaderboard data
 * This will be replaced with actual data from the backend
 */
const mockLeaderboardData: LeaderboardEntry[] = [
  {
    rank: 1,
    name: 'Rahul Kumar',
    email: 'rahul@example.com',
    score: 2500,
    predictions: 45,
    accuracy: 85.5,
  },
  {
    rank: 2,
    name: 'Priya Singh',
    email: 'priya@example.com',
    score: 2350,
    predictions: 42,
    accuracy: 83.2,
  },
  {
    rank: 3,
    name: 'Arjun Patel',
    email: 'arjun@example.com',
    score: 2200,
    predictions: 40,
    accuracy: 81.0,
  },
  {
    rank: 4,
    name: 'Sneha Gupta',
    email: 'sneha@example.com',
    score: 2100,
    predictions: 38,
    accuracy: 79.5,
  },
  {
    rank: 5,
    name: 'Vikas Sharma',
    email: 'vikas@example.com',
    score: 1950,
    predictions: 35,
    accuracy: 77.8,
  },
];

/**
 * Leaderboard page component
 * Displays top cricket prediction makers
 */
const Leaderboard = () => {
  return (
    <Box className={styles.leaderboardContainer}>
      <Navbar />
      <Container maxWidth="lg" className={styles.contentContainer}>
        <Box className={styles.headerSection}>
          <Box className={styles.titleBox}>
            <EmojiEventsIcon className={styles.titleIcon} />
            <Typography variant="h3" component="h1" className={styles.title}>
              Leaderboard
            </Typography>
          </Box>
          <Typography variant="body1" className={styles.subtitle}>
            Top cricket prediction makers ranked by score and accuracy
          </Typography>

          <TableContainer component={Paper} className={styles.tableContainer}>
            <Table>
              <TableHead>
                <TableRow className={styles.tableHeader}>
                  <TableCell align="center" className={styles.headerCell}>
                    Rank
                  </TableCell>
                  <TableCell className={styles.headerCell}>
                    Name
                  </TableCell>
                  <TableCell className={styles.headerCell}>
                    Email
                  </TableCell>
                  <TableCell align="right" className={styles.headerCell}>
                    Score
                  </TableCell>
                  <TableCell align="right" className={styles.headerCell}>
                    Predictions
                  </TableCell>
                  <TableCell align="right" className={styles.headerCell}>
                    Accuracy
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockLeaderboardData.map((entry, index) => (
                  <TableRow
                    key={entry.rank}
                    className={`${styles.tableRow} ${
                      index % 2 === 0 ? styles.rowEven : styles.rowOdd
                    }`}
                  >
                    <TableCell align="center" className={styles.rankCell}>
                      {entry.rank <= 3 ? '🏆' : '#'}{entry.rank}
                    </TableCell>
                    <TableCell className={styles.nameCell}>
                      {entry.name}
                    </TableCell>
                    <TableCell className={styles.emailCell}>
                      {entry.email}
                    </TableCell>
                    <TableCell align="right" className={styles.scoreCell}>
                      {entry.score}
                    </TableCell>
                    <TableCell align="right" className={styles.predictionsCell}>
                      {entry.predictions}
                    </TableCell>
                    <TableCell align="right" className={styles.accuracyCell}>
                      {entry.accuracy}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Container>
    </Box>
  );
};

export default Leaderboard;
