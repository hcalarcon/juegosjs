// ============================================================
// WEB DOOM — mini raycaster estilo Doom clásico, sin librerías
// ============================================================

// ---------- Canvas setup ----------
const viewport = document.getElementById('viewport');
const vctx = viewport.getContext('2d');

const minimapCanvas = document.getElementById('minimap');
const mctx = minimapCanvas.getContext('2d');
minimapCanvas.width = 150;
minimapCanvas.height = 150;

const RENDER_W = 480; // resolución interna (baja para look retro + rendimiento)
const RENDER_H = 300;
viewport.width = RENDER_W;
viewport.height = RENDER_H;

function resizeCanvas() {
  viewport.style.width = window.innerWidth + 'px';
  viewport.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---------- Mapa ----------
// 1-4 = distintos tipos de pared (colores distintos), 0 = suelo libre
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1],
  [1,0,2,2,2,0,0,0,0,2,0,3,3,3,0,1],
  [1,0,2,0,0,0,1,1,0,0,0,3,0,0,0,1],
  [1,0,2,0,0,0,1,0,0,0,0,3,0,4,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,4,0,1],
  [1,0,0,0,1,1,1,0,0,1,1,0,0,4,0,1],
  [1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,1,0,0,2,2,0,1],
  [1,0,3,0,0,0,0,4,0,0,0,0,2,0,0,1],
  [1,0,3,0,0,0,0,4,0,0,1,1,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
  [1,0,0,1,1,0,0,1,1,0,1,0,3,3,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];
const MAP_H = MAP.length;
const MAP_W = MAP[0].length;

const WALL_COLORS = {
  1: [110, 50, 50],   // ladrillo rojizo
  2: [60, 90, 60],    // musgo verde
  3: [70, 70, 110],   // piedra azulada
  4: [120, 100, 40],  // óxido / metal
};

function isWall(x, y) {
  const mx = Math.floor(x), my = Math.floor(y);
  if (mx < 0 || my < 0 || mx >= MAP_W || my >= MAP_H) return true;
  return MAP[my][mx] !== 0;
}

// ---------- Jugador ----------
const player = {
  x: 8.5,
  y: 13.5,
  angle: -Math.PI / 2,
  fov: (66 * Math.PI) / 180,
  moveSpeed: 3.2,
  radius: 0.25,
  health: 100,
  ammo: 50,
  kills: 0,
};

// ---------- Enemigos ----------
function makeEnemy(x, y) {
  return { x, y, health: 60, alive: true, speed: 1.1, hurtTimer: 0, attackCooldown: 0 };
}
let enemies = [
  makeEnemy(9, 2),
  makeEnemy(3, 9),
  makeEnemy(13, 9),
  makeEnemy(12, 4),
  makeEnemy(2, 3),
];
const TOTAL_ENEMIES = enemies.length;

// ---------- Input ----------
const keys = {};
let pointerLocked = false;

document.addEventListener('keydown', (e) => { keys[e.code] = true; });
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

viewport.addEventListener('click', () => {
  if (gameState === 'playing') viewport.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === viewport;
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  player.angle += e.movementX * 0.0025;
});

document.addEventListener('mousedown', (e) => {
  if (pointerLocked && e.button === 0) shoot();
});

// ---------- Estado del juego ----------
let gameState = 'menu'; // 'menu' | 'playing' | 'dead' | 'won'
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const winScreen = document.getElementById('winScreen');
const statusbar = document.getElementById('statusbar');
const hitFlash = document.getElementById('hitFlash');
const healthBarTrack = document.getElementById('healthBar');
const faceCanvas = document.getElementById('faceCanvas');
const fctx = faceCanvas.getContext('2d');
fctx.imageSmoothingEnabled = false;

// ---------- Barra de vida segmentada ----------
const HEALTH_SEGMENTS = 10;
for (let i = 0; i < HEALTH_SEGMENTS; i++) {
  const seg = document.createElement('div');
  seg.className = 'sb-segment';
  healthBarTrack.appendChild(seg);
}
const segmentEls = Array.from(healthBarTrack.children);

let faceTimer = 0; // tiempo restante de expresión transitoria (dolor / disparo)
let faceExpr = 'grin'; // expresión transitoria activa

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', () => location.reload());
document.getElementById('restartBtn2').addEventListener('click', () => location.reload());

function startGame() {
  gameState = 'playing';
  startScreen.classList.add('hidden');
  viewport.requestPointerLock();
}

// ---------- Disparo ----------
let zBuffer = new Array(RENDER_W).fill(Infinity);
let muzzleFlashTimer = 0;

function shoot() {
  if (gameState !== 'playing') return;
  if (player.ammo <= 0) return;
  player.ammo--;
  updateHUD();
  muzzleFlashTimer = 0.08;
  weaponRecoil = -26;
  faceExpr = 'grin';
  faceTimer = 0.15;

  // rayo central de la cámara para golpear al enemigo más cercano dentro de un pequeño cono
  const maxAngleDiff = 0.06; // ~3.4 grados de tolerancia
  let closest = null;
  let closestDist = Infinity;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angleToEnemy = Math.atan2(dy, dx);
    let diff = angleToEnemy - player.angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // normalizar a [-PI, PI]

    if (Math.abs(diff) < maxAngleDiff && dist < closestDist) {
      // comprobar que no hay pared en medio (usando el zBuffer de la columna central)
      const wallDist = zBuffer[Math.floor(RENDER_W / 2)];
      if (dist < wallDist + 0.3) {
        closest = enemy;
        closestDist = dist;
      }
    }
  }

  if (closest) {
    closest.health -= 30;
    closest.hurtTimer = 0.15;
    if (closest.health <= 0) {
      closest.alive = false;
      player.kills++;
      updateHUD();
      checkWin();
    }
  }
}

