import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrailerModal from "./TrailerModal";
import { interstellar } from "../test/fixtures/movies";

const movieWithTrailer = { ...interstellar, trailerUrl: "https://www.youtube.com/embed/zSWdZVtXT7E" };

describe("TrailerModal", () => {
  it("renders nothing when movie is null", () => {
    render(<TrailerModal movie={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when the movie has no trailerUrl", () => {
    render(<TrailerModal movie={interstellar} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the trailer dialog with an iframe when a trailer is available", () => {
    render(<TrailerModal movie={movieWithTrailer} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: /interstellar trailer/i });
    expect(dialog).toBeInTheDocument();

    const iframe = screen.getByTitle(`${movieWithTrailer.title} Trailer`);
    expect(iframe).toHaveAttribute("src", movieWithTrailer.trailerUrl);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TrailerModal movie={movieWithTrailer} onClose={onClose} />);

    await user.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the player itself", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TrailerModal movie={movieWithTrailer} onClose={onClose} />);

    await user.click(screen.getByTitle(`${movieWithTrailer.title} Trailer`));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the Close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TrailerModal movie={movieWithTrailer} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /close trailer/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed while open", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TrailerModal movie={movieWithTrailer} onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not attach an Escape listener when there is no movie (no leaked handler)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TrailerModal movie={null} onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});