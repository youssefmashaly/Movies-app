// src/components/NotificationCenter.test.tsx
// Phase 46 — tests for the Notification Center component.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationCenter from "./NotificationCenter";

// ---------------------------------------------------------------------------
// Mock the notifications service so tests never hit Supabase
// ---------------------------------------------------------------------------

vi.mock("../services/supabase/notifications", () => ({
  listNotifications: vi.fn(),
  markAllRead: vi.fn().mockResolvedValue({ data: null, error: null }),
  markOneRead: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

import {
  listNotifications,
  markAllRead,
  markOneRead,
} from "../services/supabase/notifications";

const mockList = listNotifications as ReturnType<typeof vi.fn>;
const mockMarkAll = markAllRead as ReturnType<typeof vi.fn>;
const mockMarkOne = markOneRead as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FOLLOW_NOTIF = {
  id: "n1",
  user_id: "user-me",
  actor_id: "user-alice",
  actor_name: "Alice",
  actor_avatar: null,
  type: "follow" as const,
  review_id: null,
  movie_id: null,
  movie_title: null,
  read: false,
  created_at: new Date(Date.now() - 60_000).toISOString(),
};

const LIKE_NOTIF = {
  id: "n2",
  user_id: "user-me",
  actor_id: "user-bob",
  actor_name: "Bob",
  actor_avatar: null,
  type: "review_like" as const,
  review_id: "rev-1",
  movie_id: "movie-1",
  movie_title: "Inception",
  read: true,
  created_at: new Date(Date.now() - 3600_000).toISOString(),
};

const HELPFUL_NOTIF = {
  id: "n3",
  user_id: "user-me",
  actor_id: "user-carol",
  actor_name: "Carol",
  actor_avatar: null,
  type: "helpful_vote" as const,
  review_id: "rev-2",
  movie_id: "movie-2",
  movie_title: "Dune",
  read: false,
  created_at: new Date(Date.now() - 7200_000).toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NotificationCenter", () => {
  beforeEach(() => {
    mockMarkAll.mockResolvedValue({ data: null, error: null });
    mockMarkOne.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  it("shows a loading skeleton while notifications are being fetched", () => {
    mockList.mockReturnValue(new Promise(() => {})); // never resolves
    render(<NotificationCenter userId="user-me" />);
    expect(screen.getByRole("status", { name: /loading notifications/i })).toBeInTheDocument();
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  it("shows the empty state when there are no notifications", async () => {
    mockList.mockResolvedValue({ data: [], error: null });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() =>
      expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument()
    );
  });

  // ── Error state ───────────────────────────────────────────────────────────

  it("shows an error state and a retry button when loading fails", async () => {
    mockList.mockResolvedValue({ data: null, error: "DB connection failed" });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("retries loading when the Try Again button is clicked", async () => {
    mockList
      .mockResolvedValueOnce({ data: null, error: "fail" })
      .mockResolvedValueOnce({ data: [FOLLOW_NOTIF], error: null });

    render(<NotificationCenter userId="user-me" />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText(/alice followed you/i)).toBeInTheDocument());
  });

  // ── Notification rendering ────────────────────────────────────────────────

  it("renders follow notifications with correct label", async () => {
    mockList.mockResolvedValue({ data: [FOLLOW_NOTIF], error: null });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() =>
      expect(screen.getByText(/alice followed you/i)).toBeInTheDocument()
    );
  });

  it("renders review_like notifications with movie title", async () => {
    mockList.mockResolvedValue({ data: [LIKE_NOTIF], error: null });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() =>
      expect(screen.getByText(/bob liked your review/i)).toBeInTheDocument()
    );
    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("renders helpful_vote notifications with movie title", async () => {
    mockList.mockResolvedValue({ data: [HELPFUL_NOTIF], error: null });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() =>
      expect(screen.getByText(/carol found your review helpful/i)).toBeInTheDocument()
    );
    expect(screen.getByText("Dune")).toBeInTheDocument();
  });

  // ── Unread state ──────────────────────────────────────────────────────────

  it("shows unread count badge when unread notifications exist", async () => {
    mockList.mockResolvedValue({
      data: [FOLLOW_NOTIF, HELPFUL_NOTIF], // both unread
      error: null,
    });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() =>
      expect(screen.getByLabelText(/2 unread/i)).toBeInTheDocument()
    );
  });

  it("does not show the unread badge when all notifications are read", async () => {
    mockList.mockResolvedValue({ data: [LIKE_NOTIF], error: null }); // read: true
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() =>
      expect(screen.getByText(/bob liked your review/i)).toBeInTheDocument()
    );
    expect(screen.queryByLabelText(/unread/i)).not.toBeInTheDocument();
  });

  it("marks notification as unread in the accessible label when read=false", async () => {
    mockList.mockResolvedValue({ data: [FOLLOW_NOTIF], error: null });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() => {
      const row = screen.getByRole("button", { name: /alice followed you.*unread/i });
      expect(row).toBeInTheDocument();
    });
  });

  // ── Mark all as read ──────────────────────────────────────────────────────

  it("shows the Mark all read button only when there are unread notifications", async () => {
    mockList.mockResolvedValue({ data: [FOLLOW_NOTIF], error: null });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /mark all.*read/i })).toBeInTheDocument()
    );
  });

  it("does not show Mark all read when all notifications are already read", async () => {
    mockList.mockResolvedValue({ data: [LIKE_NOTIF], error: null });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() =>
      expect(screen.getByText(/bob liked your review/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /mark all.*read/i })).not.toBeInTheDocument();
  });

  it("calls markAllRead service and removes unread badge after clicking", async () => {
    mockList.mockResolvedValue({
      data: [FOLLOW_NOTIF, HELPFUL_NOTIF],
      error: null,
    });
    render(<NotificationCenter userId="user-me" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /mark all.*read/i })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: /mark all.*read/i }));

    expect(mockMarkAll).toHaveBeenCalledWith("user-me");
    await waitFor(() =>
      expect(screen.queryByLabelText(/unread/i)).not.toBeInTheDocument()
    );
  });

  // ── Navigation on click ───────────────────────────────────────────────────

  it("calls onViewProfile with actor_id when a follow notification is clicked", async () => {
    mockList.mockResolvedValue({ data: [FOLLOW_NOTIF], error: null });
    const onViewProfile = vi.fn();
    render(<NotificationCenter userId="user-me" onViewProfile={onViewProfile} />);

    await waitFor(() =>
      expect(screen.getByText(/alice followed you/i)).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /alice followed you/i }));

    expect(onViewProfile).toHaveBeenCalledWith("user-alice");
  });

  it("calls onSelectMovie with movie_id when a review_like notification is clicked", async () => {
    mockList.mockResolvedValue({ data: [LIKE_NOTIF], error: null });
    const onSelectMovie = vi.fn();
    render(<NotificationCenter userId="user-me" onSelectMovie={onSelectMovie} />);

    await waitFor(() =>
      expect(screen.getByText(/bob liked your review/i)).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /bob liked your review/i }));

    expect(onSelectMovie).toHaveBeenCalledWith("movie-1");
  });

  it("calls markOneRead when an unread notification is clicked", async () => {
    mockList.mockResolvedValue({ data: [FOLLOW_NOTIF], error: null });
    render(<NotificationCenter userId="user-me" onViewProfile={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText(/alice followed you/i)).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /alice followed you/i }));

    expect(mockMarkOne).toHaveBeenCalledWith("n1");
  });

  it("does not call markOneRead when an already-read notification is clicked", async () => {
    mockList.mockResolvedValue({ data: [LIKE_NOTIF], error: null }); // read: true
    const onSelectMovie = vi.fn();
    render(<NotificationCenter userId="user-me" onSelectMovie={onSelectMovie} />);

    await waitFor(() =>
      expect(screen.getByText(/bob liked your review/i)).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /bob liked your review/i }));

    expect(mockMarkOne).not.toHaveBeenCalled();
  });

  // ── Unread count callback ─────────────────────────────────────────────────

  it("calls onUnreadCountChange with the correct count on load", async () => {
    mockList.mockResolvedValue({
      data: [FOLLOW_NOTIF, HELPFUL_NOTIF, LIKE_NOTIF], // 2 unread
      error: null,
    });
    const onUnreadCountChange = vi.fn();
    render(
      <NotificationCenter userId="user-me" onUnreadCountChange={onUnreadCountChange} />
    );
    await waitFor(() =>
      expect(onUnreadCountChange).toHaveBeenCalledWith(2)
    );
  });
});