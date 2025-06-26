// For Express or Vercel (rename as /api/chat.js if Vercel)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
  
    const { agentId } = req.body;
  
    const response = await fetch(`https://api.d-id.com/agents/${agentId}/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.D_ID_API_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
  
    const data = await response.json();
    res.status(response.ok ? 200 : 400).json(data);
  }
  