import { describe, it, expect, vi, beforeEach } from "vitest";

// `infer.ts` pulls in `cypherQuestionsPromptBuilder`, which opens a Neo4j
// driver connection at module load and throws if the connection env vars are
// missing. Stub the whole module so importing `infer.ts` never touches Neo4j.
const h = vi.hoisted(() => ({
  promptBuilderMock: vi.fn(),
  streamObjectMock: vi.fn(),
  updateMock: vi.fn(),
  doneMock: vi.fn(),
}));

vi.mock("@/app/cypherQuestionsPromptBuilder", () => ({
  cypherQuestionsPromptBuilder: h.promptBuilderMock,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => (model: string) => ({ model }),
}));

vi.mock("ai", () => ({
  streamObject: h.streamObjectMock,
}));

vi.mock("ai/rsc", () => ({
  createStreamableValue: () => ({
    value: "stream-value",
    update: h.updateMock,
    done: h.doneMock,
  }),
}));

vi.mock("next/cache", () => ({
  unstable_noStore: () => {},
}));

import { infer } from "./infer";

async function* asyncGen<T>(items: T[]) {
  for (const item of items) yield item;
}

describe("infer", () => {
  beforeEach(() => {
    h.promptBuilderMock.mockReset().mockResolvedValue("built prompt");
    h.streamObjectMock.mockReset();
    h.updateMock.mockReset();
    h.doneMock.mockReset();
  });

  it("returns a streamable value synchronously", async () => {
    h.streamObjectMock.mockResolvedValue({
      partialObjectStream: asyncGen([]),
    });

    const result = await infer({ nodes: ["n1"], edges: ["e1"], summary: "s" });

    expect(result?.object).toBe("stream-value");
  });

  it("builds the prompt, forwards each partial object, and completes the stream", async () => {
    const partials = [{ entries: [] }, { entries: [{ question: "q", cypher: "c" }] }];
    h.streamObjectMock.mockResolvedValue({
      partialObjectStream: asyncGen(partials),
    });

    await infer({ nodes: ["n1"], edges: ["e1"], summary: "s" });

    await vi.waitFor(() => expect(h.doneMock).toHaveBeenCalledTimes(1));

    expect(h.promptBuilderMock).toHaveBeenCalledWith(["n1"], ["e1"], "s");
    expect(h.streamObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "built prompt" }),
    );
    expect(h.updateMock).toHaveBeenNthCalledWith(1, partials[0]);
    expect(h.updateMock).toHaveBeenNthCalledWith(2, partials[1]);
  });
});
