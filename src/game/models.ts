import * as THREE from 'three';
import { AttachmentSlot, CharacterCustomization, OperatorDef, WeaponDef, WeaponSkinDef } from './types';
import { createBrushedMetalTexture, createCarbonTexture, createContactShadowTexture } from './textures';

let sharedCarbonTex: THREE.CanvasTexture | null = null;
let sharedMetalTex: THREE.CanvasTexture | null = null;
let sharedShadowTex: THREE.CanvasTexture | null = null;

function ensureSharedTextures(anisotropy = 4) {
  if (!sharedCarbonTex) sharedCarbonTex = createCarbonTexture('#1A1F28', '#29313F', anisotropy);
  if (!sharedMetalTex) sharedMetalTex = createBrushedMetalTexture('#2A303B', anisotropy);
  if (!sharedShadowTex) sharedShadowTex = createContactShadowTexture();
}

export interface WeaponModelOptions {
  weapon: WeaponDef;
  skin: WeaponSkinDef;
  attachments?: Partial<Record<AttachmentSlot, string>>;
  charmColor?: string;
  charmAccentColor?: string;
  anisotropy?: number;
}

/**
 * Composite procedural 3D weapon model used in both the 3D Armory Inspector and in-hand combat.
 * Oriented pointing along +Z (barrel forward), grip down (-Y).
 */
