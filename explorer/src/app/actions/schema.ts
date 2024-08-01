import { z } from "zod";

export const cypherQuestionsSchema = z.object({
  entries: z.array(z.object({
    question: z.string().describe("A question that can be answered by a Cypher query."),
    cypher: z.string().describe("The Cypher query that answers the question."),
  })),
})