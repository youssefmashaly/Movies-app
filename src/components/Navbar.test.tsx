import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navbar from "./Navbar";
import { interstellar, darkKnight, godfather } from "../test/fixtures/movies";

vi.mock("../firebase", () => ({ auth: {} }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
    callback(null);
    return () => {};
  },
  signOut: vi.fn(),
}));

const suggestionPool = [interstellar, darkKnight, godfather];

// A tiny controlled wrapper — Navbar's searchQuery is lifted state in the
// real app (owned by App.tsx), so the test harness plays that role.
function NavbarHarness(props: Partial<React.ComponentProps<typeof Navbar>> = {}) {
  const [activeTab, setActiveTab] = useState("explore");
  const [searchQuery, setSearchQuery] = useState("");
  return (
    <Navbar
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onOpenAuth={vi.fn()}
      suggestionPool={suggestionPool}
      {...props}
    />
  );
}

describe("Navbar search", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the updated placeholder text", () => {
    render(<NavbarHarness />);
    expect(screen.getByPlaceholderText("Search for movies...")).toBeInTheDocument();
  });

  it("shows ranked, matching suggestions after typing (director search)", async () => {
    const user = userEvent.setup();
    render(<NavbarHarness />);

    const input = screen.getByRole("combobox", { name: /search movies, actors, directors/i });
    await user.type(input, "Nolan");

    await waitFor(() => {
      expect(screen.getByText("Interstellar")).toBeInTheDocument();
      expect(screen.getByText("The Dark Knight")).toBeInTheDocument();
    });
    expect(screen.queryByText("The Godfather")).not.toBeInTheDocument();
  });

  it("opens the clicked suggestion directly via onSelectMovie", async () => {
    const onSelectMovie = vi.fn();
    const user = userEvent.setup();
    render(<NavbarHarness onSelectMovie={onSelectMovie} />);

    const input = screen.getByRole("combobox", { name: /search movies, actors, directors/i });
    await user.type(input, "Godfather");

    // "Godfather" is a partial-title match, so the suggestion renders with a
    // highlighted <mark> splitting the text into fragments — query by role
    // and match on the option's full text content rather than an exact
    // getByText, which only matches a single contiguous text node.
    const option = await waitFor(() => {
      const options = screen.getAllByRole("option");
      const match = options.find((el) => el.textContent?.includes("The Godfather"));
      if (!match) throw new Error("Godfather suggestion not yet rendered");
      return match;
    });
    await user.click(option);

    expect(onSelectMovie).toHaveBeenCalledWith(godfather);
  });

  it("Enter opens the first ranked result when no suggestion is arrow-selected", async () => {
    const onSelectMovie = vi.fn();
    const user = userEvent.setup();
    render(<NavbarHarness onSelectMovie={onSelectMovie} />);

    const input = screen.getByRole("combobox", { name: /search movies, actors, directors/i });
    await user.type(input, "Interstellar");
    await screen.findByText("Interstellar");

    await user.keyboard("{Enter}");
    expect(onSelectMovie).toHaveBeenCalledWith(interstellar);
  });

  it("ArrowDown moves selection before Enter opens the highlighted suggestion", async () => {
    const onSelectMovie = vi.fn();
    const user = userEvent.setup();
    render(<NavbarHarness onSelectMovie={onSelectMovie} />);

    const input = screen.getByRole("combobox", { name: /search movies, actors, directors/i });
    await user.type(input, "Nolan");
    await screen.findByText("Interstellar");

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    // Two ArrowDowns from -1 lands on index 1 (second ranked result)
    expect(onSelectMovie).toHaveBeenCalledTimes(1);
    const openedMovie = onSelectMovie.mock.calls[0][0];
    expect([interstellar.id, darkKnight.id]).toContain(openedMovie.id);
  });

  it("shows a no-results state for a query that matches nothing", async () => {
    const user = userEvent.setup();
    render(<NavbarHarness />);

    const input = screen.getByRole("combobox", { name: /search movies, actors, directors/i });
    await user.type(input, "zzzznomatchzzzz");

    await waitFor(() => {
      expect(screen.getByText(/no matches for/i)).toBeInTheDocument();
    });
  });

  it("shows recent searches (from localStorage) when the input is empty and focused", async () => {
    localStorage.setItem("movieapp:searchHistory", JSON.stringify(["Interstellar", "Batman"]));
    const user = userEvent.setup();
    render(<NavbarHarness />);

    const input = screen.getByRole("combobox", { name: /search movies, actors, directors/i });
    await user.click(input);

    expect(await screen.findByText("Recent Searches")).toBeInTheDocument();
    expect(screen.getByText("Interstellar")).toBeInTheDocument();
    expect(screen.getByText("Batman")).toBeInTheDocument();
  });

  it("'Clear' removes recent search history", async () => {
    localStorage.setItem("movieapp:searchHistory", JSON.stringify(["Interstellar"]));
    const user = userEvent.setup();
    render(<NavbarHarness />);

    const input = screen.getByRole("combobox", { name: /search movies, actors, directors/i });
    await user.click(input);
    await screen.findByText("Interstellar");

    await user.click(screen.getByRole("button", { name: /clear recent searches/i }));

    await waitFor(() => {
      expect(screen.queryByText("Interstellar")).not.toBeInTheDocument();
    });
    expect(localStorage.getItem("movieapp:searchHistory")).toBeNull();
  });
});