import * as THREE from 'three';
import { MapDef } from './types';
import { createConcreteTexture, createTerrainTexture } from './textures';

export const ISLAND_RADIUS = 195;

export interface StaticCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

export interface TrainingTarget {
  mesh: THREE.Group;
  baseX: number;
  baseZ: number;
  patrolRange: number;
  speed: number;
  phase: number;
  hp: number;
  maxHp: number;
  respawnTimer: number;
}

export interface BuiltWorld {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
  waterUniforms: { uTime: { value: number } };
  colliders: StaticCollider[];
  trainingTargets: TrainingTarget[];
  disposables: Array<{ dispose: () => void }>;
}

/**
 * Deterministic multi-octave island heightfield.
 * Smooth coastal descent into ocean past r ~ 170m, elevated tactical ridges and central military plateau.
 */
export function groundHeightAt(x: number, z: number, mapId: string): number {
  const dist = Math.hypot(x, z);
  const seed = mapId === 'sirocco' ? 1.7 : mapId === 'frostbite' ? 3.1 : mapId === 'obsidian' ? 4.4 : 0.4;

  // Flat central compound plateau around (0, 0) for buildings & training range
  const centerFlat = THREE.MathUtils.smoothstep(dist, 16, 48);

  const h1 = Math.sin(x * 0.022 + seed) * Math.cos(z * 0.021 - seed) * 7.5;
  const h2 = Math.sin((x + z) * 0.048 + seed * 2) * 2.6;
  const h3 = Math.cos(x * 0.085 - z * 0.072) * 0.85;

  const ridgeScale = mapId === 'obsidian' ? 0.45 : mapId === 'frostbite' ? 1.25 : 1.0;
  let elevation = 2.6 + (h1 + h2 + h3) * ridgeScale * centerFlat;

  // Gentle island edge falloff into ocean
  if (dist > 145) {
    const t = THREE.MathUtils.clamp((dist - 145) / 60, 0, 1);
    elevation -= t * t * 14;
  }

  return elevation;
}

function buildTacticalCompound(
  x: number,
  z: number,
  rotY: number,
  mapId: string,
  concreteMat: THREE.Material,
  roofMat: THREE.Material,
  accentMat: THREE.Material,
  colliders: StaticCollider[]
): THREE.Group {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z, mapId);
  g.position.set(x, baseY - 0.3, z);
  g.rotation.y = rotY;

  const w = 11;
  const d = 9;
  const h = 4.4;
  const t = 0.45;

  // Concrete foundation slab
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.6, d + 0.8), roofMat);
  slab.position.y = 0.3;
  slab.receiveShadow = true;
  g.add(slab);

  // Back wall (solid)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), concreteMat);
  backWall.position.set(0, 0.6 + h / 2, -d / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  g.add(backWall);

  // Side walls with window slits
  [-w / 2, w / 2].forEach((sx) => {
    const lower = new THREE.Mesh(new THREE.BoxGeometry(t, 1.4, d), concreteMat);
    lower.position.set(sx, 0.6 + 0.7, 0);
    lower.castShadow = true;
    lower.receiveShadow = true;
    g.add(lower);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(t, 1.5, d), concreteMat);
    upper.position.set(sx, 0.6 + 3.65, 0);
    upper.castShadow = true;
    g.add(upper);

    [-d / 2 + 1.1, d / 2 - 1.1].forEach((pz) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(t + 0.1, h, 1.4), concreteMat);
      pillar.position.set(sx, 0.6 + h / 2, pz);
      pillar.castShadow = true;
      g.add(pillar);
    });
  });

  // Front wall split with wide enterable doorway
  [-3.4, 3.4].forEach((fx) => {
    const fw = new THREE.Mesh(new THREE.BoxGeometry(4.2, h, t), concreteMat);
    fw.position.set(fx, 0.6 + h / 2, d / 2);
    fw.castShadow = true;
    fw.receiveShadow = true;
    g.add(fw);
  });

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, t + 0.08), roofMat);
  lintel.position.set(0, 0.6 + h - 0.55, d / 2);
  g.add(lintel);

  // Roof deck + parapet + accent trim
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.35, d + 0.5), roofMat);
  roof.position.set(0, 0.6 + h + 0.17, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.56, 0.16, d + 0.56), accentMat);
  trim.position.set(0, 0.6 + h + 0.42, 0);
  g.add(trim);

  // Simplified collision box for walls (leaving center slightly navigable or solid cover)
  // Using two flank boxes so players can walk through doorway or take cover cleanly
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const addLocalBox = (lx: number, lz: number, bw: number, bd: number) => {
    const wx = x + lx * cos + lz * sin;
    const wz = z - lx * sin + lz * cos;
    const hw = (Math.abs(bw * cos) + Math.abs(bd * sin)) * 0.5;
    const hd = (Math.abs(bw * sin) + Math.abs(bd * cos)) * 0.5;
    colliders.push({
      minX: wx - hw,
      maxX: wx + hw,
      minZ: wz - hd,
      maxZ: wz + hd,
      maxY: baseY + h + 0.8,
    });
  };

  addLocalBox(0, -d / 2, w, 0.8);
  addLocalBox(-w / 2, 0, 0.8, d);
  addLocalBox(w / 2, 0, 0.8, d);
  addLocalBox(-3.4, d / 2, 4.0, 0.8);
  addLocalBox(3.4, d / 2, 4.0, 0.8);

  return g;
}

