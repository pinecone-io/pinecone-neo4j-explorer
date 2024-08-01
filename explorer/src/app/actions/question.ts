'use server'
import neo4j from 'neo4j-driver';

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
  throw new Error('Missing required environment variables for Neo4j connection');
}

  const driver = neo4j.driver(
    NEO4J_URI!,
    neo4j.auth.basic(NEO4J_USERNAME!, NEO4J_PASSWORD!)
  );

  const session = driver.session();

export async function question(cypher: string) {
  const result = await session.run(cypher)
  const records = result.records.map(record => {
    const obj: any = {};
    record.keys.forEach(key => {
      const value = record.get(key);
      obj[key] = neo4j.isInt(value) ? value.toNumber() : value;
    });
    return obj;
  });
  console.log(cypher)
  console.log(records)
  return records
}