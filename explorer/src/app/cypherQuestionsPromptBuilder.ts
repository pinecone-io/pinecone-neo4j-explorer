import OpenAI from 'openai'
import {
  encode,
  decode,  
} from 'gpt-tokenizer'

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});


const cypherQuestionsPromptBuilder = (nodes: any, edges: any, summary: string) => {
  const prompt = `
    Given the following schema and subgraph as well as a summary of content, generate a set of non-trivial questions that can be answered by a Cypher query. 
    The queries created should relate directly to the provided nodes and edges, and assume they will be used in the query.
    Allow queries that may explore nodes and edges that don't appear in the current graph, but follow the same schema. 
    Ensure that at least one node from the original graph is included in each question.
    Prioritize NON TRIVIAL queries over ones that are obvious.
    Then, generate the corresponding Cypher query for each question.
    Graph Schema:
      {'nodes': ['Case', 'Party', 'Justice', 'Advocate', 'Opinion', 'ORG', 'LOC', 'PER', 'MISC'], 'edges': ['case_opinion', 'alternate_name', 'mentioned_in', 'Petitioner', 'Respondent', 'advocated_by', 'decided_by', 'won_by', 'majority', 'minority', 'based_in', 'none', 'lived_in', 'religion', 'employee_of', 'works_for', 'parent_of', 'child_of', 'has_shareholder', 'owns', 'sibling_of', 'related_to', 'Appellant', 'Appellee', 'charges', 'origin', 'born_in', 'school_attended', 'has_title', 'part_of', 'website']}
    Sub Graph:
      Nodes: ${JSON.stringify(nodes)}
      Edges: ${JSON.stringify(edges)}
    Summary:
      ${summary}       
  `

  return prompt
}

export { cypherQuestionsPromptBuilder }