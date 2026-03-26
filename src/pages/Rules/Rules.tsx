import { useSearchParams, Link } from 'react-router-dom';
import { Box, Container, Typography, Paper } from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Navbar from '../../components/Navbar/Navbar';
import styles from './Rules.module.css';

type Stage = {
  name: string;
  matches: string;
  doubleTroubleNote?: string;
  points: Array<{ label: string; value: number }>;
};

const stages: Stage[] = [
  {
    name: 'Stage 1',
    matches: 'Match 1 - 35',
    doubleTroubleNote: '7 Double Trouble Available',
    points: [
      { label: 'Winning Team', value: 50 },
      { label: 'Top Run Scorer', value: 60 },
      { label: 'Top Wicket Taker', value: 60 },
      { label: 'Man of the Match', value: 60 },
    ],
  },
  {
    name: 'Stage 2',
    matches: 'Match 36 - 70',
    doubleTroubleNote: '7 Double Trouble Available',
    points: [
      { label: 'Winning Team', value: 70 },
      { label: 'Top Run Scorer', value: 80 },
      { label: 'Top Wicket Taker', value: 80 },
      { label: 'Man of the Match', value: 80 },
    ],
  },
  {
    name: 'Final Stage',
    matches: 'Match 71 - 74',
    doubleTroubleNote: '2 Double Trouble Available',
    points: [
      { label: 'Winning Team', value: 90 },
      { label: 'Top Run Scorer', value: 100 },
      { label: 'Top Wicket Taker', value: 100 },
      { label: 'Man of the Match', value: 100 },
    ],
  },
];

const tournamentStats: Array<{ label: string; value: number }> = [
  { label: 'Top Run Scorer', value: 100 },
  { label: 'Top Wicket Taker', value: 100 },
  { label: 'Player of the Tournament', value: 150 },
  { label: 'Most Sixes', value: 50 },
  { label: 'Most Fours', value: 50 },
];

const tournamentProgression: Array<{ label: string; value: number }> = [
  { label: '4 Qualifying Teams (each)', value: 100 },
  { label: 'Final Teams (each)', value: 150 },
  { label: 'Tournament Winner', value: 200 },
];


