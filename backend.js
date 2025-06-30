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
let countdown = 600;

// Elements
const statusElement = document.getElementById("status");
const mediaElement = document.getElementById("mediaElement");
const taskInput = document.getElementById("taskInput");
const timeLeft = document.getElementById("timeLeft");

// Countdown timer
const timer = setInterval(() => {
  if (countdown <= 0) {
    clearInterval(timer);
    timeLeft.textContent = "0:00";
  } else {
    countdown--;
    const min = Math.floor(countdown / 60);
    const sec = countdown % 60;
    timeLeft.textContent = `${min}:${sec.toString().padStart(2, "0")}`;
  }
}, 1000);

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
  updateStatus("Session token obtained.");
}

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
      avatar_name: "Wayne_20240711",
      version: "v2",
      video_encoding: "H264",
    }),
  });

  const data = await response.json();
  sessionInfo = data.data;
  updateStatus("Session created.");
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

  updateStatus("Streaming started.");
}

async function sendText(text) {
  if (!sessionInfo) return updateStatus("No active session.");

  await fetch(`${API_CONFIG.serverUrl}/v1/streaming.task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      session_id: sessionInfo.session_id,
      text,
      task_type: "talk",
    }),
  });

  updateStatus(`Sent: ${text}`);
}

async function closeSession() {
  if (!sessionInfo) return updateStatus("No active session.");

  await fetch(`${API_CONFIG.serverUrl}/v1/streaming.stop`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ session_id: sessionInfo.session_id }),
  });

  sessionInfo = null;
  sessionToken = null;
  updateStatus("Session closed.");
}

function downloadTranscript() {
  if (!transcriptLog.length) return updateStatus("Transcript is empty.");

  const blob = new Blob([JSON.stringify(transcriptLog, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transcript.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  updateStatus("Transcript downloaded.");
}

// Event bindings
document.getElementById("startBtn").addEventListener("click", async () => {
  await createNewSession();
  await startStreamingSession();
});

document.getElementById("closeBtn").addEventListener("click", closeSession);

document.getElementById("talkBtn").addEventListener("click", () => {
  const text = taskInput.value.trim();
  if (text) {
    transcriptLog.push({
      speaker: "user",
      text,
      timestamp: new Date().toISOString(),
    });
    sendText(text);
    taskInput.value = "";
  }
});

document.getElementById("downloadTranscriptBtn").addEventListener("click", downloadTranscript);

document.getElementById("endSessionBtn").addEventListener("click", closeSession);

document.getElementById("muteBtn").addEventListener("click", () => {
  mediaElement.muted = !mediaElement.muted;
  updateStatus(mediaElement.muted ? "Muted." : "Unmuted.");
});

document.getElementById("endChatBtn").addEventListener("click", () => {
  updateStatus("Chat ended.");
});
