import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { Opinion } from "@/types";

// route.ts reads a local lowdb JSON file at module load via `LowSync`/
// `JSONFileSync`. Stub both so the module never touches the filesystem, and
// so each test can control `.data` directly instead of fixturing a real file.
const h = vi.hoisted(() => ({
  data: { _default: {} as Record<string, Opinion> },
}));

vi.mock("lowdb/node", () => ({
  JSONFileSync: class {},
  JSONFile: class {},
}));

vi.mock("lowdb", () => ({
  LowSync: class {
    data = h.data;
    read() {}
  },
}));

import { POST } from "./route";

function request(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/opinion", () => {
  beforeEach(() => {
    h.data._default = {};
  });

  it("returns the opinion matching the given caseId", async () => {
    const opinion: Opinion = {
      id: "op-1",
      case_id: 42,
      title: "Case Title",
      content: "Opinion text",
    };
    h.data._default = { "op-1": opinion };

    const response = await POST(request({ caseId: 42 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(opinion);
  });

  it("returns a 404 with an error body when no opinion matches", async () => {
    h.data._default = {
      "op-1": { id: "op-1", case_id: 1, title: "t", content: "c" },
    };

    const response = await POST(request({ caseId: 999 }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Opinion not found",
    });
  });

  it("matches caseId numerically, tolerating a string input", async () => {
    h.data._default = {
      "op-1": { id: "op-1", case_id: 7, title: "t", content: "c" },
    };

    const response = await POST(request({ caseId: "7" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("op-1");
  });
});
