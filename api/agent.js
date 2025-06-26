export default async function handler(req, res) {
    const agentId = "agt_Jd4BnTW4"; // Replace with your actual ID
  
    const response = await fetch(`https://api.d-id.com/agents/${agentId}`, {
      headers: {
        "Authorization": "Basic ZXZhbmRlci5mb3h4QGRzaXRpcC5jb20:3vPGhYgaZ6NDukM8jUTKp", // Optional
        "Content-Type": "application/json",
      },
    });
  
    const data = await response.json();
    res.status(200).json(data);
  }
  