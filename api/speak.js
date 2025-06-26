export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST allowed" });
    }
  
    const { agentId, inputText } = req.body;
  
    const response = await fetch(`https://api.d-id.com/agents/${agentId}/chat`, {
      method: "POST",
      headers: {
        "Authorization": "Basic ZXZhbmRlci5mb3h4QGRzaXRpcC5jb20:6ZPRGocDVi5Z82-f71CHF", // OR Bearer API_KEY
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "text",
        input: inputText
      })
    });
  
    const data = await response.json();
    res.status(response.status).json(data);
  }
  