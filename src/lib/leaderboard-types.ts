export type LeaderboardEntry = {
  wallet: string;
  kills: number;
  coins: number;
  bestWave: number;
  updatedAt: number;
};

export type ScoreSubmission = {
  wallet: string;
  kills: number;
  coins: number;
  wave: number;
};
