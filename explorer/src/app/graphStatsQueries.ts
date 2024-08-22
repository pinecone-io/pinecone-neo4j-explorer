import { Driver, Record, Result, type Session } from 'neo4j-driver'

interface GraphStats {
  nodeCounts: { [key: string]: number };
  edgeCounts: { [key: string]: number };
  mostConnectedNodes: { nodeType: string; nodeName: string; connections: number }[];
  commonNodeProperties: { nodeType: string; properties: string[] }[];
  relationshipPatterns: { pattern: string; count: number }[];
  schema: string
  // longestPaths: { startType: string; endType: string; pathLength: number; nodeTypes: string[] }[];
  // nodeDegreeDistribution: { nodeType: string; degreeCounts: { [key: number]: number } }[];
  graphStructure: string
  edgeTypes: string[]
  nodeTypes: string[]
}

interface DegreeDistribution {
  nodeType: string;
  degreeCounts: { [key: number]: number };
}

async function runQuery(driver: Driver, query: string): Promise<Result> {
  const session = driver.session();
  try {
    return await session.run(query);
  } finally {
    await session.close();
  }
}

async function getNodeCounts(driver: Driver): Promise<{ [key: string]: number }> {
  const result = await runQuery(driver, `
    MATCH (n)
    RETURN labels(n) AS nodeType, count(*) AS count
    ORDER BY count DESC
  `);
  return result.records.reduce((acc: { [key: string]: number }, record: Record) => {
    acc[record.get('nodeType')[0]] = record.get('count').toNumber();
    return acc;
  }, {});
}

async function getEdgeCounts(driver: Driver): Promise<{ [key: string]: number }> {
  const result = await runQuery(driver, `
    MATCH ()-[r]->()
    RETURN type(r) AS edgeType, count(*) AS count
    ORDER BY count DESC
  `);
  return result.records.reduce((acc: { [key: string]: number }, record: Record) => {
    acc[record.get('edgeType')] = record.get('count').toNumber();
    return acc;
  }, {});
}

async function getMostConnectedNodes(driver: Driver): Promise<{ nodeType: string; nodeName: string; connections: number }[]> {
  const result = await runQuery(driver, `
    MATCH (n)
    RETURN labels(n) AS nodeType, n.name AS nodeName, COUNT{ (n)--() } AS connections
    ORDER BY connections DESC
    LIMIT 5
  `);
  return result.records.map(record => ({
    nodeType: record.get('nodeType')[0],
    nodeName: record.get('nodeName'),
    connections: record.get('connections').toNumber()
  }));
}

async function getCommonNodeProperties(driver: Driver): Promise<{ nodeType: string; properties: string[] }[]> {
  const result = await runQuery(driver, `
    MATCH (n)
    UNWIND keys(n) AS key
    WITH labels(n) AS nodeType, key
    RETURN DISTINCT nodeType, collect(key) AS properties
    ORDER BY nodeType
  `);
  return result.records.map(record => ({
    nodeType: record.get('nodeType')[0],
    properties: record.get('properties')
  }));
}

async function getRelationshipPatterns(driver: Driver): Promise<{ pattern: string; count: number }[]> {
  const result = await runQuery(driver, `
    MATCH (a)-[r]->(b)
    WITH labels(a)[0] + '-[' + type(r) + ']->' + labels(b)[0] AS pattern, count(*) AS count
    RETURN pattern, count
    ORDER BY count DESC
  `);
  return result.records.map(record => ({
    pattern: record.get('pattern'),
    count: record.get('count').toNumber()
  }));
}

async function getSchema(driver:Driver): Promise<string> {
  const result = await runQuery(driver, `
    CALL apoc.meta.schema({
      includeLabels: true,
      includeRels: true,
      sample: -1
    })
    YIELD value
    UNWIND keys(value) as label
    WITH label, value[label] as data
    WHERE data.type = "node"
    MATCH (n)
    OPTIONAL MATCH (n)-[r]->(m)
    WITH label, data, 
        collect(DISTINCT {
          type: type(r), 
          direction: "outgoing", 
          targetLabel: head(labels(m))
        }) as outRelations
    OPTIONAL MATCH (n)<-[r]-(m)
    WITH label, data, outRelations,
        collect(DISTINCT {
          type: type(r), 
          direction: "incoming", 
          sourceLabel: head(labels(m))
        }) as inRelations
    RETURN {
      label: label,
      properties: data.properties,
      outgoingRelationships: outRelations,
      incomingRelationships: inRelations
    } as schema`)
  return result.records[0].get('schema')
}

