export default async function handler(req, res) {
    const { session_id } = req.query;
  
    if (!session_id) {
      return res.status(400).json({ error: "Missing session_id in query" });
    }
  
    try {
      const response = await fetch(`https://api.heygen.com/v1/streaming.transcript?session_id=${session_id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.HEYGEN_API_KEY}`,
        },
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }
  
      const data = await response.json();
  
      // Allow CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(200).json(data);
    } catch (error) {
      console.error("Error fetching transcript:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
  