import React, { useState, useRef, useEffect } from "react";

const VideoCall = () => {
    const [username, setUsername] = useState("");
    const [callTo, setCallTo] = useState("");
    const [registered, setRegistered] = useState(false);
    const [socket, setSocket] = useState(null);
    const [peerConnection, setPeerConnection] = useState(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localStream = useRef(null);
    const remoteStream = useRef(null);

    useEffect(() => {
        const ws = new WebSocket("wss://api.abiv.in");
        setSocket(ws);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case "candidate":
                    console.log("🔗 Adding ICE Candidate:", data.candidate);
                    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    break;
                case "register":
                    console.log("Registration successful");
                    setRegistered(true);
                    break;
                case "offer":
                    handleOffer(data.offer, data.name);
                    break;
                case "answer":
                    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                    break;
                case "candidate":
                    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    break;
                default:
                    break;
            }
        };

        return () => ws.close();
    }, [peerConnection]);

    const registerUser = () => {
        if (socket && username) {
            socket.send(JSON.stringify({ type: "register", name: username }));
        }
    };
    const startCall = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("❌ getUserMedia is not supported in this browser. Try Chrome or Firefox.");
            return;
        }
    
        try {
            localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    
            console.log("🎥 Local stream obtained:", localStream.current);
            localVideoRef.current.srcObject = localStream.current;
    
            localStream.current.getTracks().forEach(track => peerConnection.addTrack(track, localStream.current));
        } catch (error) {
            console.error("🚨 Error accessing webcam/microphone:", error);
            alert("⚠️ Error accessing webcam/microphone. Please allow camera permissions.");
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
                socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate, target }));
            }
        };
        
        
        pc.ontrack = (event) => {
            console.log("📡 Received Remote Stream:", event.streams[0]);
        
            if (!remoteStream.current) {
                remoteStream.current = new MediaStream();
            }
        
            event.streams[0].getTracks().forEach(track => {
                console.log("🎤 Adding track to remote stream:", track);
                remoteStream.current.addTrack(track);
            });
        
            remoteVideoRef.current.srcObject = remoteStream.current;
        };
        

        return pc;
    };

    const handleOffer = async (offer, name) => {
        const pc = createPeerConnection(name);
        setPeerConnection(pc);

        localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = localStream.current;
        localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current));

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.send(JSON.stringify({ type: "answer", answer, target: name }));
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