// ---------- Raycasting (DDA) ----------
function castRay(rayAngle) {
  const rayDirX = Math.cos(rayAngle);
  const rayDirY = Math.sin(rayAngle);

  let mapX = Math.floor(player.x);
  let mapY = Math.floor(player.y);

  const deltaDistX = Math.abs(1 / rayDirX);
  const deltaDistY = Math.abs(1 / rayDirY);

  let stepX, stepY, sideDistX, sideDistY;

  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (player.x - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - player.x) * deltaDistX;
  }
  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (player.y - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - player.y) * deltaDistY;
  }

  let side = 0;
  let hit = false;
  let wallType = 1;
  let safety = 0;

  while (!hit && safety < 64) {
    safety++;
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }
    if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) {
      hit = true;
      wallType = 1;
      break;
    }
    if (MAP[mapY][mapX] !== 0) {
      hit = true;
      wallType = MAP[mapY][mapX];
    }
  }

  let perpDist;
  if (side === 0) {
    perpDist = (mapX - player.x + (1 - stepX) / 2) / rayDirX;
  } else {
    perpDist = (mapY - player.y + (1 - stepY) / 2) / rayDirY;
  }
  perpDist = Math.max(perpDist, 0.0001);

  return { dist: perpDist, side, wallType };
}

// ---------- Render ----------
function render() {
  // cielo y suelo
  const grd = vctx.createLinearGradient(0, 0, 0, RENDER_H / 2);
  grd.addColorStop(0, '#1a1a24');
  grd.addColorStop(1, '#33333f');
  vctx.fillStyle = grd;
  vctx.fillRect(0, 0, RENDER_W, RENDER_H / 2);

  const grd2 = vctx.createLinearGradient(0, RENDER_H / 2, 0, RENDER_H);
  grd2.addColorStop(0, '#3a3126');
  grd2.addColorStop(1, '#1c1712');
  vctx.fillStyle = grd2;
  vctx.fillRect(0, RENDER_H / 2, RENDER_W, RENDER_H / 2);

  // paredes
  for (let x = 0; x < RENDER_W; x++) {
    const cameraX = (2 * x) / RENDER_W - 1;
    const rayAngle = player.angle + Math.atan(cameraX * Math.tan(player.fov / 2));
    const result = castRay(rayAngle);

    const correctedDist = result.dist * Math.cos(rayAngle - player.angle);
    zBuffer[x] = correctedDist;

    const lineHeight = Math.min(RENDER_H * 3, RENDER_H / correctedDist);
    const drawStart = RENDER_H / 2 - lineHeight / 2;

    let [r, g, b] = WALL_COLORS[result.wallType] || [120, 120, 120];
    if (result.side === 1) {
      r *= 0.7; g *= 0.7; b *= 0.7;
    }
    const shade = Math.max(0.25, Math.min(1, 1.4 / (1 + correctedDist * correctedDist * 0.06)));
    r = Math.floor(r * shade);
    g = Math.floor(g * shade);
    b = Math.floor(b * shade);

    vctx.fillStyle = `rgb(${r},${g},${b})`;
    vctx.fillRect(x, drawStart, 1, lineHeight);
  }

  renderSprites();

  if (muzzleFlashTimer > 0) {
    vctx.fillStyle = 'rgba(255, 220, 120, 0.25)';
    vctx.fillRect(0, 0, RENDER_W, RENDER_H);
  }

  drawWeapon();
}