async function generateGraphStructure(driver: Driver): Promise<string> {
  const session: Session = driver.session();
  let structureString = "";

  try {
    const result = await session.run(`
      CALL apoc.meta.schema()
      YIELD value
      RETURN value
    `);

    if (result.records.length > 0) {
      const schema = result.records[0].get('value');

      if (schema && typeof schema === 'object') {
        for (const [nodeType, nodeDetails] of Object.entries(schema)) {
          const relationships = (nodeDetails as any).relationships;
          if (relationships && typeof relationships === 'object') {
            for (const [relType, relDetails] of Object.entries(relationships)) {
              const direction = (relDetails as any).direction;
              const targetNodeTypes = (relDetails as any).labels;

              if (Array.isArray(targetNodeTypes)) {
                for (const targetNodeType of targetNodeTypes) {
                  if (direction === 'OUT' || direction === 'BOTH') {
                    structureString += `- (${nodeType})-[:${relType}]->(${targetNodeType})\n`;
                  }
                  if (direction === 'IN' || direction === 'BOTH') {
                    structureString += `- (${targetNodeType})-[:${relType}]->(${nodeType})\n`;
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error generating graph structure:', error);
  } finally {
    await session.close();
  }

  return structureString || "No graph structure found.";
}

// async function getLongestPaths(driver: Driver): Promise<{ startType: string; endType: string; pathLength: number; nodeTypes: string[] }[]> {
//   const result = await runQuery(driver, `
//     MATCH path = (start)-[*]->(end)
//     WHERE id(start) <> id(end)
//     RETURN labels(start)[0] AS startType, labels(end)[0] AS endType,
//            length(path) AS pathLength, [n IN nodes(path) | labels(n)[0]] AS nodeTypes
//     ORDER BY pathLength DESC
//     LIMIT 3
//   `);
//   return result.records.map(record => ({
//     startType: record.get('startType'),
//     endType: record.get('endType'),
//     pathLength: record.get('pathLength').toNumber(),
//     nodeTypes: record.get('nodeTypes')
//   }));
// }

async function getNodeDegreeDistribution(driver: Driver): Promise<DegreeDistribution[]> {
  const result = await runQuery(driver, `
    MATCH (n)
    WITH labels(n) AS nodeType, COUNT{ (n)--() } AS degree
    RETURN nodeType, degree, count(*) AS frequency
    ORDER BY nodeType, degree
  `);
  
  const distribution: { [nodeType: string]: { [degree: number]: number } } = {};
  
  result.records.forEach((record: Record) => {
    const nodeType = record.get('nodeType')[0] as string;
    const degree = record.get('degree').toNumber();
    const frequency = record.get('frequency').toNumber();
    
    if (!distribution[nodeType]) {
      distribution[nodeType] = {};
    }
    distribution[nodeType][degree] = frequency;
  });

  return Object.entries(distribution).map(([nodeType, degreeCounts]): DegreeDistribution => ({
    nodeType,
    degreeCounts
  }));
}

async function getEdgeTypes(driver: Driver): Promise<string[]> {
  const result = await runQuery(driver, `
    MATCH ()-[r]->()
    RETURN type(r) AS edgeType, count(*) AS count
    ORDER BY count DESC
    LIMIT 5
  `);
  return result.records.map(record => record.get('edgeType'))
}

async function getNodeTypes(driver: Driver): Promise<string[]> {
  const result = await runQuery(driver, `
    MATCH (n)
    RETURN labels(n) AS nodeType, count(*) AS count
    ORDER BY count DESC
    LIMIT 5
  `);
  return result.records.map(record => record.get('nodeType'))
}

async function getGraphStats(driver: Driver): Promise<GraphStats> {
  return {
    schema: await getSchema(driver),
    nodeCounts: await getNodeCounts(driver),
    edgeCounts: await getEdgeCounts(driver),
    mostConnectedNodes: await getMostConnectedNodes(driver),
    commonNodeProperties: await getCommonNodeProperties(driver),
    relationshipPatterns: await getRelationshipPatterns(driver),
    graphStructure: await generateGraphStructure(driver),
    // longestPaths: await getLongestPaths(driver),
    // nodeDegreeDistribution: await getNodeDegreeDistribution(driver)
    edgeTypes: await getEdgeTypes(driver),
    nodeTypes: await getNodeTypes(driver)
  };
}

function reduceGraphStats(stats: GraphStats): GraphStats {
  console.log("PATTERNS", stats.relationshipPatterns)
  return {
    schema: stats.schema,
    nodeCounts: stats.nodeCounts,
    edgeCounts: stats.edgeCounts,
    mostConnectedNodes: stats.mostConnectedNodes.slice(0, 3),
    commonNodeProperties: stats.commonNodeProperties.map(item => ({
      nodeType: item.nodeType,
      properties: item.properties.slice(0, 5)
    })),
    relationshipPatterns: stats.relationshipPatterns.slice(0, 3),
    graphStructure: stats.graphStructure,
    edgeTypes: stats.edgeTypes,
    nodeTypes: stats.nodeTypes,
    // longestPaths: stats.longestPaths.slice(0, 2),
    // nodeDegreeDistribution: stats.nodeDegreeDistribution.map(item => ({
    //   nodeType: item.nodeType,
    //   degreeCounts: Object.fromEntries(
    //     Object.entries(item.degreeCounts)
    //       .sort(([a], [b]) => parseInt(b) - parseInt(a))
    //       .slice(0, 3)
    //   )
    // }))
  };
}
export async function getReducedGraphStats(driver: Driver): Promise<GraphStats> {
  const stats = await getGraphStats(driver)
  return reduceGraphStats(stats)
}