function buildShippingContainer(
  x: number,
  z: number,
  rotY: number,
  colorHex: number,
  mapId: string,
  colliders: StaticCollider[]
): THREE.Group {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z, mapId);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;

  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.55,
    metalness: 0.45,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x161920,
    roughness: 0.45,
    metalness: 0.75,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.7, 6.4), mat);
  body.position.y = 1.35;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Corrugated steel ribs
  for (let rz = -2.7; rz <= 2.7; rz += 0.9) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(2.68, 2.55, 0.14), frameMat);
    rib.position.set(0, 1.35, rz);
    g.add(rib);
  }

  const cos = Math.abs(Math.cos(rotY));
  const sin = Math.abs(Math.sin(rotY));
  const hw = (2.6 * cos + 6.4 * sin) * 0.5;
  const hd = (2.6 * sin + 6.4 * cos) * 0.5;
  colliders.push({
    minX: x - hw,
    maxX: x + hw,
    minZ: z - hd,
    maxZ: z + hd,
    maxY: baseY + 2.8,
  });

  return g;
}

function buildWatchtower(
  x: number,
  z: number,
  mapId: string,
  frameMat: THREE.Material,
  deckMat: THREE.Material,
  colliders: StaticCollider[]
): THREE.Group {
  const g = new THREE.Group();
  const baseY = groundHeightAt(x, z, mapId);
  g.position.set(x, baseY, z);

  // 4 Steel support legs
  [
    [-1.7, -1.7],
    [1.7, -1.7],
    [-1.7, 1.7],
    [1.7, 1.7],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 8.2, 8), frameMat);
    leg.position.set(lx, 4.1, lz);
    leg.castShadow = true;
    g.add(leg);
  });

  // Observation deck + armored railings + canopy
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 4.4), deckMat);
  deck.position.y = 5.6;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.05, 4.5), frameMat);
  rail.position.y = 6.2;
  g.add(rail);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.28, 4.8), deckMat);
  canopy.position.y = 8.3;
  canopy.castShadow = true;
  g.add(canopy);

  colliders.push({
    minX: x - 2.1,
    maxX: x + 2.1,
    minZ: z - 2.1,
    maxZ: z + 2.1,
    maxY: baseY + 8.5,
  });

  return g;
}

