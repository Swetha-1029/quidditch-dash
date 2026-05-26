import { useState, useEffect, useRef, useCallback } from "react";

const W = 390, H = 600;
const FLY_TOP = 55;
const FLY_BOT = H - 80;
const HARRY_X = 72;
const HARRY_W = 60, HARRY_H = 36;
const CENTRE_Y = H / 2 - HARRY_H / 2;

// Medium floaty physics — never too high, never too low
const GRAVITY = 0.34;
const JUMP_V = -8.2;
const FALL_CAP = 7;

const OBS_W = 28;
const SNITCH_R = 11;
const SPEED_BASE = 2.0;
const SPEED_MAX = 5.8;
const INVINCIBLE_MS = 1800;

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function makeObs(worldX, speed, level) {
  const gap = Math.max(175, 215 - level * 4);
  const topMax = FLY_BOT - gap - 30;
  const topH = rand(FLY_TOP + 10, topMax);
  return { x: worldX + W + 40, topH, botY: topH + gap, speed, passed: false };
}

function makeSnitch(fromWorldX) {
  return {
    worldX: fromWorldX + 700,
    y: rand(FLY_TOP + 50, FLY_BOT - 50),
    bobT: rand(0, Math.PI * 2),
    wingT: 0, blinkT: 0,
    active: true,
  };
}

// ── BG clouds
const CLOUDS = [
  { ox: 20, oy: 65, w: 100, h: 32 },
  { ox: 160, oy: 40, w: 80, h: 24 },
  { ox: 270, oy: 85, w: 110, h: 30 },
  { ox: 80, oy: 145, w: 70, h: 22 },
  { ox: 330, oy: 130, w: 90, h: 28 },
];