// ---------- Arma en primera persona (pistola) ----------
let weaponBobPhase = 0;
let weaponIdlePhase = 0;
let weaponRecoil = 0;

function drawWeapon() {
  if (gameState === 'menu') return;

  const isMoving = (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']) && gameState === 'playing';
  const bobX = isMoving ? Math.cos(weaponBobPhase * 0.5) * 4 : Math.sin(weaponIdlePhase) * 1.2;
  const bobY = isMoving ? Math.abs(Math.sin(weaponBobPhase)) * 6 : Math.sin(weaponIdlePhase * 0.7) * 1.2;

  vctx.save();
  vctx.translate(RENDER_W / 2 + 38 + bobX, RENDER_H + bobY + weaponRecoil);
  vctx.scale(0.82, 0.82);

  // ---- manga (brazo) ----
  vctx.fillStyle = '#3d4229';
  vctx.beginPath();
  vctx.moveTo(-54, 4);
  vctx.lineTo(-38, -38);
  vctx.lineTo(34, -38);
  vctx.lineTo(50, 4);
  vctx.closePath();
  vctx.fill();
  // puño / cuff
  vctx.fillStyle = '#2c2f1c';
  vctx.fillRect(-38, -38, 72, 7);

  // ---- empuñadura (detrás de la mano) ----
  const gripGrd = vctx.createLinearGradient(-16, -108, 4, -46);
  gripGrd.addColorStop(0, '#3a2818');
  gripGrd.addColorStop(1, '#160d06');
  vctx.fillStyle = gripGrd;
  vctx.beginPath();
  vctx.moveTo(-11, -104);
  vctx.lineTo(3, -104);
  vctx.lineTo(7, -46);
  vctx.lineTo(-15, -46);
  vctx.closePath();
  vctx.fill();
  // textura de agarre (líneas diagonales)
  vctx.strokeStyle = 'rgba(0,0,0,0.35)';
  vctx.lineWidth = 1.5;
  for (let i = -100; i < -52; i += 7) {
    vctx.beginPath();
    vctx.moveTo(-13 + (i + 104) * 0.06, i);
    vctx.lineTo(5 + (i + 104) * 0.06, i + 4);
    vctx.stroke();
  }

  // ---- guardamonte (fino, discreto) ----
  vctx.strokeStyle = '#0c0c0c';
  vctx.lineWidth = 3;
  vctx.beginPath();
  vctx.arc(-2, -108, 8, 0.15, Math.PI - 0.15, false);
  vctx.stroke();

  // ---- mano envolviendo la empuñadura ----
  vctx.fillStyle = '#c98c56';
  vctx.beginPath();
  vctx.moveTo(-26, -38);
  vctx.lineTo(24, -38);
  vctx.lineTo(22, -64);
  vctx.lineTo(14, -74);
  vctx.lineTo(-20, -72);
  vctx.lineTo(-26, -60);
  vctx.closePath();
  vctx.fill();
  // sombra bajo los dedos
  vctx.fillStyle = 'rgba(120, 70, 35, 0.55)';
  vctx.fillRect(-24, -46, 46, 8);
  // nudillos
  vctx.fillStyle = '#b9784a';
  for (let i = 0; i < 3; i++) vctx.fillRect(-18 + i * 13, -70, 9, 6);
  // pulgar
  vctx.fillStyle = '#c98c56';
  vctx.beginPath();
  vctx.ellipse(20, -78, 9, 14, 0.5, 0, Math.PI * 2);
  vctx.fill();

  // ---- marco / bloque conector ----
  vctx.fillStyle = '#232426';
  vctx.fillRect(-13, -116, 24, 12);

  // ---- corredera (cuerpo metálico principal) ----
  const slideGrd = vctx.createLinearGradient(0, -158, 0, -114);
  slideGrd.addColorStop(0, '#6d6f74');
  slideGrd.addColorStop(0.45, '#333437');
  slideGrd.addColorStop(1, '#141516');
  vctx.fillStyle = slideGrd;
  vctx.fillRect(-27, -158, 52, 44);
  // filo superior brillante
  vctx.fillStyle = 'rgba(210,212,216,0.55)';
  vctx.fillRect(-27, -158, 52, 2);
  // puerto de expulsión
  vctx.fillStyle = '#0b0b0c';
  vctx.fillRect(3, -145, 15, 12);
  vctx.strokeStyle = 'rgba(255,255,255,0.12)';
  vctx.lineWidth = 1;
  vctx.strokeRect(3, -145, 15, 12);
  // serraciones traseras
  vctx.strokeStyle = 'rgba(0,0,0,0.5)';
  vctx.lineWidth = 2;
  for (let sx = -23; sx <= -9; sx += 4) {
    vctx.beginPath();
    vctx.moveTo(sx, -150);
    vctx.lineTo(sx, -122);
    vctx.stroke();
  }

  // ---- martillo ----
  vctx.fillStyle = '#1c1d1e';
  vctx.beginPath();
  vctx.ellipse(-24, -140, 6, 9, 0, 0, Math.PI * 2);
  vctx.fill();

  // ---- mira trasera ----
  vctx.fillStyle = '#0a0a0a';
  vctx.fillRect(-19, -160, 9, 5);
  vctx.fillRect(-16, -163, 3, 4);

  // ---- cañón / boca ----
  const barrelGrd = vctx.createLinearGradient(0, -190, 0, -156);
  barrelGrd.addColorStop(0, '#48494c');
  barrelGrd.addColorStop(1, '#0e0f10');
  vctx.fillStyle = barrelGrd;
  vctx.fillRect(-8, -190, 16, 34);
  vctx.fillStyle = 'rgba(210,212,216,0.4)';
  vctx.fillRect(-8, -190, 16, 2);
  // mira frontal
  vctx.fillStyle = '#0a0a0a';
  vctx.fillRect(-3, -194, 5, 6);
  // boca del cañón
  vctx.fillStyle = '#020202';
  vctx.beginPath();
  vctx.ellipse(0, -188, 6.5, 4, 0, 0, Math.PI * 2);
  vctx.fill();
  vctx.strokeStyle = '#3a3b3d';
  vctx.lineWidth = 1;
  vctx.beginPath();
  vctx.ellipse(0, -188, 6.5, 4, 0, 0, Math.PI * 2);
  vctx.stroke();

  // ---- destello de disparo ----
  if (muzzleFlashTimer > 0) {
    const t = muzzleFlashTimer / 0.08;
    vctx.save();
    vctx.translate(0, -190);
    vctx.rotate(Math.random() * 0.5 - 0.25);
    vctx.fillStyle = `rgba(255, 240, 170, ${0.6 + 0.4 * t})`;
    const spikes = 6;
    const outer = 30 * t + 5;
    const inner = 11 * t + 2;
    vctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / spikes) * i;
      vctx.lineTo(Math.cos(a) * r, Math.sin(a) * r - r * 0.4);
    }
    vctx.closePath();
    vctx.fill();
    vctx.fillStyle = `rgba(255, 255, 230, ${0.85 * t})`;
    vctx.beginPath();
    vctx.arc(0, -4, 9 * t + 2, 0, Math.PI * 2);
    vctx.fill();
    vctx.restore();
  }

  vctx.restore();
}

