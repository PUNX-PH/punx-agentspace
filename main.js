import { connect } from 'https://cdn.livekit.io/js/livekit-client.min.js';

const AGENT_ID = 'Pedro_CasualLook_public';
const API_KEY = 'ZmVjNDdmZDM5NmYwNGRmMmE5NTcyYjQ1YzA1YjNiY2EtMTc1MDc1MTE3Nw==';
const LIVEKIT_URL = 'wss://globe-google-agent-space-wn7xyct0.livekit.cloud';
const LIVEKIT_TOKEN = 'API9uhbHdXSFxiZ';

const videoElement = document.getElementById('avatar-video');
const transcriptEl = document.getElementById('transcript');

// Start LiveKit connection
async function connectLiveKit() {
  const room = await connect(LIVEKIT_URL, LIVEKIT_TOKEN, {
    video: false,
    audio: true,
  });

  // Render remote participant’s video stream (avatar)
  room.on('trackSubscribed', (track, publication, participant) => {
    if (track.kind === 'video') {
      track.attach(videoElement);
    }
  });

  return room;
}

// Send user message to HeyGen
async function sendMessage() {
  const text = document.getElementById('text-input').value;
  if (!text) return;

  const response = await fetch('https://api.heygen.com/v2/streaming-agent/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: AGENT_ID,
      query: text,
    }),
  });

  const result = await response.json();
  console.log('HeyGen response:', result);
  transcriptEl.innerText = `You: ${text}\nAI: ${result.reply}`;
}

connectLiveKit();
