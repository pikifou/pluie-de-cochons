@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700&display=swap');

:root {
  color-scheme: dark;
  font-family: 'Orbitron', sans-serif;
  color: #f8fafc;
  background: #020817;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  min-height: 100%;
  background: radial-gradient(circle at top, #1d4ed8, #020817 60%);
}

body {
  min-height: 100vh;
  display: grid;
  place-items: center;
}

#game-shell {
  width: min(100%, 1040px);
  padding: 1.25rem;
}

.hud {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.8rem 1.1rem;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 40px rgba(14, 116, 144, 0.3);
}

.label {
  display: block;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.8;
}

.hud strong {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.8rem;
}

.game-area {
  border-radius: 22px;
  overflow: hidden;
  border: 2px solid rgba(125, 211, 252, 0.6);
  box-shadow: 0 18px 60px rgba(59, 130, 246, 0.35);
}

canvas {
  display: block;
  width: 100%;
  height: auto;
  background: #0f172a;
}
