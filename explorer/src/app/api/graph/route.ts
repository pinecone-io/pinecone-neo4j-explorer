import { NextRequest, NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
  throw new Error('Missing required environment variables for Neo4j connection');
}

export async function POST(req: NextRequest) {
  const { selectedNodes } = await req.json();
  // console.log("NEO4J_URI", NEO4J_URI)
  const uniqueSelectNodes = Array.from(new Set(selectedNodes));
  const driver = neo4j.driver(
    NEO4J_URI!,
    neo4j.auth.basic(NEO4J_USERNAME!, NEO4J_PASSWORD!)
  );

  const session = driver.session();
  try {
    // First query to get nodes and direct relationships
    const result = await session.run(`
      MATCH (case:Case)-[r]->(connectedNode)
      WHERE case.id IN $selectedNodes
      RETURN DISTINCT 
        id(case) AS caseNodeId, 
        case, 
        id(connectedNode) AS connectedNodeId, 
        connectedNode, 
        r,
        case.id AS caseId,
        connectedNode.id AS connectedNodePropertyId
      LIMIT 400
    `, { selectedNodes: uniqueSelectNodes });


    const nodes: any[] = [];
    const links: any[] = [];
    // console.log(`
    //   MATCH (case:Case)-[r]->(connectedNode)
    //   WHERE case.id IN $selectedNodes
    //   RETURN DISTINCT 
    //     id(case) AS caseId, 
    //     case, 
    //     id(connectedNode) AS connectedNodeId, 
    //     connectedNode, 
    //     r
    //   LIMIT 1000
    // `, { selectedNodes: uniqueSelectNodes })
    // console.log(result)
    // Collect all inEdgesCount values
    // const fromInEdgesCounts = result.records.map(record => Number(record.get('fromInEdgesCount')));
    // const toInEdgesCounts = result.records.map(record => Number(record.get('toInEdgesCount')));

    // // Find the min and max values for normalization
    // const allEdgesCounts = [...fromInEdgesCounts, ...toInEdgesCounts];
    // const minEdgesCount = Math.min(...allEdgesCounts);
    // const maxEdgesCount = Math.max(...allEdgesCounts);

    // // Normalize the values to fall between 0-100
    // const normalize = (value: number) => {
    //   return ((value - minEdgesCount) / (maxEdgesCount - minEdgesCount)) * 100;
    // };

    // Process first query results
    result.records.forEach(record => {      
      const caseNode = record.get('case');
      const connectedNode = record.get('connectedNode');
      const caseNodeId = record.get('caseNodeId').toString();
      const caseId = record.get('caseId').toString();
      const connectedNodeId = record.get('connectedNodeId').toString();
      const relationship = record.get('r');

      // console.log("relationship", relationship)

      if (caseNode) {
        nodes.push({      
          label: 'Case', 
          caseId,   
          ...caseNode.properties,
          id: caseNode.identity.toString(),
        });
      }

      if (connectedNode) {
        nodes.push({
          // id: connectedNodeId,
          label: connectedNode.labels[0],
          ...connectedNode.properties,
          id: connectedNode.identity.toString(),
        });
      }

      if (relationship && relationship.properties) {
        links.push({
          label: relationship.type,
          source: caseNodeId,
          target: connectedNodeId,
          ...relationship.properties
        });
      }
    });

    // Remove duplicate nodes
    const uniqueNodes = Array.from(new Set(nodes.map(node => node.id)))
      .map(id => nodes.find(node => node.id === id));

    // Ensure the transaction_id is unique
    const uniqueLinks = Array.from(new Set(links.map(link => link.source + link.target)))
      .map(id => links.find(link => link.source + link.target === id));

    // Remove unconnected nodes
    const connectedNodeIds = new Set(uniqueLinks.flatMap(link => [link.source, link.target]));
    const filteredNodes = uniqueNodes.filter(node => connectedNodeIds.has(node.id));

    const records = {
      nodes: filteredNodes,
      links: uniqueLinks
    };

    // console.log(nodes.length, uniqueNodes.length)

    return NextResponse.json({ data: records });
  } catch (error) {
    console.error('Error executing Cypher query:', error);
    return NextResponse.error();
  } finally {
    await session.close();
    await driver.close();
  }
}