function drawBg(ctx, worldX, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#4ba3d2");
  g.addColorStop(0.5, "#85ccee");
  g.addColorStop(1, "#c5e8f7");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // sun
  ctx.fillStyle = "#ffe44d"; ctx.shadowColor = "#ffdd00"; ctx.shadowBlur = 26;
  ctx.beginPath(); ctx.arc(W - 50, 50, 22, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // clouds
  CLOUDS.forEach(c => {
    const cx = ((c.ox - worldX * 0.28) % (W + 160) + (W + 160)) % (W + 160) - 60;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.beginPath();
    ctx.ellipse(cx,           c.oy,        c.w * 0.36, c.h * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + c.w*0.3, c.oy-c.h*0.2,c.w * 0.3, c.h * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + c.w*0.6, c.oy,        c.w * 0.32, c.h * 0.55,0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Quidditch hoops (parallax 0.12x)
  [{ ox: 100, col: "#b91c1c" }, { ox: 310, col: "#166534" }, { ox: 520, col: "#b91c1c" }]
    .forEach(({ ox, col }) => {
      const hx = ((ox - worldX * 0.12) % (W + 220) + (W + 220)) % (W + 220) - 60;
      ctx.strokeStyle = col; ctx.lineWidth = 5;
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(hx, FLY_BOT + 30); ctx.lineTo(hx, H); ctx.stroke();
      ctx.beginPath(); ctx.arc(hx, FLY_BOT + 10, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    });

  // green ground
  ctx.fillStyle = "#2d6e18"; ctx.fillRect(0, FLY_BOT + 55, W, H);
  ctx.fillStyle = "#4aaa28"; ctx.fillRect(0, FLY_BOT + 55, W, 7);
  // turf stripes
  ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1;
  for (let lx = (-(worldX * 0.35) % 45 + 45) % 45; lx < W; lx += 45) {
    ctx.beginPath(); ctx.moveTo(lx, FLY_BOT + 62); ctx.lineTo(lx, H); ctx.stroke();
  }
  // coloured crowd dots
  const cols = ["#ef4444","#3b82f6","#f59e0b","#22c55e","#a855f7"];
  for (let ci = 0; ci < 34; ci++) {
    const cx2 = ((ci * 49 - worldX * 0.08) % (W + 20) + (W + 20)) % (W + 20);
    const cy2 = FLY_BOT + 68 + (ci % 4) * 9;
    ctx.fillStyle = cols[ci % cols.length];
    ctx.beginPath(); ctx.arc(cx2, cy2, 4, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Obstacle (wooden Bludger pole)
function drawObs(ctx, o, worldX) {
  const sx = o.x - worldX;
  if (sx + OBS_W < -10 || sx > W + 10) return;
  ctx.shadowColor = "#92400e"; ctx.shadowBlur = 8;
  // top pole
  ctx.fillStyle = "#78350f";
  ctx.fillRect(sx, 0, OBS_W, o.topH);
  ctx.fillStyle = "#a16207";
  ctx.fillRect(sx - 5, o.topH - 20, OBS_W + 10, 20);
  // wood grain
  ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1.2;
  for (let ry = 14; ry < o.topH - 20; ry += 14) {
    ctx.beginPath(); ctx.moveTo(sx+3, ry); ctx.lineTo(sx+OBS_W-3, ry+3); ctx.stroke();
  }
  // bottom pole
  ctx.fillStyle = "#78350f";
  ctx.fillRect(sx, o.botY, OBS_W, H - o.botY);
  ctx.fillStyle = "#a16207";
  ctx.fillRect(sx - 5, o.botY, OBS_W + 10, 20);
  for (let ry = o.botY + 22; ry < H; ry += 14) {
    ctx.beginPath(); ctx.moveTo(sx+3, ry); ctx.lineTo(sx+OBS_W-3, ry+3); ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

// ── Golden Snitch
function drawSnitch(ctx, sn, worldX) {
  if (!sn.active) return;
  const sx = sn.worldX - worldX;
  if (sx < -50 || sx > W + 50) return;
  const sy = sn.y;
  ctx.save(); ctx.translate(sx, sy);
  const flap = Math.sin(sn.wingT) * 0.6;
  // left wing
  ctx.save(); ctx.rotate(flap - 0.25);
  ctx.fillStyle = "rgba(255,215,0,0.52)";
  ctx.beginPath(); ctx.ellipse(-18, -2, 19, 8, -0.25, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(180,140,0,0.45)"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0,-2); ctx.lineTo(-19,-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6,-2); ctx.lineTo(-15,-9); ctx.stroke();
  ctx.restore();
  // right wing
  ctx.save(); ctx.rotate(-flap + 0.25);
  ctx.fillStyle = "rgba(255,215,0,0.52)";
  ctx.beginPath(); ctx.ellipse(18, -2, 19, 8, 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(180,140,0,0.45)"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0,-2); ctx.lineTo(19,-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6,-2); ctx.lineTo(15,-9); ctx.stroke();
  ctx.restore();
  // glow + body
  const pulse = 12 + 5 * Math.sin(sn.blinkT * 0.1);
  ctx.shadowColor = "#FFD700"; ctx.shadowBlur = pulse;
  const bg = ctx.createRadialGradient(-3,-3,1,0,0,SNITCH_R);
  bg.addColorStop(0,"#fffde0"); bg.addColorStop(0.45,"#FFD700"); bg.addColorStop(1,"#b8860b");
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(0,0,SNITCH_R,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  // shine + band
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath(); ctx.arc(-3,-4,3.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#b8860b"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0,0,SNITCH_R,0.1,Math.PI-0.1); ctx.stroke();
  ctx.restore(); ctx.shadowBlur = 0;
}

// ── Harry Potter on Nimbus 2000 ─────────────────────────────────────────────
function drawHarry(ctx, py, velY, trail) {
  // broom trail
  for (let i = trail.length - 1; i > 0; i--) {
    ctx.globalAlpha = (1 - i / trail.length) * 0.38;
    ctx.strokeStyle = "#d4a017";
    ctx.lineWidth = 2.8 - i * 0.15;
    ctx.beginPath();
    ctx.moveTo(trail[i].x - 22,   trail[i].y + HARRY_H * 0.7);
    ctx.lineTo(trail[i-1].x - 22, trail[i-1].y + HARRY_H * 0.7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tilt = clamp(velY * 0.035, -0.38, 0.38);
  const cx = HARRY_X + HARRY_W * 0.42;
  const cy = py + HARRY_H * 0.5;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  // ── NIMBUS 2000 BROOM ──────────────────────────────────────
  // Handle — long slim tapered rod
  ctx.fillStyle = "#92400e";
  ctx.beginPath();
  ctx.moveTo(-HARRY_W * 0.55, 8);
  ctx.lineTo( HARRY_W * 0.58, 5);
  ctx.lineTo( HARRY_W * 0.58, 9);
  ctx.lineTo(-HARRY_W * 0.55, 13);
  ctx.closePath();
  ctx.fill();
  // handle shine
  ctx.fillStyle = "rgba(255,220,150,0.25)";
  ctx.beginPath();
  ctx.moveTo(-HARRY_W*0.5, 8.5);
  ctx.lineTo( HARRY_W*0.5, 5.5);
  ctx.lineTo( HARRY_W*0.5, 7);
  ctx.lineTo(-HARRY_W*0.5, 10);
  ctx.closePath();
  ctx.fill();
  // bristle bundle at back
  const bristleX = -HARRY_W * 0.52;
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.ellipse(bristleX - 8, 12, 12, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // individual bristles
  ctx.strokeStyle = "#78350f"; ctx.lineWidth = 1;
  for (let b = 0; b < 9; b++) {
    const bx = bristleX - 4 - b * 2.5;
    const by = 8 + (b % 3) * 2.5;
    ctx.beginPath(); ctx.moveTo(bx + 5, by); ctx.lineTo(bx, by + 12); ctx.stroke();
  }
  // broom name tag
  ctx.font = "4.5px Arial"; ctx.fillStyle = "rgba(255,200,80,0.7)";
  ctx.textAlign = "center";
  ctx.fillText("NIMBUS 2000", HARRY_W * 0.1, 5);

  // ── HARRY BODY (riding position — leaning forward) ──────────
  // Legs straddling broom
  ctx.fillStyle = "#1c1c3a"; // dark trousers
  ctx.beginPath(); ctx.ellipse(-5, 14, 9, 5, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8,  14, 9, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  // shoes
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.ellipse(-10, 18, 6, 3.5, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14,  18, 6, 3.5, -0.5, 0, Math.PI * 2); ctx.fill();

  // Robe body — Gryffindor scarlet/maroon
  ctx.fillStyle = "#7f1d1d";
  ctx.beginPath();
  ctx.roundRect(-10, -14, 22, 24, 4);
  ctx.fill();
  // Robe flowing cape behind (longer with speed)
  const capeLen = 14 + Math.abs(velY) * 1.2;
  ctx.fillStyle = "#991b1b";
  ctx.beginPath();
  ctx.moveTo(-10, -12);
  ctx.quadraticCurveTo(-18 - capeLen * 0.4, 2, -10 + capeLen * 0.1, 8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  // Gryffindor tie stripes (gold + red)
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(-3, -8, 5, 12);
  ctx.fillStyle = "#991b1b";
  ctx.fillRect(-3, -8, 5, 2);
  ctx.fillRect(-3, -4, 5, 2);
  ctx.fillRect(-3, 0, 5, 2);
  // Robe collar
  ctx.fillStyle = "#f8f0e3";
  ctx.beginPath();
  ctx.moveTo(-5, -14); ctx.lineTo(5, -14);
  ctx.lineTo(3, -8); ctx.lineTo(-3, -8);
  ctx.closePath(); ctx.fill();

  // Arms leaning forward on broom
  ctx.fillStyle = "#7f1d1d";
  ctx.beginPath(); ctx.roundRect(8, -4, 18, 7, 3); ctx.fill();
  // Hands
  ctx.fillStyle = "#f5cba7";
  ctx.beginPath(); ctx.ellipse(27, -1, 5, 4, -0.2, 0, Math.PI * 2); ctx.fill();

  // Wand tucked in robe (pointing forward, glowing tip)
  ctx.strokeStyle = "#5c3317"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, -8); ctx.lineTo(36, -14); ctx.stroke();
  ctx.shadowColor = "#d8b4fe"; ctx.shadowBlur = 7;
  ctx.fillStyle = "#d8b4fe";
  ctx.beginPath(); ctx.arc(36, -14, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // ── HEAD ──────────────────────────────────────────────────────
  // neck
  ctx.fillStyle = "#f5cba7";
  ctx.beginPath(); ctx.roundRect(-1, -20, 6, 8, 2); ctx.fill();

  // head
  ctx.fillStyle = "#f5cba7";
  ctx.beginPath(); ctx.ellipse(3, -26, 10, 12, 0.08, 0, Math.PI * 2); ctx.fill();

  // messy black hair — multiple overlapping blobs
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.ellipse(3, -35, 10, 6, 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4, -32, 6, 5, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -31, 5, 4, 0.4, 0, Math.PI * 2); ctx.fill();
  // fringe bits
  ctx.beginPath(); ctx.ellipse(0, -28, 4, 3, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, -27, 3, 2.5, 0.3, 0, Math.PI * 2); ctx.fill();

  // round glasses — two circles
  ctx.strokeStyle = "#3d1a00"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(-2, -25, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc( 7, -25, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2, -25); ctx.lineTo(3.5, -25); ctx.stroke(); // bridge
  // eyes behind glasses
  ctx.fillStyle = "#1a6e2a";
  ctx.beginPath(); ctx.arc(-2, -25, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 7, -25, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.arc(-1.5,-25, 0.9, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(7.5, -25, 0.9, 0, Math.PI*2); ctx.fill();

  // lightning bolt scar (forehead)
  ctx.strokeStyle = "#ff6600"; ctx.lineWidth = 1.2;
  ctx.shadowColor = "#ff6600"; ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(3, -33); ctx.lineTo(0, -30); ctx.lineTo(4, -29); ctx.lineTo(1, -26);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // mouth (slight concentration grimace)
  ctx.strokeStyle = "#c0826a"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(3, -21, 3, 0.3, Math.PI - 0.3); ctx.stroke();

  ctx.restore();
}

// ── HUD ──────────────────────────────────────────────────────────────────────
function drawHUD(ctx, score, worldX, sn) {
  const pill = (x, y, w, h) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill(); };
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  pill(10, 10, 120, 34);
  ctx.font = "bold 13px Georgia, serif"; ctx.textAlign = "left";
  ctx.fillStyle = "#78350f";
  ctx.fillText(`⚡ ${score} pts`, 20, 32);

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  pill(W - 88, 10, 78, 34);
  ctx.textAlign = "right"; ctx.fillStyle = "#5a1e00";
  ctx.font = "bold 13px Georgia, serif";


  // snitch radar bar (centre)
  if (sn && sn.active) {
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    pill(W/2 - 68, 10, 136, 34);
    const dist = Math.max(0, sn.worldX - worldX - HARRY_W);
    const pct = clamp(1 - dist / 900, 0, 1);
    ctx.fillStyle = "#d1d5db";
    ctx.beginPath(); ctx.roundRect(W/2 - 52, 20, 104, 8, 4); ctx.fill();
    ctx.fillStyle = "#d97706"; ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.roundRect(W/2 - 52, 20, 104 * pct, 8, 4); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = "9px Georgia, serif"; ctx.fillStyle = "#92400e"; ctx.textAlign = "center";
    ctx.fillText("SNITCH", W / 2, 41);
  } else {
    // missed — show respawn hint
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    pill(W/2 - 68, 10, 136, 34);
    ctx.font = "bold 11px Georgia, serif"; ctx.fillStyle = "#b45309"; ctx.textAlign = "center";
    ctx.fillText("Snitch respawning...", W/2, 31);
  }
}


// ── Large Harry illustration for idle screen ──────────────────────────────────
function HarryIllustration() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const CW = 280, CH = 200;
    ctx.clearRect(0, 0, CW, CH);

    // sky bg
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, "#4ba3d2"); g.addColorStop(1, "#c5e8f7");
    ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);

    // moon / stars
    ctx.fillStyle = "#ffe44d"; ctx.shadowColor = "#ffdd00"; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(CW - 36, 32, 18, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    [[30,18],[60,8],[110,22],[170,12],[220,25]].forEach(([sx,sy]) => {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
    });

    // clouds
    [[20,55,80,22],[160,40,90,24]].forEach(([cx,cy,cw,ch]) => {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(cx,       cy,      cw*0.35, ch*0.6, 0, 0, Math.PI*2);
      ctx.ellipse(cx+cw*0.3,cy-ch*0.2,cw*0.3, ch*0.7, 0, 0, Math.PI*2);
      ctx.ellipse(cx+cw*0.6,cy,      cw*0.32, ch*0.55,0, 0, Math.PI*2);
      ctx.fill();
    });

    // draw snitch (top right area)
    const snx = 220, sny = 75;
    ctx.save(); ctx.translate(snx, sny);
    // wings
    [-1,1].forEach(side => {
      ctx.save(); ctx.rotate(side * 0.3);
      ctx.fillStyle = "rgba(255,215,0,0.55)";
      ctx.beginPath(); ctx.ellipse(side*18, -2, 17, 7, side*0.25, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 14;
    const bg = ctx.createRadialGradient(-2,-3,1,0,0,10);
    bg.addColorStop(0,"#fffde0"); bg.addColorStop(0.45,"#FFD700"); bg.addColorStop(1,"#b8860b");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle="rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(-3,-3,2.5,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // ── Harry on broom (large, centred-left) ──
    const hx = 80, hy = 110; // centre point
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.18); // slight forward lean

    // broom handle
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(-70, 10); ctx.lineTo(65, 5); ctx.lineTo(65, 10); ctx.lineTo(-70, 16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,210,130,0.2)";
    ctx.beginPath();
    ctx.moveTo(-65, 10); ctx.lineTo(60, 5.5); ctx.lineTo(60, 7.5); ctx.lineTo(-65, 12);
    ctx.closePath(); ctx.fill();
    // Nimbus label
    ctx.font = "5px Arial"; ctx.fillStyle = "rgba(255,200,80,0.75)"; ctx.textAlign="center";
    ctx.fillText("NIMBUS 2000", 0, 4);

    // bristles
    ctx.fillStyle = "#b45309";
    ctx.beginPath(); ctx.ellipse(-72, 14, 14, 8, -0.15, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = 1;
    for (let b = 0; b < 10; b++) {
      ctx.beginPath();
      ctx.moveTo(-62 - b*2.2, 10 + (b%3)*2);
      ctx.lineTo(-68 - b*2.2, 22 + (b%2)*3);
      ctx.stroke();
    }

    // legs
    ctx.fillStyle = "#1c1c3a";
    ctx.beginPath(); ctx.ellipse(-10, 18, 12, 6, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, 18, 12, 6, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.ellipse(-18, 23, 8, 4, 0.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, 23, 8, 4, -0.5, 0, Math.PI*2); ctx.fill();

    // robe body
    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath(); ctx.roundRect(-16, -18, 30, 30, 5); ctx.fill();
    // cape
    ctx.fillStyle = "#991b1b";
    ctx.beginPath();
    ctx.moveTo(-16,-16); ctx.quadraticCurveTo(-30, 0, -18, 12); ctx.lineTo(-16,12); ctx.closePath();
    ctx.fill();
    // tie
    ctx.fillStyle = "#FFD700"; ctx.fillRect(-4,-12,7,16);
    ctx.fillStyle = "#991b1b";
    [[-12],[-6],[0]].forEach(([ty]) => ctx.fillRect(-4, ty, 7, 2.5));
    // collar
    ctx.fillStyle = "#f8f0e3";
    ctx.beginPath(); ctx.moveTo(-7,-18); ctx.lineTo(7,-18); ctx.lineTo(4,-11); ctx.lineTo(-4,-11); ctx.closePath(); ctx.fill();

    // arms leaning fwd
    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath(); ctx.roundRect(12, -6, 24, 9, 4); ctx.fill();
    ctx.fillStyle = "#f5cba7";
    ctx.beginPath(); ctx.ellipse(37, -2, 7, 5, -0.2, 0, Math.PI*2); ctx.fill();

    // wand
    ctx.strokeStyle = "#5c3317"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(28,-10); ctx.lineTo(50,-18); ctx.stroke();
    ctx.shadowColor = "#d8b4fe"; ctx.shadowBlur = 8;
    ctx.fillStyle = "#d8b4fe";
    ctx.beginPath(); ctx.arc(50,-18,3,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // neck
    ctx.fillStyle = "#f5cba7";
    ctx.beginPath(); ctx.roundRect(-3,-26,8,10,2); ctx.fill();

    // head
    ctx.fillStyle = "#f5cba7";
    ctx.beginPath(); ctx.ellipse(4,-34,13,15,0.08,0,Math.PI*2); ctx.fill();

    // messy hair
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.ellipse(4,-46,13,7,0.1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-4,-42,8,6,-0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13,-41,7,5,0.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(1,-37,5,3.5,-0.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9,-36,4,3,0.3,0,Math.PI*2); ctx.fill();

    // glasses
    ctx.strokeStyle = "#3d1a00"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(-1,-33,5,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(9,-33,5,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4,-33); ctx.lineTo(4.8,-33); ctx.stroke();
    // eyes
    ctx.fillStyle = "#1a6e2a";
    ctx.beginPath(); ctx.arc(-1,-33,2.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(9,-33,2.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(-0.5,-33,1.1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(9.5,-33,1.1,0,Math.PI*2); ctx.fill();

    // scar
    ctx.strokeStyle = "#ff6600"; ctx.lineWidth = 1.5;
    ctx.shadowColor = "#ff6600"; ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(4,-43); ctx.lineTo(1,-39); ctx.lineTo(5,-38); ctx.lineTo(2,-34);
    ctx.stroke(); ctx.shadowBlur = 0;

    // mouth (smile — he sees the snitch!)
    ctx.strokeStyle = "#c0826a"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(4,-28,4,-Math.PI+0.4,-0.4); ctx.stroke();

    // trail behind broom
    [1,2,3,4].forEach(i => {
      ctx.globalAlpha = (1 - i/5) * 0.35;
      ctx.strokeStyle = "#d4a017"; ctx.lineWidth = 2 - i*0.3;
      ctx.beginPath();
      ctx.moveTo(-70 - i*12, 14 + i*1.5);
      ctx.lineTo(-70 - (i-1)*12, 14 + (i-1)*1.5);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  }, []);

  return (
    <canvas
      ref={ref}
      width={280}
      height={200}
      className="block rounded-xl w-[75%] max-w-[280px] h-auto"
      style={{ boxShadow: "0 4px 18px rgba(120,80,0,0.15)" }}
    />
  );
}

// ── DPR-aware canvas setup ─────────────────────────────────────────────────────
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return ctx;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function QuidditchDash() {
  const canvasRef = useRef(null);
  const idleCanvasRef = useRef(null);
  const gsRef = useRef(null);
  const phaseRef = useRef("idle");
  const rafRef = useRef(null);
  const spawnRef = useRef(0);

  const [phase, setPhase] = useState("idle");

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try { return parseInt(localStorage.getItem("qd2_best") || "0", 10); } catch { return 0; }
  });


  const setPhaseSync = p => { phaseRef.current = p; setPhase(p); };

  const initGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    spawnRef.current = Date.now();
    gsRef.current = {
      worldX: 0,
      playerY: CENTRE_Y,
      velY: 0,
      score: 0,
      speed: SPEED_BASE,
      obstacles: [], frame: 0, nextSpawn: 150,
      snitch: makeSnitch(0),
      trail: [], t: 0, caught: false,
    };
  }, []);

  const tap = useCallback(() => {
    const p = phaseRef.current;
    if (p === "idle" || p === "dead") {
      initGame(); setScore(0); setPhaseSync("playing"); return;
    }
    if (p === "playing" && gsRef.current) {
      const s = gsRef.current;
      // Only jump if not already near top — prevents rocketing off screen
      if (s.playerY > FLY_TOP + 30) {
        s.velY = JUMP_V;
      } else {
        // already near top, gentle nudge only
        s.velY = Math.max(s.velY, JUMP_V * 0.35);
      }
    }
  }, [initGame]);

  useEffect(() => {
    const fn = e => { if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); tap(); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [tap]);

  // ── Game loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas);

    const endGame = finalScore => {
      cancelAnimationFrame(rafRef.current);
      setScore(finalScore);
      setBest(prev => { const n = Math.max(prev, finalScore); try { localStorage.setItem("qd2_best", String(n)); } catch {} return n; });
      setPhaseSync("dead");
    };

    const catchSnitch = s => {
      s.score += 100;
      setScore(s.score);
      // respawn snitch ahead immediately
      s.snitch = makeSnitch(s.worldX);
      s.caught = false;
    };

    const TARGET_FPS = 60;
    const TARGET_FRAME_MS = 1000 / TARGET_FPS;
    let lastTs = null;

    const tick = (ts) => {
      if (phaseRef.current !== "playing") return;
      const s = gsRef.current; if (!s) return;

      // ── FPS cap — skip frame if too soon (fixes 120Hz/144Hz screens) ──────
      if (lastTs === null) lastTs = ts;
      const rawDt = ts - lastTs;
      if (rawDt < TARGET_FRAME_MS - 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTs = ts;
      const dt = Math.min(rawDt, TARGET_FRAME_MS * 3) / TARGET_FRAME_MS; // 1.0 = perfect 60fps

      s.frame++; s.t += 0.055 * dt;

      const alive = Date.now() - spawnRef.current > INVINCIBLE_MS;

      // ── Physics — scaled by dt so same speed on all devices ────────────
      s.velY = clamp(s.velY + GRAVITY * dt, -12, FALL_CAP);
      s.playerY = clamp(s.playerY + s.velY * dt, FLY_TOP, FLY_BOT - HARRY_H);
      // soft ceiling bounce
      if (s.playerY <= FLY_TOP + 2) s.velY = Math.abs(s.velY) * 0.4;
      // soft floor bounce — keeps Harry always flying
      if (s.playerY >= FLY_BOT - HARRY_H - 2) s.velY = -Math.abs(s.velY) * 0.5;

      s.worldX += s.speed * dt;

      s.trail.unshift({ x: HARRY_X, y: s.playerY });
      if (s.trail.length > 14) s.trail.pop();

      // ── Snitch ──────────────────────────────────────────────────────────
      let sn = s.snitch;
      sn.wingT += 0.32 * dt;
      sn.blinkT += dt;
      sn.bobT += 0.038 * dt;
      sn.y = clamp(sn.y + Math.sin(sn.bobT) * 0.65 * dt, FLY_TOP + 45, FLY_BOT - 45);

      // catch check
      const ssx = sn.worldX - s.worldX;
      const ssy = sn.y;
      if (sn.active && Math.hypot(ssx - (HARRY_X + HARRY_W * 0.55), ssy - (s.playerY + HARRY_H * 0.4)) < SNITCH_R + 28) {
        s.caught = true; catchSnitch(s);
      }

      // missed — snitch went off the left side — respawn ahead
      if (sn.active && sn.worldX < s.worldX - 60) {
        s.snitch = makeSnitch(s.worldX); sn = s.snitch;
        sn.y = rand(FLY_TOP + 50, FLY_BOT - 50);
        sn.bobT = rand(0, Math.PI * 2);
      }

      // ── Obstacles — spawn by time not frame count ────────────────────────
      s.timeAcc = (s.timeAcc || 0) + rawDt;
      const interval = Math.max(1400, 2500 - Math.floor(s.score / 50) * 80);
      if (s.timeAcc >= interval) {
        s.timeAcc = 0;
        const ox = s.worldX + W + 40;
        if (Math.abs(ox - sn.worldX) > 130) {
          s.obstacles.push(makeObs(s.worldX, s.speed, Math.floor(s.score / 80)));
        }
      }
      s.obstacles = s.obstacles.filter(o => o.x - s.worldX + OBS_W > -10);

      for (const o of s.obstacles) {
        if (!o.passed && o.x < s.worldX + HARRY_X) {
          o.passed = true; s.score += 10; setScore(s.score);
        }
        if (alive) {
          const osx = o.x - s.worldX;
          const pad = 9;
          const px = HARRY_X + pad, py = s.playerY + pad;
          const pw = HARRY_W - pad * 2, ph = HARRY_H - pad * 2;
          if (px < osx + OBS_W - 2 && px + pw > osx + 2 && (py < o.topH || py + ph > o.botY)) {
            endGame(s.score); return;
          }
        }
      }

      // ── Draw ─────────────────────────────────────────────────────────────
      drawBg(ctx, s.worldX, s.t);
      s.obstacles.forEach(o => drawObs(ctx, o, s.worldX));
      drawSnitch(ctx, sn, s.worldX);
      drawHarry(ctx, s.playerY, s.velY, s.trail);
      drawHUD(ctx, s.score, s.worldX, sn);

      // invincibility shimmer
      if (!alive) {
        ctx.globalAlpha = 0.18 * Math.abs(Math.sin(s.t * 9));
        ctx.fillStyle = "#fff";
        ctx.fillRect(HARRY_X - 4, s.playerY - 4, HARRY_W + 8, HARRY_H + 8);
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, initGame]);

  // static idle/dead canvas
  useEffect(() => {
    if (phase === "playing") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = setupCanvas(canvas);
    drawBg(ctx, 0, 0);
    const fakeSn = { worldX: 300, y: 220, bobT: 0, wingT: 1.2, blinkT: 50, active: true };
    drawSnitch(ctx, fakeSn, 0);
    drawHarry(ctx, CENTRE_Y, 0, []);
    drawHUD(ctx, 0, 0, fakeSn);
  }, [phase]);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen select-none bg-[#bde4f5] font-serif px-2"
      onTouchStart={e => { e.preventDefault(); tap(); }}
    >
      {/* Header */}
      <div className="mb-3 text-center">
        <p className="text-[#78350f] text-[10px] tracking-[0.26em] mb-0.5 uppercase">
          Hogwarts Quidditch Cup
        </p>
        <h1 className="text-[27px] font-black m-0 tracking-wide text-[#b8860b]">
          ⚡ QUIDDITCH DASH
        </h1>
      </div>

      {/* Game canvas wrapper — responsive */}
      <div
        className="relative w-full rounded-[14px] overflow-hidden cursor-pointer"
        style={{ maxWidth: W, border: "2.5px solid #b8860b", boxShadow: "0 6px 32px #b8860b44, 0 2px 0 #7b3a00" }}
        onClick={tap}
      >
        <canvas
          ref={canvasRef}
          className="block touch-none"
          style={{ width: "100%", height: "auto", aspectRatio: `${W}/${H}` }}
        />

        {/* Idle overlay */}
        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-[2px]">
            <HarryIllustration />
            <p className="text-[#7b3a00] text-base font-bold italic mt-[18px] mb-5 text-center tracking-wide"
              style={{ textShadow: "0 1px 0 rgba(255,255,255,0.7)" }}>
              Help Harry Potter catch the snitch!
            </p>
            <div className="px-8 py-3 bg-white text-[#3d1a00] font-black text-[15px] tracking-widest cursor-pointer rounded-lg w-[80%] text-center"
              style={{ border: "2px solid #92400e", boxShadow: "0 4px 0 #78350f" }}>
              MOUNT BROOM 🧹
            </div>
          </div>
        )}

        {/* Dead overlay */}
        {phase === "dead" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-[2px]">
            <div className="text-[38px] mb-1">💫</div>
            <div className="text-[#cc2200] text-[22px] font-black tracking-widest">KNOCKED OFF!</div>
            <div className="text-[#3d1a00] text-[52px] font-black leading-tight">{score}</div>
            <div className="text-gray-500 text-xs mb-1">pts</div>
            <div className="text-[#b8860b] text-[13px] font-semibold mb-6">Best: {best} pts</div>
            <div className="px-8 py-3 bg-white text-[#3d1a00] font-black text-sm tracking-widest cursor-pointer rounded-lg w-[80%] text-center"
              style={{ border: "2px solid #92400e", boxShadow: "0 4px 0 #78350f" }}>
              FLY AGAIN 🧹
            </div>
          </div>
        )}

        {/* In-game hint */}
        {phase === "playing" && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[rgba(90,40,0,0.38)] text-[10px] tracking-widest pointer-events-none text-center w-full px-2">
            TAP to fly up · catch the golden snitch ✨
          </div>
        )}
      </div>

      {/* Score bar */}
      <div className="flex gap-7 mt-2.5 text-xs tracking-widest text-[#5a8040]">
        <span>SCORE <strong className="text-[#b8860b]">{score}</strong></span>
        <span>BEST <strong className="text-[#b8860b]">{best}</strong></span>
      </div>
    </div>
  );
}
