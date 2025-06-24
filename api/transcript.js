export default async function handler(req, res) {
    const { session_id } = req.query;
  
    if (!session_id) {
      return res.status(400).json({ error: "Missing session_id" });
    }
  
    const response = await fetch(`https://api.heygen.com/v1/streaming.transcript?session_id=${session_id}`, {
      method: "GET",
      headers: {
        Authorization: "Bearer ZmVjNDdmZDM5NmYwNGRmMmE5NTcyYjQ1YzA1YjNiY2EtMTc1MDc2NTYwMg==", // Replace with your real token
      },
    });
  
    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }
  
    const data = await response.json();
  
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);
  }
  