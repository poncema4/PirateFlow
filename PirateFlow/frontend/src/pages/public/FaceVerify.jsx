import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";

const CAMERA_KEY = "dev-camera-key";

export default function FaceVerify() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [streaming, setStreaming] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.get("/rooms", { params: { page_size: 200 } })
      .then((r) => setRooms(r.data?.items || []))
      .catch(() => {});
  }, []);

  const startWebcam = async () => {
    setError("");
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch {
      setError("Could not access webcam. Please allow camera permissions.");
    }
  };

  const stopWebcam = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  };

  const scan = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !selectedRoom) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];

    setScanning(true);
    setError("");
    setResult(null);
    try {
      const { data } = await apiClient.post("/face/verify",
        { image_base64: base64, room_id: selectedRoom },
        { headers: { "X-Camera-Key": CAMERA_KEY } },
      );
      setResult(data);
    } catch (err) {
      const msg = err.response?.data?.detail || "Verification failed.";
      setError(msg);
    } finally {
      setScanning(false);
    }
  };

  const selectedRoomInfo = rooms.find((r) => r.id === selectedRoom);

  return (
    <div className="face-page">
      <div className="face-card face-card-wide">
        <h1 className="face-title">Room Access Verification</h1>
        <p className="face-subtitle">
          Simulate a camera scanning a face at a room entrance.
        </p>

        {/* Room selector */}
        <div className="face-field">
          <label className="face-label">Select Room</label>
          <select
            className="face-select"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
          >
            <option value="">-- Choose a room --</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.building_name} - {r.name} (Cap: {r.capacity})
              </option>
            ))}
          </select>
        </div>

        {/* Webcam */}
        <div className="face-verify-layout">
          <div className="face-webcam-section">
            {!streaming ? (
              <button className="btn btn-primary" onClick={startWebcam}>
                Start Camera
              </button>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="face-video" />
                <div className="face-actions">
                  <button
                    className="btn btn-primary"
                    onClick={scan}
                    disabled={scanning || !selectedRoom}
                  >
                    {scanning ? "Scanning..." : "Scan Face"}
                  </button>
                  <button className="btn btn-secondary" onClick={stopWebcam}>
                    Stop Camera
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Result panel */}
          <div className="face-result-panel">
            {result && (
              <div className={`face-result ${result.recognized && result.has_valid_booking ? "success" : "denied"}`}>
                <div className="face-result-icon">
                  {result.recognized && result.has_valid_booking ? "\u2713" : "\u2717"}
                </div>
                <h3>
                  {!result.recognized
                    ? "Not Recognized"
                    : result.has_valid_booking
                      ? "Access Granted"
                      : "No Valid Booking"
                  }
                </h3>
                {result.recognized && (
                  <div className="face-result-details">
                    <p><strong>Name:</strong> {result.user_name}</p>
                    <p><strong>Confidence:</strong> {(result.confidence * 100).toFixed(1)}%</p>
                    <p><strong>Room:</strong> {selectedRoomInfo?.building_name} - {selectedRoomInfo?.name}</p>
                    <p><strong>Booking:</strong> {result.has_valid_booking ? "Valid" : "None found"}</p>
                  </div>
                )}
                {!result.recognized && (
                  <p className="face-result-hint">
                    Face not found in the system. Make sure you've registered first.
                  </p>
                )}
                {result.alert_sent && (
                  <p className="face-alert-badge">Alert sent to admins</p>
                )}
              </div>
            )}

            {error && <p className="face-error">{error}</p>}

            {!result && !error && (
              <div className="face-result-placeholder">
                <p>Select a room and scan your face to verify access.</p>
              </div>
            )}
          </div>
        </div>

        <div className="face-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => navigate("/face/register")}>
            Register Face
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} hidden />
    </div>
  );
}