export function buildWeaponModel({
  weapon,
  skin,
  attachments = {},
  charmColor,
  charmAccentColor,
  anisotropy = 4,
}: WeaponModelOptions): THREE.Group {
  ensureSharedTextures(anisotropy);
  const group = new THREE.Group();
  group.name = `weapon_${weapon.id}`;

  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(skin.id === 'skin_factory' ? weapon.bodyColor : skin.primaryColor),
    map: sharedMetalTex,
    metalness: skin.metalness,
    roughness: skin.roughness,
    clearcoat: skin.rarity === 'legendary' ? 0.65 : 0.25,
    clearcoatRoughness: 0.25,
  });

  const secondaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.secondaryColor),
    map: sharedCarbonTex,
    metalness: 0.42,
    roughness: 0.62,
  });

  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e24,
    metalness: 0.88,
    roughness: 0.26,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.id === 'skin_factory' ? weapon.accentColor : skin.emissiveColor),
    emissive: new THREE.Color(skin.emissiveColor),
    emissiveIntensity: 0.65,
    metalness: 0.5,
    roughness: 0.3,
  });

  const isSniper = weapon.category === 'SNIPER' || weapon.category === 'DMR';
  const isSmg = weapon.category === 'SMG';
  const isShotgun = weapon.category === 'SHOTGUN';
  const isLmg = weapon.category === 'LMG';
  const isPistol = weapon.category === 'PISTOL';
  const isMelee = weapon.category === 'MELEE';
  const isGrenade = weapon.category === 'GRENADE';

  if (isGrenade) {
    const isCanister = weapon.id === 'smoke_m18' || weapon.id === 'flash_m84' || weapon.id === 'thermite_vx';
    const body = new THREE.Mesh(
      isCanister
        ? new THREE.CylinderGeometry(0.068, 0.068, 0.21, 16)
        : new THREE.SphereGeometry(0.088, 16, 14),
      primaryMat
    );
    body.scale.set(1, isCanister ? 1 : 1.16, 1);
    body.castShadow = true;
    group.add(body);

    // Tactical identification band
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(isCanister ? 0.072 : 0.09, isCanister ? 0.072 : 0.09, 0.028, 16),
      accentMat
    );
    band.position.y = isCanister ? 0.04 : 0.015;
    group.add(band);

    // Metallic fuse collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.055, 12), barrelMat);
    collar.position.y = isCanister ? 0.125 : 0.115;
    group.add(collar);

    // Safety lever spoon
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.14, 0.016), secondaryMat);
    spoon.position.set(0.058, isCanister ? 0.07 : 0.06, 0);
    spoon.rotation.z = -0.22;
    group.add(spoon);

    // Pull-pin ring
    const pinRing = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 8, 18), accentMat);
    pinRing.position.set(-0.045, isCanister ? 0.13 : 0.12, 0);
    pinRing.rotation.y = Math.PI * 0.25;
    group.add(pinRing);

    return group;
  }

  if (isMelee) {
    if (weapon.id === 'tomahawk_v') {
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.034, 0.38), secondaryMat);
      shaft.position.set(0, -0.02, 0.02);
      group.add(shaft);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.11, 0.14), primaryMat);
      head.position.set(0, 0.045, 0.15);
      group.add(head);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.12, 0.022), accentMat);
      edge.position.set(0, 0.045, 0.22);
      group.add(edge);

      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.075, 6), barrelMat);
      spike.rotation.x = -Math.PI / 2;
      spike.position.set(0, 0.055, 0.05);
      group.add(spike);
      return group;
    }

    // Composite tactical combat knife (grip, pommel, crossguard, beveled spine blade)
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.14, 10), secondaryMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, -0.08);
    group.add(handle);

    const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.018, 0.03, 10), accentMat);
    pommel.rotation.x = Math.PI / 2;
    pommel.position.set(0, 0, -0.16);
    group.add(pommel);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.085, 0.018), primaryMat);
    guard.position.set(0, 0.005, 0);
    group.add(guard);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.042, 0.25), barrelMat);
    blade.position.set(0, 0.008, 0.135);
    group.add(blade);

    const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.012, 0.23), accentMat);
    edgeStrip.position.set(0, 0.025, 0.13);
    group.add(edgeStrip);

    return group;
  }

  const bodyLen = isSniper ? 0.52 : isLmg ? 0.5 : isPistol ? 0.2 : isSmg ? 0.32 : isShotgun ? 0.44 : 0.42;
  const barrelLen = isSniper ? 0.56 : isLmg ? 0.44 : isPistol ? 0.09 : isSmg ? 0.2 : isShotgun ? 0.42 : 0.34;

  // 1. Main upper receiver
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(isLmg ? 0.086 : isPistol ? 0.042 : 0.068, isLmg ? 0.115 : isPistol ? 0.06 : 0.095, bodyLen),
    primaryMat
  );
  receiver.position.set(0, 0.02, 0);
  receiver.castShadow = true;
  group.add(receiver);

  // 2. Top Picatinny rail
  const rail = new THREE.Mesh(new THREE.BoxGeometry(isPistol ? 0.026 : 0.036, 0.016, bodyLen * 0.92), barrelMat);
  rail.position.set(0, isPistol ? 0.055 : 0.075, 0.02);
  group.add(rail);

  // 3. Handguard / Shroud
  if (!isPistol) {
    const handguard = new THREE.Mesh(
      new THREE.BoxGeometry(isLmg ? 0.074 : 0.056, isLmg ? 0.088 : 0.074, barrelLen * 0.72),
      secondaryMat
    );
    handguard.position.set(0, 0.022, bodyLen * 0.5 + barrelLen * 0.32);
    handguard.castShadow = true;
    group.add(handguard);
  }

  // 4. Precision fluted barrel
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(isLmg ? 0.018 : 0.014, isLmg ? 0.02 : 0.016, barrelLen, 12),
    barrelMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.032, bodyLen * 0.5 + barrelLen * 0.52);
  barrel.castShadow = true;
  group.add(barrel);

  // Under-barrel tube for shotgun
  if (isShotgun) {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, barrelLen * 0.85, 10),
      secondaryMat
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.002, bodyLen * 0.5 + barrelLen * 0.42);
    group.add(tube);
  }

  // 5. Accent trim strips on receiver flanks
  const stripGeo = new THREE.BoxGeometry(isLmg ? 0.091 : isPistol ? 0.046 : 0.073, 0.014, bodyLen * 0.62);
  const strip = new THREE.Mesh(stripGeo, accentMat);
  strip.position.set(0, 0.034, 0.03);
  group.add(strip);

  // 6. Ergonomic pistol grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(isPistol ? 0.038 : 0.046, 0.13, 0.056), secondaryMat);
  grip.position.set(0, -0.072, isPistol ? -bodyLen * 0.2 : -bodyLen * 0.28);
  grip.rotation.x = -0.26;
  grip.castShadow = true;
  group.add(grip);

  // 7. Magazine (tagged 'weaponMag' for live reload preview animation)
  const hasExtMag = attachments.magazine === 'mag_ext' || attachments.magazine === 'mag_quickext';
  if (isLmg) {
    const drum = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.13), secondaryMat);
    drum.position.set(0, -0.08, bodyLen * 0.15);
    drum.name = 'weaponMag';
    drum.userData.baseY = drum.position.y;
    drum.castShadow = true;
    group.add(drum);
  } else if (isPistol) {
    const pMag = new THREE.Mesh(new THREE.BoxGeometry(0.03, hasExtMag ? 0.15 : 0.11, 0.044), barrelMat);
    pMag.position.set(0, hasExtMag ? -0.1 : -0.08, -bodyLen * 0.22);
    pMag.rotation.x = -0.26;
    pMag.name = 'weaponMag';
    pMag.userData.baseY = pMag.position.y;
    group.add(pMag);
  } else {
    const magH = isShotgun ? 0.08 : isSniper ? 0.1 : hasExtMag ? 0.24 : 0.17;
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, magH, isSmg ? 0.048 : 0.068),
      secondaryMat
    );
    mag.position.set(0, -0.055 - magH * 0.35, bodyLen * 0.18);
    mag.rotation.x = weapon.id === 'vx47' ? 0.22 : 0.08;
    mag.name = 'weaponMag';
    mag.userData.baseY = mag.position.y;
    mag.castShadow = true;
    group.add(mag);
  }

  // 8. Buttstock (tactical adjustable if attached)
  const hasStock = !isPistol && (Boolean(attachments.stock) || !isSmg);
  if (hasStock) {
    const stockLen = isSniper ? 0.28 : 0.23;
    const stockTube = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.045, stockLen), primaryMat);
    stockTube.position.set(0, 0.024, -bodyLen * 0.5 - stockLen * 0.46);
    group.add(stockTube);

    const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.12, 0.04), secondaryMat);
    buttPad.position.set(0, -0.008, -bodyLen * 0.5 - stockLen * 0.92);
    group.add(buttPad);
  }

  // 9. Muzzle Attachment (Suppressor / Compensator / Flash Hider)
  const muzzleZ = bodyLen * 0.5 + barrelLen + 0.04;
  if (attachments.muzzle === 'muzzle_supp') {
    const supp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 14), barrelMat);
    supp.rotation.x = Math.PI / 2;
    supp.position.set(0, 0.032, muzzleZ + 0.07);
    group.add(supp);
  } else if (attachments.muzzle === 'muzzle_comp') {
    const comp = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.036, 0.085), primaryMat);
    comp.position.set(0, 0.032, muzzleZ + 0.01);
    group.add(comp);
  } else {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.016, 0.055, 10), barrelMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.032, muzzleZ);
    group.add(tip);
  }

  // 10. Scope / Optic Attachment
  const scopeId = attachments.scope;
  if (scopeId === 'scope_8x' || scopeId === 'scope_4x') {
    const sLen = scopeId === 'scope_8x' ? 0.28 : 0.19;
    const sRad = scopeId === 'scope_8x' ? 0.03 : 0.025;
    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(sRad, sRad * 0.85, sLen, 14), barrelMat);
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.position.set(0, 0.122, 0.02);
    group.add(scopeBody);

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.7,
      metalness: 0.9,
      roughness: 0.1,
    });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(sRad * 0.82, sRad * 0.82, 0.012, 12), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.122, 0.02 + sLen * 0.5);
    group.add(lens);

    // Mount rings
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.038, 0.08), secondaryMat);
    mount.position.set(0, 0.095, 0.02);
    group.add(mount);
  } else if (scopeId === 'scope_2x' || scopeId === 'scope_reddot') {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.042, 0.085), barrelMat);
    housing.position.set(0, 0.108, 0.02);
    group.add(housing);
    const dotLens = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.024, 0.006), accentMat);
    dotLens.position.set(0, 0.108, 0.055);
    group.add(dotLens);
  } else {
    // Iron sight post
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.018), barrelMat);
    frontSight.position.set(0, 0.095, bodyLen * 0.45);
    group.add(frontSight);
  }

  // 11. Foregrip / Laser Attachment
  if (attachments.grip === 'grip_vertical') {
    const fg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 10), secondaryMat);
    fg.position.set(0, -0.055, bodyLen * 0.5 + barrelLen * 0.25);
    group.add(fg);
  } else if (attachments.grip === 'grip_laser') {
    const laser = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.026, 0.075), barrelMat);
    laser.position.set(0.038, 0.022, bodyLen * 0.5 + barrelLen * 0.35);
    group.add(laser);
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), accentMat);
    emitter.position.set(0.038, 0.022, bodyLen * 0.5 + barrelLen * 0.35 + 0.04);
    group.add(emitter);
  }

  // 12. Optional Hanging 3D Weapon Charm on receiver flank
  if (charmColor) {
    const charmGroup = new THREE.Group();
    charmGroup.name = 'weaponCharm';
    charmGroup.position.set(isLmg ? 0.052 : isPistol ? 0.028 : 0.042, 0.015, -bodyLen * 0.12);

    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.0025, 6, 12), barrelMat);
    loop.position.y = -0.01;
    charmGroup.add(loop);

    const charmMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(charmColor),
      emissive: new THREE.Color(charmAccentColor || charmColor),
      emissiveIntensity: 0.32,
      metalness: 0.85,
      roughness: 0.2,
    });
    const tag = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), charmMat);
    tag.scale.set(0.65, 1.3, 0.45);
    tag.position.y = -0.042;
    charmGroup.add(tag);

    group.add(charmGroup);
  }

  // Muzzle anchor node for flash & tracers
  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.name = 'muzzlePoint';
  muzzlePoint.position.set(0, 0.032, muzzleZ + (attachments.muzzle === 'muzzle_supp' ? 0.18 : 0.06));
  group.add(muzzlePoint);

  return group;
}

