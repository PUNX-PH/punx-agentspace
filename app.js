const API_CONFIG = {
  apiKey: "ZmVjNDdmZDM5NmYwNGRmMmE5NTcyYjQ1YzA1YjNiY2EtMTc1MDc2NTYwMg==",
  serverUrl: "https://api.heygen.com",
};

let sessionInfo = null;
let room = null;
let mediaStream = null;
let webSocket = null;
let sessionToken = null;
let transcriptLog = [];

const statusElement = document.getElementById("status");
const mediaElement = document.getElementById("mediaElement");
const taskInput = document.getElementById("taskInput");
const micBtn = document.getElementById("micBtn");

function updateStatus(message) {
  const timestamp = new Date().toLocaleTimeString();
  statusElement.innerHTML += `[${timestamp}] ${message}<br>`;
  statusElement.scrollTop = statusElement.scrollHeight;
}

async function getSessionToken() {
  const response = await fetch(`${API_CONFIG.serverUrl}/v1/streaming.create_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": API_CONFIG.apiKey,
    },
  });
  const data = await response.json();
  sessionToken = data.data.token;
  updateStatus("Session token obtained");
}

async function connectWebSocket(sessionId) {
  const params = new URLSearchParams({
    session_id: sessionId,
    session_token: sessionToken,
    silence_response: false,
    opening_text: "Hello, how can I help you?",
    stt_language: "en",
  });

  const wsUrl = `wss://${new URL(API_CONFIG.serverUrl).hostname}/v1/ws/streaming.chat?${params}`;
  webSocket = new WebSocket(wsUrl);

  webSocket.addEventListener("message", (event) => {
    const eventData = JSON.parse(event.data);
    console.log("WebSocket Event:", eventData);

    if (eventData.type === "USER_TALKING_MESSAGE") {
      transcriptLog.push({
        speaker: "user",
        text: eventData.text,
        timestamp: new Date().toISOString(),
      });
    }
  });
}

let avatarBuffer = [];
let avatarSpeaking = false;

async function createNewSession() {
  if (!sessionToken) await getSessionToken();

  const response = await fetch(`${API_CONFIG.serverUrl}/v1/streaming.new`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      quality: "high",
      avatar_name: "Dexter_Lawyer_Sitting_public",
      version: "v2",
      video_encoding: "H264",
      knowledge_base: `
Specialty: Business Models, Monetization, Scalability, Operations
Personality: Analytical, calm, mentor-like
Knowledge Focus:
- Revenue models and pricing strategy
- Financial forecasting and unit economics
- Operational efficiency and scalability
- Risk management and startup resilience
Behavioral Traits:
- Logical, precise, values long-term sustainability
- Focuses on whether the idea is structurally sound
- Encourages data-backed thinking and planning
Response Style:
Neutral and detailed with a strategic tone. Uses analogies from real startups. Asks: “How will this make money at scale?”
`,
    }),
  });

  const data = await response.json();
  sessionInfo = data.data;

 const LivekitClient = window.Livekit;

  room = new LivekitClient.Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: LivekitClient.VideoPresets.h720.resolution,
    },
  });

  room.on(LivekitClient.RoomEvent.DataReceived, (payload) => {
    const dataStr = new TextDecoder().decode(payload);
    try {
      const data = JSON.parse(dataStr);
      if (data.type === "avatar_start_talking") {
        avatarSpeaking = true;
        avatarBuffer = [];
      }
      if (data.type === "avatar_talking_message" && avatarSpeaking) {
        avatarBuffer.push(data.message);
      }
      if (data.type === "avatar_end_message" && avatarSpeaking) {
        const fullMessage = avatarBuffer.join(" ").replace(/\s+/g, " ").trim();
        transcriptLog.push({
          speaker: "avatar",
          text: fullMessage,
          timestamp: new Date().toISOString(),
        });
        avatarBuffer = [];
        avatarSpeaking = false;
      }
    } catch (e) {
      console.warn("Invalid JSON message:", dataStr);
    }
  });

  room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === "video" || track.kind === "audio") {
      mediaStream.addTrack(track.mediaStreamTrack);
      if (
        mediaStream.getVideoTracks().length > 0 &&
        mediaStream.getAudioTracks().length > 0
      ) {
        mediaElement.srcObject = mediaStream;
        updateStatus("Media stream ready");
      }
    }
  });

  room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
    const mediaTrack = track.mediaStreamTrack;
    if (mediaTrack) mediaStream.removeTrack(mediaTrack);
  });

  room.on(LivekitClient.RoomEvent.Disconnected, (reason) => {
    updateStatus(`Room disconnected: ${reason}`);
  });

  mediaStream = new MediaStream();

  await room.prepareConnection(sessionInfo.url, sessionInfo.access_token);
  updateStatus("Connection prepared");

  await connectWebSocket(sessionInfo.session_id);
  updateStatus("Session created successfully");
}

