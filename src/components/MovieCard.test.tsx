import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MovieCard from "./MovieCard";
import { MovieCardPreferencesProvider } from "../context/MovieCardContext";
import { interstellar, darkKnight } from "../test/fixtures/movies";

function renderCard(props: Partial<React.ComponentProps<typeof MovieCard>> = {}, favoriteGenres: string[] = []) {
  return render(
    <MovieCardPreferencesProvider favoriteGenres={favoriteGenres} openTrailer={vi.fn()}>
      <MovieCard movie={interstellar} {...props} />
    </MovieCardPreferencesProvider>
  );
}

describe("MovieCard", () => {
  beforeEach(() => {
    // MovieCard prefetches /api/movies/detail/:id on hover/focus intent —
    // stub fetch so tests don't depend on (or wait on) real network calls.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network disabled in tests")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a loading skeleton when isLoading is true", () => {
    render(
      <MovieCardPreferencesProvider favoriteGenres={[]} openTrailer={vi.fn()}>
        <MovieCard isLoading />
      </MovieCardPreferencesProvider>
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a loading skeleton when no movie is provided", () => {
    render(
      <MovieCardPreferencesProvider favoriteGenres={[]} openTrailer={vi.fn()}>
        <MovieCard />
      </MovieCardPreferencesProvider>
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the movie title, year, and an accessible label", () => {
    renderCard();
    expect(screen.getByText("Interstellar")).toBeInTheDocument();
    expect(screen.getByText("2014")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view details for interstellar \(2014\)/i })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderCard({ onClick });

    await user.click(screen.getByRole("button", { name: /view details/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onClick when activated via Enter or Space (keyboard accessibility)", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderCard({ onClick });

    const card = screen.getByRole("button", { name: /view details/i });
    card.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("shows a favorite-genre indicator only when a genre matches", () => {
    const { rerender } = render(
      <MovieCardPreferencesProvider favoriteGenres={["Comedy"]} openTrailer={vi.fn()}>
        <MovieCard movie={interstellar} />
      </MovieCardPreferencesProvider>
    );
    expect(screen.queryByLabelText(/matches one of your favorite genres/i)).not.toBeInTheDocument();

    rerender(
      <MovieCardPreferencesProvider favoriteGenres={["Sci-Fi"]} openTrailer={vi.fn()}>
        <MovieCard movie={interstellar} />
      </MovieCardPreferencesProvider>
    );
    expect(screen.getByLabelText(/matches one of your favorite genres/i)).toBeInTheDocument();
  });

  it("renders a watchlist toggle button only when onToggleSave is provided, and it doesn't also trigger onClick", async () => {
    const onClick = vi.fn();
    const onToggleSave = vi.fn();
    const user = userEvent.setup();
    renderCard({ onClick, onToggleSave, isSaved: false });

    const saveButton = screen.getByRole("button", { name: /add interstellar to watchlist/i });
    await user.click(saveButton);

    expect(onToggleSave).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("reflects isSaved in the button's label and aria-pressed state", () => {
    renderCard({ onToggleSave: vi.fn(), isSaved: true });
    const saveButton = screen.getByRole("button", { name: /remove interstellar from watchlist/i });
    expect(saveButton).toHaveAttribute("aria-pressed", "true");
  });

  it("renders distinct cards for distinct movies (memoized but not stuck)", () => {
    const { rerender } = renderCard();
    expect(screen.getByText("Interstellar")).toBeInTheDocument();

    rerender(
      <MovieCardPreferencesProvider favoriteGenres={[]} openTrailer={vi.fn()}>
        <MovieCard movie={darkKnight} />
      </MovieCardPreferencesProvider>
    );
    expect(screen.getByText("The Dark Knight")).toBeInTheDocument();
    expect(screen.queryByText("Interstellar")).not.toBeInTheDocument();
  });
});