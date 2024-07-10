import { NextRequest, NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
  throw new Error('Missing required environment variables for Neo4j connection');
}

export async function POST(req: NextRequest) {
  const { selectedNodes } = await req.json();
  const driver = neo4j.driver(
    NEO4J_URI!,
    neo4j.auth.basic(NEO4J_USERNAME!, NEO4J_PASSWORD!)
  );

  const session = driver.session();
  try {
    // First query to get nodes and direct relationships
    const result = await session.run(`
      MATCH (from:EmailAddress)-[fromRelationship:EMAIL_FROM]->(email:Email)-[toRelationship:EMAIL_TO]->(to:EmailAddress)
      WHERE from.address IN $selectedNodes OR to.address IN $selectedNodes
      OPTIONAL MATCH (from)<-[fromIn:EMAIL_TO|EMAIL_FROM]-()
      OPTIONAL MATCH (to)<-[toIn:EMAIL_TO|EMAIL_FROM]-()
      RETURN DISTINCT 
        id(from) AS sourceId, 
        from, 
        id(email) AS emailId, 
        email, 
        id(to) AS targetId, 
        to, 
        fromRelationship, 
        toRelationship,
        COUNT(fromIn) AS fromInEdgesCount,
        COUNT(toIn) AS toInEdgesCount
      LIMIT 1000
    `, { selectedNodes });

    const nodes: any[] = [];
    const links: any[] = [];

    // Collect all inEdgesCount values
    const fromInEdgesCounts = result.records.map(record => Number(record.get('fromInEdgesCount')));
    const toInEdgesCounts = result.records.map(record => Number(record.get('toInEdgesCount')));

    // Find the min and max values for normalization
    const allEdgesCounts = [...fromInEdgesCounts, ...toInEdgesCounts];
    const minEdgesCount = Math.min(...allEdgesCounts);
    const maxEdgesCount = Math.max(...allEdgesCounts);

    // Normalize the values to fall between 0-100
    const normalize = (value: number) => {
      return ((value - minEdgesCount) / (maxEdgesCount - minEdgesCount)) * 100;
    };

    // Process first query results
    result.records.forEach(record => {
      const sourceNode = record.get('from');
      const targetNode = record.get('to');
      const emailNode = record.get('email');
      const fromRelationship = record.get('fromRelationship');
      const toRelationship = record.get('toRelationship');
      const sourceId = record.get('sourceId').toString();
      const targetId = record.get('targetId').toString();
      const fromInEdgesCount = record.get('fromInEdgesCount');
      const toInEdgesCount = record.get('toInEdgesCount');

      if (sourceNode) {
        nodes.push({
          id: sourceId,
          ...sourceNode.properties,
          inEdgesCount: normalize(fromInEdgesCount)
        });
      }

      if (targetNode) {
        nodes.push({
          id: targetId,
          ...targetNode.properties,
          inEdgesCount: normalize(toInEdgesCount)
        });
      }

      if (fromRelationship && fromRelationship.properties && toRelationship && toRelationship.properties) {
        links.push({
          source: sourceId,
          target: targetId,
          ...fromRelationship.properties,
          ...toRelationship.properties,
          ...emailNode.properties,
          transaction_id: emailNode.properties.id
        });
      }
    });

    // Remove duplicate nodes
    const uniqueNodes = Array.from(new Set(nodes.map(node => node.id)))
      .map(id => nodes.find(node => node.id === id));

    // Ensure the transaction_id is unique
    const uniqueLinks = Array.from(new Set(links.map(link => link.id)))
      .map(id => links.find(link => link.id === id));

    // Remove unconnected nodes
    const connectedNodeIds = new Set(uniqueLinks.flatMap(link => [link.source, link.target]));
    const filteredNodes = uniqueNodes.filter(node => connectedNodeIds.has(node.id));

    const records = {
      nodes: filteredNodes,
      links: uniqueLinks
    };

    console.log("RECORDS", records)

    return NextResponse.json({ data: records });
  } catch (error) {
    console.error('Error executing Cypher query:', error);
    return NextResponse.error();
  } finally {
    await session.close();
    await driver.close();
  }
}