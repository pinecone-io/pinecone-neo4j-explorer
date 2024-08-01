import { cypherQuestionsPromptBuilder } from "@/app/cypherQuestionsPromptBuilder";

// const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

// if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
//   throw new Error('Missing required environment variables for Neo4j connection');
// }

// export async function POST(req: NextRequest) {

//   const result = await cypherBuilder(nodes, edges)
//   return NextResponse.json(result)
// }



import { createOpenAI } from '@ai-sdk/openai';
import { streamObject } from 'ai';
import { createStreamableValue } from 'ai/rsc';

import { cypherQuestionsSchema } from './schema';
import { unstable_noStore as noStore } from 'next/cache';


// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  'use server'
  noStore();
  const { nodes, edges } = await req.json()

  const openai = createOpenAI({
    compatibility: 'strict',
  });
  const llm = openai("gpt-4o")
  const stream = createStreamableValue();

  try {
    (async () => {
      const { partialObjectStream } = await streamObject({
        model: llm,
        prompt: cypherQuestionsPromptBuilder(nodes, edges),
        schema: cypherQuestionsSchema,
      });

      for await (const partialObject of partialObjectStream) {
        stream.update(partialObject);
      }

      stream.done();
    })();
    return { object: stream.value };    

  } catch (error) {
    console.log("error", error)      
  }
}