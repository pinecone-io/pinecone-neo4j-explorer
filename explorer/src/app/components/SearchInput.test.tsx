import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../test-utils";
import { SearchInput } from "./SearchInput";

// SearchInput's <input>/<button>/spinner were migrated off @material-tailwind
// to plain Tailwind + native elements during the Next 16 / React 19 upgrade.
// These smoke tests confirm it still renders and behaves under React 19.
describe("SearchInput", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ caseIds: [], summary: "" }),
        }),
      ),
    );
  });

  it("renders the search input and button", () => {
    renderWithProviders(<SearchInput />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /search/i }),
    ).toBeInTheDocument();
  });

  it("updates the input value as the user types", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchInput />);
    const input = screen.getByPlaceholderText("Search...") as HTMLInputElement;
    await user.type(input, "antitrust");
    expect(input.value).toBe("antitrust");
  });

  it("calls the search API when the button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchInput />);
    await user.type(screen.getByPlaceholderText("Search..."), "antitrust");
    await user.click(screen.getByRole("button", { name: /search/i }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/search",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
