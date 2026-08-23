import { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { Mic, MicOff } from "lucide-react";

const APP_ID = "4bf767c547a04dfeb581065f5fa11e63"; // Your specific App ID
const TEMP_TOKEN = "007eJxTYJhc0Pp0vXC+lXN7SJbsGrOtCnXTv8486BLANPf2JMGLqQoKDCZJaeZm5smmJuaJBiYpaalJphaGBmamaaZpiYaGqWbGmtVdWZp1YbU+M9sZGBkYGVgYGBlAgAlMMoNJFjDJw5CcWFBckp+XGl+cX8zAAAD5eCFP";
const HARDCODED_CHANNEL = "capstone_sos";

// Initialize the client outside the component so it doesn't recreate on re-renders.
// 'rtc' mode is for 1-to-1 or small group calls.
// 'vp8' is a highly compatible video codec for web and mobile.
const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

export default function LiveVideoPlayer({ channelName }) {
  const videoContainerRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [isTalking, setIsTalking] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let track = null;

    const startLiveStream = async () => {
      try {
        // 0. Initialize Admin Microphone but keep it completely MUTED by default
        track = await AgoraRTC.createMicrophoneAudioTrack();
        await track.setMuted(true);
        if (isMounted) setLocalAudioTrack(track);

        // 1. Listen for when the User (Broadcaster) publishes their camera or mic
        client.on("user-published", async (user, mediaType) => {
          // Subscribe to the incoming stream
          await client.subscribe(user, mediaType);
          
          if (mediaType === "video") {
            // Play the video inside our referenced div container
            user.videoTrack.play(videoContainerRef.current);
          }
          if (mediaType === "audio") {
            // Play the audio (does not need a container)
            user.audioTrack.play();
          }
        });

        // 2. Join the specific SOS channel using the Temp Token
        // We pass 'null' for uid so Agora automatically assigns a random User ID to the Admin
        await client.join(APP_ID, HARDCODED_CHANNEL, TEMP_TOKEN, null);
        
        // 3. Publish the Admin's muted audio track to the channel
        await client.publish(track);

        if (isMounted) setJoined(true);
      } catch (err) {
        console.error("Agora Connection Error:", err);
        if (isMounted) setError("Failed to connect to live stream.");
      }
    };

    startLiveStream();

    // 4. Cleanup: When the Admin closes the modal/video, stop mic and leave the channel
    return () => {
      isMounted = false;
      if (track) {
        track.stop();
        track.close();
      }
      client.leave();
    };
  }, [channelName]);

  const handleTalkStart = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setMuted(false);
      setIsTalking(true);
    }
  };

  const handleTalkEnd = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setMuted(true);
      setIsTalking(false);
    }
  };

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#1e1e1e", borderRadius: "8px", overflow: "hidden", position: "relative" }}>
      {!joined && !error && <p style={{ color: "white", padding: "15px", fontFamily: "sans-serif" }}>Connecting to Live SOS Stream...</p>}
      
      {error && <p style={{ color: "#ef4444", padding: "15px", fontFamily: "sans-serif" }}>{error}</p>}
      
      {/* This is the invisible container where Agora will inject the <video> element */}
      <div ref={videoContainerRef} style={{ width: "100%", height: "100%" }}></div>
      
      {joined && (
        <>
          <div style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(239,68,68,0.8)", padding: "4px 8px", borderRadius: "4px", color: "white", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "8px", height: "8px", background: "white", borderRadius: "50%" }}></div>
            LIVE
          </div>

          <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
            <button
              onMouseDown={handleTalkStart}
              onMouseUp={handleTalkEnd}
              onMouseLeave={handleTalkEnd}
              onTouchStart={handleTalkStart}
              onTouchEnd={handleTalkEnd}
              style={{
                background: isTalking ? "#22c55e" : "rgba(15, 23, 42, 0.8)",
                color: isTalking ? "white" : "#94a3b8",
                border: "1px solid",
                borderColor: isTalking ? "#16a34a" : "rgba(255,255,255,0.2)",
                padding: "12px 24px",
                borderRadius: "99px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                transition: "all 0.2s ease",
                backdropFilter: "blur(10px)",
                userSelect: "none",
                WebkitUserSelect: "none"
              }}
            >
              {isTalking ? <Mic size={18} /> : <MicOff size={18} />}
              {isTalking ? "TALKING..." : "HOLD TO TALK"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
