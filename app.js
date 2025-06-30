document.addEventListener("DOMContentLoaded", () => {
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

  const mediaElement = document.getElementById("mediaElement");
  const taskInput = document.getElementById("taskInput");
  const micBtn = document.getElementById("micBtn");
  const startBtn = document.getElementById("startBtn");
  const talkBtn = document.getElementById("talkBtn");
  const downloadBtn = document.getElementById("downloadTranscriptBtn");
  const endSessionBtn = document.querySelector(".end-button");
  const inputArea = document.querySelector(".input-area");
  const timerDisplay = document.querySelector(".time-box");

  const loadingOverlay = document.createElement("div");
  loadingOverlay.style = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); color: white; font-size: 24px;
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
  `;
  loadingOverlay.innerText = "Loading Avatar...";
  loadingOverlay.style.display = "none";
  document.body.appendChild(loadingOverlay);

  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = "Switch to Chat";
  toggleBtn.className = "btn-secondary mt-2";
  toggleBtn.style.display = "none";
  startBtn?.parentNode?.insertBefore(toggleBtn, startBtn.nextSibling);

  let mode = "voice";
  if (micBtn) micBtn.style.display = "none";
  if (inputArea) inputArea.style.display = "none";

  toggleBtn.addEventListener("click", () => {
    if (mode === "voice") {
      micBtn.style.display = "none";
      inputArea.style.display = "flex";
      toggleBtn.textContent = "Switch to Voice";
      mode = "text";
    } else {
      micBtn.style.display = "block";
      inputArea.style.display = "none";
      toggleBtn.textContent = "Switch to Chat";
      mode = "voice";
    }
  });

  let countdownInterval;
  let remainingTime = 600;
  function startCountdown() {
    if (!timerDisplay) return;
    countdownInterval = setInterval(() => {
      remainingTime--;
      const m = Math.floor(remainingTime / 60);
      const s = remainingTime % 60;
      timerDisplay.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        closeSession();
      }
    }, 1000);
  }

  async function getSessionToken() {
    const res = await fetch(`${API_CONFIG.serverUrl}/v1/streaming.create_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": API_CONFIG.apiKey,
      },
    });
    const data = await res.json();
    sessionToken = data.data.token;
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
    webSocket.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "USER_TALKING_MESSAGE") {
        transcriptLog.push({ speaker: "user", text: msg.text, timestamp: new Date().toISOString() });
      }
    });
  }

  let avatarBuffer = [];
  let avatarSpeaking = false;

  async function createNewSession() {
    if (!sessionToken) await getSessionToken();
    loadingOverlay.style.display = "flex";

    const res = await fetch(`${API_CONFIG.serverUrl}/v1/streaming.new`, {
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
        knowledge_base: "...",
      }),
    });

    const data = await res.json();
    sessionInfo = data.data;

    room = new LivekitClient.Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: LivekitClient.VideoPresets.h720.resolution,
      },
    });

    room.on(LivekitClient.RoomEvent.DataReceived, (payload) => {
      const msg = JSON.parse(new TextDecoder().decode(payload));
      if (msg.type === "avatar_start_talking") {
        avatarSpeaking = true;
        avatarBuffer = [];
      } else if (msg.type === "avatar_talking_message" && avatarSpeaking) {
        avatarBuffer.push(msg.message);
      } else if (msg.type === "avatar_end_message" && avatarSpeaking) {
        const full = avatarBuffer.join(" ").replace(/\s+/g, " ").trim();
        transcriptLog.push({ speaker: "avatar", text: full, timestamp: new Date().toISOString() });
        avatarBuffer = [];
        avatarSpeaking = false;
      }
    });

    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === "video" || track.kind === "audio") {
        mediaStream.addTrack(track.mediaStreamTrack);
        if (mediaElement) {
          mediaElement.srcObject = mediaStream;
        }
      }
    });

    mediaStream = new MediaStream();
    await room.prepareConnection(sessionInfo.url, sessionInfo.access_token);
    await connectWebSocket(sessionInfo.session_id);
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
    loadingOverlay.style.display = "none";
    startBtn.style.display = "none";
    toggleBtn.style.display = "block";
    micBtn.style.display = "block";
    startCountdown();
  }

  async function closeSession() {
    if (!sessionInfo) return;

    await fetch(`${API_CONFIG.serverUrl}/v1/streaming.stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ session_id: sessionInfo.session_id }),
    });

    webSocket?.close();
    room?.disconnect();
    mediaElement.srcObject = null;

    sessionInfo = null;
    room = null;
    mediaStream = null;
    sessionToken = null;
    avatarBuffer = [];
    avatarSpeaking = false;

    clearInterval(countdownInterval);
    timerDisplay.textContent = "10:00";
  }

  startBtn?.addEventListener("click", async () => {
    await createNewSession();
    await startStreamingSession();
  });

  endSessionBtn?.addEventListener("click", closeSession);

  talkBtn?.addEventListener("click", () => {
    const text = taskInput?.value.trim();
    if (text) {
      transcriptLog.push({ speaker: "user", text, timestamp: new Date().toISOString() });
      sendText(text, "talk");
      taskInput.value = "";
    }
  });

  async function sendText(text, taskType = "talk") {
    if (!sessionInfo) return;
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
  }

  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && mode === "voice") recognition.start();
    });
    document.addEventListener("keyup", (e) => {
      if (e.code === "Space" && mode === "voice") recognition.stop();
    });

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      if (transcript) {
        transcriptLog.push({ speaker: "user", text: transcript, timestamp: new Date().toISOString() });
        sendText(transcript, "talk");
      }
    };
  } else {
    micBtn.disabled = true;
    micBtn.textContent = "🎤 Not Supported";
  }
});
