import neo4j from 'neo4j-driver';
import { getReducedGraphStats } from './graphStatsQueries';

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
  throw new Error('Missing required environment variables for Neo4j connection');
}

const driver = neo4j.driver(
  NEO4J_URI!,
  neo4j.auth.basic(NEO4J_USERNAME!, NEO4J_PASSWORD!)
);


let cachedGraphStats: any = null;

const getGraphStats = async (driver: any) => {
  if (!cachedGraphStats) {
    cachedGraphStats = await getReducedGraphStats(driver);
  }
  return cachedGraphStats;
};

const cypherQuestionsPromptBuilder = async (nodes: any, edges: any, summary: string) => {
  const graphStats = await getGraphStats(driver);
  
  const prompt = `
    <context>
      You are an expert in graph databases and Cypher queries. 
      Your task is to generate insightful questions and corresponding Cypher queries based on the provided graph information as well as the summary.
    </context>

    <schema>${graphStats.schema}</schema>

    <subgraph>
      <nodes>${JSON.stringify(nodes)}</nodes>
      <edges>${JSON.stringify(edges)}</edges>
    </subgraph>

    <summary>${summary}</summary>

    <graph_statistics>
      <node_counts>${JSON.stringify(graphStats.nodeCounts)}</node_counts>
      <edge_counts>${JSON.stringify(graphStats.edgeCounts)}</edge_counts>
      <most_connected_nodes>${JSON.stringify(graphStats.mostConnectedNodes)}</most_connected_nodes>
      <common_node_properties>${JSON.stringify(graphStats.commonNodeProperties)}</common_node_properties>
      <relationship_patterns>${JSON.stringify(graphStats.relationshipPatterns)}</relationship_patterns>
    </graph_statistics>

    <graph_structure>${graphStats.graphStructure}</graph_structure>

    <node_types>
      ${graphStats.nodeTypes.map((nodeType: string) => `<nodeType>${nodeType}</nodeType>`).join('')}
    </node_types>

    <edge_types>
      ${graphStats.edgeTypes.map((edgeType: string) => `<edgeType>${edgeType}</edgeType>`).join('')}
    </edge_types>

    <query_strategies>
      When formulating queries, use these strategies to increase the likelihood of returning results:
      1. Use case-insensitive regex matching for names and terms: =~ '(?i).*term.*'
      2. Employ OPTIONAL MATCH for potentially missing relationships or nodes.
      3. Broaden node matches: Include relevant alternative labels (e.g., :LOC OR :MISC).
      4. Use flexible relationship patterns: -[:RELATIONSHIP*1..2]-> for variable-length paths.
      5. Always include a LIMIT clause to prevent overwhelming results.
      6. Use COUNT and aggregations to summarize data when appropriate.
      7. Consider partial matches: Use CONTAINS or regex patterns instead of exact matches.
      8. Provide alternatives for potentially inconsistent data (e.g., full names vs. last names).
    </query_strategies>

    <query_structure>
      Follow this general structure for queries:
      1. Main MATCH clause(s) for primary entities.
      2. WHERE clause with flexible matching (regex, CONTAINS).
      3. OPTIONAL MATCH for related entities that might not always exist.
      4. RETURN clause with relevant data and aggregations.
      5. ORDER BY for sorted results when applicable.
      6. LIMIT clause (usually 5-10 results).
    </query_structure>

    

    <cypher_guidelines_and_examples>

    Guidelines for Effective Cypher Queries:

    1. Explore diverse node and relationship types.
    2. Use flexible matching with case-insensitive regex patterns.
    3. Employ OPTIONAL MATCH for potentially missing relationships.
    4. Structure queries logically: MATCH, WHERE, OPTIONAL MATCH, RETURN, ORDER BY, LIMIT.
    5. Utilize advanced techniques like path finding, CASE statements, UNION, and subqueries when appropriate.
    6. Prioritize query performance and clarity.
    7. Adapt queries to specific questions, being prepared to try alternative approaches.

    General Example Queries:

    1. Basic pattern matching with multiple node types:
    MATCH (c:Case)
    OPTIONAL MATCH (c)-[:decided_by]->(j:Justice)
    OPTIONAL MATCH (c)-[:considers_policy]->(p:PolicyArea)
    RETURN c.name AS case_name, j.name AS justice, p.name AS policy_area
    LIMIT 5

    2. Flexible text matching and aggregation:
    MATCH (e:Entity)
    WHERE e.name =~ '(?i).*constitutional.*'
    OPTIONAL MATCH (e)<-[:mentions]-(c:Case)
    RETURN e.name AS entity, COUNT(c) AS mention_count
    ORDER BY mention_count DESC
    LIMIT 5

    3. Path finding with variable length relationships:
    MATCH path = (c1:Case)-[:cites*1..3]->(c2:Case)
    WHERE c1.name =~ '(?i).*landmark.*'
    RETURN c1.name AS source_case, c2.name AS cited_case, 
          [r IN relationships(path) | type(r)] AS citation_chain
    LIMIT 5

    4. Combining multiple patterns with UNION:
    MATCH (c:Case)-[:ruled_on]->(i:Issue)
    WHERE i.name =~ '(?i).*privacy.*'
    RETURN c.name AS case_name, 'Privacy' AS category
    LIMIT 5
    UNION
    MATCH (c:Case)-[:considers_policy]->(p:PolicyArea)
    WHERE p.name =~ '(?i).*technology.*'
    RETURN c.name AS case_name, 'Technology' AS category
    LIMIT 5

    5. Using CASE statements for data categorization:
    MATCH (c:Case)-[:decided_by]->(j:Justice)
    RETURN j.name AS justice,
          COUNT(c) AS total_cases,
          CASE 
            WHEN COUNT(c) > 100 THEN 'Prolific'
            WHEN COUNT(c) > 50 THEN 'Active'
            ELSE 'Moderate'
          END AS activity_level
    ORDER BY total_cases DESC
    LIMIT 5

    Remember to adapt these patterns to the specific questions at hand, exploring various aspects of the legal database without overemphasizing any particular node type or relationship.

    </cypher_guidelines_and_examples>

    
    <chain_of_thought>
      For each question and query, follow this reasoning process:
      1. Identify the main entities and relationships needed.
      2. Start with a broad MATCH clause for the primary entity.
      3. Add WHERE clauses using case-insensitive regex for flexible name matching.
      4. Include OPTIONAL MATCH for related entities that might not always be present.
      5. Consider alternative labels or relationships that could contain relevant data.
      6. Use aggregations (COUNT, COLLECT) for summarizing data when appropriate.
      7. Always include ORDER BY (if relevant) and LIMIT clauses.
      8. Review the query to ensure it follows the successful patterns in the example queries.
    </chain_of_thought>

    Generate 5-7 questions with corresponding Cypher queries using this approach. For each question, provide:
    1. The main, specific query
    2. A version of the query with fuzzy matching for relevant text properties
    3. A more general alternative query
    4. A brief explanation of how the alternative query differs and why it might be useful

    Important: The queries must be related in a substantive way the summary.
    Avoid general aggregation questions that pertain to specific people like, "Which cases were decided by Justice Clarence Thomas?"
  `
  return prompt
}

