import { NextRequest, NextResponse } from 'next/server';
import { Pinecone, type ScoredPineconeRecord } from '@pinecone-database/pinecone';
import neo4j from 'neo4j-driver';
import OpenAI from 'openai';
import { summarizeOpinions } from '@/app/summarize';
import type { MatchMetadata, Case, Opinion } from '@/types';
import { MongoClient } from 'mongodb';

export const maxDuration = 900

const { MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_HOST, MONGODB_DATABASE } = process.env;

if (!MONGODB_USERNAME || !MONGODB_PASSWORD || !MONGODB_HOST || !MONGODB_DATABASE) {
  throw new Error('Missing required environment variables for MongoDB connection');
}

const mongoUri = `mongodb+srv://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DATABASE}?authSource=admin&replicaSet=db-mongo-graph-explorer`;

let mongoClient: MongoClient;

async function connectToMongoDB() {
  if (!mongoClient) {
    mongoClient = new MongoClient(mongoUri, { tls: true });
    await mongoClient.connect();
  }
  return mongoClient.db(MONGODB_DATABASE);
}

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
  const documentStore = await connectToMongoDB();
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


  const caseIds = matches.map((match: ScoredPineconeRecord<MatchMetadata>) => match.metadata?.case_id !== undefined ? parseInt(match.metadata.case_id) : undefined);  

  let cases;
  try {
    cases = await documentStore.collection('cases').find({ "id": { "$in": caseIds } }).toArray();
    console.log(`Found ${cases.length} cases`);
  } catch (error) {
    console.error('Error querying cases:', error);
    return NextResponse.json({ error: 'Error querying cases' }, { status: 500 });
  }

  cases = cases as unknown as Case[];

  const opinionIds = cases.map((caseItem) => caseItem.written_opinion.map((opinion) => opinion.id)).flat();

  const opinions = await documentStore.collection('opinions').find({ "id": { "$in": opinionIds } }).toArray() as unknown as Opinion[];
  
  const summary = await summarizeOpinions(opinions.map((opinion) => opinion.content), query)  
  return NextResponse.json({ caseIds, summary });

}