async function startStreamingSession() {
  await fetch(`${API_CONFIG.serverUrl}/v1/streaming.start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ session_id: sessionInfo.session_id }),
  });

  await room.connect(sessionInfo.url, sessionInfo.access_token);
  updateStatus("Connected to room");
  updateStatus("Streaming started successfully");
}

async function sendText(text, taskType = "talk") {
  if (!sessionInfo) return updateStatus("No active session");

  await fetch(`${API_CONFIG.serverUrl}/v1/streaming.task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      session_id: sessionInfo.session_id,
      text,
      task_type: taskType,
    }),
  });

  updateStatus(`Sent text (${taskType}): ${text}`);
}

async function closeSession() {
  if (!sessionInfo) return updateStatus("No active session");

  await fetch(`${API_CONFIG.serverUrl}/v1/streaming.stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ session_id: sessionInfo.session_id }),
  });

  if (webSocket) webSocket.close();
  if (room) room.disconnect();

  mediaElement.srcObject = null;
  sessionInfo = null;
  room = null;
  mediaStream = null;
  sessionToken = null;
  avatarBuffer = [];
  avatarSpeaking = false;

  updateStatus("Session closed");
}

function downloadTranscript() {
  if (!transcriptLog.length) return updateStatus("Transcript is empty.");

  const blob = new Blob([JSON.stringify(transcriptLog, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transcript_${sessionInfo?.session_id || "session"}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  updateStatus("Transcript JSON downloaded.");
}

// Speech Recognition
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recognizing = false;

if (window.SpeechRecognition) {
  recognition = new window.SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognizing = true;
    updateStatus("🎤 Microphone listening...");
  };

  recognition.onerror = (event) => {
    updateStatus(`Microphone error: ${event.error}`);
  };

  recognition.onend = () => {
    recognizing = false;
    updateStatus("🎤 Microphone stopped.");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    if (transcript) {
      updateStatus(`You said: "${transcript}"`);
      transcriptLog.push({
        speaker: "user",
        text: transcript,
        timestamp: new Date().toISOString(),
      });
      sendText(transcript, "talk");
    }
  };
} else {
  micBtn.disabled = true;
  micBtn.textContent = "🎤 Not Supported";
  micBtn.classList.add("opacity-50", "cursor-not-allowed");
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !recognizing && recognition) {
    event.preventDefault();
    recognition.start();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code === "Space" && recognizing && recognition) {
    event.preventDefault();
    recognition.stop();
  }
});

// UI Binds
const talkBtn = document.querySelector("#talkBtn");
if (talkBtn)
  talkBtn.addEventListener("click", () => {
    const text = taskInput?.value.trim();
    if (text) {
      transcriptLog.push({ speaker: "user", text, timestamp: new Date().toISOString() });
      sendText(text, "talk");
      taskInput.value = "";
    }
  });

const downloadBtn = document.querySelector("#downloadTranscriptBtn");
if (downloadBtn) downloadBtn.addEventListener("click", downloadTranscript);

const endSessionBtn = document.querySelector("#endSessionBtn");
if (endSessionBtn)
  endSessionBtn.addEventListener("click", async () => {
    await closeSession();
    updateStatus("🔴 Session ended by user.");
  });

// Auto Start on Load
(async () => {
  const LivekitClient = window.livekitClient;
  await createNewSession();
  await startStreamingSession();
})();
