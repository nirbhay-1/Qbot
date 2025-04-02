import express from 'express';
import { Configuration, OpenAIApi } from 'openai';
import { PineconeClient } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

// Initialize Pinecone
const pinecone = new PineconeClient();
await pinecone.init({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index('faq-chatbot'); // Ensure this index exists

// Embed text function
async function getEmbedding(text) {
    const response = await openai.createEmbedding({
        model: 'text-embedding-ada-002',
        input: text
    });
    return response.data.data[0].embedding;
}

// Store FAQ in Pinecone
app.post('/add-faq', async (req, res) => {
    const { question, answer } = req.body;
    const vector = await getEmbedding(question);
    await index.upsert([{ id: question, values: vector, metadata: { answer } }]);
    res.json({ message: 'FAQ added successfully!' });
});

// Query the chatbot
app.post('/query', async (req, res) => {
    const { query } = req.body;
    const vector = await getEmbedding(query);
    const queryResponse = await index.query({
        vector,
        topK: 1,
        includeMetadata: true
    });
    
    if (queryResponse.matches.length > 0) {
        res.json({ answer: queryResponse.matches[0].metadata.answer });
    } else {
        res.json({ answer: 'Sorry, I could not find a relevant answer.' });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));

