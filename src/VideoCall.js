import React, { useState, useRef, useEffect } from "react";

const VideoCall = () => {
    const [username, setUsername] = useState("");
    const [callTo, setCallTo] = useState("");
    const [registered, setRegistered] = useState(false);
    const socketRef = useRef(null);
    const [peerConnection, setPeerConnection] = useState(null);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localStream = useRef(null);
    const remoteStream = useRef(new MediaStream());

    useEffect(() => {
        if (!socketRef.current) {
            const ws = new WebSocket("wss://api.abiv.in");
            socketRef.current = ws;

            ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                console.log("📩 Received Message:", data);

                switch (data.type) {
                    case "register":
                        setRegistered(true);
                        console.log("✅ Registration Successful");
                        break;
                    case "offer":
                        await handleOffer(data.offer, data.name);
                        break;
                    case "answer":
                        if (peerConnection) {
                            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                        }
                        break;
                    case "candidate":
                        if (peerConnection) {
                            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                        }
                        break;
                    default:
                        console.log("⚠️ Unknown Message Type:", data.type);
                }
            };

            ws.onclose = () => {
                console.warn("⚠️ WebSocket Disconnected. Reconnecting...");
                socketRef.current = null;
                setTimeout(() => {
                    if (!socketRef.current) {
                        window.location.reload();
                    }
                }, 3000);
            };
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [peerConnection]);

    const registerUser = () => {
        if (socketRef.current && username) {
            socketRef.current.send(JSON.stringify({ type: "register", name: username }));
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
                console.log("📡 Sending ICE Candidate:", event.candidate);
                socketRef.current.send(JSON.stringify({ type: "candidate", candidate: event.candidate, target }));
            }
        };

        pc.ontrack = (event) => {
            console.log("📡 Received Remote Stream:", event.streams[0]);

            event.streams[0].getTracks().forEach(track => {
                remoteStream.current.addTrack(track);
            });

            remoteVideoRef.current.srcObject = remoteStream.current;
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
    
            throw error; // Stop execution if permission is denied
        }
    };
    
    // Call getLocalStream() before setting up PeerConnection
    const startCall = async () => {
        if (!callTo) {
            alert("⚠️ Enter a username to call.");
            return;
        }
    
        const pc = createPeerConnection(callTo);
        setPeerConnection(pc);
    
        try {
            localStream.current = await getLocalStream();
            localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current));
    
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
    
            socketRef.current.send(JSON.stringify({ type: "offer", offer, target: callTo }));
        } catch (error) {
            console.log("❌ Call initialization failed:", error);
        }
    };
    
    const handleOffer = async (offer, name) => {
        const pc = createPeerConnection(name);
        setPeerConnection(pc);
    
        try {
            localStream.current = await getLocalStream();
            localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current));
    
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
    
            socketRef.current.send(JSON.stringify({ type: "answer", answer, target: name }));
        } catch (error) {
            console.log("❌ Handling offer failed:", error);
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
                <video ref={localVideoRef} autoPlay playsInline style={{ width: "45%", marginRight: "10px" }} />
                <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "45%" }} />
            </div>
        </div>
    );
};

export default VideoCall;
