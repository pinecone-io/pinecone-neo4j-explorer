import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// route.ts opens a Neo4j driver connection and validates the connection env
// vars at module load, before any test code runs. `vi.hoisted` (unlike plain
// statements) runs ahead of the static import below, so set dummy values
// (mirroring ci.yml) there, and stub the whole driver so no real connection
// is attempted.
const h = vi.hoisted(() => {
  process.env.NEO4J_URI ??= "bolt://localhost:7687";
  process.env.NEO4J_USERNAME ??= "neo4j";
  process.env.NEO4J_PASSWORD ??= "dummy";
  return {
    runMock: vi.fn(),
    sessionCloseMock: vi.fn(),
    driverCloseMock: vi.fn(),
  };
});

vi.mock("neo4j-driver", () => ({
  default: {
    driver: () => ({
      session: () => ({ run: h.runMock, close: h.sessionCloseMock }),
      close: h.driverCloseMock,
    }),
    auth: { basic: () => ({}) },
  },
}));

import { POST } from "./route";

function request(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

function record(fields: Record<string, unknown>) {
  return { get: (key: string) => fields[key] };
}

describe("POST /api/graph", () => {
  beforeEach(() => {
    h.runMock.mockReset();
    h.sessionCloseMock.mockReset();
    h.driverCloseMock.mockReset();
  });

  it("shapes the Cypher query result into deduped, connected nodes and links", async () => {
    h.runMock.mockResolvedValue({
      records: [
        record({
          case: { properties: { name: "Case One" }, identity: { toString: () => "1" } },
          connectedNode: {
            labels: ["Justice"],
            properties: { name: "J" },
            identity: { toString: () => "2" },
          },
          caseNodeId: { toString: () => "1" },
          caseId: "c1",
          connectedNodeId: { toString: () => "2" },
          r: { type: "AUTHORED", properties: { weight: 1 } },
        }),
      ],
    });

    const response = await POST(request({ selectedNodes: ["c1"] }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "1", label: "Case", caseId: "c1", name: "Case One" }),
        expect.objectContaining({ id: "2", label: "Justice", name: "J" }),
      ]),
    );
    expect(body.data.nodes).toHaveLength(2);
    expect(body.data.links).toEqual([
      expect.objectContaining({ source: "1", target: "2", label: "AUTHORED", weight: 1 }),
    ]);
    expect(h.sessionCloseMock).toHaveBeenCalledTimes(1);
    expect(h.driverCloseMock).toHaveBeenCalledTimes(1);
  });

  it("drops nodes left unconnected after dedup (no link references them)", async () => {
    h.runMock.mockResolvedValue({
      records: [
        record({
          case: { properties: {}, identity: { toString: () => "1" } },
          connectedNode: null,
          caseNodeId: { toString: () => "1" },
          caseId: "c1",
          connectedNodeId: { toString: () => "2" },
          r: null,
        }),
      ],
    });

    const response = await POST(request({ selectedNodes: ["c1"] }));

    const body = await response.json();
    expect(body.data.nodes).toEqual([]);
    expect(body.data.links).toEqual([]);
  });

  it("returns a network-error response and still releases the session/driver when the query fails", async () => {
    h.runMock.mockRejectedValue(new Error("boom"));

    const response = await POST(request({ selectedNodes: ["c1"] }));

    expect(response.status).toBe(0);
    expect(h.sessionCloseMock).toHaveBeenCalledTimes(1);
    expect(h.driverCloseMock).toHaveBeenCalledTimes(1);
  });
});
