import { useState } from "react";
import axios from "axios";

function App() {
  const [message, setMessage] = useState("");

  const callFlask = async () => {
    const res = await axios.get("http://localhost:5000/api/hello");
    setMessage(res.data.message);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <button
        onClick={callFlask}
        className="bg-blue-600 text-white px-6 py-2 rounded"
      >
        Call Flask
      </button>
      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}

export default App;