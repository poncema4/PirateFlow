import { useState, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";

export default function FaceRegister() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [mode, setMode] = useState(null); // "webcam" | "upload"
  const [streaming, setStreaming] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const startWebcam = async () => {
    setMode("webcam");
    setError("");
    setResult(null);
    setPreview(null);
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

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPreview(dataUrl);
    stopWebcam();
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMode("upload");
    setError("");
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const register = async () => {
    if (!preview) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const base64 = preview.split(",")[1];
      const { data } = await apiClient.post("/face/register", { image_base64: base64 });
      setResult(data);
    } catch (err) {
      const msg = err.response?.data?.detail || "Registration failed. Make sure your face is clearly visible.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    stopWebcam();
    setMode(null);
    setPreview(null);
    setResult(null);
    setError("");
  };

  return (
    <div className="face-page">
      <div className="face-card">
        <h1 className="face-title">Face Registration</h1>
        <p className="face-subtitle">
          Register your face for room access verification.
          {user && <> Logged in as <strong>{user.name}</strong>.</>}
        </p>

        {result ? (
          <div className="face-result success">
            <div className="face-result-icon">&#10003;</div>
            <h3>Face Registered</h3>
            <p>{result.message}</p>
            <div className="face-actions">
              <button className="btn btn-primary" onClick={() => navigate("/face/verify")}>
                Test Verification
              </button>
              <button className="btn btn-secondary" onClick={reset}>
                Register Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {!mode && !preview && (
              <div className="face-options">
                <button className="face-option-btn" onClick={startWebcam}>
                  <span className="face-option-icon">&#128247;</span>
                  <span>Take a Photo</span>
                  <span className="face-option-hint">Use your webcam</span>
                </button>
                <label className="face-option-btn">
                  <span className="face-option-icon">&#128193;</span>
                  <span>Upload a Photo</span>
                  <span className="face-option-hint">Choose from files</span>
                  <input type="file" accept="image/*" onChange={handleUpload} hidden />
                </label>
              </div>
            )}

            {mode === "webcam" && streaming && !preview && (
              <div className="face-webcam">
                <video ref={videoRef} autoPlay playsInline muted className="face-video" />
                <div className="face-actions">
                  <button className="btn btn-primary" onClick={capturePhoto}>Capture</button>
                  <button className="btn btn-secondary" onClick={() => { stopWebcam(); setMode(null); }}>Cancel</button>
                </div>
              </div>
            )}

            {preview && (
              <div className="face-preview">
                <img src={preview} alt="Preview" className="face-preview-img" />
                <div className="face-actions">
                  <button className="btn btn-primary" onClick={register} disabled={loading}>
                    {loading ? "Registering..." : "Register Face"}
                  </button>
                  <button className="btn btn-secondary" onClick={reset} disabled={loading}>
                    Retake
                  </button>
                </div>
              </div>
            )}

            {error && <p className="face-error">{error}</p>}
          </>
        )}
      </div>
      <canvas ref={canvasRef} hidden />
    </div>
  );
}
