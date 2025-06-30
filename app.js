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
const avatarID = document.getElementById("avatarID");
const taskInput = document.getElementById("taskInput");

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
      avatar_name: avatarID.value,
      version: "v2",
      video_encoding: "H264",
    }),
  });

  const data = await response.json();
  sessionInfo = data.data;

  mediaStream = new MediaStream();

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

  updateStatus("Streaming started");
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
  mediaElement.srcObject = null;

  sessionInfo = null;
  room = null;
  mediaStream = null;
  sessionToken = null;

  updateStatus("Session closed");
}

function downloadTranscript() {
  if (!transcriptLog.length) return updateStatus("Transcript is empty.");

  const blob = new Blob([JSON.stringify(transcriptLog, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transcript_${sessionInfo?.session_id || "session"}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  updateStatus("Transcript downloaded");
}

// Timer countdown
let secondsLeft = 600;
const timerSpan = document.getElementById('timeLeft');
setInterval(() => {
  if (secondsLeft > 0) {
    secondsLeft--;
    const min = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const sec = String(secondsLeft % 60).padStart(2, '0');
    timerSpan.textContent = `${min}:${sec}`;
  }
}, 1000);

// Button event handlers
document.getElementById("startBtn").addEventListener("click", async () => {
  await createNewSession();
  await startStreamingSession();
});

document.getElementById("closeBtn").addEventListener("click", closeSession);

document.getElementById("talkBtn").addEventListener("click", () => {
  const text = taskInput.value.trim();
  if (text) {
    transcriptLog.push({ speaker: "user", text, timestamp: new Date().toISOString() });
    sendText(text, "talk");
    taskInput.value = "";
  }
});

document.getElementById("downloadTranscriptBtn").addEventListener("click", downloadTranscript);

document.getElementById("endSessionBtn").addEventListener("click", closeSession);

document.getElementById("muteMicBtn").addEventListener("click", () => {
  alert("Microphone muted/unmuted (implement logic)");
});

document.getElementById("endChatBtn").addEventListener("click", () => {
  alert("Chat ended (implement logic)");
});
