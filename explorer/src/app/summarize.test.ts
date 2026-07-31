import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the OpenAI SDK so no real network call happens. `openai.ts`
// instantiates `new OpenAI(...)` at module load, so the mock must supply a
// constructable default export with the same `chat.completions.create` shape.
const h = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: h.createMock } };
  },
}));

// Real gpt-tokenizer BPE encoding needs hundreds of KB of text to cross
// MAX_TOKENS. Swap in a 1-char-per-token encoder so chunking math is exact
// and the over-the-limit test stays cheap and deterministic.
vi.mock("gpt-tokenizer", () => ({
  encode: (text: string) => Array.from(text),
  decode: (tokens: string[]) => tokens.join(""),
}));

import { summarizeOpinions } from "./summarize";

function completion(content: string) {
  return { choices: [{ message: { content } }] };
}

describe("summarizeOpinions", () => {
  beforeEach(() => {
    h.createMock.mockReset();
  });

  it("summarizes in a single call when under the token limit", async () => {
    h.createMock.mockResolvedValueOnce(completion("short summary"));

    const result = await summarizeOpinions(
      ["opinion one", "opinion two"],
      "What happened?",
    );

    expect(result).toBe("short summary");
    expect(h.createMock).toHaveBeenCalledTimes(1);
    const prompt = h.createMock.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("opinion one");
    expect(prompt).toContain("opinion two");
    expect(prompt).toContain("What happened?");
  });

  it("chunks the text and combines chunk summaries when over the token limit", async () => {
    // 150,000 mock "tokens" (chars) -> ceil(150000 / 128000) = 2 chunks.
    const bigOpinion = "x".repeat(150000);
    h.createMock
      .mockResolvedValueOnce(completion("chunk summary 1"))
      .mockResolvedValueOnce(completion("chunk summary 2"))
      .mockResolvedValueOnce(completion("final summary"));

    const result = await summarizeOpinions([bigOpinion], "question");

    expect(result).toBe("final summary");
    expect(h.createMock).toHaveBeenCalledTimes(3);
    const finalPrompt = h.createMock.mock.calls[2][0].messages[0].content;
    expect(finalPrompt).toContain("chunk summary 1");
    expect(finalPrompt).toContain("chunk summary 2");
  });
});
