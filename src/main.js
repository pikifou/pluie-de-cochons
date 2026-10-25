import './style.css';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const livesEl = document.querySelector('#lives');

const state = {
  score: 0,
  lives: 3,
  gameOver: false,
  lastTime: 0,
  spawnTimer: 0,
  difficulty: 1,
  keys: {
    left: false,
    right: false,
  },
  player: {
    x: canvas.width / 2,
    y: canvas.height - 60,
    width: 110,
    height: 28,
    speed: 430,
  },
  items: [],
};

function resetGame() {
  state.score = 0;
  state.lives = 3;
  state.gameOver = false;
  state.items = [];
  state.player.x = canvas.width / 2;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
}

function spawnItem() {
  const isDragon = Math.random() < 0.18;
  const radius = isDragon ? 18 : 16;
  const x = 30 + Math.random() * (canvas.width - 60);
  const y = -radius;
  const speed = 160 + Math.random() * 100 + state.difficulty * 12;

  state.items.push({
    x,
    y,
    radius,
    speed,
    type: isDragon ? 'dragon' : 'pig',
    drift: (Math.random() - 0.5) * 40,
  });
}

function drawPlayer() {
  const { x, y, width, height } = state.player;

  ctx.fillStyle = '#4dd0ff';
  ctx.fillRect(x - width / 2, y, width, height);

  ctx.fillStyle = '#f4d35e';
  ctx.fillRect(x - 18, y - 18, 36, 16);

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x - 10, y - 8, 7, 7);
  ctx.fillRect(x + 3, y - 8, 7, 7);
}

function drawItem(item) {
  const x = item.x;
  const y = item.y;

  if (item.type === 'dragon') {
    ctx.fillStyle = '#ff7b54';
    ctx.beginPath();
    ctx.ellipse(x, y, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(x - 8, y - 5, 4, 4);
    ctx.fillRect(x + 4, y - 5, 4, 4);
    ctx.fillStyle = '#ffb703';
    ctx.fillRect(x - 6, y + 6, 12, 4);
    return;
  }

  ctx.fillStyle = '#d8b4fe';
  ctx.beginPath();
  ctx.arc(x, y, item.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(x - 6, y - 4, 3, 3);
  ctx.fillRect(x + 2, y - 4, 3, 3);
  ctx.fillStyle = '#fcd34d';
  ctx.fillRect(x - 4, y + 4, 8, 4);
}

function update(delta) {
  if (state.gameOver) return;

  state.difficulty += delta * 0.02;

  if (state.keys.left) {
    state.player.x -= state.player.speed * delta;
  }
  if (state.keys.right) {
    state.player.x += state.player.speed * delta;
  }

  state.player.x = Math.max(55, Math.min(canvas.width - 55, state.player.x));

  state.spawnTimer -= delta;
  if (state.spawnTimer <= 0) {
    spawnItem();
    state.spawnTimer = Math.max(0.3, 1.3 - state.difficulty * 0.06);
  }

  for (let i = state.items.length - 1; i >= 0; i -= 1) {
    const item = state.items[i];
    item.y += item.speed * delta;
    item.x += item.drift * delta;

    const withinX = Math.abs(item.x - state.player.x) < state.player.width / 2 + item.radius;
    const withinY = item.y + item.radius >= state.player.y && item.y - item.radius <= state.player.y + state.player.height;

    if (withinX && withinY) {
      if (item.type === 'pig') {
        state.score += 10;
      } else {
        state.lives -= 1;
      }
      state.items.splice(i, 1);
      updateHud();
      continue;
    }

    if (item.y - item.radius > canvas.height) {
      if (item.type === 'dragon') {
        state.score += 5;
      } else {
        state.lives -= 1;
      }
      state.items.splice(i, 1);
      updateHud();
    }
  }

  if (state.lives <= 0) {
    state.gameOver = true;
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#0f172a');
  sky.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let i = 0; i < 40; i += 1) {
    const x = (i * 97) % canvas.width;
    const y = (i * 53) % (canvas.height * 0.6);
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, canvas.height - 36, canvas.width, 36);

  const ground = ctx.createLinearGradient(0, canvas.height - 36, 0, canvas.height);
  ground.addColorStop(0, '#6ee7b7');
  ground.addColorStop(1, '#10b981');
  ctx.fillStyle = ground;
  ctx.fillRect(0, canvas.height - 36, canvas.width, 36);
}

function render() {
  drawBackground();
  drawPlayer();
  state.items.forEach(drawItem);

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(220, 180, 520, 150);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Partie terminée', canvas.width / 2, 245);
    ctx.font = '26px sans-serif';
    ctx.fillText('Appuie sur Espace pour recommencer', canvas.width / 2, 290);
  }
}

function loop(timestamp) {
  const delta = Math.min((timestamp - state.lastTime) / 1000 || 0.016, 0.032);
  state.lastTime = timestamp;

  update(delta);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'q') state.keys.left = true;
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keys.right = true;
  if (event.code === 'Space' && state.gameOver) resetGame();
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'q') state.keys.left = false;
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') state.keys.right = false;
});

resetGame();
requestAnimationFrame(loop);
