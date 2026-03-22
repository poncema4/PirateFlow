import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const BUILDINGS = [
  { id: "bld_004", name: "Walsh Library", code: "WAL", description: "Study Rooms, Computer Labs & Group Spaces", floors: 5, rooms: 25, color: "#10b981",
    path: "M 195,195 L 245,185 L 255,210 L 250,230 L 200,235 Z", labelX: 225, labelY: 212 },
  { id: "bld_005", name: "University Center", code: "UC", description: "Event Spaces, Meeting Rooms & Dining", floors: 3, rooms: 20, color: "#8b5cf6",
    path: "M 310,270 L 365,260 L 375,290 L 370,310 L 315,315 Z", labelX: 342, labelY: 290 },
  { id: "bld_001", name: "Jubilee Hall", code: "JUB", description: "Classrooms & Offices", floors: 4, rooms: 22, color: "#6366f1",
    path: "M 285,350 L 325,345 L 330,370 L 290,375 Z", labelX: 308, labelY: 362 },
  { id: "bld_002", name: "McNulty Hall", code: "MCN", description: "Science Labs & Classrooms", floors: 4, rooms: 28, color: "#f59e0b",
    path: "M 530,180 L 590,170 L 600,210 L 595,240 L 535,245 Z", labelX: 565, labelY: 208 },
  { id: "bld_003", name: "Corrigan Hall", code: "COR", description: "Lecture Halls & Music Department", floors: 3, rooms: 18, color: "#ef4444",
    path: "M 545,270 L 590,265 L 595,290 L 550,295 Z", labelX: 570, labelY: 282 },
  { id: "bld_006", name: "Arts & Sciences Hall", code: "A&S", description: "Classrooms & Seminar Rooms", floors: 3, rooms: 20, color: "#ec4899",
    path: "M 370,200 L 420,195 L 425,220 L 375,225 Z", labelX: 398, labelY: 212 },
];

const CONTEXT = [
  { label: "Boland", path: "M 400,330 L 440,325 L 445,350 L 405,355 Z" },
  { label: "Xavier", path: "M 250,250 L 285,245 L 288,265 L 253,268 Z" },
  { label: "Fahy", path: "M 210,260 L 245,255 L 248,275 L 213,278 Z" },
  { label: "Duffy", path: "M 185,245 L 210,242 L 213,258 L 188,260 Z" },
  { label: "Mooney", path: "M 160,270 L 190,267 L 193,285 L 163,288 Z" },
  { label: "Rec Center", path: "M 280,120 L 350,110 L 355,140 L 285,148 Z" },
  { label: "Bayley", path: "M 490,255 L 525,250 L 528,270 L 493,273 Z" },
  { label: "Presidents", path: "M 430,235 L 475,230 L 478,252 L 433,255 Z" },
  { label: "Chapel", path: "M 480,235 L 510,232 L 513,255 L 483,257 Z" },
  { label: "Aquinas", path: "M 520,305 L 555,300 L 558,320 L 523,323 Z" },
  { label: "McQuaid", path: "M 460,310 L 500,305 L 503,325 L 463,328 Z" },
  { label: "Seminary", path: "M 580,130 L 640,120 L 645,150 L 585,158 Z" },
  { label: "Schwartz", path: "M 335,195 L 365,192 L 367,210 L 337,213 Z" },
  { label: "Serra", path: "M 220,225 L 248,222 L 250,238 L 222,240 Z" },
  { label: "Bookstore", path: "M 195,240 L 215,238 L 217,252 L 197,254 Z" },
];

function getPathCenter(pathStr) {
  const nums = pathStr.match(/[\d.]+/g)?.map(Number) || [];
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 0; i < nums.length; i += 2) {
    sumX += nums[i];
    sumY += nums[i + 1];
    count++;
  }
  return { x: sumX / count, y: sumY / count };
}

