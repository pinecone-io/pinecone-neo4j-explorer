import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// route.ts constructs `new Pinecone()` at module load, which throws unless
// PINECONE_API_KEY is set. Stub the whole client so import never touches the
// real SDK or makes a network call.
const h = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: class {
    index() {
      return { fetch: h.fetchMock };
    }
  },
}));

import { POST } from "./route";

function request(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/summarizer", () => {
  beforeEach(() => {
    h.fetchMock.mockReset();
  });

  it("fetches vectors by id from the scotus index", async () => {
    h.fetchMock.mockResolvedValue({ records: { "op-1": { id: "op-1" } } });

    const response = await POST(request({ ids: ["op-1"] }));

    expect(h.fetchMock).toHaveBeenCalledWith(["op-1"]);
    await expect(response.json()).resolves.toEqual({
      results: { records: { "op-1": { id: "op-1" } } },
    });
  });
});
