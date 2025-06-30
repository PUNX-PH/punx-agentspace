document.addEventListener("DOMContentLoaded", () => {
  const API_CONFIG = {
    apiKey: "ZmVjNDdmZDM5NmYwNGRmMmE5NTcyYjQ1YzA1YjNiY2EtMTc1MDc2NTYwMg==",
    serverUrl: "https://api.heygen.com",
  };

  let sessionInfo = null;
  let room = null;
  let mediaStream = new MediaStream();
  let webSocket = null;
  let sessionToken = null;
  let transcriptLog = [];
  let avatarBuffer = [];
  let avatarSpeaking = false;

  const statusElement = document.getElementById("status");
  const mediaElement = document.getElementById("mediaElement");
  const taskInput = document.getElementById("taskInput");
  const micBtn = document.getElementById("micBtn");

  function updateStatus(message) {
    if (!statusElement) return;
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
    updateStatus("✅ Session token obtained");
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
        avatar_name: "Rachel_default_avatar", // Use a valid public avatar
        version: "v2",
        video_encoding: "H264",
        knowledge_base: "..."
      }),
    });

    const data = await response.json();
    sessionInfo = data.data;
    updateStatus("🧠 Session created");

    room = new LivekitClient.Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: LivekitClient.VideoPresets.h720.resolution,
      },
    });

    // Handle LiveKit room events
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
        console.warn("Invalid JSON from avatar:", dataStr);
      }
    });

    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, pub, participant) => {
      if (track.kind === "video" || track.kind === "audio") {
        updateStatus(`🔔 Track subscribed: ${track.kind}`);
        mediaStream.addTrack(track.mediaStreamTrack);
        mediaElement.srcObject = mediaStream;
        mediaElement.play().catch(err => {
          updateStatus("⚠️ Autoplay blocked. Click anywhere to resume.");
          document.body.addEventListener("click", () => mediaElement.play());
        });
      }
    });

    room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
      mediaStream.removeTrack(track.mediaStreamTrack);
    });

    room.on(LivekitClient.RoomEvent.Disconnected, (reason) => {
      updateStatus(`⚠️ Disconnected: ${reason}`);
    });

    mediaElement.srcObject = mediaStream;
    mediaElement.autoplay = true;
    mediaElement.playsInline = true;
    mediaElement.muted = false;

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
    updateStatus("🚀 Streaming session started");
  }

  async function sendText(text, taskType = "talk") {
    if (!sessionInfo) return updateStatus("⚠️ No active session");
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
    updateStatus(`💬 Sent: "${text}"`);
  }

  // Global: used by HTML onclick for End Session
  window.closeSession = async function () {
    if (!sessionInfo) return updateStatus("⚠️ No active session");
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
    if (mediaElement) mediaElement.srcObject = null;

    sessionInfo = null;
    room = null;
    mediaStream = new MediaStream();
    sessionToken = null;
    avatarBuffer = [];
    avatarSpeaking = false;

    updateStatus("🛑 Session closed");
  };

  function downloadTranscript() {
    if (!transcriptLog.length) return updateStatus("📭 No transcript to download");
    const blob = new Blob([JSON.stringify(transcriptLog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${sessionInfo?.session_id || "session"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    updateStatus("⬇️ Transcript downloaded");
  }

  // Speech Recognition (Hold Space to Talk)
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
      updateStatus("🎙️ Listening...");
    };
    recognition.onerror = (event) => {
      updateStatus(`❗ Mic error: ${event.error}`);
    };
    recognition.onend = () => {
      recognizing = false;
      updateStatus("🛑 Mic stopped");
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        updateStatus(`🗣️ You said: "${transcript}"`);
        transcriptLog.push({
          speaker: "user",
          text: transcript,
          timestamp: new Date().toISOString(),
        });
        sendText(transcript, "talk");
      }
    };
  } else {
    if (micBtn) {
      micBtn.disabled = true;
      micBtn.textContent = "🎤 Not Supported";
      micBtn.classList.add("opacity-50", "cursor-not-allowed");
    }
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

  // Talk button handler
  const talkBtn = document.getElementById("talkBtn");
  if (talkBtn)
    talkBtn.addEventListener("click", () => {
      const text = taskInput?.value.trim();
      if (text) {
        transcriptLog.push({ speaker: "user", text, timestamp: new Date().toISOString() });
        sendText(text, "talk");
        taskInput.value = "";
      }
    });

  const downloadBtn = document.getElementById("downloadTranscriptBtn");
  if (downloadBtn) downloadBtn.addEventListener("click", downloadTranscript);

  // Auto-start session on page load
  (async () => {
    try {
      updateStatus("🔄 Starting session...");
      await createNewSession();
      await startStreamingSession();
    } catch (err) {
      updateStatus("❌ Auto-start failed: " + err.message);
    }
  })();
});
