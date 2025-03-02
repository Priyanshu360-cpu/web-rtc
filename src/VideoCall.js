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

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log("📩 Received Message:", data);

                switch (data.type) {
                    case "register":
                        setRegistered(true);
                        console.log("✅ Registration Successful");
                        break;
                    case "offer":
                        handleOffer(data.offer, data.name);  // Ensure this function exists
                        break;
                    case "answer":
                        if (peerConnection) {
                            peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                        }
                        break;
                    case "candidate":
                        if (peerConnection) {
                            peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                        }
                        break;
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
                console.log("🎤 Adding track to remote stream:", track);
                remoteStream.current.addTrack(track);
            });

            remoteVideoRef.current.srcObject = remoteStream.current;
        };

        return pc;
    };

    const handleOffer = async (offer, name) => {
        console.log("📞 Received offer from:", name);
        
        const pc = createPeerConnection(name);
        setPeerConnection(pc);

        localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = localStream.current;
        localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current));

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketRef.current.send(JSON.stringify({ type: "answer", answer, target: name }));
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
                    <button onClick={() => console.log("Start Call Logic Here")}>Call</button>
                </div>
            )}
        </div>
    );
};

export default VideoCall;