function renderSprites() {
  const sorted = enemies
    .filter((e) => e.alive)
    .map((e) => {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      return { e, dist: dx * dx + dy * dy };
    })
    .sort((a, b) => b.dist - a.dist);

  for (const { e } of sorted) {
    const dx = e.x - player.x;
    const dy = e.y - player.y;

    // ángulo del enemigo relativo a la dirección del jugador
    const angleToEnemy = Math.atan2(dy, dx) - player.angle;
    let a = Math.atan2(Math.sin(angleToEnemy), Math.cos(angleToEnemy));
    const dist = Math.hypot(dx, dy);

    if (Math.abs(a) > player.fov / 2 + 0.3 || dist < 0.2) continue;

    const spriteScreenX = (0.5 * Math.tan(a) / Math.tan(player.fov / 2) + 0.5) * RENDER_W;
    const spriteHeight = Math.min(RENDER_H * 2, RENDER_H / dist);
    const spriteWidth = spriteHeight * 0.6;

    const drawStartY = RENDER_H / 2 - spriteHeight / 2;
    const drawStartX = spriteScreenX - spriteWidth / 2;

    // comprobación de oclusión por columnas usando el zBuffer
    const colStart = Math.max(0, Math.floor(drawStartX));
    const colEnd = Math.min(RENDER_W - 1, Math.floor(drawStartX + spriteWidth));
    if (colEnd < 0 || colStart >= RENDER_W) continue;

    let visibleCols = 0;
    for (let cx = colStart; cx <= colEnd; cx++) {
      if (dist < zBuffer[cx]) visibleCols++;
    }
    if (visibleCols === 0) continue;

    drawEnemySprite(drawStartX, drawStartY, spriteWidth, spriteHeight, dist, e, colStart, colEnd);
  }
}