const Rules = () => {
  const [searchParams] = useSearchParams();
  const fromLogin = searchParams.get('from') === 'login';

  return (
    <Box className={styles.rulesPage}>
      {fromLogin ? (
        <Box className={styles.backBar}>
          <Link to="/login" className={styles.backLink}>
            <ArrowBackIcon sx={{ fontSize: '1rem' }} />
            Back to Login
          </Link>
        </Box>
      ) : (
        <Navbar />
      )}
      <Container maxWidth="lg" className={styles.contentContainer}>
        <Box className={styles.hero}>
          <Typography variant="h4" className={styles.heroTitle}>
            Rules
          </Typography>
          <Typography variant="body1" className={styles.heroSubtitle}>
            Full scoring rules for every match. Read carefully before placing your
            predictions, including special bonuses and penalties.
          </Typography>

          <Typography variant="body1" className={styles.heroSubtitle}>
              <strong>Note :</strong> It's just made for entertainment purposes no real money is involved
          </Typography>
        </Box>

        <Typography variant="h6" className={styles.sectionTitle}>
          Scoring Stages
        </Typography>
        <Box className={styles.sectionDivider} />

        <Box className={`${styles.cardsGrid} ${styles.stagesGrid}`}>
          {stages.map((stage) => (
            <Paper key={stage.name} className={styles.stageCard} elevation={0}>
              <Box className={styles.stageHeader}>
                <Box className={styles.stageLabelRow}>
                  <Typography className={styles.stageName}>{stage.name}</Typography>
                  {stage.doubleTroubleNote && <span className={styles.pill}>{stage.doubleTroubleNote}</span>}
                </Box>
                <Typography className={styles.matchesText}>{stage.matches}</Typography>
              </Box>

              <Box className={styles.pointsGrid}>
                {stage.points.map((p) => (
                  <Box key={p.label} className={styles.pointsRow}>
                    <Box className={styles.pointsLabel}>{p.label}</Box>
                    <Box className={styles.pointsValue}>{p.value} pts</Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          ))}
        </Box>

        {/* ── Scoring Calculation ─────────────────────────────── */}
        <Typography variant="h6" className={styles.sectionTitle}>
          Scoring Calculation
        </Typography>
        <Box className={styles.sectionDivider} />
        <Paper className={styles.noteCard} elevation={0}>
          <ul>
            <li>
              <strong>Wrong Winning Team Prediction:</strong> If you predict the wrong winning team, you will receive a minus penalty based on the stage:<br/>
              Stage 1: -50 pts, Stage 2: -70 pts, Final Stage: -90 pts.
            </li>
            <li>
              <strong>Missed Prediction or Washout:</strong> If you miss making a prediction and the match is washed out, you will still receive minus points equal to the winning team penalty for that stage.
            </li>
            <li>
              <strong>Double Trouble Penalty:</strong> If your winning team prediction is wrong and you have used Double Trouble (DT), the penalty will be doubled:<br/>
              Stage 1: -100 pts, Stage 2: -140 pts, Final Stage: -180 pts.
            </li>
            <li>
              <strong>Streak & Washout:</strong> If a match is washed out, your winning streak will not be broken and will continue.
            </li>
            <li>
              <strong>Special Situations:</strong>
              <ul>
                <li>If the IPL season is paused, the prediction game will resume when the season continues.</li>
                <li>For tied top scorers/wicket-takers, strike rate/economy rate will be considered. If the Top Scorer and Top Wicket-Taker are tied, the Strike Rate and Economy Rate will be considered. If the tie persists, the batsman with the most sixes and the bowler with the most dot balls will be given preference.</li>
                <li>Rules may be updated during the season with advance notice.</li>
              </ul>
            </li>
            <li>
              <strong>Rain &amp; Match Abandonment Policy:</strong> If a match is washed out or abandoned for any reason, your Double Trouble will be considered used and will not be refunded. All other predictions will earn zero points — no positive points will be awarded. If you fail to make a prediction for any match (regardless of abandonment), it will be treated as a missed prediction with zero points.
            </li>
          </ul>
        </Paper>
        <Typography variant="h6" className={styles.sectionTitle}>
          Specials Rules
        </Typography>
        <Box className={styles.sectionDivider} />

        <Box className={`${styles.cardsGrid} ${styles.specialsGrid}`}>
          <Paper className={styles.specialCard} elevation={0}>
            <Box className={styles.specialTop}>
              <Box className={styles.specialIcon}>
                <BoltIcon />
              </Box>
              <Typography className={styles.specialName}>Double Trouble</Typography>
            </Box>
            <Typography className={styles.specialDesc}>
              Your predicted points are doubled. If your prediction is wrong and the match is
              lost, the points that would go to the winning team are subtracted (negative impact).
            </Typography>
          </Paper>

          <Paper className={styles.specialCard} elevation={0}>
            <Box className={styles.specialTop}>
              <Box className={styles.specialIcon}>
                <EmojiEventsIcon />
              </Box>
              <Typography className={styles.specialName}>Fifer</Typography>
            </Box>
            <Typography className={styles.specialDesc}>
              If you correctly predict the winners for 5 consecutive matches, you get an extra
              +100 points bonus.
            </Typography>
          </Paper>

          <Paper className={styles.specialCard} elevation={0}>
            <Box className={styles.specialTop}>
              <Box className={styles.specialIcon}>
                <MilitaryTechIcon />
              </Box>
              <Typography className={styles.specialName}>Perfect Match</Typography>
            </Box>
            <Typography className={styles.specialDesc}>
              If your predictions are completely correct for the match (all predictions right),
              you receive an extra +150 points.
            </Typography>
          </Paper>
        </Box>

        {/* ── Bonus Stage ────────────────────────────────────────── */}
        <Typography variant="h6" className={styles.sectionTitle}>
          Bonus Stage
        </Typography>
        <Box className={styles.sectionDivider} />

        <Box className={styles.bonusGrid}>
          {/* Tournament Statistics */}
          <Paper className={styles.bonusCard} elevation={0}>
            <Typography className={styles.bonusCardTitle} style={{ color: '#1565c0' }}>
              Tournament Statistics
            </Typography>
            <Box className={styles.pointsGrid}>
              {tournamentStats.map((item) => (
                <Box key={item.label} className={styles.pointsRow}>
                  <Box className={styles.pointsLabel}>{item.label}</Box>
                  <Box className={`${styles.pointsValue} ${styles.pointsValueBlue}`}>{item.value} pts</Box>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Tournament Progression */}
          <Paper className={styles.bonusCard} elevation={0}>
            <Typography className={styles.bonusCardTitle} style={{ color: '#e65100' }}>
              Tournament Progression
            </Typography>
            <Box className={styles.pointsGrid}>
              {tournamentProgression.map((item) => (
                <Box key={item.label} className={styles.pointsRow}>
                  <Box className={styles.pointsLabel}>{item.label}</Box>
                  <Box className={`${styles.pointsValue} ${styles.pointsValueAmber}`}>{item.value} pts</Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>

        {/* ── Special Situations ─────────────────────────────────── */}
        {/* Special Situations moved to Scoring Calculation */}

        {/* ── Rain & Abandonment Policy ───────────────────────────── */}
        {/* Rain & Match Abandonment Policy moved to Scoring Calculation */}

      </Container>
    </Box>
  );
};

export default Rules;

