import { NextRequest, NextResponse } from 'next/server';
import { Pinecone, type ScoredPineconeRecord } from '@pinecone-database/pinecone';
import neo4j from 'neo4j-driver';
import OpenAI from 'openai';
import { summarizeEmails } from '@/app/summarize';
import type { MatchMetadata } from '@/types';


const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;
// return NextResponse.json({ data: { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } });

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
  throw new Error('Missing required environment variables for Neo4j connection');
}

 const driver = neo4j.driver(
    NEO4J_URI!,
    neo4j.auth.basic(NEO4J_USERNAME!, NEO4J_PASSWORD!)
  );




const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});
const pc = new Pinecone();
const index = pc.index<MatchMetadata>('enron')


export async function POST(req: NextRequest) {
  
  const session = driver.session();

  const { query } = await req.json();
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })
  console.log(embedding)

  const { matches } = await index.query({
    vector: embedding.data[0].embedding,
    topK: 20,
    includeMetadata: true,    
  });

  const uniqueEmailTo = Array.from(new Set(matches.map((match: ScoredPineconeRecord<MatchMetadata>) => match.metadata?.email_to).filter(email => email !== "null")));

  const transactionIds = matches.map((match: ScoredPineconeRecord<MatchMetadata>) => match.metadata?.transaction_id);

  const result = await session.run(`
    MATCH (n)-[r]->(m)
    WHERE r.transaction_id IN $transactionIds
    RETURN n, r, m
  `, { transactionIds });

  const emails = result.records.map(record => {
    const n = record.get('n').properties;
    const r = record.get('r').properties;
    const m = record.get('m').properties;

    return `      
      Sender: ${n.address}
      Recipients: ${m.address}
      Subject: ${r.subject}
      Date: ${r.sent_date}
      Body: ${r.body}
    `;
  })
  console.log(summarizeEmails)
  const summary = await summarizeEmails(emails)  
  return NextResponse.json({ matches, summary, uniqueEmailTo });

}