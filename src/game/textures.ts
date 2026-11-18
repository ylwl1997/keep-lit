import * as THREE from "three";

export type GameTextures = {
  wood: THREE.CanvasTexture;
  floor: THREE.CanvasTexture;
  plaster: THREE.CanvasTexture;
  curtain: THREE.CanvasTexture;
  copper: THREE.CanvasTexture;
};

function hash(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, seed: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    v += a * valueNoise(x * f, y * f, seed + i * 19);
    a *= 0.5;
    f *= 2.05;
  }
  return v;
}

function canvasTexture(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a texture canvas.");
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function paintWood(ctx: CanvasRenderingContext2D, size: number, dark: boolean): void {
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const grain = fbm(u * 6, v * 28, dark ? 3 : 7);
      const ring = Math.sin((v * 18 + grain * 2.4) * Math.PI * 2) * 0.5 + 0.5;
      const pore = hash(x * 0.4, y * 0.7, 11) > 0.97 ? 0.12 : 0;
      const t = Math.min(1, Math.max(0, grain * 0.55 + ring * 0.35 + pore));
      let r: number;
      let g: number;
      let b: number;
      if (dark) {
        r = mix(42, 90, t);
        g = mix(24, 58, t);
        b = mix(14, 32, t);
      } else {
        r = mix(58, 122, t);
        g = mix(36, 78, t);
        b = mix(20, 42, t);
      }
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Stylized plank seams, not photo grain.
  ctx.strokeStyle = "rgba(20,10,6,0.35)";
  ctx.lineWidth = 2;
  const boards = 6;
  for (let i = 1; i < boards; i++) {
    const x = (i / boards) * size + (hash(i, 2, 4) - 0.5) * 6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 2, size);
    ctx.stroke();
  }
}

function paintPlaster(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const blot = fbm(u * 8, v * 8, 21);
      const fleck = hash(x, y, 5) * 0.1;
      const t = blot * 0.85 + fleck;
      const r = mix(36, 78, t);
      const g = mix(28, 60, t);
      const b = mix(20, 44, t);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = "rgba(20,16,12,0.12)";
  for (let i = 0; i < 18; i++) {
    const x = hash(i, 1, 9) * size;
    const y = hash(i, 2, 8) * size;
    const w = 20 + hash(i, 3, 7) * 80;
    const h = 4 + hash(i, 4, 6) * 14;
    ctx.fillRect(x, y, w, h);
  }
}

function paintCurtain(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fold = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 8 + Math.sin((y / size) * 3) * 0.4);
      const nap = fbm(x / size * 10, y / size * 4, 31);
      const t = fold * 0.75 + nap * 0.25;
      const r = mix(58, 122, t);
      const g = mix(28, 72, t);
      const b = mix(40, 88, t);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function paintCopper(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = fbm(x / size * 7, y / size * 7, 41);
      const r = mix(90, 196, t);
      const g = mix(58, 137, t);
      const b = mix(28, 74, t);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function createGameTextures(): GameTextures {
  return {
    wood: canvasTexture(512, (ctx, s) => paintWood(ctx, s, false)),
    floor: canvasTexture(1024, (ctx, s) => paintWood(ctx, s, true)),
    plaster: canvasTexture(512, paintPlaster),
    curtain: canvasTexture(512, paintCurtain),
    copper: canvasTexture(512, paintCopper),
  };
}

export function makeMaterial(
  color: number,
  textures: GameTextures,
  kind: "wood" | "floor" | "plaster" | "curtain" | "copper" | "metal" | "plain",
  opts?: { roughness?: number; metalness?: number; repeat?: [number, number] },
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.78,
    metalness: opts?.metalness ?? 0.02,
  });
  const map =
    kind === "wood"
      ? textures.wood
      : kind === "floor"
        ? textures.floor
        : kind === "plaster"
          ? textures.plaster
          : kind === "curtain"
            ? textures.curtain
            : kind === "copper"
              ? textures.copper
              : null;
  if (map) {
    const cloned = map.clone();
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    const rx = opts?.repeat?.[0] ?? 1;
    const ry = opts?.repeat?.[1] ?? 1;
    cloned.repeat.set(rx, ry);
    cloned.needsUpdate = true;
    mat.map = cloned;
  }
  if (kind === "metal") {
    mat.roughness = opts?.roughness ?? 0.5;
    mat.metalness = opts?.metalness ?? 0.62;
  }
  if (kind === "copper") {
    mat.roughness = opts?.roughness ?? 0.4;
    mat.metalness = opts?.metalness ?? 0.72;
  }
  if (kind === "plaster") {
    mat.roughness = opts?.roughness ?? 0.88;
    mat.metalness = 0;
  }
  if (kind === "curtain") {
    mat.roughness = opts?.roughness ?? 0.82;
    mat.metalness = 0;
  }
  if (kind === "floor") {
    mat.roughness = opts?.roughness ?? 0.8;
    mat.metalness = 0.02;
  }
  return mat;
}
