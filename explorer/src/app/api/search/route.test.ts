import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// route.ts opens a Neo4j driver and validates Neo4j/MongoDB connection env
// vars at module load, before any test code runs. `vi.hoisted` (unlike plain
// statements) runs ahead of the static import below, so set dummy values
// (mirroring ci.yml) there, and stub every external client (Neo4j, MongoDB,
// OpenAI, Pinecone, and the summarizer) so no real connection or network
// call happens.
const h = vi.hoisted(() => {
  process.env.NEO4J_URI ??= "bolt://localhost:7687";
  process.env.NEO4J_USERNAME ??= "neo4j";
  process.env.NEO4J_PASSWORD ??= "dummy";
  process.env.MONGODB_USERNAME ??= "dummy";
  process.env.MONGODB_PASSWORD ??= "dummy";
  process.env.MONGODB_HOST ??= "localhost";
  process.env.MONGODB_DATABASE ??= "dummy";
  return {
    mongoConnectMock: vi.fn(),
    casesFindMock: vi.fn(),
    opinionsFindMock: vi.fn(),
    embeddingsCreateMock: vi.fn(),
    indexQueryMock: vi.fn(),
    summarizeOpinionsMock: vi.fn(),
  };
});

vi.mock("neo4j-driver", () => ({
  default: {
    driver: () => ({ session: () => ({}) }),
    auth: { basic: () => ({}) },
  },
}));

vi.mock("mongodb", () => ({
  MongoClient: class {
    connect = h.mongoConnectMock;
    db() {
      return {
        collection(name: string) {
          const toArray = name === "cases" ? h.casesFindMock : h.opinionsFindMock;
          return { find: () => ({ toArray }) };
        },
      };
    }
  },
}));

vi.mock("openai", () => ({
  default: class {
    embeddings = { create: h.embeddingsCreateMock };
  },
}));

vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: class {
    index() {
      return { query: h.indexQueryMock };
    }
  },
}));

vi.mock("@/app/summarize", () => ({
  summarizeOpinions: h.summarizeOpinionsMock,
}));

import { POST } from "./route";

function request(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/search", () => {
  beforeEach(() => {
    h.mongoConnectMock.mockReset().mockResolvedValue(undefined);
    h.casesFindMock.mockReset();
    h.opinionsFindMock.mockReset();
    h.embeddingsCreateMock.mockReset().mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
    });
    h.indexQueryMock.mockReset();
    h.summarizeOpinionsMock.mockReset().mockResolvedValue("the summary");
  });

  it("embeds the query, resolves matching cases/opinions from Mongo, and returns a summary", async () => {
    h.indexQueryMock.mockResolvedValue({
      matches: [{ metadata: { case_id: "42" } }],
    });
    h.casesFindMock.mockResolvedValue([
      { id: 42, written_opinion: [{ id: "op-1" }] },
    ]);
    h.opinionsFindMock.mockResolvedValue([{ id: "op-1", content: "opinion text" }]);

    const response = await POST(request({ query: "what happened?" }));

    expect(h.embeddingsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ input: "what happened?" }),
    );
    expect(h.indexQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ vector: [0.1, 0.2], topK: 20 }),
    );
    expect(h.summarizeOpinionsMock).toHaveBeenCalledWith(["opinion text"], "what happened?");
    await expect(response.json()).resolves.toEqual({
      caseIds: [42],
      summary: "the summary",
    });
  });

  it("returns a 500 with an error body when the Mongo cases lookup fails", async () => {
    h.indexQueryMock.mockResolvedValue({ matches: [] });
    h.casesFindMock.mockRejectedValue(new Error("connection lost"));

    const response = await POST(request({ query: "q" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Error querying cases" });
    expect(h.summarizeOpinionsMock).not.toHaveBeenCalled();
  });
});