function drawEnemySprite(x, y, w, h, dist, enemy, colStart, colEnd) {
  vctx.save();
  vctx.beginPath();
  vctx.rect(colStart, 0, colEnd - colStart + 1, RENDER_H);
  vctx.clip();

  const shade = Math.max(0.35, Math.min(1, 1.5 / (1 + dist * dist * 0.05)));
  const hurt = enemy.hurtTimer > 0;

  const bodyColor = hurt ? `rgba(255,255,255,${shade})` : `rgba(${Math.floor(150*shade)},${Math.floor(30*shade)},${Math.floor(30*shade)},1)`;

  // cuerpo (cápsula simple)
  vctx.fillStyle = bodyColor;
  const cx = x + w / 2;
  vctx.beginPath();
  vctx.ellipse(cx, y + h * 0.35, w * 0.32, h * 0.35, 0, 0, Math.PI * 2);
  vctx.fill();
  vctx.fillRect(x + w * 0.18, y + h * 0.35, w * 0.64, h * 0.55);

  // ojos
  vctx.fillStyle = `rgba(255, 230, 40, ${shade})`;
  vctx.fillRect(cx - w * 0.18, y + h * 0.22, w * 0.12, h * 0.06);
  vctx.fillRect(cx + w * 0.06, y + h * 0.22, w * 0.12, h * 0.06);

  // barra de vida sobre el enemigo
  const barW = w * 0.8;
  vctx.fillStyle = 'rgba(0,0,0,0.6)';
  vctx.fillRect(cx - barW / 2, y - 10, barW, 5);
  vctx.fillStyle = '#4dff4d';
  vctx.fillRect(cx - barW / 2, y - 10, barW * Math.max(0, enemy.health / 60), 5);

  vctx.restore();
}