export interface OperatorRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponMount: THREE.Group;
  parachuteGroup: THREE.Group;
  shieldAura: THREE.Mesh;
}

/**
 * Composite 12+ part articulated tactical Operator 3D model, bottom-center grounded at y = 0.
 */
export function buildOperatorModel(
  op: OperatorDef,
  weaponModel?: THREE.Group,
  options?: {
    outfitColor?: string;
    visorColor?: string;
    customization?: Partial<CharacterCustomization>;
    anisotropy?: number;
    showShadowPlane?: boolean;
  }
): OperatorRig {
  ensureSharedTextures(options?.anisotropy ?? 4);
  const cust = options?.customization || {};
  const isFemale = op.gender === 'Female';
  const isHeavy = op.className === 'Heavy' || op.className === 'Defense';

  const resolvedOutfit = cust.outfitColor || options?.outfitColor || op.armorColor;
  const resolvedSuit = cust.outfitColor ? new THREE.Color(cust.outfitColor).multiplyScalar(0.55) : new THREE.Color(op.suitColor);
  const resolvedVisor = cust.visorColor || options?.visorColor || op.visorColor;
  const resolvedSkin = cust.faceTone || op.skinTone;
  const resolvedHair = cust.hairColor || op.hairColor;
  const resolvedBootGlove = cust.glovesBootsColor || '#12151A';
  const helmetStyle = cust.helmetStyle ?? op.defaultHelmet ?? 'ballistic';
  const maskStyle = cust.maskStyle ?? op.defaultMask ?? 'half_mask';
  const backpackStyle = cust.backpackStyle ?? op.defaultBackpack ?? 'tactical';
  const hairStyle = cust.hairStyle ?? op.defaultHairStyle ?? 'tactical_crop';

  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const suitMat = new THREE.MeshStandardMaterial({
    color: resolvedSuit,
    map: sharedCarbonTex,
    roughness: 0.72,
    metalness: 0.18,
  });

  const armorMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(resolvedOutfit),
    map: sharedMetalTex,
    roughness: 0.34,
    metalness: 0.68,
    clearcoat: 0.25,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(op.accentColor),
    emissive: new THREE.Color(op.accentColor),
    emissiveIntensity: 0.38,
    roughness: 0.35,
    metalness: 0.5,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(resolvedVisor),
    emissive: new THREE.Color(resolvedVisor),
    emissiveIntensity: 0.9,
    metalness: 0.9,
    roughness: 0.1,
    clearcoat: 1.0,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(resolvedSkin),
    roughness: 0.68,
    metalness: 0.04,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(resolvedHair),
    roughness: 0.85,
    metalness: 0.06,
  });

  const bootMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(resolvedBootGlove),
    roughness: 0.72,
    metalness: 0.26,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x161a1d,
    roughness: 0.35,
    metalness: 0.82,
  });

  // Contact shadow disc grounded at y = 0.015
  if (options?.showShadowPlane !== false) {
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.35),
      new THREE.MeshBasicMaterial({
        map: sharedShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    root.add(shadowPlane);
  }

  const widthScale = isHeavy ? 1.09 : isFemale ? 0.9 : 1.0;

  // Pelvis / Tactical Belt
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38 * widthScale, 0.18, 0.24), suitMat);
  pelvis.position.y = 0.94;
  pelvis.castShadow = true;
  bodyPivot.add(pelvis);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.41 * widthScale, 0.075, 0.27), armorMat);
  belt.position.y = 0.99;
  bodyPivot.add(belt);

  // Legs (hinged at hip y = 0.88)
  const makeLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * (isFemale ? 0.115 : 0.128), 0.88, 0);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.086 * widthScale, 0.072 * widthScale, 0.42, 10),
      suitMat
    );
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    legGroup.add(thigh);

    // Armored knee pad
    const knee = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.08), armorMat);
    knee.position.set(0, -0.42, 0.055);
    legGroup.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.36, 10), suitMat);
    shin.position.y = -0.58;
    shin.castShadow = true;
    legGroup.add(shin);

    // Tactical combat boot grounded cleanly at local y = -0.88 (world y = 0)
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.14, 0.25), bootMat);
    boot.position.set(0, -0.81, 0.045);
    boot.castShadow = true;
    legGroup.add(boot);

    return legGroup;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  bodyPivot.add(leftLeg, rightLeg);

  // Torso group (hinged at waist y = 1.03)
  const torso = new THREE.Group();
  torso.position.y = 1.03;
  bodyPivot.add(torso);

  const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.42 * widthScale, 0.48, 0.25), suitMat);
  chestCore.position.y = 0.24;
  chestCore.castShadow = true;
  torso.add(chestCore);

  // Sculpted front ballistic chest plate + pouches
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.36 * widthScale, 0.34, 0.31), armorMat);
  chestPlate.position.set(0, 0.27, 0.01);
  chestPlate.castShadow = true;
  torso.add(chestPlate);

  const chestAccent = new THREE.Mesh(new THREE.BoxGeometry(0.24 * widthScale, 0.045, 0.325), accentMat);
  chestAccent.position.set(0, 0.34, 0.015);
  torso.add(chestAccent);

  // Tactical mag pouches on vest
  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.06), bootMat);
    pouch.position.set(i * 0.095 * widthScale, 0.14, 0.17);
    torso.add(pouch);
  }

  // Customizable Tactical Backpack
  if (backpackStyle === 'tactical') {
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.16), armorMat);
    backpack.position.set(0, 0.25, -0.2);
    backpack.castShadow = true;
    torso.add(backpack);
    const packStrip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.17), accentMat);
    packStrip.position.set(0, 0.36, -0.2);
    torso.add(packStrip);
  } else if (backpackStyle === 'heavy_pack') {
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.22), armorMat);
    backpack.position.set(0, 0.27, -0.23);
    backpack.castShadow = true;
    torso.add(backpack);
    const packRadio = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.28, 6), darkMetalMat);
    packRadio.position.set(0.14, 0.58, -0.22);
    torso.add(packRadio);
    const packStrip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.23), accentMat);
    packStrip.position.set(0, 0.4, -0.23);
    torso.add(packStrip);
  } else if (backpackStyle === 'recon_sling') {
    const sling = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.11), bootMat);
    sling.position.set(0.03, 0.24, -0.18);
    sling.rotation.z = -0.18;
    sling.castShadow = true;
    torso.add(sling);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.12), accentMat);
    buckle.position.set(0.03, 0.31, -0.18);
    buckle.rotation.z = -0.18;
    torso.add(buckle);
  }

  // Shoulder pauldrons
  [-1, 1].forEach((side) => {
    const pauldron = new THREE.Mesh(
      new THREE.BoxGeometry(isHeavy ? 0.19 : 0.15, isHeavy ? 0.17 : 0.14, 0.22),
      armorMat
    );
    pauldron.position.set(side * (0.27 * widthScale), 0.41, 0);
    pauldron.rotation.z = side * -0.22;
    pauldron.castShadow = true;
    torso.add(pauldron);
  });

  // Head + Hair + Customizable Helmet + Customizable Mask
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0);
  torso.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.072, 0.1, 10), maskStyle === 'balaclava' ? bootMat : skinMat);
  neck.position.y = -0.02;
  head.add(neck);

  const cranium = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.24, 0.22),
    maskStyle === 'balaclava' ? bootMat : skinMat
  );
  cranium.position.y = 0.12;
  cranium.castShadow = true;
  head.add(cranium);

  // Subtle tactical eyes when unmasked & no full visor
  if (helmetStyle !== 'heavy_visor') {
    [-0.048, 0.048].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.016, 0.012), darkMetalMat);
      eye.position.set(ex, 0.15, 0.11);
      head.add(eye);
    });
  }

  // Hair geometry (shown when helmetStyle is 'none' or 'recon_cap', plus ponytail visible from back)
  if (helmetStyle === 'none') {
    if (hairStyle === 'tactical_crop' || hairStyle === 'undercut') {
      const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.085, 0.235), hairMat);
      hairCap.position.set(0, 0.235, -0.005);
      head.add(hairCap);
      if (hairStyle === 'undercut') {
        const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.24), hairMat);
        sweep.position.set(0.02, 0.265, 0.015);
        sweep.rotation.z = -0.14;
        head.add(sweep);
      }
    } else if (hairStyle === 'mohawk') {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.24), hairMat);
      ridge.position.set(0, 0.27, -0.01);
      head.add(ridge);
    } else if (hairStyle === 'buzz') {
      const buzz = new THREE.Mesh(new THREE.BoxGeometry(0.218, 0.05, 0.226), hairMat);
      buzz.position.set(0, 0.228, -0.004);
      head.add(buzz);
    } else if (hairStyle === 'ponytail') {
      const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.226, 0.09, 0.235), hairMat);
      hairCap.position.set(0, 0.235, -0.008);
      head.add(hairCap);
    }
  }
  if (hairStyle === 'ponytail' && (helmetStyle === 'none' || helmetStyle === 'recon_cap')) {
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.022, 0.24, 8), hairMat);
    tail.position.set(0, 0.11, -0.16);
    tail.rotation.x = 0.35;
    head.add(tail);
  }

  // Customizable Mask
  if (maskStyle === 'half_mask') {
    const jawMask = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.105, 0.235), bootMat);
    jawMask.position.set(0, 0.065, 0.01);
    head.add(jawMask);
  } else if (maskStyle === 'respirator') {
    const maskCore = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.115, 0.24), darkMetalMat);
    maskCore.position.set(0, 0.065, 0.012);
    head.add(maskCore);
    [-0.075, 0.075].forEach((fx) => {
      const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 10), armorMat);
      filter.rotation.x = Math.PI / 2;
      filter.position.set(fx, 0.06, 0.135);
      head.add(filter);
    });
  } else if (maskStyle === 'balaclava') {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.222, 0.035, 0.232), accentMat);
    trim.position.set(0, 0.04, 0.008);
    head.add(trim);
  }

  // Customizable Helmet & Visor
  if (helmetStyle === 'ballistic' || helmetStyle === 'nvg_tactical') {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      armorMat
    );
    helmet.position.set(0, 0.15, -0.005);
    helmet.castShadow = true;
    head.add(helmet);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.062, 0.07), visorMat);
    visor.position.set(0, 0.155, 0.105);
    head.add(visor);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.18, 6), darkMetalMat);
    antenna.position.set(-0.15, 0.24, -0.04);
    head.add(antenna);

    if (helmetStyle === 'nvg_tactical') {
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.06), darkMetalMat);
      mount.position.set(0, 0.245, 0.13);
      head.add(mount);
      [-0.042, 0.042].forEach((nx) => {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.08, 10), darkMetalMat);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(nx, 0.215, 0.165);
        head.add(tube);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 10), visorMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(nx, 0.215, 0.205);
        head.add(lens);
      });
    }
  } else if (helmetStyle === 'recon_cap') {
    const capCrown = new THREE.Mesh(new THREE.BoxGeometry(0.228, 0.08, 0.235), armorMat);
    capCrown.position.set(0, 0.225, -0.005);
    head.add(capCrown);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.016, 0.12), bootMat);
    brim.position.set(0, 0.195, 0.145);
    brim.rotation.x = 0.08;
    head.add(brim);
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.045, 0.045), visorMat);
    shades.position.set(0, 0.155, 0.108);
    head.add(shades);
  } else if (helmetStyle === 'heavy_visor') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.168, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.68),
      armorMat
    );
    dome.position.set(0, 0.15, -0.005);
    dome.castShadow = true;
    head.add(dome);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.095, 0.11), armorMat);
    brow.position.set(0, 0.165, 0.095);
    head.add(brow);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.038, 0.03), visorMat);
    slit.position.set(0, 0.155, 0.145);
    head.add(slit);
  } else {
    // No helmet: tactical comms headset earpiece
    const earpiece = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.07, 0.07), darkMetalMat);
    earpiece.position.set(-0.118, 0.135, 0);
    head.add(earpiece);
  }

  // Arms (hinged at shoulders)
  const makeArm = (side: -1 | 1) => {
    const arm = new THREE.Group();
    arm.position.set(side * (0.28 * widthScale), 0.41, 0);

    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.066 * widthScale, 0.056 * widthScale, 0.3, 10),
      suitMat
    );
    upper.position.y = -0.15;
    upper.castShadow = true;
    arm.add(upper);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.28, 10), armorMat);
    forearm.position.set(0, -0.38, 0.07);
    forearm.rotation.x = -0.55;
    forearm.castShadow = true;
    arm.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.085), bootMat);
    glove.position.set(0, -0.49, 0.16);
    arm.add(glove);

    return arm;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torso.add(leftArm, rightArm);

  // Weapon mount attached to right arm
  const weaponMount = new THREE.Group();
  weaponMount.position.set(-0.04, -0.46, 0.26);
  rightArm.add(weaponMount);
  if (weaponModel) {
    weaponMount.add(weaponModel);
  }

  // Parachute assembly (shown only during deployment drop)
  const parachuteGroup = new THREE.Group();
  parachuteGroup.visible = false;
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.55,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.2, 12, 1, false, 0, Math.PI), canopyMat);
  canopy.rotation.z = Math.PI / 2;
  canopy.rotation.y = Math.PI / 2;
  canopy.position.set(0, 4.4, -0.1);
  canopy.scale.set(1.3, 0.55, 0.85);
  parachuteGroup.add(canopy);

  const lineMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.75 });
  [
    [-1.4, 4.1, 0],
    [1.4, 4.1, 0],
    [-0.7, 4.3, -0.4],
    [0.7, 4.3, -0.4],
  ].forEach(([lx, ly, lz]) => {
    const pts = [new THREE.Vector3(0, 1.45, -0.15), new THREE.Vector3(lx, ly, lz)];
    parachuteGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  });
  root.add(parachuteGroup);

  // Reactive shield energy aura (for Aegis / ability feedback)
  const shieldAura = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 1.9, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  shieldAura.position.y = 0.98;
  shieldAura.visible = false;
  root.add(shieldAura);

  // Default tactical combat stance
  rightArm.rotation.x = -0.78;
  rightArm.rotation.y = -0.15;
  leftArm.rotation.x = -0.82;
  leftArm.rotation.y = 0.42;

  return {
    root,
    bodyPivot,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMount,
    parachuteGroup,
    shieldAura,
  };
}

