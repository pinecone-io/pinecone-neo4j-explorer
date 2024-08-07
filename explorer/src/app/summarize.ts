import OpenAI from 'openai'
import {
  encode,
  decode,  
} from 'gpt-tokenizer'

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

const MAX_TOKENS = 128000

const recursiveSummary = async (text: string) => {  
  
  const encoded = encode(text);
  const numTokens = encoded.length;

  console.log(numTokens)

  if (numTokens < MAX_TOKENS) {
    return summarize(text); 
  }

  const numChunks = Math.ceil(numTokens / MAX_TOKENS);
  const chunkSize = Math.ceil(numTokens / numChunks);

  const chunks = Array.from({ length: numChunks }, (_, i) => {
    const start = i * chunkSize;
    const end = (i + 1) * chunkSize;
    return decode(encoded.slice(start, end));
  });

  const summaries = await Promise.all(chunks.map(chunk => summarize(chunk)));

  const finalSummary = await summarize(summaries.join('\n\n'));
  return finalSummary;

}

const summarize = async (text: string) => {
  const prompt = `Summarize the following Supreme Court opinions:\n\n${text}. 
  Indicate the number of opinions processed. Find the most common themes across all of them.
  Whenever mentioning a case, clearly indicate the case name and docket number.
  `
  const summary = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: "system", content: prompt,}
    ]    
  });

  return summary.choices[0].message.content;
}


const answer = async (text: string, query: string) => {
  const summary = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: "system", content: `Related the following text:\n\n${text} \n\nto this query ${query}.`,}
    ]    
  });

  return summary.choices[0].message.content;
}


const summarizeOpinions = async (opinions: string[], query: string) => {
  const fullText = opinions.join('\n\n');  
  const summary = await recursiveSummary(fullText);
  if (!summary) {
    return { summary: '' }
  }
  const finalAnswer = await answer(summary, query);
  console.log("finalAnswer", finalAnswer)
  return finalAnswer
}

export { summarizeOpinions }