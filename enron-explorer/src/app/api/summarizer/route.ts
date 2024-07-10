import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone();

export async function POST(req: NextRequest) {
  const { ids } = await req.json();
  
  const index = pc.index('enron');
  const results = await index.fetch(ids);

  return NextResponse.json({ results });
}