import React, { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";

const VideoCall = () => {
    const [username, setUsername] = useState("");
    const [callTo, setCallTo] = useState("");
    const [registered, setRegistered] = useState(false);
    const socketRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localStreamRef = useRef(null);

    useEffect(() => {
        socketRef.current = io("https://api.abiv.in");

        socketRef.current.on("register", (data) => {
            if (data.success) {
                console.log("✅ Registration successful");
                setRegistered(true);
            }
        });

        socketRef.current.on("offer", async ({ from, offer }) => {
            console.log(`📞 Incoming call from ${from}`);
            handleOffer(offer, from);
        });

        socketRef.current.on("answer", async ({ answer }) => {
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            }
        });

        socketRef.current.on("candidate", async ({ candidate }) => {
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        return () => socketRef.current.disconnect();
    }, []);

    const registerUser = () => {
        if (socketRef.current && username) {
            socketRef.current.emit("register", username);
        }
    };

    const startCall = async () => {
        if (!callTo) {
            alert("⚠️ Enter a username to call.");
            return;
        }

        peerConnectionRef.current = createPeerConnection(callTo);

        try {
            localStreamRef.current = await getLocalStream();
            localStreamRef.current.getTracks().forEach(track => peerConnectionRef.current.addTrack(track, localStreamRef.current));

            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);

            socketRef.current.emit("call", { from: username, to: callTo, offer });
        } catch (error) {
            console.error("❌ Call initialization failed:", error);
        }
    };

    const handleOffer = async (offer, from) => {
        peerConnectionRef.current = createPeerConnection(from);

        try {
            localStreamRef.current = await getLocalStream();
            localStreamRef.current.getTracks().forEach(track => peerConnectionRef.current.addTrack(track, localStreamRef.current));

            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);

            socketRef.current.emit("answer", { from: username, to: from, answer });
        } catch (error) {
            console.error("❌ Handling offer failed:", error);
        }
    };

    const createPeerConnection = (target) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                {
                    urls: "turn:relay.metered.ca:80",
                    username: "open",
                    credential: "open"
                }
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current.emit("candidate", { from: username, to: target, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        return pc;
    };

    const getLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            return stream;
        } catch (error) {
            console.error("🚨 Camera/Microphone Error:", error);

            if (error.name === "NotAllowedError") {
                alert("⚠️ Camera/Microphone access denied. Please allow permissions.");
            } else if (error.name === "NotFoundError") {
                alert("⚠️ No webcam/microphone found. Check your device settings.");
            } else {
                alert("⚠️ Unknown error: " + error.message);
            }

            throw error;
        }
    };

    return (
        <div style={{ textAlign: "center" }}>
            <h2>WebRTC Video Call</h2>

            {!registered ? (
                <div>
                    <input type="text" placeholder="Enter your name" onChange={(e) => setUsername(e.target.value)} />
                    <button onClick={registerUser}>Register</button>
                </div>
            ) : (
                <div>
                    <input type="text" placeholder="User to call" onChange={(e) => setCallTo(e.target.value)} />
                    <button onClick={startCall}>Call</button>
                </div>
            )}

            <div style={{ marginTop: "20px" }}>
                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "45%", marginRight: "10px" }} />
                <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "45%" }} />
            </div>
        </div>
    );
};

export default VideoCall;
