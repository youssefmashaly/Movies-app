// src/test/fixtures/movies.ts
//
// Phase 24 — shared test fixtures. Small, deterministic Movie[] used by
// multiple unit/component test files instead of each one defining its own
// ad-hoc movie objects (or depending on the real ~500-movie catalog, which
// would make tests slow and fragile to catalog edits).
import type { Movie } from "../../types";

export const interstellar: Movie = {
  id: "1",
  title: "Interstellar",
  overview: "A team of explorers travel through a wormhole in space.",
  backdropPath: "https://example.test/interstellar-backdrop.jpg",
  posterPath: "https://example.test/interstellar-poster.jpg",
  releaseDate: "2014-11-07",
  voteAverage: 8.6,
  voteCount: 32000,
  genres: ["Adventure", "Drama", "Sci-Fi"],
  director: "Christopher Nolan",
  cast: [
    { id: "c1", name: "Matthew McConaughey", character: "Cooper", profilePath: "" },
    { id: "c2", name: "Anne Hathaway", character: "Brand", profilePath: "" },
  ],
};

export const darkKnight: Movie = {
  id: "2",
  title: "The Dark Knight",
  overview: "Batman faces the Joker.",
  backdropPath: "https://example.test/dark-knight-backdrop.jpg",
  posterPath: "https://example.test/dark-knight-poster.jpg",
  releaseDate: "2008-07-18",
  voteAverage: 9.0,
  voteCount: 40000,
  genres: ["Action", "Crime", "Drama"],
  director: "Christopher Nolan",
  cast: [{ id: "c3", name: "Christian Bale", character: "Bruce Wayne", profilePath: "" }],
};

export const godfather: Movie = {
  id: "3",
  title: "The Godfather",
  overview: "The aging patriarch of an organized crime dynasty.",
  backdropPath: "https://example.test/godfather-backdrop.jpg",
  posterPath: "https://example.test/godfather-poster.jpg",
  releaseDate: "1972-03-24",
  voteAverage: 9.2,
  voteCount: 35000,
  genres: ["Crime", "Drama"],
  director: "Francis Ford Coppola",
  cast: [{ id: "c4", name: "Marlon Brando", character: "Vito Corleone", profilePath: "" }],
};

export const forrestGump: Movie = {
  id: "4",
  title: "Forrest Gump",
  overview: "The presidencies of Kennedy and Johnson through the eyes of an Alabama man.",
  backdropPath: "https://example.test/forrest-gump-backdrop.jpg",
  posterPath: "https://example.test/forrest-gump-poster.jpg",
  releaseDate: "1994-07-06",
  voteAverage: 8.8,
  voteCount: 30000,
  genres: ["Drama", "Romance"],
  director: "Robert Zemeckis",
  cast: [{ id: "c5", name: "Tom Hanks", character: "Forrest Gump", profilePath: "" }],
};

export const pulpFiction: Movie = {
  id: "5",
  title: "Pulp Fiction",
  overview: "The lives of two mob hitmen, a boxer, and others intertwine.",
  backdropPath: "https://example.test/pulp-fiction-backdrop.jpg",
  posterPath: "https://example.test/pulp-fiction-poster.jpg",
  releaseDate: "1994-10-14",
  voteAverage: 8.9,
  voteCount: 28000,
  genres: ["Crime", "Drama"],
  director: "Quentin Tarantino",
};

export const movieFixtures: Movie[] = [interstellar, darkKnight, godfather, forrestGump, pulpFiction];