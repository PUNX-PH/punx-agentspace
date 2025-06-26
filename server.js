// server.js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const D_ID_API_KEY = process.env.D_ID_API_KEY;

app.post('/api/chat', async (req, res) => {
  const { agentId, message } = req.body;

  try {
    const chatResp = await fetch(`https://api.d-id.com/agents/${agentId}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(D_ID_API_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    const chat = await chatResp.json();
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Proxy server running on http://localhost:3000');
});
