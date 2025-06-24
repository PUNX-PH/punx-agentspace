async function downloadTranscript() {
    if (!sessionInfo) {
      updateStatus("Session ID not found.");
      return;
    }
  
    try {
      const response = await fetch(
        `${API_CONFIG.proxyTranscriptUrl}?session_id=${sessionInfo.session_id}`
      );
  
      if (!response.ok) {
        const error = await response.text();
        updateStatus(`Transcript fetch failed: ${error}`);
        return;
      }
  
      const result = await response.json();
  
      if (!result?.data || result.data.length === 0) {
        updateStatus("Transcript is empty or unavailable.");
        return;
      }
  
      // Log JSON to console and UI
      console.log("Transcript JSON:", result);
      updateStatus("Transcript JSON logged to console.");
  
      result.data.forEach((entry) => {
        const timestamp = entry.timestamp || "no-time";
        updateStatus(`[${timestamp}] ${entry.speaker}: ${entry.text}`);
      });
    } catch (err) {
      console.error("Error fetching transcript:", err);
      updateStatus("Error fetching transcript. See console for details.");
    }
  }
  