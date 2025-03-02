import React, { useState, useRef, useEffect } from "react";

const VideoCall = () => {
    const [username, setUsername] = useState("");
    const [callTo, setCallTo] = useState("");
    const [registered, setRegistered] = useState(false);
    const socketRef = useRef(null); // Keep socket persistent
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
                        handleOffer(data.offer, data.name);
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
    }, [peerConnection]); // Keep socket persistent

    const registerUser = () => {
        if (socketRef.current && username) {
            socketRef.current.send(JSON.stringify({ type: "register", name: username }));
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
                    <button onClick={() => console.log("Start Call Logic Here")}>Call</button>
                </div>
            )}
        </div>
    );
};

export default VideoCall;
