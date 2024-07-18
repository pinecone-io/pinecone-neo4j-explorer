import OpenAI from 'openai'
import {
  encode,
  encodeChat,
  decode,
  isWithinTokenLimit,
  encodeGenerator,
  decodeGenerator,
  decodeAsyncGenerator,
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
  const summary = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: "system", content: `Summarize the following emails:\n\n${text}. Summarize all the emails and combine them together, and indicate what the common theme across all of them is. Do not under any circumstances just quote the emails in full. Always summarize the whole set of emails. Start by mentioning the number of emails processed.`,}
    ]    
  });

  return summary.choices[0].message.content;
}


const summarizeEmails = async (emails: string[]) => {
  const fullText = emails.join('\n\n');  
  return await recursiveSummary(fullText);
}

export { summarizeEmails }