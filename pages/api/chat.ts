import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { makeChain } from '@/utils/makechain';
import { pinecone } from '@/utils/pinecone-client';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import { Configuration, OpenAIApi } from 'openai';
const configuration = new Configuration({
  organization: 'org-HRpFLdGsffkFpjAoVoPmwGIT',
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { question, history } = req.body;

  if (!question) {
    return res.status(400).json({ message: 'No question in the request' });
  }
  // OpenAI recommends replacing newlines with spaces for best results
  const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

  const promptTreeNamespace = `You will be provided with text. Select from the options below based on relevance. 
  Reply only with the option itself. If you're unsure, select unknown. If the question is about app use or user experience, select faq.
  If the question is something about health or anything related to human physiology, select podcasts.


  Option 1: faq
  Option 2: podcasts
  Option 3: unknown

  Examples:
  Question: How do I use the app?
  Answer: faq

  Question: What did the person say in the podcast?
  Answer: podcasts

  DO NOT REPLY WITH ANYTHING OTHER THAN THE PROVIDED OPTIONS.

  Prompt: ${sanitizedQuestion}
  `;

  const response = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: promptTreeNamespace,
    max_tokens: 7,
    temperature: 0,
  });

  const resp = response.data.choices[0].text?.split(' ')[1];
  let namespace = 'faq';
  if (resp === 'faq') {
    namespace = 'faq';
  } else if (resp === 'podcasts') {
    namespace = 'podcasts';
  }

  console.log('namespace: ' + namespace);

  const index = pinecone.Index(PINECONE_INDEX_NAME);

  /* create vectorstore*/
  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({}),
    {
      pineconeIndex: index,
      textKey: 'text',
      namespace: namespace,
    },
  );

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const sendData = (data: string) => {
    res.write(`data: ${data}\n\n`);
  };

  sendData(JSON.stringify({ data: '' }));

  //create chain
  const chain = makeChain(vectorStore, (token: string) => {
    sendData(JSON.stringify({ data: token }));
  });

  try {
    //Ask a question
    const response = await chain.call({
      question: sanitizedQuestion,
      chat_history: history || [],
    });

    console.log('response', response);
    sendData(JSON.stringify({ sourceDocs: response.sourceDocuments }));
  } catch (error) {
    console.log('error', error);
  } finally {
    sendData('[DONE]');
    res.end();
  }
}