export interface VehicleRig {
  root: THREE.Group;
  wheels: THREE.Mesh[];
}

/**
 * Composite 10-part off-road tactical military buggy, bottom-center grounded at y = 0.
 */
export function buildVehicleModel(accentColor = '#DC2626', anisotropy = 4): VehicleRig {
  ensureSharedTextures(anisotropy);
  const root = new THREE.Group();

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x222831,
    map: sharedMetalTex,
    metalness: 0.72,
    roughness: 0.34,
    clearcoat: 0.3,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentColor),
    metalness: 0.55,
    roughness: 0.35,
  });
  const cageMat = new THREE.MeshStandardMaterial({
    color: 0x14171d,
    metalness: 0.85,
    roughness: 0.35,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.92,
    metalness: 0.08,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.88,
    roughness: 0.25,
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e7,
    emissive: 0xffe4b5,
    emissiveIntensity: 1.4,
  });

  // 1. Armored Lower Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.58, 4.1), hullMat);
  chassis.position.y = 0.78;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  root.add(chassis);

  // 2. Sloped armored hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.36, 1.45), hullMat);
  hood.position.set(0, 1.15, 1.18);
  hood.rotation.x = 0.14;
  hood.castShadow = true;
  root.add(hood);

  // 3. Accent stripe & bumper
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.26, 0.35), cageMat);
  bumper.position.set(0, 0.65, 2.12);
  root.add(bumper);

  const hoodStripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 1.4), trimMat);
  hoodStripe.position.set(0, 1.35, 1.18);
  hoodStripe.rotation.x = 0.14;
  root.add(hoodStripe);

  // 4. Roll cage pillars + roof rack
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 1.8), cageMat);
  roof.position.set(0, 2.02, -0.25);
  roof.castShadow = true;
  root.add(roof);

  [
    [-0.84, 1.54, 0.56],
    [0.84, 1.54, 0.56],
    [-0.84, 1.54, -1.08],
    [0.84, 1.54, -1.08],
  ].forEach(([px, py, pz]) => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.96, 8), cageMat);
    pillar.position.set(px, py, pz);
    root.add(pillar);
  });

  // 5. Windshield frame (translucent tactical glass)
  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(1.62, 0.68),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.32,
      roughness: 0.1,
      metalness: 0.8,
      side: THREE.DoubleSide,
    })
  );
  windshield.position.set(0, 1.62, 0.58);
  windshield.rotation.x = -0.35;
  root.add(windshield);

  // 6. Headlights & Taillights
  [-0.68, 0.68].forEach((hx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), lightMat);
    hl.position.set(hx, 0.96, 2.04);
    root.add(hl);

    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.14, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.1 })
    );
    tl.position.set(hx, 0.96, -2.05);
    root.add(tl);
  });

  // 7. 4 Chunky Off-Road Wheels with metallic alloy rims
  const wheels: THREE.Mesh[] = [];
  const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.38, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.4, 10);
  rimGeo.rotateZ(Math.PI / 2);

  [
    [-1.12, 0.52, 1.38],
    [1.12, 0.52, 1.38],
    [-1.12, 0.52, -1.38],
    [1.12, 0.52, -1.38],
  ].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheel.add(rim);
    root.add(wheel);
    wheels.push(wheel);
  });

  // 8. Rear spare wheel mounted on back
  const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14), tireMat);
  spare.rotation.x = Math.PI / 2;
  spare.position.set(0, 1.26, -2.14);
  root.add(spare);

  return { root, wheels };
}

/**
 * Multi-part Supply Air-Drop Crate with glowing red smoke beacon.
 */
export function buildAirDropModel(): THREE.Group {
  const group = new THREE.Group();
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.45,
    metalness: 0.55,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.8,
  });
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), crateMat);
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);

  const strap1 = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.2, 1.56), frameMat);
  strap1.position.y = 0.35;
  group.add(strap1);

  const strap2 = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.2, 1.56), frameMat);
  strap2.position.y = 1.15;
  group.add(strap2);

  // Vertical crimson smoke / flare column visible across the island
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.55, 38, 10, 1, true), beaconMat);
  flare.position.y = 20;
  group.add(flare);

  return group;
}