// ---------- Minimapa ----------
function renderMinimap() {
  const cell = minimapCanvas.width / MAP_W;
  mctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  for (let yy = 0; yy < MAP_H; yy++) {
    for (let xx = 0; xx < MAP_W; xx++) {
      if (MAP[yy][xx] !== 0) {
        const [r, g, b] = WALL_COLORS[MAP[yy][xx]] || [120, 120, 120];
        mctx.fillStyle = `rgb(${r},${g},${b})`;
        mctx.fillRect(xx * cell, yy * cell, cell, cell);
      }
    }
  }

  for (const e of enemies) {
    if (!e.alive) continue;
    mctx.fillStyle = '#ff3b3b';
    mctx.beginPath();
    mctx.arc(e.x * cell, e.y * cell, 2.5, 0, Math.PI * 2);
    mctx.fill();
  }

  mctx.fillStyle = '#4dd2ff';
  mctx.beginPath();
  mctx.arc(player.x * cell, player.y * cell, 3, 0, Math.PI * 2);
  mctx.fill();

  mctx.strokeStyle = '#4dd2ff';
  mctx.lineWidth = 1.5;
  mctx.beginPath();
  mctx.moveTo(player.x * cell, player.y * cell);
  mctx.lineTo(player.x * cell + Math.cos(player.angle) * 10, player.y * cell + Math.sin(player.angle) * 10);
  mctx.stroke();
}

// ---------- HUD ----------
function updateHUD() {
  const hp = Math.max(0, Math.round(player.health));
  document.getElementById('healthVal').textContent = hp;
  document.getElementById('ammoVal').textContent = player.ammo;
  document.getElementById('killsVal').textContent = player.kills;
  statusbar.classList.toggle('low-health', player.health <= 30 && player.health > 0);

  const filled = Math.ceil((player.health / 100) * HEALTH_SEGMENTS);
  segmentEls.forEach((seg, i) => {
    const on = i < filled;
    seg.classList.toggle('on', on);
    seg.classList.toggle('warn', on && player.health <= 60 && player.health > 30);
    seg.classList.toggle('crit', on && player.health <= 30);
  });
}

// ---------- Cara del jugador (mugshot pixelado, 16x16) ----------
function drawFace() {
  fctx.clearRect(0, 0, 16, 16);

  const dead = gameState === 'dead';
  const critical = player.health <= 30 && !dead;
  const hurting = faceTimer > 0 && faceExpr === 'pain';
  const shooting = faceTimer > 0 && faceExpr === 'grin';

  const skin = dead ? '#5c5648' : critical ? '#c9784f' : '#d9a066';
  const skinShade = dead ? '#403c33' : critical ? '#a15a37' : '#b97a45';

  // casco / pelo
  fctx.fillStyle = '#221a12';
  fctx.fillRect(3, 1, 10, 3);
  fctx.fillRect(2, 3, 2, 9);
  fctx.fillRect(12, 3, 2, 9);

  // cara base
  fctx.fillStyle = skin;
  fctx.fillRect(4, 3, 8, 10);
  fctx.fillStyle = skinShade;
  fctx.fillRect(4, 9, 8, 4);

  // sangre si vida crítica
  if (critical && !dead) {
    fctx.fillStyle = '#8a0000';
    fctx.fillRect(5, 4, 1, 3);
    fctx.fillRect(10, 5, 1, 4);
  }

  // ojos
  if (dead) {
    fctx.fillStyle = '#101010';
    fctx.fillRect(5, 5, 2, 1);
    fctx.fillRect(6, 6, 2, 1);
    fctx.fillRect(9, 5, 2, 1);
    fctx.fillRect(10, 6, 2, 1);
  } else if (hurting) {
    fctx.fillStyle = '#101010';
    fctx.fillRect(5, 6, 2, 1);
    fctx.fillRect(9, 6, 2, 1);
  } else {
    fctx.fillStyle = '#f0f0f0';
    fctx.fillRect(5, 5, 2, 2);
    fctx.fillRect(9, 5, 2, 2);
    fctx.fillStyle = critical || shooting ? '#ff2a1e' : '#101010';
    fctx.fillRect(5, 6, 1, 1);
    fctx.fillRect(10, 6, 1, 1);
  }

  // boca
  if (dead) {
    fctx.fillStyle = '#101010';
    fctx.fillRect(6, 10, 4, 1);
  } else if (shooting) {
    fctx.fillStyle = '#101010';
    fctx.fillRect(6, 9, 4, 2);
    fctx.fillStyle = '#f0f0f0';
    fctx.fillRect(6, 9, 4, 1);
  } else if (hurting || critical) {
    fctx.fillStyle = '#5a1010';
    fctx.fillRect(6, 10, 4, 2);
  } else {
    fctx.fillStyle = '#5c3a22';
    fctx.fillRect(6, 10, 4, 1);
  }
}

