import React, { createContext, useContext } from "react";
import type { Movie } from "../types";

interface MovieCardPreferences {
  favoriteGenres: string[];
  openTrailer: (movie: Movie) => void;
}

const defaultValue: MovieCardPreferences = {
  favoriteGenres: [],
  openTrailer: () => {},
};

const MovieCardContext = createContext<MovieCardPreferences>(defaultValue);

export function MovieCardPreferencesProvider({
  favoriteGenres,
  openTrailer,
  children,
}: {
  favoriteGenres: string[];
  openTrailer: (movie: Movie) => void;
  children: React.ReactNode;
}) {
  return (
    <MovieCardContext.Provider value={{ favoriteGenres, openTrailer }}>
      {children}
    </MovieCardContext.Provider>
  );
}

export function useMovieCardPreferences() {
  return useContext(MovieCardContext);
}