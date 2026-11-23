import * as THREE from 'three';

function makeCanvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

export function createCarbonTexture(baseHex = '#1B2028', accentHex = '#2A313D', anisotropy = 4): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = accentHex;
  const step = 8;
  for (let y = 0; y < 128; y += step) {
    for (let x = 0; x < 128; x += step) {
      if (((x + y) / step) % 2 === 0) {
        ctx.fillRect(x, y, step - 1, step / 2);
      } else {
        ctx.fillRect(x, y + step / 2, step - 1, step / 2 - 1);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = anisotropy;
  return tex;
}

export function createTerrainTexture(primaryHex: string, secondaryHex: string, anisotropy = 4): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512);
  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, 512, 512);

  // Layered organic speckles & micro-strata
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1.5 + Math.random() * 8;
    ctx.fillStyle = i % 2 === 0 ? secondaryHex : primaryHex;
    ctx.globalAlpha = 0.14 + Math.random() * 0.18;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fine mineral grain
  for (let i = 0; i < 3500; i++) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)';
    ctx.globalAlpha = 1;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.anisotropy = anisotropy;
  return tex;
}

export function createConcreteTexture(anisotropy = 4): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = '#4A515C';
  ctx.fillRect(0, 0, 256, 256);

  // Panel seams
  ctx.strokeStyle = 'rgba(15, 18, 24, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 252, 124);
  ctx.strokeRect(2, 130, 252, 124);

  // Weathering streaks & grain
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2);
  }
  // Rivet dots
  ctx.fillStyle = 'rgba(20,24,30,0.5)';
  [14, 242].forEach((rx) => {
    [14, 114, 142, 242].forEach((ry) => {
      ctx.beginPath();
      ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.anisotropy = anisotropy;
  return tex;
}

export function createBrushedMetalTexture(baseHex = '#2A303B', anisotropy = 4): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const shade = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    ctx.fillStyle = shade;
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.34)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLobbyPlatformTexture(anisotropy = 4): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512);
  ctx.fillStyle = '#101412';
  ctx.fillRect(0, 0, 512, 512);

  // Concentric tactical rings
  ctx.strokeStyle = 'rgba(197, 164, 92, 0.28)';
  ctx.lineWidth = 3;
  [230, 190, 130].forEach((r) => {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Metallic gold cardinal ticks
  ctx.strokeStyle = 'rgba(197, 164, 92, 0.85)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * 198, 256 + Math.sin(a) * 198);
    ctx.lineTo(256 + Math.cos(a) * 224, 256 + Math.sin(a) * 224);
    ctx.stroke();
  }

  // Subtle military olive grid lines
  ctx.strokeStyle = 'rgba(52, 63, 43, 0.35)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y < 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}