// ---------- Movimiento ----------
function tryMove(nx, ny) {
  if (!isWall(nx + Math.sign(nx - player.x) * player.radius, player.y)) player.x = nx;
  if (!isWall(player.x, ny + Math.sign(ny - player.y) * player.radius)) player.y = ny;
}

function updatePlayer(dt) {
  let moveX = 0, moveY = 0;
  const forward = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
  const right = { x: Math.cos(player.angle + Math.PI / 2), y: Math.sin(player.angle + Math.PI / 2) };

  if (keys['KeyW']) { moveX += forward.x; moveY += forward.y; }
  if (keys['KeyS']) { moveX -= forward.x; moveY -= forward.y; }
  if (keys['KeyD']) { moveX += right.x; moveY += right.y; }
  if (keys['KeyA']) { moveX -= right.x; moveY -= right.y; }

  const len = Math.hypot(moveX, moveY);
  if (len > 0) {
    moveX = (moveX / len) * player.moveSpeed * dt;
    moveY = (moveY / len) * player.moveSpeed * dt;
    tryMove(player.x + moveX, player.y + moveY);
  }
}

// ---------- IA enemigos ----------
function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.hurtTimer > 0) e.hurtTimer -= dt;
    if (e.attackCooldown > 0) e.attackCooldown -= dt;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 6 && dist > 0.6) {
      const nx = e.x + (dx / dist) * e.speed * dt;
      const ny = e.y + (dy / dist) * e.speed * dt;
      if (!isWall(nx, e.y)) e.x = nx;
      if (!isWall(e.x, ny)) e.y = ny;
    } else if (dist <= 0.6 && e.attackCooldown <= 0) {
      player.health -= 8;
      e.attackCooldown = 0.9;
      flashHit();
      updateHUD();
      if (player.health <= 0) {
        player.health = 0;
        updateHUD();
        endGame();
      }
    }
  }
}

function flashHit() {
  hitFlash.classList.add('active');
  faceExpr = 'pain';
  faceTimer = 0.35;
  requestAnimationFrame(() => {
    hitFlash.classList.remove('active');
  });
}

function endGame() {
  gameState = 'dead';
  document.getElementById('finalScore').textContent = `Enemigos eliminados: ${player.kills} / ${TOTAL_ENEMIES}`;
  gameOverScreen.classList.remove('hidden');
  document.exitPointerLock();
}

function checkWin() {
  if (player.kills >= TOTAL_ENEMIES) {
    gameState = 'won';
    winScreen.classList.remove('hidden');
    document.exitPointerLock();
  }
}

// ---------- Loop principal ----------
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (muzzleFlashTimer > 0) muzzleFlashTimer -= dt;
  if (faceTimer > 0) faceTimer -= dt;

  const isMoving = (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']) && gameState === 'playing';
  if (isMoving) {
    weaponBobPhase += dt * 9;
  } else {
    weaponIdlePhase += dt * 1.6;
  }
  weaponRecoil += (0 - weaponRecoil) * Math.min(1, dt * 10);
  if (Math.abs(weaponRecoil) < 0.05) weaponRecoil = 0;

  if (gameState === 'playing') {
    updatePlayer(dt);
    updateEnemies(dt);
  }

  render();
  renderMinimap();
  drawFace();

  requestAnimationFrame(loop);
}

updateHUD();
requestAnimationFrame(loop);