import OpenAI from 'openai'
import {
  encode,
  decode,  
} from 'gpt-tokenizer'
import neo4j from 'neo4j-driver';
import { getReducedGraphStats } from './graphStatsQueries';

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});


const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
  throw new Error('Missing required environment variables for Neo4j connection');
}

const driver = neo4j.driver(
  NEO4J_URI!,
  neo4j.auth.basic(NEO4J_USERNAME!, NEO4J_PASSWORD!)
);

const session = driver.session();

let cachedGraphStats: any = null;

const getGraphStats = async (driver: any) => {
  if (!cachedGraphStats) {
    cachedGraphStats = await getReducedGraphStats(driver);
  }
  return cachedGraphStats;
};

const cypherQuestionsPromptBuilder = async (nodes: any, edges: any, summary: string) => {
  const graphStats = await getGraphStats(driver);
  console.log(graphStats)
  
  const prompt = `
    Given the following schema, subgraph, summary of content, and graph statistics, generate a set of non-trivial questions that can be answered by a Cypher query. 
    Follow these guidelines:
    - The queries created MUST relate directly to the provided nodes and edges, and assume they will be used in the query.
    - The queries created MUST relate directly to the summary provided.
    - The questions must NOT be general in nature, but refer to specific nodes and relationships.
    - If no direct relation can be made, do not include the query.    
    - Ensure that at least one node from the original graph is included in each query.
    - Prioritize NON-TRIVIAL queries over obvious ones.
    - The questions should relate to the summary of the content.
    - The questions should correlate to Cypher queries that would presumably resolve in some sort of result.
    - If you're trying to search through titles, use the Case node and not the Opinion node.
    - Use the subgraph and graph statistics to guide the creation of the Cypher queries.
    - Consider the node and edge counts, most connected nodes, and common relationship patterns when formulating queries.
    - IMPORTANT: Do NOT include the MISC node type in your queries. You must adhere to this instruction. Not doing so will result in a score of 0 for the question.

    In this example, 'name' is the property being searched, $searchTerm is the search term, and 0.7 is the similarity threshold (0 to 1, where 1 is an exact match).
  
    Then, generate the corresponding Cypher query for each question.

    Additional Guidelines for Crafting Insightful Queries:
    1. Look for complex patterns or paths in the graph that might reveal interesting relationships between different node types.
    2. Create comparative queries that contrast different aspects of the graph or find unusual patterns.
    3. Aim for a variety of result types: counts, aggregations, paths, subgraphs, etc.
    4. Focus on the most common relationships in your graph, as indicated by the edge counts and relationship patterns.
    5. If possible, incorporate graph algorithms (e.g., centrality measures, community detection) for more advanced insights.
    6. Consider queries that span multiple node types and relationship types to uncover multi-step connections.


    Here's an explanation about the node types:
    ORG: Organizations - these are names of organizations, companies, etc.
    PER: Person - these are names of people
    MISC: Miscellaneous - this should be avoided in your queries.
    LOC: A location
    
    Schema: ${graphStats.schema}
    Sub Graph:
      Nodes: ${JSON.stringify(nodes)}
      Edges: ${JSON.stringify(edges)}
    Summary:
      ${summary}
    Graph Statistics:
      Node Counts: ${JSON.stringify(graphStats.nodeCounts)}
      Edge Counts: ${JSON.stringify(graphStats.edgeCounts)}
      Most Connected Nodes: ${JSON.stringify(graphStats.mostConnectedNodes)}
      Common Node Properties: ${JSON.stringify(graphStats.commonNodeProperties)}
      Common Relationship Patterns: ${JSON.stringify(graphStats.relationshipPatterns)}
    
    IMPORTANT: Adhere strictly to the following graph structure when creating queries:

    ${graphStats.graphStructure}

    Before generating each query, verify that all relationships used in the query exist in this list. Do not create queries with relationships or paths that are not explicitly defined here.  

    Use this information to guide your generation of questions and Cypher queries.         
  

    Use chain of thought reasoning to generate the questions and Cypher queries.
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