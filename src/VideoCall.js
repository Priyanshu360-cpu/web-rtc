import React, { useState, useRef, useEffect } from "react";

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
        socketRef.current = new WebSocket("ws://api.abiv.in");

        socketRef.current.onopen = () => console.log("✅ WebSocket Connected");
        socketRef.current.onclose = () => console.log("❌ WebSocket Disconnected");
        socketRef.current.onerror = (error) => console.error("⚠️ WebSocket Error:", error);

        socketRef.current.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log("📩 Message received:", data);

            switch (data.type) {
                case "register":
                    console.log("✅ Registration successful");
                    setRegistered(true);
                    break;
                case "offer":
                    handleOffer(data.offer, data.name);
                    break;
                case "answer":
                    if (peerConnectionRef.current) {
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                    }
                    break;
                case "candidate":
                    if (peerConnectionRef.current) {
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                    }
                    break;
                default:
                    console.warn("⚠️ Unknown message type:", data.type);
                    break;
            }
        };

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    const registerUser = () => {
        if (socketRef.current && username) {
            socketRef.current.send(JSON.stringify({ type: "register", name: username }));
        }
    };

    const startCall = async () => {
        if (!callTo) {
            alert("⚠️ Enter a username to call.");
            return;
        }

        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            alert("❌ WebSocket is not connected. Try refreshing.");
            return;
        }

        peerConnectionRef.current = createPeerConnection(callTo);

        try {
            localStreamRef.current = await getLocalStream();
            localStreamRef.current.getTracks().forEach(track => peerConnectionRef.current.addTrack(track, localStreamRef.current));

            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);

            socketRef.current.send(JSON.stringify({ type: "offer", offer, target: callTo }));
        } catch (error) {
            console.error("❌ Call initialization failed:", error);
        }
    };

    const handleOffer = async (offer, name) => {
        peerConnectionRef.current = createPeerConnection(name);

        try {
            localStreamRef.current = await getLocalStream();
            localStreamRef.current.getTracks().forEach(track => peerConnectionRef.current.addTrack(track, localStreamRef.current));

            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnectionRef.current.createAnswer();
            await peerConnectionRef.current.setLocalDescription(answer);

            socketRef.current.send(JSON.stringify({ type: "answer", answer, target: name }));
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
            if (event.candidate && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                console.log("📡 Sending ICE Candidate:", event.candidate);
                socketRef.current.send(JSON.stringify({ type: "candidate", candidate: event.candidate, target }));
            } else {
                console.warn("⚠️ WebSocket is not ready. ICE Candidate not sent.");
            }
        };

        pc.ontrack = (event) => {
            console.log("📡 Received Remote Stream:", event.streams[0]);

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
