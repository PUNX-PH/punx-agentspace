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
        knowledge_base: "..."
      }),
    });

    const data = await response.json();
    sessionInfo = data.data;

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
      } catch (e) {}
    });

    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === "video" || track.kind === "audio") {
        mediaStream.addTrack(track.mediaStreamTrack);
        if (
          mediaElement &&
          mediaStream.getVideoTracks().length > 0 &&
          mediaStream.getAudioTracks().length > 0
        ) {
          mediaElement.srcObject = mediaStream;
        }
      }
    });

    room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
      const mediaTrack = track.mediaStreamTrack;
      if (mediaTrack) mediaStream.removeTrack(mediaTrack);
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
    const startBtn = document.querySelector("#startBtn");
    if (startBtn) startBtn.disabled = true;
  }

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

    if (webSocket) webSocket.close();
    if (room) room.disconnect();
    if (mediaElement) mediaElement.srcObject = null;

    sessionInfo = null;
    room = null;
    mediaStream = null;
    sessionToken = null;
    avatarBuffer = [];
    avatarSpeaking = false;

    const startBtn = document.querySelector("#startBtn");
    if (startBtn) startBtn.disabled = false;
  }

  function downloadTranscript() {
    if (!transcriptLog.length) return;
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
  }

  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let recognizing = false;

  if (window.SpeechRecognition) {
    recognition = new window.SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

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

  // Event bindings
  const startBtn = document.querySelector("#startBtn");
  const talkBtn = document.querySelector("#talkBtn");
  const downloadBtn = document.querySelector("#downloadTranscriptBtn");
  const endSessionBtn = document.querySelector("#endSessionBtn");

  if (startBtn)
    startBtn.addEventListener("click", async () => {
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

  if (downloadBtn) downloadBtn.addEventListener("click", downloadTranscript);
  if (endSessionBtn) endSessionBtn.addEventListener("click", closeSession);
});
