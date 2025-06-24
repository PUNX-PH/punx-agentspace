const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/save-chat', (req, res) => {
  const chatData = req.body;
  const fileName = `chat_${Date.now()}.json`;
  fs.writeFileSync(`./chats/${fileName}`, JSON.stringify(chatData, null, 2));
  res.status(200).send({ message: 'Chat saved', file: fileName });
});

app.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