export default function CampusMap() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: "#090b0f", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        height: 52,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/PirateFlow.png" alt="PirateFlow" style={{ width: 28, height: 28, objectFit: "contain" }} />
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.5px", lineHeight: 1 }}>
              PirateFlow
            </h1>
            <p style={{ fontSize: 8, color: "#4a5060", marginTop: 1, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Campus Space Intelligence
            </p>
          </div>
        </div>
        {user ? (
          <button onClick={() => navigate(user.role === "admin" ? "/dashboard" : "/")}
            style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {user.role === "admin" ? "Dashboard" : "Spaces"}
          </button>
        ) : (
          <button onClick={() => navigate("/login")}
            style={{ background: "transparent", color: "#5a6070", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 14px", fontSize: 11, cursor: "pointer", transition: "all 150ms" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#5a6070"; }}>
            Sign In
          </button>
        )}
      </header>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "#e8eaf0", letterSpacing: "-0.5px", marginBottom: 4 }}>
            Seton Hall University
          </h2>
          <p style={{ fontSize: 12, color: "#4a5060" }}>Select a building to browse rooms and book a space</p>
        </div>

        <div style={{ display: "flex", gap: 16, maxWidth: 1060, width: "100%", flex: 1, minHeight: 0 }}>
          {/* SVG Map */}
          <div style={{ flex: 1, background: "#0d0f14", borderRadius: 14, border: "1px solid rgba(255,255,255,0.05)", padding: 10, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />

            <svg viewBox="0 0 800 500" style={{ width: "100%", height: "100%", display: "block" }}>
              <defs>
                <filter id="glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b98108" /><stop offset="100%" stopColor="#10b98102" /></linearGradient>
              </defs>

              <path d="M 80,90 C 200,50 450,40 700,60 L 720,100 L 730,350 L 710,420 Q 650,450 500,455 L 300,460 Q 150,455 100,430 L 60,370 L 50,200 Z" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" strokeDasharray="8,6" />

              <path d="M 30,430 Q 200,455 400,450 Q 600,445 760,420" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" strokeLinecap="round" />
              <path d="M 30,430 Q 200,455 400,450 Q 600,445 760,420" stroke="rgba(255,255,255,0.03)" strokeWidth="18" fill="none" strokeLinecap="round" />
              <text x="400" y="470" textAnchor="middle" fontSize="11" fill="#2a2e38" fontFamily="var(--font-body)" fontWeight="600" letterSpacing="3">SOUTH ORANGE AVE</text>

              <path d="M 720,100 L 730,350 L 710,420" stroke="rgba(255,255,255,0.06)" strokeWidth="5" fill="none" strokeLinecap="round" />
              <text x="745" y="260" textAnchor="middle" fontSize="10" fill="#2a2e38" fontFamily="var(--font-body)" fontWeight="600" letterSpacing="2" transform="rotate(85, 745, 260)">WARD PLACE</text>

              <path d="M 130,200 Q 250,180 350,170 Q 450,160 550,165 Q 620,170 680,180" stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="none" strokeDasharray="6,4" />
              <text x="400" y="162" textAnchor="middle" fontSize="8" fill="#1e2229" fontFamily="var(--font-body)">Seton Drive</text>

              <ellipse cx="380" cy="340" rx="50" ry="30" fill="url(#grassGrad)" stroke="#10b98110" strokeWidth="1" />
              <text x="380" y="344" textAnchor="middle" fontSize="9" fill="#10b98125" fontFamily="var(--font-body)" fontWeight="500">The Green</text>

              <rect x="610" y="65" width="100" height="55" rx="4" fill="#10b98106" stroke="#10b98110" strokeWidth="0.8" />
              <text x="660" y="96" textAnchor="middle" fontSize="7" fill="#10b98120" fontFamily="var(--font-body)">Owen T. Carroll Field</text>

              {Array.from({ length: 20 }, (_, i) => {
                const x = 100 + i * 32;
                const y = 65 + Math.sin(i * 0.8) * 10;
                return <circle key={i} cx={x} cy={y} r={8 + Math.sin(i) * 2} fill="#10b98104" stroke="#10b98108" strokeWidth="0.5" />;
              })}

              <circle cx="180" cy="310" r="15" fill="#10b98105" />
              <circle cx="620" cy="310" r="12" fill="#10b98105" />
              <circle cx="450" cy="380" r="18" fill="#10b98104" />

              {CONTEXT.map((b) => (
                <g key={b.label}>
                  <path d={b.path} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
                  <text x={getPathCenter(b.path).x} y={getPathCenter(b.path).y + 1} textAnchor="middle" fontSize="6.5" fill="#1e2229" fontFamily="var(--font-body)">{b.label}</text>
                </g>
              ))}

              {BUILDINGS.map((b) => {
                const isHovered = hoveredId === b.id;
                return (
                  <g key={b.id} onClick={() => navigate(`/spaces/${b.id}`)} onMouseEnter={() => setHoveredId(b.id)} onMouseLeave={() => setHoveredId(null)} style={{ cursor: "pointer" }}>
                    {isHovered && <path d={b.path} fill={b.color + "15"} stroke={b.color} strokeWidth="2" filter="url(#glow)" />}
                    <path d={b.path} fill={isHovered ? b.color + "25" : b.color + "12"} stroke={isHovered ? b.color : b.color + "50"} strokeWidth={isHovered ? "1.5" : "0.8"} style={{ transition: "all 200ms ease" }} />
                    <text x={b.labelX} y={b.labelY} textAnchor="middle" fontSize={isHovered ? "12" : "10"} fontWeight="700" fill={isHovered ? b.color : b.color + "90"} fontFamily="var(--font-display)" style={{ transition: "all 200ms", pointerEvents: "none" }}>{b.code}</text>
                    {isHovered && <text x={b.labelX} y={b.labelY + 14} textAnchor="middle" fontSize="7" fill={b.color} fontFamily="var(--font-body)" fontWeight="500" style={{ pointerEvents: "none" }}>{b.name}</text>}
                    {isHovered && <circle cx={b.labelX} cy={b.labelY - 18} r="3" fill={b.color}><animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" /></circle>}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Sidebar */}
          <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 5 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#2a2e38", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 4px 6px" }}>
              Available Buildings
            </p>

            {BUILDINGS.map((b) => {
              const active = hoveredId === b.id;
              return (
                <button key={b.id} onClick={() => navigate(`/spaces/${b.id}`)} onMouseEnter={() => setHoveredId(b.id)} onMouseLeave={() => setHoveredId(null)}
                  style={{
                    background: active ? b.color + "0a" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? b.color + "30" : "rgba(255,255,255,0.04)"}`,
                    borderRadius: 8, padding: "8px 10px", cursor: "pointer", textAlign: "left",
                    display: "flex", gap: 8, alignItems: "center", transition: "all 150ms", width: "100%",
                  }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 6, background: active ? b.color + "18" : b.color + "0c", border: `1px solid ${b.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: b.color, fontFamily: "var(--font-display)" }}>{b.code}</span>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: active ? "#e8eaf0" : "#8890a0", transition: "color 150ms" }}>{b.name}</p>
                    <p style={{ fontSize: 9, color: "#3a3e48", marginTop: 1 }}>{b.floors} floors &middot; {b.rooms} rooms</p>
                  </div>
                  <span style={{ fontSize: 11, color: active ? b.color : "#1e2229", transition: "color 150ms" }}>&rarr;</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
