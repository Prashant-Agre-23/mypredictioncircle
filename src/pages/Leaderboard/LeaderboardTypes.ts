/**
 * Leaderboard Entry Interface
 * Represents a single leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  email: string;
  score: number;
  predictions: number;
  accuracy: number;
}
