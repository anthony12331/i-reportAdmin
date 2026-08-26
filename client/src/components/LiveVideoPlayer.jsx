import { useEffect, useRef, useState } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import { Mic, MicOff, Camera, Video, Square, Lock } from "lucide-react";

const APP_ID = "4bf767c547a04dfeb581065f5fa11e63"; // Your specific App ID
let TEMP_TOKEN_MAIN = "";
let TEMP_TOKEN_PRIVATE = "";
const HARDCODED_CHANNEL = "capstone_sos";

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
const privateClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

export default function LiveVideoPlayer({ channelName, responderId }) {
  const videoContainerRef = useRef(null);
  const [joined, setJoined] = useState(false);
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
    let track = null;

    const startLiveStream = async () => {
      try {
        // 0. Initialize Admin Microphone but keep it completely MUTED by default
        track = await AgoraRTC.createMicrophoneAudioTrack();
        await track.setMuted(true);
        if (isMounted) setLocalAudioTrack(track);

        client.removeAllListeners();
          privateClient.removeAllListeners();
          // 1. Listen for when the User (Broadcaster) publishes their camera or mic
        client.on("user-published", async (user, mediaType) => {
          // Subscribe to the incoming stream
          await client.subscribe(user, mediaType);
          
          if (mediaType === "video") {
            remoteVideoTrackRef.current = user.videoTrack;
            user.videoTrack.play(videoContainerRef.current);
          }
          if (mediaType === "audio") {
            remoteAudioTrackRef.current = user.audioTrack;
            user.audioTrack.play();
          }
        });

        // 1.5 Handle unpublishing
        client.on("user-unpublished", (user, mediaType) => {
          if (mediaType === "video") remoteVideoTrackRef.current = null;
          if (mediaType === "audio") remoteAudioTrackRef.current = null;
        });

        // 1.6 Listen for responder's private audio
        privateClient.on("user-published", async (user, mediaType) => {
          await privateClient.subscribe(user, mediaType);
          if (mediaType === "audio") {
            user.audioTrack.play();
          }
        });

        // 2. Join the specific SOS channel using the Temp Token
                  // FETCH DYNAMIC TOKEN FROM BACKEND BEFORE JOINING!
          try {
            const tokenResponse = await fetch('https://api.ireportsystem.com/express-api/token?channel=' + HARDCODED_CHANNEL);
            const tokenData = await tokenResponse.json();
            if (tokenData.token) {
              TEMP_TOKEN_MAIN = tokenData.token;
            }
          } catch(e) {
            console.error('Failed to fetch dynamic token:', e);
          }
          await client.join(APP_ID, HARDCODED_CHANNEL, TEMP_TOKEN_MAIN, null);
        await client.publish(track);

        // 2.5 Join Private Channel if responder is assigned
        if (responderId) {
          // Join the private room for this responder
                      try {
              const pTokenResponse = await fetch('https://api.ireportsystem.com/express-api/token?channel=capstone_sos_private');
              const pTokenData = await pTokenResponse.json();
              if (pTokenData.token) {
                TEMP_TOKEN_PRIVATE = pTokenData.token;
              }
            } catch(e) {}
            await privateClient.join(APP_ID, "capstone_sos_private", TEMP_TOKEN_PRIVATE, null);
          // DO NOT publish track here to avoid multi-client publish error
        }

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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (client) {
        client.removeAllListeners();
        client.leave();
      }
      if (privateClient) {
        privateClient.removeAllListeners();
        privateClient.leave();
      }
    };
  }, [channelName, responderId]);

  const toggleTalk = async () => {
    if (localAudioTrack && !isPrivateTalking) {
      if (isTalking) {
        await localAudioTrack.setMuted(true);
        setIsTalking(false);
      } else {
        await localAudioTrack.setMuted(false);
        setIsTalking(true);
      }
    }
  };

  const togglePrivateTalk = async () => {
    if (localAudioTrack && !isTalking) {
      if (isPrivateTalking) {
        try {
          await localAudioTrack.setMuted(true);
          await privateClient.unpublish(localAudioTrack);
          await client.publish(localAudioTrack).catch(() => {});
          setIsPrivateTalking(false);
        } catch (err) { console.error("PTT End Error:", err); }
      } else {
        try {
          await client.unpublish(localAudioTrack);
          await privateClient.publish(localAudioTrack);
          await localAudioTrack.setMuted(false);
          setIsPrivateTalking(true);
        } catch (err) { console.error("PTT Start Error:", err); }
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
    <div style={{ width: "100%", height: "100%", backgroundColor: "#1e1e1e", borderRadius: "8px", overflow: "hidden", position: "relative" }}>
      {!joined && !error && <p style={{ color: "white", padding: "15px", fontFamily: "sans-serif" }}>Connecting to Live SOS Stream...</p>}
      
      {error && <p style={{ color: "#ef4444", padding: "15px", fontFamily: "sans-serif" }}>{error}</p>}
      
      {/* This is the invisible container where Agora will inject the <video> element */}
      <div ref={videoContainerRef} style={{ width: "100%", height: "100%" }}></div>
      
      {joined && (
        <>
          <div style={{ position: "absolute", top: "10px", right: "10px", background: isRecording ? "rgba(239,68,68,0.9)" : "rgba(239,68,68,0.8)", padding: "4px 8px", borderRadius: "4px", color: "white", fontSize: "12px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px", boxShadow: isRecording ? "0 0 10px rgba(239,68,68,0.8)" : "none" }}>
            <div style={{ width: "8px", height: "8px", background: "white", borderRadius: "50%", animation: isRecording ? "pulse 1.5s infinite" : "none" }}></div>
            {isRecording ? "REC" : "LIVE"}
          </div>

          <div style={{ position: "absolute", top: "10px", left: "10px", zIndex: 10, display: "flex", gap: "10px" }}>
            <button
              onClick={handleFlipCamera}
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "8px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "bold",
                backdropFilter: "blur(10px)",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.background = "rgba(15, 23, 42, 1)"}
              onMouseLeave={(e) => e.target.style.background = "rgba(15, 23, 42, 0.8)"}
            >
              <Camera size={14} /> FLIP
            </button>
            
            <button
              onClick={toggleRecording}
              style={{
                background: isRecording ? "rgba(239, 68, 68, 0.9)" : "rgba(15, 23, 42, 0.8)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "8px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "bold",
                backdropFilter: "blur(10px)",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => !isRecording && (e.target.style.background = "rgba(15, 23, 42, 1)")}
              onMouseLeave={(e) => !isRecording && (e.target.style.background = "rgba(15, 23, 42, 0.8)")}
            >
              {isRecording ? <Square size={14} /> : <Video size={14} />}
              {isRecording ? "STOP REC" : "RECORD"}
            </button>
          </div>

          <div style={{ position: "absolute", bottom: "20px", left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", gap: "10px" }}>
            <button
              onClick={toggleTalk}
              disabled={isPrivateTalking}
              style={{
                background: isTalking ? "#22c55e" : "rgba(15, 23, 42, 0.8)",
                color: isTalking ? "white" : "#94a3b8",
                border: "1px solid",
                borderColor: isTalking ? "#16a34a" : "rgba(255,255,255,0.2)",
                padding: "12px 24px",
                borderRadius: "99px",
                fontWeight: "bold",
                cursor: isPrivateTalking ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                transition: "all 0.2s ease",
                backdropFilter: "blur(10px)",
                userSelect: "none",
                WebkitUserSelect: "none",
                opacity: isPrivateTalking ? 0.5 : 1
              }}
            >
              {isTalking ? <Mic size={18} /> : <MicOff size={18} />}
              {isTalking ? "TALKING (ALL)" : "TALK (ALL)"}
            </button>

            {responderId && (
              <button
                onClick={togglePrivateTalk}
                disabled={isTalking}
                style={{
                  background: isPrivateTalking ? "#eab308" : "rgba(15, 23, 42, 0.8)",
                  color: isPrivateTalking ? "white" : "#94a3b8",
                  border: "1px solid",
                  borderColor: isPrivateTalking ? "#ca8a04" : "rgba(255,255,255,0.2)",
                  padding: "12px 24px",
                  borderRadius: "99px",
                  fontWeight: "bold",
                  cursor: isTalking ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                  transition: "all 0.2s ease",
                  backdropFilter: "blur(10px)",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  opacity: isTalking ? 0.5 : 1
                }}
              >
                <Lock size={18} />
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