export function buildIslandWorld(
  map: MapDef,
  foliageDensity: 'low' | 'medium' | 'high' | 'ultra',
  isTraining: boolean,
  anisotropy: number
): BuiltWorld {
  const group = new THREE.Group();
  const colliders: StaticCollider[] = [];
  const trainingTargets: TrainingTarget[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. High-resolution terrain heightfield mesh
  const segs = 110;
  const terrainGeo = new THREE.PlaneGeometry(460, 460, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const baseCol = new THREE.Color(map.groundColor);
  const secCol = new THREE.Color(map.groundSecondary);
  const sandCol = new THREE.Color(map.biome === 'arctic' ? '#667686' : '#85775B');
  const tmpCol = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = groundHeightAt(vx, vz, map.id);
    posAttr.setY(i, vy);

    if (vy < 0.7) {
      tmpCol.copy(sandCol);
    } else if (vy > 6.5) {
      tmpCol.copy(baseCol).lerp(secCol, 0.75);
    } else {
      const blend = (Math.sin(vx * 0.05) * Math.cos(vz * 0.05) + 1) * 0.5;
      tmpCol.copy(baseCol).lerp(secCol, blend * 0.55);
    }
    colors[i * 3] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainTex = createTerrainTexture(map.groundColor, map.groundSecondary, anisotropy);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: terrainTex,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.04,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);
  disposables.push(terrainGeo, terrainTex, terrainMat);

  // 2. Animated PBR Ocean Water Plane extending to horizon
  const waterUniforms = { uTime: { value: 0 } };
  const waterGeo = new THREE.PlaneGeometry(1600, 1600, 64, 64);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(map.waterColor),
    roughness: 0.16,
    metalness: 0.35,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: 0.92,
  });
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float wv = sin(transformed.x * 0.08 + uTime * 1.6) * 0.24 + cos(transformed.z * 0.09 + uTime * 1.3) * 0.22;
      transformed.y += wv;
      `
    );
  };
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = -0.35;
  waterMesh.receiveShadow = true;
  group.add(waterMesh);
  disposables.push(waterGeo, waterMat);

  // 3. Tactical Structures & POIs
  const concreteTex = createConcreteTexture(anisotropy);
  const concreteMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: map.biome === 'desert' ? 0xc2ab8e : map.biome === 'arctic' ? 0xb4c2d0 : 0x7b8492,
    roughness: 0.84,
    metalness: 0.12,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x252b34,
    roughness: 0.55,
    metalness: 0.5,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.4,
    metalness: 0.55,
  });
  disposables.push(concreteTex, concreteMat, roofMat, accentMat);

  // Place enterable compounds near POIs
  const compoundSpecs = [
    { x: -16, z: -22, rot: 0.15 },
    { x: 24, z: -18, rot: -0.4 },
    { x: -72, z: -76, rot: 0.5 },
    { x: 82, z: 60, rot: -1.1 },
    { x: -78, z: 68, rot: 0.8 },
    { x: 64, z: -70, rot: -0.6 },
    { x: 4, z: 42, rot: Math.PI },
    { x: -42, z: 8, rot: Math.PI / 2 },
  ];
  compoundSpecs.forEach((c) => {
    group.add(buildTacticalCompound(c.x, c.z, c.rot, map.id, concreteMat, roofMat, accentMat, colliders));
  });

  // Shipping containers for tactical cover
  const containerColors = [0x8b2626, 0x1e3a5f, 0x3b4938, 0x475569, 0x92400e];
  const containerCoords = [
    [-8, 6, 0.2],
    [14, 14, -0.3],
    [-28, -42, 0.9],
    [40, -35, -0.5],
    [52, 24, 0.4],
    [-55, -24, -0.8],
    [22, 68, 0.1],
    [-32, 64, -0.7],
    [90, -18, 1.2],
    [-92, 16, -0.2],
  ];
  containerCoords.forEach(([cx, cz, cr], idx) => {
    group.add(buildShippingContainer(cx, cz, cr, containerColors[idx % containerColors.length], map.id, colliders));
  });

  // Watchtowers on strategic high ground
  [
    [-38, -52],
    [48, -56],
    [56, 48],
    [-58, 44],
  ].forEach(([tx, tz]) => {
    group.add(buildWatchtower(tx, tz, map.id, roofMat, concreteMat, colliders));
  });

  // 4. Instanced Vegetation (Multi-part Composite Trees: Trunk InstancedMesh + Dual Canopy Tiers InstancedMesh)
  const treeCounts = { low: 70, medium: 115, high: 165, ultra: 220 };
  const treeCount = treeCounts[foliageDensity];
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 3.6, 7);
  trunkGeo.translate(0, 1.8, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2e22, roughness: 0.94, metalness: 0.02 });

  const crownGeo1 = new THREE.ConeGeometry(2.3, 4.8, 8);
  crownGeo1.translate(0, 4.9, 0);
  const crownGeo2 = new THREE.ConeGeometry(1.65, 3.8, 8);
  crownGeo2.translate(0, 7.2, 0);
  const crownMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.foliageColor),
    roughness: 0.85,
    metalness: 0.04,
  });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crownInst1 = new THREE.InstancedMesh(crownGeo1, crownMat, treeCount);
  const crownInst2 = new THREE.InstancedMesh(crownGeo2, crownMat, treeCount);
  trunkInst.castShadow = true;
  crownInst1.castShadow = true;
  crownInst1.receiveShadow = true;
  crownInst2.castShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let placedTrees = 0;
  let attempts = 0;
  while (placedTrees < treeCount && attempts < treeCount * 8) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const rad = 26 + Math.random() * 128;
    const tx = Math.cos(angle) * rad;
    const tz = Math.sin(angle) * rad;
    const ty = groundHeightAt(tx, tz, map.id);
    if (ty < 0.9) continue;

    // Keep clear of buildings/training center
    if (isTraining && Math.hypot(tx, tz) < 34) continue;
    let blocked = false;
    for (const col of colliders) {
      if (tx > col.minX - 3 && tx < col.maxX + 3 && tz > col.minZ - 3 && tz < col.maxZ + 3) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const sc = 0.85 + Math.random() * 0.35;
    dummy.position.set(tx, ty - 0.15, tz);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.scale.set(sc, sc * (0.9 + Math.random() * 0.25), sc);
    dummy.updateMatrix();

    trunkInst.setMatrixAt(placedTrees, dummy.matrix);
    crownInst1.setMatrixAt(placedTrees, dummy.matrix);
    crownInst2.setMatrixAt(placedTrees, dummy.matrix);

    tint.set(map.foliageColor);
    tint.offsetHSL((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.09);
    crownInst1.setColorAt(placedTrees, tint);
    crownInst2.setColorAt(placedTrees, tint.clone().offsetHSL(0, 0, 0.05));
    placedTrees++;
  }
  trunkInst.count = placedTrees;
  crownInst1.count = placedTrees;
  crownInst2.count = placedTrees;
  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst1.instanceMatrix.needsUpdate = true;
  crownInst2.instanceMatrix.needsUpdate = true;
  if (crownInst1.instanceColor) crownInst1.instanceColor.needsUpdate = true;
  if (crownInst2.instanceColor) crownInst2.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  crownInst1.computeBoundingSphere();
  crownInst2.computeBoundingSphere();
  group.add(trunkInst, crownInst1, crownInst2);
  disposables.push(trunkGeo, trunkMat, crownGeo1, crownGeo2, crownMat);

  // 5. Instanced Tactical Boulders for natural terrain cover
  const rockCount = 75;
  const rockGeo = new THREE.DodecahedronGeometry(1.8, 1);
  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(map.rockColor),
    roughness: 0.9,
    metalness: 0.08,
    flatShading: true,
  });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  let placedRocks = 0;
  for (let i = 0; i < rockCount * 4 && placedRocks < rockCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 140;
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    const ry = groundHeightAt(rx, rz, map.id);
    if (ry < 0.2) continue;
    if (isTraining && Math.hypot(rx, rz) < 32) continue;

    const sx = 0.8 + Math.random() * 1.4;
    const sy = 0.65 + Math.random() * 1.1;
    const sz = 0.8 + Math.random() * 1.4;
    dummy.position.set(rx, ry + sy * 0.4, rz);
    dummy.rotation.set(Math.random() * 2, Math.random() * 3, Math.random() * 2);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rockInst.setMatrixAt(placedRocks, dummy.matrix);
    tint.set(map.rockColor).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
    rockInst.setColorAt(placedRocks, tint);
    colliders.push({
      minX: rx - sx * 1.4,
      maxX: rx + sx * 1.4,
      minZ: rz - sz * 1.4,
      maxZ: rz + sz * 1.4,
      maxY: ry + sy * 1.8,
    });
    placedRocks++;
  }
  rockInst.count = placedRocks;
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);
  disposables.push(rockGeo, rockMat);

  // 6. Training Ground Shooting Range Targets (moving + stationary ballistic steel silhouettes)
  if (isTraining) {
    const targetMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.6 });
    const bullseyeMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.4,
      roughness: 0.35,
    });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1e242d, roughness: 0.5, metalness: 0.8 });
    disposables.push(targetMat, bullseyeMat, postMat);

    const rangeRows = [
      { z: -14, x: -9, move: 0 },
      { z: -14, x: 0, move: 0 },
      { z: -14, x: 9, move: 0 },
      { z: -26, x: -6, move: 6.5 },
      { z: -26, x: 6, move: 6.5 },
      { z: -42, x: 0, move: 11 },
    ];
    rangeRows.forEach((spec, idx) => {
      const tg = new THREE.Group();
      const ty = groundHeightAt(spec.x, spec.z, map.id);
      tg.position.set(spec.x, ty, spec.z);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.3, 8), postMat);
      post.position.y = 0.65;
      tg.add(post);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.12), targetMat);
      torso.position.y = 1.45;
      torso.castShadow = true;
      tg.add(torso);

      const bull = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 12), bullseyeMat);
      bull.rotation.x = Math.PI / 2;
      bull.position.set(0, 1.5, 0.01);
      tg.add(bull);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), bullseyeMat);
      head.position.set(0, 2.12, 0);
      tg.add(head);

      group.add(tg);
      trainingTargets.push({
        mesh: tg,
        baseX: spec.x,
        baseZ: spec.z,
        patrolRange: spec.move,
        speed: 1.4 + idx * 0.22,
        phase: idx * 1.1,
        hp: 100,
        maxHp: 100,
        respawnTimer: 0,
      });
    });
  }

  return { group, waterMesh, waterUniforms, colliders, trainingTargets, disposables };
}
