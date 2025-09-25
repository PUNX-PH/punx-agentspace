document.addEventListener("DOMContentLoaded", () => {
  const API_CONFIG = {
    apiKey: "ZmVjNDdmZDM5NmYwNGRmMmE5NTcyYjQ1YzA1YjNiY2EtMTc1ODYyOTMxOQ==",
    serverUrl: "https://api.heygen.com",
  };

  let sessionInfo = null;
  let room = null;
  let mediaStream = null;
  let webSocket = null;
  let sessionToken = null;
  let transcriptLog = [];
  let heygenKnowledge = "";

  const mediaElement = document.getElementById("mediaElement");
  const taskInput = document.getElementById("taskInput");
  const micBtn = document.getElementById("micBtn");
  const startBtn = document.getElementById("startBtn");
  const talkBtn = document.getElementById("talkBtn");
  const endSessionBtn = document.querySelector(".end-button");
  const inputArea = document.querySelector(".input-area");
  const timerDisplay = document.querySelector(".time-box");

  // Loading Overlay
  const loadingOverlay = document.createElement("div");
  loadingOverlay.style.position = "fixed";
  loadingOverlay.style.top = 0;
  loadingOverlay.style.left = 0;
  loadingOverlay.style.width = "100%";
  loadingOverlay.style.height = "100%";
  loadingOverlay.style.background = "rgba(0, 0, 0, 0.8)";
  loadingOverlay.style.color = "white";
  loadingOverlay.style.fontSize = "24px";
  loadingOverlay.style.display = "flex";
  loadingOverlay.style.justifyContent = "center";
  loadingOverlay.style.alignItems = "center";
  loadingOverlay.style.zIndex = 1000;
  loadingOverlay.innerText = "Loading Avatar...";
  loadingOverlay.style.display = "none";
  document.body.appendChild(loadingOverlay);

  let countdownInterval;
  let remainingTime = 300;

  function startCountdown() {
    if (!timerDisplay) return;
    countdownInterval = setInterval(() => {
      remainingTime--;
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        closeSession();
      }
    }, 1000);
  }

  // Chat/Voice toggle
  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = "Switch to Chat";
  toggleBtn.className = "btn-secondary mt-2";
  toggleBtn.style.display = "none";
  if (startBtn && startBtn.parentNode) startBtn.parentNode.insertBefore(toggleBtn, startBtn.nextSibling);

  let mode = "voice";
  if (micBtn) micBtn.style.display = "none";
  if (inputArea) inputArea.style.display = "none";

  async function getSessionToken() {
    const response = await fetch(`${API_CONFIG.serverUrl}/v1/streaming.create_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": API_CONFIG.apiKey,
      },
    });
    const data = await response.json();
    if (!response.ok || !data.data) {
      alert("Failed to get session token: " + (data.error || data.message || JSON.stringify(data)));
      return;
    }
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

    webSocket.addEventListener("message", (event) => {
      const eventData = JSON.parse(event.data);
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

  async function loadKnowledgeBase() {
    // Use .txt or .json depending on your file
    const response = await fetch('/lexi.txt');
    heygenKnowledge = await response.text();
  }

  async function createNewSession() {
    if (!sessionToken) await getSessionToken();
    loadingOverlay.style.display = "flex";
    await loadKnowledgeBase();

    // ----
    // IMPORTANT: Create mediaStream BEFORE room setup
    mediaStream = new MediaStream();
    // ----

    const response = await fetch(`${API_CONFIG.serverUrl}/v1/streaming.new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        quality: "high",
        avatar_name: "Marianne_Chair_Sitting_public",
        version: "v2",
        video_encoding: "H264",
        knowledge_base: heygenKnowledge
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.data) {
      loadingOverlay.style.display = "none";
      alert("Session start failed: " + (data.error || data.message || JSON.stringify(data)));
      return;
    }
    sessionInfo = data.data;

    // Room setup
    room = new LivekitClient.Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: LivekitClient.VideoPresets.h720.resolution,
      },
    });

    // --- Room events ---
    room.on(LivekitClient.RoomEvent.DataReceived, (payload) => {
      const dataStr = new TextDecoder().decode(payload);
      try {
        const data = JSON.parse(dataStr);
        if (data.type === "avatar_start_talking") {
          avatarSpeaking = true; avatarBuffer = [];
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
      } catch (e) {}
    });

    // Track event: always set srcObject any time a track is added/removed!
    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
      if (track.mediaStreamTrack) {
        mediaStream.addTrack(track.mediaStreamTrack);
        if (mediaElement) {
          mediaElement.srcObject = mediaStream;
          mediaElement.play().catch(()=>{});
        }
      }
    });

    room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
      if (track.mediaStreamTrack) {
        mediaStream.removeTrack(track.mediaStreamTrack);
        if (mediaElement) {
          mediaElement.srcObject = mediaStream;
        }
      }
    });

    room.on(LivekitClient.RoomEvent.Disconnected, () => {
      if (mediaElement) mediaElement.srcObject = null;
    });

    await room.prepareConnection(sessionInfo.url, sessionInfo.access_token);
    await connectWebSocket(sessionInfo.session_id);
  }

  async function startStreamingSession() {
    if(!sessionInfo) return;
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

    if (startBtn) startBtn.style.display = "none";
    if (toggleBtn) toggleBtn.style.display = "block";
    if (micBtn) micBtn.style.display = "block";
    if (endSessionBtn) endSessionBtn.style.display = "block";
    if (inputArea) inputArea.style.display = "none";

    startCountdown();
  }

  // Toggle chat/voice
  toggleBtn.addEventListener("click", () => {
    if (mode === "voice") {
      mode = "chat";
      toggleBtn.textContent = "Switch to Voice";
      micBtn.style.display = "none";
      inputArea.style.display = "flex";
    } else {
      mode = "voice";
      toggleBtn.textContent = "Switch to Chat";
      micBtn.style.display = "block";
      inputArea.style.display = "none";
    }
  });

  // UI button event
  if (startBtn)
    startBtn.addEventListener("click", async () => {
      if (mediaElement) mediaElement.srcObject = null;
      await createNewSession();
      await startStreamingSession();
    });

  if (talkBtn)
    talkBtn.addEventListener("click", () => {
      const text = taskInput?.value.trim();
      if (text) {
        transcriptLog.push({ speaker: "user", text, timestamp: new Date().toISOString() });
        sendText(text, "talk");
        taskInput.value = "";
      }
    });

  if (endSessionBtn) {
    endSessionBtn.addEventListener("click", () => {
      closeSession();
    });
  }

  // Sending chat/voice input to backend
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

  // Transcripts/email modals
  function showEmailModal() {
    document.getElementById("emailModal").style.display = "flex";
  }

  document.getElementById("emailForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const email = document.getElementById("pitchEmail").value.trim();
    if (!email || !transcriptLog.length) {
      alert("Missing email or transcript!");
      return;
    }
    try {
      const data = { email: email , status: "Pending", transcript: transcriptLog };
      const firebaseUrl = "https://punx-shark-tank-default-rtdb.firebaseio.com/transcripts.json";
      const response = await fetch(firebaseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error("Failed to send data to Firebase");
      document.getElementById("emailModal").style.display = "none";
      document.getElementById("sentPromptModal").style.display = "flex";
    } catch (err) {
      alert("There was a problem saving your transcript: " + err.message);
    }
  });

  document.getElementById("sentPromptOkBtn").addEventListener("click", function () {
    document.getElementById("sentPromptModal").style.display = "none";
    window.location.href = "https://punx-agentspace.vercel.app/lexi.html";
  });

  document.getElementById("goHomeBtn").addEventListener("click", function () {
    window.location.href = "https://punx-agentspace.vercel.app/lexi.html";
  });

  // Stop and reset everything
  async function closeSession() {
    if (!sessionInfo) return;
    await fetch(`${API_CONFIG.serverUrl}/v1/streaming.stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ session_id: sessionInfo.session_id }),
    }).catch(()=>{});

    if (webSocket) { try { webSocket.close(); } catch {} }
    if (room) { try { room.disconnect(); } catch {} }
    if (mediaElement) mediaElement.srcObject = null;

    sessionInfo = null;
    room = null;
    mediaStream = null;
    sessionToken = null;
    avatarBuffer = [];
    avatarSpeaking = false;
    clearInterval(countdownInterval);

    if (startBtn) startBtn.style.display = "block";
    if (micBtn) micBtn.style.display = "none";
    if (inputArea) inputArea.style.display = "none";
    if (endSessionBtn) endSessionBtn.style.display = "none";
    if (toggleBtn) toggleBtn.style.display = "none";
    if (timerDisplay) timerDisplay.textContent = "10:00";

    // HIDE placeholder
    const videoPlaceholder = document.getElementById("videoPlaceholder");
    if (videoPlaceholder) videoPlaceholder.style.opacity = '0';

    loadingOverlay.style.display = "none";

    showEmailModal();
  }

  // === Speech Recognition ===
  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let recognizing = false;

  if (window.SpeechRecognition) {
    recognition = new window.SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => { recognizing = true; };
    recognition.onerror = (event) => {
      recognizing = false;
      console.error(`Speech recognition error: ${event.error}`);
    };
    recognition.onend = () => { recognizing = false; };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        transcriptLog.push({
          speaker: "user",
          text: transcript,
          timestamp: new Date().toISOString(),
        });
        sendText(transcript, "talk");
      }
    };
  }

  // SPACEBAR to talk
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && recognition && !recognizing && mode === "voice") {
      event.preventDefault();
      recognizing = true;
      recognition.start();
    }
  });
  document.addEventListener("keyup", (event) => {
    if (event.code === "Space" && recognition && recognizing && mode === "voice") {
      event.preventDefault();
      recognition.stop();
    }
  });
});