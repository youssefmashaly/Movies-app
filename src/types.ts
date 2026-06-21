export interface CastMember {
  id: string;
  name: string;
  character: string;
  profilePath: string; // URL to profile picture or placeholder
}

export interface Review {
  id: string;
  movieId: string;
  userId: string;
  userEmail: string;
  rating: number; // 1 to 10 scale
  comment: string;
  createdAt: number; // timestamp
}

export interface Movie {
  id: string;
  title: string;
  tagline?: string;
  overview: string;
  backdropPath: string; // URL
  posterPath: string;   // URL
  releaseDate: string;  // YYYY-MM-DD
  voteAverage: number;  // 0 to 10
  voteCount: number;
  runtime?: number;      // in minutes
  genres: string[];
  cast?: CastMember[];
  director?: string;
  trailerUrl?: string;  // optional YouTube embed
  addedAt?: number;     // populated only for watchlist items (ms timestamp)
}

export interface WatchlistItem {
  id: string; // movieID
  title: string;
  posterPath: string;
  releaseDate: string;
  voteAverage: number;
  addedAt: number;
}
