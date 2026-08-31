import { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { Mic, MicOff, Camera, Video, Square, Lock, AlertTriangle, Loader } from "lucide-react";

const APP_ID = "4bf767c547a04dfeb581065f5fa11e63"; // Your specific App ID
const HARDCODED_CHANNEL = "capstone_sos";

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
const privateClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

export default function LiveVideoPlayer({ channelName, responderId }) {
  const videoContainerRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState("");
  const [isTalking, setIsTalking] = useState(false);
  const [isPrivateTalking, setIsPrivateTalking] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);

  // Recording states and refs
  const [isRecording, setIsRecording] = useState(false);
  const remoteVideoTrackRef = useRef(null);
  const remoteAudioTrackRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  useEffect(() => {
    let isMounted = true;
    let localTrack = null;

    const startLiveStream = async () => {
      try {
        setError("");
        setJoined(false);
        setHasRemoteVideo(false);

        // Disconnect safely if already in a connected/connecting state
        if (client.connectionState !== "DISCONNECTED") {
          try {
            await client.leave();
          } catch (e) {
            console.warn("Previous client cleanup error:", e);
          }
        }
        if (privateClient.connectionState !== "DISCONNECTED") {
          try {
            await privateClient.leave();
          } catch (e) {
            console.warn("Previous privateClient cleanup error:", e);
          }
        }

        client.removeAllListeners();
        privateClient.removeAllListeners();

        // 1. Listen for when the Citizen Broadcaster publishes their camera or mic
        client.on("user-published", async (user, mediaType) => {
          try {
            await client.subscribe(user, mediaType);
            if (mediaType === "video") {
              remoteVideoTrackRef.current = user.videoTrack;
              if (isMounted) setHasRemoteVideo(true);
              if (videoContainerRef.current) {
                user.videoTrack.play(videoContainerRef.current);
              }
            }
            if (mediaType === "audio") {
              remoteAudioTrackRef.current = user.audioTrack;
              user.audioTrack.setVolume(300); // Boost volume
              user.audioTrack.play();
            }
          } catch (subErr) {
            console.error("Agora subscribe error:", subErr);
          }
        });

        // 1.5 Handle unpublishing
        client.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "video") {
            remoteVideoTrackRef.current = null;
            if (isMounted) setHasRemoteVideo(false);
          }
          if (mediaType === "audio") {
            remoteAudioTrackRef.current = null;
          }
        });

        // 1.6 Listen for responder's private audio
        privateClient.on("user-published", async (user, mediaType) => {
          try {
            await privateClient.subscribe(user, mediaType);
            if (mediaType === "audio") {
              user.audioTrack.play();
            }
          } catch (subErr) {
            console.error("Private subscribe error:", subErr);
          }
        });

        // 2. Fetch token dynamically from backend
        let tokenMain = null;
        try {
          const tokenResponse = await fetch(`https://api.ireportsystem.com/express-api/token?channel=${HARDCODED_CHANNEL}`);
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            if (tokenData && tokenData.token) {
              tokenMain = tokenData.token;
            }
          }
        } catch (e) {
          console.warn("Failed to fetch dynamic Agora token:", e);
        }

        if (!isMounted) return;

        // Join Agora channel (No local mic required to watch!)
        await client.join(APP_ID, HARDCODED_CHANNEL, tokenMain, null);

        // 2.5 Join Private Channel if responder is assigned
        if (responderId) {
          let tokenPrivate = null;
          try {
            const pTokenResponse = await fetch("https://api.ireportsystem.com/express-api/token?channel=capstone_sos_private");
            if (pTokenResponse.ok) {
              const pTokenData = await pTokenResponse.json();
              if (pTokenData && pTokenData.token) {
                tokenPrivate = pTokenData.token;
              }
            }
          } catch (e) {
            console.warn("Failed to fetch private token:", e);
          }

          if (isMounted) {
            await privateClient.join(APP_ID, "capstone_sos_private", tokenPrivate, null).catch((err) => {
              console.warn("Private room join notice:", err);
            });
          }
        }

        if (isMounted) {
          setJoined(true);
          setError("");
        }
      } catch (err) {
        console.error("Agora Connection Error:", err);
        if (isMounted) {
          setError(err?.message || "Failed to connect to live stream channel.");
        }
      }
    };

    startLiveStream();

    // Cleanup when unmounting
    return () => {
      isMounted = false;
      if (localTrack) {
        try {
          localTrack.stop();
          localTrack.close();
        } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
      if (client) {
        client.removeAllListeners();
        client.leave().catch(() => {});
      }
      if (privateClient) {
        privateClient.removeAllListeners();
        privateClient.leave().catch(() => {});
      }
    };
  }, [channelName, responderId, retryCount]);

  const handleTalkStart = async () => {
    if (isPrivateTalking) return;

    if (!localAudioTrack) {
      try {
        const track = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalAudioTrack(track);
        await client.publish(track);
        setIsTalking(true);
      } catch (err) {
        console.warn("Microphone Access Notice:", err);
        alert("Microphone is not detected or permission was denied on this laptop. You can still watch and hear the citizen's camera stream.");
      }
    } else {
      await localAudioTrack.setMuted(false);
      setIsTalking(true);
    }
  };

  const handleTalkEnd = async () => {
    if (localAudioTrack && isTalking) {
      await localAudioTrack.setMuted(true);
      setIsTalking(false);
    }
  };

  const handlePrivateTalkStart = async () => {
    if (isTalking) return;

    if (!localAudioTrack) {
      try {
        const track = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalAudioTrack(track);
        await privateClient.publish(track);
        setIsPrivateTalking(true);
      } catch (err) {
        console.warn("PTT Start Notice:", err);
        alert("Microphone is not detected on this laptop.");
      }
    } else {
      try {
        await client.unpublish(localAudioTrack);
        await privateClient.publish(localAudioTrack);
        await localAudioTrack.setMuted(false);
        setIsPrivateTalking(true);
      } catch (err) {
        console.error("PTT Start Error:", err);
      }
    }
  };

  const handlePrivateTalkEnd = async () => {
    if (localAudioTrack && isPrivateTalking) {
      try {
        await localAudioTrack.setMuted(true);
        await privateClient.unpublish(localAudioTrack);
        await client.publish(localAudioTrack).catch(() => {});
        setIsPrivateTalking(false);
      } catch (err) {
        console.error("PTT End Error:", err);
      }
    }
  };

  const handleFlipCamera = async () => {
    try {
      const { pb } = await import("../config/pocketbase");
      await pb.collection("sos_tracking").update(channelName, { description: "FLIP_CAMERA_REQ" });
    } catch (err) {
      console.error("Failed to request camera flip:", err);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      const tracks = [];

      if (remoteVideoTrackRef.current) {
        const vt = remoteVideoTrackRef.current.getMediaStreamTrack();
        if (vt) tracks.push(vt);
      }

      const rAudio = remoteAudioTrackRef.current ? remoteAudioTrackRef.current.getMediaStreamTrack() : null;
      const lAudio = localAudioTrack ? localAudioTrack.getMediaStreamTrack() : null;

      // Mix remote and local audio tracks so both are recorded
      if (rAudio && lAudio) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(new MediaStream([rAudio])).connect(dest);
        ctx.createMediaStreamSource(new MediaStream([lAudio])).connect(dest);
        const mixedAudioTrack = dest.stream.getAudioTracks()[0];
        if (mixedAudioTrack) tracks.push(mixedAudioTrack);
      } else if (rAudio) {
        tracks.push(rAudio);
      } else if (lAudio) {
        tracks.push(lAudio);
      }

      if (tracks.length === 0) {
        alert("No video or audio stream available to record yet!");
        return;
      }

      const combinedStream = new MediaStream(tracks);

      try {
        const recorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });
        recordedChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = `SOS_Incident_Recording_${new Date().getTime()}.webm`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to start recording:", err);
        alert("Recording is not supported in this browser format.");
      }
    }
  };

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#070b14", borderRadius: "12px", overflow: "hidden", position: "relative" }}>
      {/* Connecting HUD */}
      {!joined && !error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "#94a3b8", zIndex: 5 }}>
          <Loader className="animate-spin" size={28} color="#ef4444" />
          <span style={{ fontSize: "13.5px", fontWeight: "700", color: "#cbd5e1" }}>Connecting to Live SOS Channel...</span>
        </div>
      )}

      {/* Waiting for Citizen Broadcast HUD */}
      {joined && !hasRemoteVideo && !error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "#94a3b8", padding: "20px", textAlign: "center", zIndex: 5 }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "50%", backgroundColor: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }} className="urgent-status-pulse">
            <Video size={26} />
          </div>
          <div>
            <div style={{ color: "#f8fafc", fontSize: "14.5px", fontWeight: "800" }}>Connected to Emergency Channel</div>
            <div style={{ color: "#94a3b8", fontSize: "12.5px", marginTop: "4px", maxWidth: "340px" }}>
              Waiting for citizen's mobile camera stream to transmit...
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: "#fca5a5", padding: "20px", textAlign: "center", backgroundColor: "rgba(15, 23, 42, 0.95)", zIndex: 20 }}>
          <AlertTriangle size={32} color="#ef4444" />
          <div>
            <div style={{ fontSize: "14.5px", fontWeight: "800", color: "#f87171" }}>Live Stream Notice</div>
            <div style={{ fontSize: "12.5px", color: "#cbd5e1", maxWidth: "380px", marginTop: "4px" }}>
              {error}
            </div>
          </div>
          <button
            onClick={() => {
              setError("");
              setJoined(false);
              setRetryCount((prev) => prev + 1);
            }}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              backgroundColor: "#dc2626",
              color: "#fff",
              border: "none",
              fontWeight: "700",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Video Container where Agora injects <video> */}
      <div ref={videoContainerRef} style={{ width: "100%", height: "100%", position: "relative", zIndex: 2 }}></div>

      {joined && (
        <>
          <div style={{ position: "absolute", top: "12px", right: "12px", background: isRecording ? "rgba(239,68,68,0.9)" : "rgba(239,68,68,0.8)", padding: "4px 10px", borderRadius: "6px", color: "white", fontSize: "11.5px", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px", boxShadow: isRecording ? "0 0 10px rgba(239,68,68,0.8)" : "none", zIndex: 10 }}>
            <div style={{ width: "8px", height: "8px", background: "white", borderRadius: "50%", animation: isRecording ? "pulse 1.5s infinite" : "none" }}></div>
            {isRecording ? "REC" : "LIVE"}
          </div>

          <div style={{ position: "absolute", top: "12px", left: "12px", zIndex: 10, display: "flex", gap: "10px" }}>
            <button
              onClick={handleFlipCamera}
              style={{
                background: "rgba(15, 23, 42, 0.85)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "700",
                backdropFilter: "blur(10px)",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.background = "rgba(15, 23, 42, 1)")}
              onMouseLeave={(e) => (e.target.style.background = "rgba(15, 23, 42, 0.85)")}
            >
              <Camera size={14} /> FLIP
            </button>

            <button
              onClick={toggleRecording}
              style={{
                background: isRecording ? "rgba(239, 68, 68, 0.9)" : "rgba(15, 23, 42, 0.85)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "8px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "700",
                backdropFilter: "blur(10px)",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => !isRecording && (e.target.style.background = "rgba(15, 23, 42, 1)")}
              onMouseLeave={(e) => !isRecording && (e.target.style.background = "rgba(15, 23, 42, 0.85)")}
            >
              {isRecording ? <Square size={14} /> : <Video size={14} />}
              {isRecording ? "STOP REC" : "RECORD"}
            </button>
          </div>

          <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onMouseDown={handleTalkStart}
              onMouseUp={handleTalkEnd}
              onMouseLeave={handleTalkEnd}
              onTouchStart={handleTalkStart}
              onTouchEnd={handleTalkEnd}
              disabled={isPrivateTalking}
              style={{
                background: isTalking ? "#22c55e" : "rgba(15, 23, 42, 0.85)",
                color: isTalking ? "white" : "#cbd5e1",
                border: "1px solid",
                borderColor: isTalking ? "#16a34a" : "rgba(255,255,255,0.2)",
                padding: "10px 20px",
                borderRadius: "99px",
                fontWeight: "700",
                cursor: isPrivateTalking ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                transition: "all 0.2s ease",
                backdropFilter: "blur(10px)",
                userSelect: "none",
                WebkitUserSelect: "none",
                opacity: isPrivateTalking ? 0.5 : 1,
                fontSize: "12px",
              }}
            >
              {isTalking ? <Mic size={16} /> : <MicOff size={16} />}
              {isTalking ? "TALKING (ALL)" : "TALK (ALL)"}
            </button>

            {responderId && (
              <button
                onMouseDown={handlePrivateTalkStart}
                onMouseUp={handlePrivateTalkEnd}
                onMouseLeave={handlePrivateTalkEnd}
                onTouchStart={handlePrivateTalkStart}
                onTouchEnd={handlePrivateTalkEnd}
                disabled={isTalking}
                style={{
                  background: isPrivateTalking ? "#eab308" : "rgba(15, 23, 42, 0.85)",
                  color: isPrivateTalking ? "white" : "#cbd5e1",
                  border: "1px solid",
                  borderColor: isPrivateTalking ? "#ca8a04" : "rgba(255,255,255,0.2)",
                  padding: "10px 20px",
                  borderRadius: "99px",
                  fontWeight: "700",
                  cursor: isTalking ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                  transition: "all 0.2s ease",
                  backdropFilter: "blur(10px)",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  opacity: isTalking ? 0.5 : 1,
                  fontSize: "12px",
                }}
              >
                <Lock size={16} />
                {isPrivateTalking ? "TALKING (PRIVATE)" : "TALK TO RESPONDER"}
              </button>
            )}
          </div>
        </>
      )}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}



