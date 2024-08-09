import { NextRequest, NextResponse } from 'next/server';
import { Pinecone, type ScoredPineconeRecord } from '@pinecone-database/pinecone';
import neo4j from 'neo4j-driver';
import OpenAI from 'openai';
import { summarizeOpinions } from '@/app/summarize';
import type { MatchMetadata, CaseDbSchema, OpinionDbSchema } from '@/types';
import { LowSync } from 'lowdb'
import FileSync from 'lowdb/adapters/FileSync'
import { JSONFile, JSONFileSync } from 'lowdb/node'


type CaseDbInstance = LowSync<CaseDbSchema>;
type OpinionDbInstance = LowSync<OpinionDbSchema>;
const path = require('path');
const expandedCasesPath = path.resolve(__dirname, '../../../../../../cases.db.json');
const opinionsPath = path.resolve(__dirname, '../../../../../opinions.db.json');

import fs from 'fs';

const filePath = path.resolve(__dirname, '../../../../../../final.db.json');
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }
  console.log('File length:', data.length);
});


const caseAdapter = new JSONFileSync<CaseDbSchema>(expandedCasesPath);
const opinionAdapter = new JSONFileSync<OpinionDbSchema>(opinionsPath);

const caseDb: CaseDbInstance = new LowSync(caseAdapter, { _default: {} });
const opinionDb: OpinionDbInstance = new LowSync(opinionAdapter, { _default: {} });

caseDb.read();
opinionDb.read();

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
const index = pc.index<MatchMetadata>('scotus')


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


  const caseIds = matches.map((match: ScoredPineconeRecord<MatchMetadata>) => match.metadata?.case_id);

  console.log(caseIds)

  const cases = Object.values(caseDb.data._default).filter((caseItem) => caseIds.includes(caseItem.ID?.toString()));

  // const docketNumbers = cases.map((caseItem) => caseItem.docket_number);

  const opinionIds = cases.map((caseItem) => caseItem.written_opinion.map((opinion) => opinion.id)).flat();

  const opinions = Object.values(opinionDb.data._default).filter((opinion) => opinionIds.includes(opinion.id));

  // console.log(opinionIds)

  // console.log("opinions",  Object.values(opinionDb.data._default)[0], opinions)

  // const opinions = 

  // const result = await session.run(`
  //   MATCH (n)-[r]->(m)
  //   WHERE r.transaction_id IN $caseIds
  //   RETURN n, r, m
  // `, { caseIds });

  // const emails = result.records.map(record => {
  //   const n = record.get('n').properties;
  //   const r = record.get('r').properties;
  //   const m = record.get('m').properties;

  //   return `      
  //     Sender: ${n.address}
  //     Recipients: ${m.address}
  //     Subject: ${r.subject}
  //     Date: ${r.sent_date}
  //     Body: ${r.body}
  //   `;
  // })
  
  const summary = await summarizeOpinions(opinions.map((opinion) => opinion.content), query)  
  return NextResponse.json({ caseIds, summary });

}