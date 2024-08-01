import { NextRequest, NextResponse } from "next/server";
import { JSONFile, JSONFileSync } from 'lowdb/node'
import type { MatchMetadata, OpinionDbSchema, Opinion } from '@/types';
import { LowSync } from 'lowdb'
import fs from 'fs';

const path = require('path');

const opinionDb = path.resolve(__dirname, '../../../../../../opinions.db.json');
type OpinionDbInstance = LowSync<OpinionDbSchema>;
const opinionsAdapter = new JSONFileSync<OpinionDbSchema>(opinionDb);
const opinionsDb: OpinionDbInstance = new LowSync(opinionsAdapter, { _default: {} });


// fs.readFile(opinionDb, 'utf8', (err, data) => {
//   if (err) {
//     console.error('Error reading file:', err);
//     return;
//   }
//   console.log('File length:', data.length);
// });

opinionsDb.read();



export async function POST(req: NextRequest) {
  const { caseId } = await req.json();
  const opinions = opinionsDb.data._default;
  // console.log(Object.values(opinions)[0])
  const opinion: Opinion | undefined = Object.values(opinions).find((c) => {
    // console.log(c.case_id, caseId)
    return c.case_id === parseInt(caseId)
  })
  console.log(opinion)
  if (!opinion) {
    return NextResponse.json({ error: 'Opinion not found' }, { status: 404 });
  }
  return NextResponse.json(opinion);
}