export { cypherQuestionsPromptBuilder }

// Graph Schema:
//       {'nodes': ['Case', 'Party', 'Justice', 'Advocate', 'ORG', 'LOC', 'PER', 'MISC'], 'edges': ['case_opinion', 'alternate_name', 'mentioned_in', 'Petitioner', 'Respondent', 'advocated_by', 'decided_by', 'won_by', 'majority', 'minority', 'based_in', 'none', 'lived_in', 'religion', 'employee_of', 'works_for', 'parent_of', 'child_of', 'has_shareholder', 'owns', 'sibling_of', 'related_to', 'Appellant', 'Appellee', 'charges', 'origin', 'born_in', 'school_attended', 'has_title', 'part_of', 'website']}

// Longest Paths: ${JSON.stringify(graphStats.longestPaths)}
//       Node Degree Distribution: ${JSON.stringify(graphStats.nodeDegreeDistribution)}

// - Favor structural and aggregative queries over content-based queries.

// - Allow queries that may explore nodes and edges that don't appear in the current graph, but follow the same schema. 


//     IMPORTANT: For EACH question, provide TWO versions of the Cypher query:
//     1. A standard query without fuzzy matching
//     2. A query using fuzzy matching for text properties

//     When using fuzzy matching, follow these guidelines:
//     - Use the apoc.text.fuzzyMatch() function for text properties like names, titles, or descriptions.
//     - Set an appropriate similarity threshold (between 0 and 1) based on how strict the matching should be.
//     - Example of fuzzy matching in a query:
//       MATCH (n:Node)
//       WHERE apoc.text.fuzzyMatch(n.name, $searchTerm) > 0.7
//       RETURN n
