import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { pinecone } from '@/utils/pinecone-client';
import { CustomPDFLoader } from '@/utils/customPDFLoader';
import { PINECONE_INDEX_NAME } from '@/config/pinecone';
import { DirectoryLoader, TextLoader } from 'langchain/document_loaders';
import { Document } from 'langchain/document';
import faqs from '../docs/outfile.json';
import podcast from '../docs/podcasts/7.json';

/* Name of directory to retrieve your files from */
const filePath = 'docs';

export const run = async () => {
  try {
    const docs: Document[] = [];
    for (let i = 0; i < podcast.length; i++) {
      let doc: Document = podcast[i];
      console.log(doc);
      docs.push(doc);
    }

    console.log('creating vector store...');
    /*create and store the embeddings in the vectorStore*/
    const embeddings = new OpenAIEmbeddings();
    const index = pinecone.Index(PINECONE_INDEX_NAME); //change to your own index name

    //embed the documents
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: 'podcasts',
      // textKey: 'text',
    });
  } catch (error) {
    console.log('error', error);
    throw new Error('Failed to ingest your data');
  }
};

(async () => {
  await run();
  console.log('ingestion complete');
})();

/*
  Other ways to ingest data:


const docs: Document[] = [];
    for (let i = 0; i < faqs.length; i++) {
      let obj = faqs[i];
      const doc = new Document({
        metadata: { title: obj.Title, source: obj.Source },
        pageContent: obj.Content,
      });
      console.log(doc);
      docs.push(doc);
    }

    

const directoryLoader = new DirectoryLoader(filePath, {
      '.txt': (path) => new TextLoader(path),
    });

const loader = new PDFLoader(filePath);
*/

// /*load raw docs from all files in the directory */
// const directoryLoader = new DirectoryLoader(filePath, {
//   '.pdf': (path) => new CustomPDFLoader(path),
// });

// const rawDocs = await directoryLoader.load();

// /* Split text into chunks */
// const textSplitter = new RecursiveCharacterTextSplitter({
//   chunkSize: 1000,
//   chunkOverlap: 200,
// });

// const docs = await textSplitter.splitDocuments(rawDocs);
// console.log('split docs', docs);
