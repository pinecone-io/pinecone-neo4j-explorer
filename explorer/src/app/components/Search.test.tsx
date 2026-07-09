import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Control the AppContext values the component reads. Search's Card/Typography
// were replaced with a plain Tailwind <div>/<h6> during the Next 16 upgrade;
// these tests confirm the summary/opinion panel still renders correctly.
const h = vi.hoisted(() => ({ ctx: {} as any }));
vi.mock("../AppContext", () => ({ useAppContext: () => h.ctx }));

import { Search } from "./Search";

function baseCtx(overrides: Record<string, any> = {}) {
  return {
    setSelectedData: vi.fn(),
    setSummary: vi.fn(),
    hoveredNode: null,
    summary: "This is a case summary.",
    isFlipped: false,
    queryResult: { caseIds: ["1"], summary: "This is a case summary." },
    ...overrides,
  };
}

describe("Search", () => {
  beforeEach(() => {
    h.ctx = baseCtx();
  });

  it("renders the summary card with heading and content", () => {
    render(<Search />);
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("This is a case summary.")).toBeInTheDocument();
  });

  it("shows the 'Opinion' heading when flipped", () => {
    h.ctx = baseCtx({ isFlipped: true });
    render(<Search />);
    expect(screen.getByText("Opinion")).toBeInTheDocument();
  });

  it("renders nothing when there is no query result", () => {
    h.ctx = baseCtx({ queryResult: null, summary: null });
    const { container } = render(<Search />);
    expect(screen.queryByText("Summary")).not.toBeInTheDocument();
    expect(container.textContent).toBe("");
  });
});
