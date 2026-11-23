import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  computeEffectiveWeaponStats,
  getAttachmentById,
  getMapById,
  getOperatorById,
  getSkinById,
  getWeaponById,
  OPERATORS,
  WEAPONS,
} from './data';
import { audioEngine } from './audio';
import {
  buildAirDropModel,
  buildOperatorModel,
  buildVehicleModel,
  buildWeaponModel,
  OperatorRig,
  VehicleRig,
} from './models';
import { createLobbyPlatformTexture } from './textures';
import { computePostMatchMmrDelta, evaluateSbmm } from './sbmm';
import {
  AttachmentSlot,
  ControlSettings,
  FireMode,
  GameModeId,
  GraphicsSettings,
  InventoryItem,
  KillFeedEntry,
  MapId,
  MatchHudSnapshot,
  MatchResultSummary,
  MinimapEntity,
  NearbyLootPrompt,
  PerspectiveMode,
  PlayerLoadoutSlot,
  PlayerProfile,
  SquadSize,
  TeammateState,
} from './types';
import { buildIslandWorld, BuiltWorld, groundHeightAt, ISLAND_RADIUS, StaticCollider } from './worldGen';

// Reusable scratch math objects for zero-GC game loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

interface BotAgent {
  id: string;
  name: string;
  isTeammate: boolean;
  rig: OperatorRig;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  armor: number;
  alive: boolean;
  weaponId: string;
  fireCooldown: number;
  targetX: number;
  targetZ: number;
  retargetTimer: number;
  strafeDir: number;
  skill: number; // 0.35 - 0.9
  hitFlashTimer: number;
  animTime: number;
}

interface LootDrop {
  id: string;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  label: string;
  sublabel: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: NearbyLootPrompt['type'];
  weaponId?: string;
  attachmentId?: string;
  armorLevel?: number;
  helmetLevel?: number;
  collected: boolean;
  isAirDrop?: boolean;
  dropVelocityY?: number;
}

interface DrivableVehicle {
  id: string;
  rig: VehicleRig;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  hp: number;
  maxHp: number;
  fuel: number;
}

interface BulletTracer {
  line: THREE.Line;
  life: number;
  maxLife: number;
}

interface ParticleSpark {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scaleRate: number;
}

interface ThrownGrenade {
  mesh: THREE.Mesh;
  type: 'frag' | 'smoke';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fuse: number;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: MatchHudSnapshot) => void;
  onMatchEnd: (result: MatchResultSummary) => void;
}

const BOT_NAMES = [
  'KRONOS_7', 'VALKYRIE', 'REAPER_X', 'SPECTRE', 'HYDRA_99', 'TITAN_V',
  'PHANTOM', 'ZERO_K', 'APEX_WOLF', 'NOMAD_42', 'BLAZE_AR', 'COBALT_8',
  'FENRIR', 'SHADE_01', 'VORTEX', 'STRYKER', 'ONYX_SNIP', 'ECHO_SIX',
  'MANTIS', 'TEMPEST', 'RAVEN_X', 'GOLIATH', 'HAVOC_9', 'DAGGER',
  'CIPHER', 'RONIN_77', 'SENTRY', 'BANSHEE', 'JACKAL', 'WYVERN',
];

export class VexoraEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;
  private callbacks: EngineCallbacks;

  private mode: 'lobby' | 'armory' | 'match' = 'lobby';
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private fpsSmooth = 60;
  private hudEmitAccum = 0;

  // Lighting & Atmosphere
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;
  private muzzleLight!: THREE.PointLight;
  private muzzleLightTimer = 0;
  private weatherPoints: THREE.Points | null = null;

  // Lobby showcase state
  private lobbyGroup: THREE.Group | null = null;
  private lobbyOperatorRig: OperatorRig | null = null;
  private lobbyWeaponPreview: THREE.Group | null = null;
  private lobbyTurntableAngle = 0.25;
  private lobbyTargetAngle = 0.25;
  private isLobbyDragging = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private lobbyWeaponPitch = 0.08;

  // Match state
  private world: BuiltWorld | null = null;
  private matchGroup: THREE.Group | null = null;
  private currentMapId: MapId = 'aethelgard';
  private currentGameMode: GameModeId = 'classic';
  private currentSquadSize: SquadSize = 'squad';
  private graphics: GraphicsSettings;
  private controls: ControlSettings;
  private profile: PlayerProfile;

  // Player state
  private playerRig: OperatorRig | null = null;
  private playerX = 0;
  private playerY = 4;
  private playerZ = 0;
  private playerVelY = 0;
  private playerYaw = 0;
  private playerPitch = -0.08;
  private hp = 100;
  private maxHp = 100;
  private armor = 50;
  private maxArmor = 100;
  private armorLevel = 1;
  private helmetLevel = 1;
  private boost = 20;
  private stamina = 100;
  private stance: MatchHudSnapshot['stance'] = 'stand';
  private perspective: PerspectiveMode = 'TPP';
  private isAds = false;
  private isFiring = false;
  private autoRun = false;
  private fireMode: FireMode = 'AUTO';
  private activeSbmmTier = 'Veteran';
  private activeBotSkillMean = 0.58;
  private activeBotSkillSpread = 0.16;
  private fireTimer = 0;
  private recoilKickPitch = 0;
  private recoilKickYaw = 0;
  private cameraShake = 0;
  private hitstopTimer = 0;
  private footstepTimer = 0;
  private playerAnimTime = 0;

  // Loadout & Inventory
  private activeSlot: 0 | 1 | 2 = 0;
  private slots: [PlayerLoadoutSlot, PlayerLoadoutSlot | null] = [
    { weaponId: 'm4vex', ammoInMag: 30, skinId: 'skin_factory', attachments: {} },
    { weaponId: 'awmx', ammoInMag: 5, skinId: 'skin_factory', attachments: {} },
  ];
  private reserveAmmo: Record<string, number> = {
    '5.56mm': 150,
    '7.62mm': 120,
    '9mm': 140,
    '.300 Mag': 25,
    '12 Gauge': 32,
  };
  private isReloading = false;
  private reloadElapsed = 0;
  private reloadDuration = 2.0;

  private isHealing = false;
  private healElapsed = 0;
  private healDuration = 3.2;
  private healType: 'medkit' | 'bandage' | 'energy' = 'medkit';

  private medkits = 2;
  private bandages = 4;
  private energyDrinks = 2;
  private frags = 2;
  private smokes = 2;
  private inventory: InventoryItem[] = [];

  // Ability state
  private abilityCooldown = 0;
  private abilityActiveTimer = 0;

  // Match stats & Zone
  private matchTime = 0;
  private kills = 0;
  private assists = 0;
  private damageDealt = 0;
  private headshots = 0;
  private totalCombatants = 28;
  private zonePhase = 1;
  private zoneTimer = 40;
  private zoneShrinking = false;
  private safeZone = { x: 0, z: 0, radius: 130 };
  private blueZone = { x: 0, z: 0, radius: 185 };
  private blueZoneMesh: THREE.Mesh | null = null;
  private blueTickTimer = 0;
  private airDropTimer = 28;
  private mapPing: { x: number; z: number } | null = null;

  // Entities
  private bots: BotAgent[] = [];
  private lootDrops: LootDrop[] = [];
  private vehicles: DrivableVehicle[] = [];
  private activeVehicle: DrivableVehicle | null = null;
  private tracers: BulletTracer[] = [];
  private particles: ParticleSpark[] = [];
  private grenades: ThrownGrenade[] = [];
  private killFeed: KillFeedEntry[] = [];
  private hitMarker = { active: false, headshot: false, kill: false, time: 0 };
  private damageIndicatorAngle: number | null = null;
  private damageIndicatorAlpha = 0;
  private bannerAlert: MatchHudSnapshot['bannerAlert'] = null;
  private bannerTimer = 0;
  private alertSeq = 1;
  private matchEnded = false;
  private paused = false;
  private pointerLocked = false;

  // Input state (continuous held vs edge-triggered)
  private keys = new Set<string>();
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchSprint = false;
  private onResizeBound: () => void;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onBlurBound: () => void;
  private onPointerDownBound: (e: PointerEvent) => void;
  private onPointerMoveBound: (e: PointerEvent) => void;
  private onPointerUpBound: () => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseDownBound: (e: MouseEvent) => void;
  private onMouseUpBound: (e: MouseEvent) => void;
  private onPointerLockChangeBound: () => void;
  private onContextMenuBound: (e: MouseEvent) => void;

  constructor(
    container: HTMLElement,
    profile: PlayerProfile,
    graphics: GraphicsSettings,
    controls: ControlSettings,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.profile = profile;
    this.graphics = graphics;
    this.controls = controls;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && graphics.antiAliasing,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = graphics.hdr ? 1.12 : 0.96;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && graphics.dynamicShadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.applyResolution();
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    this.scene = new THREE.Scene();
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(58, w / h, 0.15, 700);

    // Mandatory studio PBR environment map on every device
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.setupLights();
    this.enterLobby();

    // Bind events
    this.onResizeBound = this.handleResize.bind(this);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
    this.onBlurBound = this.handleBlur.bind(this);
    this.onPointerDownBound = this.handlePointerDown.bind(this);
    this.onPointerMoveBound = this.handlePointerMove.bind(this);
    this.onPointerUpBound = this.handlePointerUp.bind(this);
    this.onMouseMoveBound = this.handleMouseMove.bind(this);
    this.onMouseDownBound = this.handleMouseDown.bind(this);
    this.onMouseUpBound = this.handleMouseUp.bind(this);
    this.onPointerLockChangeBound = this.handlePointerLockChange.bind(this);
    this.onContextMenuBound = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onBlurBound);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDownBound);
    window.addEventListener('pointermove', this.onPointerMoveBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('mousemove', this.onMouseMoveBound);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenuBound);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTime = performance.now();
    this.tick();
  }

  private setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0x88b4e6, 0x262932, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffe7c8, 1.9);
    this.sunLight.position.set(55, 78, 42);
    this.sunLight.castShadow = !this.isSoftwareGl && this.graphics.dynamicShadows;
    const smSize = this.graphics.shadowQuality === 'ultra' ? 2048 : this.graphics.shadowQuality === 'high' ? 1024 : 512;
    this.sunLight.shadow.mapSize.set(smSize, smSize);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 260;
    const d = 80;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.75);
    this.rimLight.position.set(-28, 22, -32);
    this.scene.add(this.rimLight);

    this.muzzleLight = new THREE.PointLight(0xffb454, 0, 12, 2);
    this.scene.add(this.muzzleLight);
  }

  private applyResolution() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2) * this.graphics.resolutionScale;
    this.renderer.setPixelRatio(Math.max(0.6, Math.min(2, dpr)));
    this.renderer.setSize(w, h, false);
  }

  private applyAtmosphere(mapId: MapId) {
    const map = getMapById(mapId);
    const tod = this.graphics.timeOfDay;
    const weather = this.graphics.weather;

    let skyColor = new THREE.Color(map.skyHorizon);
    let sunCol = new THREE.Color(map.sunColor);
    let sunInt = 1.85;
    let hemiInt = 0.78;
    let sunPos = new THREE.Vector3(60, 82, 40);

    if (tod === 'sunset') {
      skyColor.set('#5C3E4A').lerp(new THREE.Color(map.fogColor), 0.35);
      sunCol.set('#FF9C59');
      sunInt = 1.95;
      hemiInt = 0.62;
      sunPos.set(-85, 28, -55);
    } else if (tod === 'night') {
      skyColor.set('#0B1320');
      sunCol.set('#7AA5D9');
      sunInt = 0.75;
      hemiInt = 0.42;
      sunPos.set(45, 72, -45);
    }

    if (weather === 'storm') {
      skyColor.multiplyScalar(0.58);
      sunInt *= 0.65;
    } else if (weather === 'rain') {
      skyColor.multiplyScalar(0.75);
      sunInt *= 0.8;
    }

    this.scene.background = skyColor;
    const fogDensity =
      weather === 'fog' ? 0.0115 : weather === 'storm' ? 0.0085 : weather === 'rain' ? 0.006 : 0.0038;
    this.scene.fog = new THREE.FogExp2(skyColor.getHex(), this.mode === 'match' ? fogDensity : 0.032);

    this.sunLight.color.copy(sunCol);
    this.sunLight.intensity = sunInt;
    this.sunLight.position.copy(sunPos);
    this.hemiLight.intensity = hemiInt;

    // Weather particles (rain/storm streaks or floating embers)
    if (this.weatherPoints) {
      this.scene.remove(this.weatherPoints);
      this.weatherPoints.geometry.dispose();
      (this.weatherPoints.material as THREE.Material).dispose();
      this.weatherPoints = null;
    }

    if (weather === 'rain' || weather === 'storm' || this.mode !== 'match') {
      const count = weather === 'storm' ? 950 : weather === 'rain' ? 550 : 180;
      const positions = new Float32Array(count * 3);
      const spread = this.mode === 'match' ? 75 : 14;
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spread;
        positions[i * 3 + 1] = Math.random() * (this.mode === 'match' ? 32 : 8);
        positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const isRain = weather === 'rain' || weather === 'storm';
      const mat = new THREE.PointsMaterial({
        color: isRain ? 0xa5c8e8 : 0xdc2626,
        size: isRain ? 0.14 : 0.055,
        transparent: true,
        opacity: isRain ? 0.55 : 0.65,
      });
      this.weatherPoints = new THREE.Points(geo, mat);
      this.scene.add(this.weatherPoints);
    }
  }

  public updateProfile(next: PlayerProfile) {
    this.profile = next;
    if (this.mode === 'lobby') {
      this.rebuildLobbySubject();
    } else if (this.mode === 'armory') {
      this.rebuildArmoryWeapon();
    }
  }

  public updateGraphics(next: GraphicsSettings) {
    this.graphics = next;
    this.renderer.toneMappingExposure = next.hdr ? 1.12 : 0.96;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && next.dynamicShadows;
    this.sunLight.castShadow = !this.isSoftwareGl && next.dynamicShadows;
    this.applyResolution();
    this.applyAtmosphere(this.currentMapId);
  }

  public updateControls(next: ControlSettings) {
    this.controls = next;
  }

  public setLobbyPreviewMode(mode: 'lobby' | 'armory') {
    if (this.mode === 'match') return;
    this.mode = mode;
    if (mode === 'armory') {
      this.rebuildArmoryWeapon();
    } else {
      this.rebuildLobbySubject();
    }
  }

  public enterLobby() {
    this.exitPointerLock();
    this.clearMatchScene();
    this.mode = 'lobby';
    audioEngine.stopAmbient();

    if (!this.lobbyGroup) {
      this.lobbyGroup = new THREE.Group();
      this.scene.add(this.lobbyGroup);

      // Tactical hangar circular turntable platform
      const platTex = createLobbyPlatformTexture(this.maxAnisotropy);
      const platGeo = new THREE.CylinderGeometry(2.35, 2.7, 0.24, 36);
      const platMat = new THREE.MeshPhysicalMaterial({
        map: platTex,
        metalness: 0.72,
        roughness: 0.3,
        clearcoat: 0.4,
      });
      const platform = new THREE.Mesh(platGeo, platMat);
      platform.position.y = -0.12;
      platform.receiveShadow = true;
      this.lobbyGroup.add(platform);

      // Glowing VARKON metallic gold perimeter ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.38, 0.038, 10, 48),
        new THREE.MeshStandardMaterial({
          color: 0xc5a45c,
          emissive: 0xc5a45c,
          emissiveIntensity: 1.25,
          metalness: 0.85,
          roughness: 0.2,
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.01;
      this.lobbyGroup.add(ring);

      // Military olive-matte hangar floor deck
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50),
        new THREE.MeshStandardMaterial({
          color: 0x101412,
          metalness: 0.45,
          roughness: 0.52,
        })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.25;
      floor.receiveShadow = true;
      this.lobbyGroup.add(floor);

      // Architectural military base struts & gold light strips in background
      const strutMat = new THREE.MeshStandardMaterial({ color: 0x252d20, metalness: 0.65, roughness: 0.4 });
      const lightStripMat = new THREE.MeshStandardMaterial({
        color: 0xc5a45c,
        emissive: 0xc5a45c,
        emissiveIntensity: 1.1,
      });
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.65, 8, 1.1), strutMat);
        col.position.set(i * 3.1, 3.7, -7.8 - Math.abs(i) * 0.5);
        col.rotation.y = i * -0.12;
        this.lobbyGroup.add(col);

        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.5, 0.08), lightStripMat);
        strip.position.set(i * 3.1, 3.5, -7.2 - Math.abs(i) * 0.5);
        this.lobbyGroup.add(strip);
      }

      // Parked olive military tactical vehicle in background right
      const bgVehicle = buildVehicleModel('#C5A45C', this.maxAnisotropy);
      bgVehicle.root.position.set(5.4, -0.25, -4.4);
      bgVehicle.root.rotation.y = -0.78;
      bgVehicle.root.scale.setScalar(0.85);
      this.lobbyGroup.add(bgVehicle.root);
    }

    this.lobbyGroup.visible = true;
    this.rebuildLobbySubject();
    this.applyAtmosphere(this.currentMapId);
    this.camera.fov = 44;
    this.camera.position.set(0.2, 1.55, 4.75);
    this.camera.lookAt(0, 1.05, 0);
    this.camera.updateProjectionMatrix();
  }

  private rebuildLobbySubject() {
    if (!this.lobbyGroup) return;
    if (this.lobbyOperatorRig) {
      this.lobbyGroup.remove(this.lobbyOperatorRig.root);
      this.lobbyOperatorRig = null;
    }
    if (this.lobbyWeaponPreview) {
      this.lobbyGroup.remove(this.lobbyWeaponPreview);
      this.lobbyWeaponPreview = null;
    }

    const op = getOperatorById(this.profile.selectedOperatorId);
    const weapon = getWeaponById(this.profile.selectedWeaponId);
    const skin = getSkinById(this.profile.selectedWeaponSkins[weapon.id]);
    const atts = this.profile.selectedAttachments[weapon.id] || {};
    const weaponMesh = buildWeaponModel({ weapon, skin, attachments: atts, anisotropy: this.maxAnisotropy });

    const rig = buildOperatorModel(op, weaponMesh, {
      outfitColor: this.profile.operatorOutfitTint[op.id],
      visorColor: this.profile.operatorVisorTint[op.id],
      anisotropy: this.maxAnisotropy,
    });
    rig.root.position.set(0, 0, 0);
    rig.root.rotation.y = this.lobbyTurntableAngle;
    this.lobbyGroup.add(rig.root);
    this.lobbyOperatorRig = rig;
  }

  private rebuildArmoryWeapon() {
    if (!this.lobbyGroup) return;
    if (this.lobbyOperatorRig) {
      this.lobbyGroup.remove(this.lobbyOperatorRig.root);
      this.lobbyOperatorRig = null;
    }
    if (this.lobbyWeaponPreview) {
      this.lobbyGroup.remove(this.lobbyWeaponPreview);
      this.lobbyWeaponPreview = null;
    }

    const weapon = getWeaponById(this.profile.selectedWeaponId);
    const skin = getSkinById(this.profile.selectedWeaponSkins[weapon.id]);
    const atts = this.profile.selectedAttachments[weapon.id] || {};
    const model = buildWeaponModel({ weapon, skin, attachments: atts, anisotropy: this.maxAnisotropy });
    model.scale.setScalar(2.65);
    model.position.set(0, 1.25, 0);
    model.rotation.y = Math.PI * 0.42;
    this.lobbyGroup.add(model);
    this.lobbyWeaponPreview = model;
  }

  public startMatch(
    mode: GameModeId,
    squadSize: SquadSize,
    mapId: MapId,
    perspective: PerspectiveMode,
    customBotSkill?: number
  ) {
    this.clearMatchScene();
    if (this.lobbyGroup) this.lobbyGroup.visible = false;

    const sbmm = evaluateSbmm(this.profile, mode);
    this.activeSbmmTier = `${sbmm.tierName} (${sbmm.bracketMin}-${sbmm.bracketMax})`;
    this.activeBotSkillMean = customBotSkill !== undefined ? customBotSkill : sbmm.botSkillMean;
    this.activeBotSkillSpread = customBotSkill !== undefined ? 0.08 : sbmm.botSkillSpread;

    this.mode = 'match';
    this.currentGameMode = mode;
    this.currentSquadSize = squadSize;
    this.currentMapId = mapId;
    this.perspective = perspective;
    this.matchEnded = false;
    this.paused = false;
    this.autoRun = false;
    this.kills = 0;
    this.assists = 0;
    this.damageDealt = 0;
    this.headshots = 0;
    this.matchTime = 0;
    this.killFeed = [];
    this.mapPing = null;
    this.activeVehicle = null;
    this.isReloading = false;
    this.isHealing = false;
    this.isAds = false;
    this.isFiring = false;
    this.abilityCooldown = 0;
    this.abilityActiveTimer = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.armor = mode === 'training' ? 100 : 50;
    this.armorLevel = mode === 'training' ? 3 : 1;
    this.helmetLevel = mode === 'training' ? 3 : 1;
    this.boost = 25;
    this.stamina = 100;
    this.medkits = 2;
    this.bandages = 4;
    this.energyDrinks = 2;
    this.frags = 3;
    this.smokes = 2;

    this.matchGroup = new THREE.Group();
    this.scene.add(this.matchGroup);

    const map = getMapById(mapId);
    const isTraining = mode === 'training';
    const isCloseArena = mode === 'arena4v4' || mode === 'tdm';
    this.world = buildIslandWorld(map, this.graphics.foliageQuality, isTraining, this.maxAnisotropy);
    this.matchGroup.add(this.world.group);

    // Setup weapons loadout with weapon upgrade levels
    const primaryId = mode === 'sniper' ? 'awmx' : this.profile.selectedWeaponId;
    const secondaryId = mode === 'sniper' ? 'kar98v' : this.profile.selectedSecondaryId;
    const pDef = getWeaponById(primaryId);
    const sDef = getWeaponById(secondaryId);
    const pAtts = { ...(this.profile.selectedAttachments[primaryId] || {}) };
    const sAtts = { ...(this.profile.selectedAttachments[secondaryId] || {}) };
    if (mode === 'sniper' && !pAtts.scope) pAtts.scope = 'scope_8x';

    const pEff = computeEffectiveWeaponStats(pDef, pAtts, this.profile.weaponLevels[primaryId] || 1);
    const sEff = computeEffectiveWeaponStats(sDef, sAtts, this.profile.weaponLevels[secondaryId] || 1);
    this.fireMode = pDef.fireModes[0] || 'AUTO';

    this.slots = [
      {
        weaponId: primaryId,
        ammoInMag: pEff.magSize,
        skinId: this.profile.selectedWeaponSkins[primaryId] || 'skin_factory',
        attachments: pAtts,
      },
      {
        weaponId: secondaryId,
        ammoInMag: sEff.magSize,
        skinId: this.profile.selectedWeaponSkins[secondaryId] || 'skin_factory',
        attachments: sAtts,
      },
    ];
    this.activeSlot = 0;
    this.reserveAmmo = {
      '5.56mm': 180,
      '7.62mm': 140,
      '9mm': 180,
      '.300 Mag': 30,
      '12 Gauge': 36,
    };
    this.rebuildInventoryList();

    // Player spawn: Parachute drop in BR, instant ground spawn in Training/Arena/TDM
    if (isTraining) {
      this.playerX = 0;
      this.playerZ = 6;
      this.playerY = groundHeightAt(0, 6, mapId);
      this.stance = 'stand';
    } else if (isCloseArena) {
      this.playerX = 0;
      this.playerZ = 34;
      this.playerY = groundHeightAt(0, 34, mapId);
      this.stance = 'stand';
    } else {
      const dropAngle = Math.random() * Math.PI * 2;
      const dropR = 32 + Math.random() * 52;
      this.playerX = Math.cos(dropAngle) * dropR;
      this.playerZ = Math.sin(dropAngle) * dropR;
      this.playerY = groundHeightAt(this.playerX, this.playerZ, mapId) + 46;
      this.stance = 'parachute';
    }
    this.playerYaw = 0;
    this.playerPitch = -0.05;
    this.playerVelY = 0;

    this.rebuildPlayerMesh();

    // Safe Zone & Blue Zone Energy Wall
    const zcx = (Math.random() - 0.5) * 36;
    const zcz = (Math.random() - 0.5) * 36;
    this.safeZone = { x: zcx, z: zcz, radius: isTraining ? 185 : isCloseArena ? 80 : 125 };
    this.blueZone = { x: 0, z: 0, radius: isTraining ? 210 : isCloseArena ? 95 : 190 };
    this.zonePhase = 1;
    this.zoneTimer = isCloseArena ? 35 : 38;
    this.zoneShrinking = false;

    const wallGeo = new THREE.CylinderGeometry(1, 1, 95, 48, 1, true);
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.blueZoneMesh = new THREE.Mesh(wallGeo, wallMat);
    this.blueZoneMesh.position.set(this.blueZone.x, 38, this.blueZone.z);
    this.blueZoneMesh.scale.set(this.blueZone.radius, 1, this.blueZone.radius);
    this.matchGroup.add(this.blueZoneMesh);

    this.spawnCombatants();
    this.spawnVehicles();
    this.spawnInitialLoot();

    this.applyAtmosphere(mapId);
    audioEngine.startAmbient(this.graphics.weather === 'storm' || this.graphics.weather === 'rain');

    this.pushBanner(
      isTraining
        ? 'TRAINING GROUND ACTIVE'
        : mode === 'tdm'
        ? 'TEAM DEATHMATCH DEPLOYED'
        : mode === 'arena4v4'
        ? '4v4 ARENA DEPLOYMENT'
        : 'VARKON AIRDROP DEPLOYMENT',
      `SBMM Tier: ${sbmm.tierName} · ${sbmm.strictnessLabel}`,
      'gold'
    );

    this.emitHud();
  }

  private rebuildPlayerMesh() {
    if (!this.matchGroup) return;
    if (this.playerRig) {
      this.matchGroup.remove(this.playerRig.root);
    }
    const op = getOperatorById(this.profile.selectedOperatorId);
    const activeWeaponSlot = this.activeSlot === 2 ? null : this.slots[this.activeSlot];
    let wMesh: THREE.Group | undefined;
    if (activeWeaponSlot) {
      const wDef = getWeaponById(activeWeaponSlot.weaponId);
      const skin = getSkinById(activeWeaponSlot.skinId);
      wMesh = buildWeaponModel({ weapon: wDef, skin, attachments: activeWeaponSlot.attachments, anisotropy: this.maxAnisotropy });
    }
    this.playerRig = buildOperatorModel(op, wMesh, {
      outfitColor: this.profile.operatorOutfitTint[op.id],
      visorColor: this.profile.operatorVisorTint[op.id],
      anisotropy: this.maxAnisotropy,
    });
    this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
    this.matchGroup.add(this.playerRig.root);
  }

  private spawnCombatants() {
    if (!this.matchGroup) return;
    this.bots = [];

    const isTraining = this.currentGameMode === 'training';
    const isArena = this.currentGameMode === 'arena4v4' || this.currentGameMode === 'tdm';
    const teammateCount = isTraining ? 0 : isArena ? 3 : this.currentSquadSize === 'squad' ? 3 : this.currentSquadSize === 'duo' ? 1 : 0;
    const enemyCount = isTraining ? 4 : this.currentGameMode === 'tdm' ? 6 : isArena ? 4 : 24;
    this.totalCombatants = 1 + teammateCount + enemyCount;

    const spawnAgent = (idx: number, isTeammate: boolean) => {
      const op = OPERATORS[idx % OPERATORS.length];
      const wDef =
        this.currentGameMode === 'sniper'
          ? getWeaponById('kar98v')
          : WEAPONS[idx % Math.min(8, WEAPONS.length)];
      const wMesh = buildWeaponModel({
        weapon: wDef,
        skin: getSkinById('skin_factory'),
        anisotropy: this.maxAnisotropy,
      });
      const rig = buildOperatorModel(op, wMesh, {
        outfitColor: isTeammate ? '#153A5B' : idx % 3 === 0 ? '#4B1D1D' : op.armorColor,
        visorColor: isTeammate ? '#38BDF8' : '#EF4444',
        anisotropy: this.maxAnisotropy,
      });

      let bx: number;
      let bz: number;
      if (isTeammate) {
        bx = this.playerX + (idx - 1) * 7 + (Math.random() - 0.5) * 4;
        bz = this.playerZ + 4 + (Math.random() - 0.5) * 6;
      } else if (isArena) {
        bx = (idx - 1.5) * 10;
        bz = -34 + (Math.random() - 0.5) * 8;
      } else if (isTraining) {
        bx = 24 + idx * 8;
        bz = -20 - idx * 6;
      } else {
        const a = (idx / enemyCount) * Math.PI * 2 + Math.random() * 0.4;
        const r = 34 + Math.random() * 112;
        bx = Math.cos(a) * r;
        bz = Math.sin(a) * r;
      }
      const by = groundHeightAt(bx, bz, this.currentMapId);
      rig.root.position.set(bx, by, bz);
      this.matchGroup!.add(rig.root);

      this.bots.push({
        id: `${isTeammate ? 'ally' : 'bot'}_${idx}`,
        name: isTeammate ? ['KIRA_SNIPES', 'REX_TACTICAL', 'NOVA_ZERO'][idx % 3] : BOT_NAMES[idx % BOT_NAMES.length],
        isTeammate,
        rig,
        x: bx,
        y: by,
        z: bz,
        yaw: Math.random() * Math.PI * 2,
        hp: 100,
        maxHp: 100,
        armor: isArena ? 75 : 40,
        alive: true,
        weaponId: wDef.id,
        fireCooldown: 1 + Math.random() * 2,
        targetX: bx,
        targetZ: bz,
        retargetTimer: 0.5 + Math.random() * 2,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        skill: Math.max(
          0.25,
          Math.min(0.95, this.activeBotSkillMean + (Math.random() - 0.5) * 2 * this.activeBotSkillSpread)
        ),
        hitFlashTimer: 0,
        animTime: Math.random() * 10,
      });
    };

    for (let i = 0; i < teammateCount; i++) spawnAgent(i, true);
    for (let i = 0; i < enemyCount; i++) spawnAgent(i + teammateCount, false);
  }

  private spawnVehicles() {
    if (!this.matchGroup) return;
    this.vehicles = [];
    const coords = [
      [18, 12, 0.4, '#DC2626'],
      [-48, 22, 1.2, '#38BDF8'],
      [58, -32, -0.8, '#F59E0B'],
      [-28, -68, 0.2, '#DC2626'],
      [74, 42, 2.1, '#94A3B8'],
    ] as const;

    coords.forEach(([vx, vz, vyaw, accent], i) => {
      const rig = buildVehicleModel(accent, this.maxAnisotropy);
      const y = groundHeightAt(vx, vz, this.currentMapId);
      rig.root.position.set(vx, y, vz);
      rig.root.rotation.y = vyaw;
      this.matchGroup!.add(rig.root);
      this.vehicles.push({
        id: `veh_${i}`,
        rig,
        x: vx,
        y,
        z: vz,
        yaw: vyaw,
        speed: 0,
        hp: 350,
        maxHp: 350,
        fuel: 100,
      });
    });
  }

  private spawnInitialLoot() {
    if (!this.matchGroup) return;
    this.lootDrops = [];

    const lootTemplates: Array<Omit<LootDrop, 'id' | 'mesh' | 'x' | 'y' | 'z' | 'collected'>> = [
      { label: 'VX-47 Vanguard', sublabel: '7.62mm AR', rarity: 'rare', type: 'weapon', weaponId: 'vx47' },
      { label: 'SCAR-X Recon', sublabel: '5.56mm AR', rarity: 'rare', type: 'weapon', weaponId: 'scarx' },
      { label: 'VECTOR-9 Pulse', sublabel: '9mm SMG', rarity: 'rare', type: 'weapon', weaponId: 'vector9' },
      { label: 'KAR-98V Sentinel', sublabel: 'Bolt Sniper', rarity: 'epic', type: 'weapon', weaponId: 'kar98v' },
      { label: 'VEX-12 Breacher', sublabel: '12G Shotgun', rarity: 'common', type: 'weapon', weaponId: 'pump12' },
      { label: 'Level 3 Tactical Vest', sublabel: '+100 Armor', rarity: 'epic', type: 'armor', armorLevel: 3 },
      { label: 'Level 3 Ballistic Helmet', sublabel: 'Headshot Reduction', rarity: 'epic', type: 'helmet', helmetLevel: 3 },
      { label: 'Field Medkit + Energy', sublabel: '+2 Medkits · +2 Boost', rarity: 'rare', type: 'heal' },
      { label: '4x ACOG Optic', sublabel: 'Long Range Scope', rarity: 'epic', type: 'attachment', attachmentId: 'scope_4x' },
      { label: 'Obsidian Suppressor', sublabel: 'Stealth Muzzle', rarity: 'epic', type: 'attachment', attachmentId: 'muzzle_supp' },
      { label: 'Extended Quickdraw Mag', sublabel: '+12 Mag · Fast Reload', rarity: 'legendary', type: 'attachment', attachmentId: 'mag_quickext' },
      { label: 'Tactical Grenade Pack', sublabel: '+2 Frag · +2 Smoke', rarity: 'common', type: 'grenade' },
    ];

    for (let i = 0; i < 34; i++) {
      const tpl = lootTemplates[i % lootTemplates.length];
      const angle = (i / 34) * Math.PI * 2 + Math.random() * 0.35;
      const dist = i < 6 ? 12 + Math.random() * 22 : 25 + Math.random() * 105;
      const lx = Math.cos(angle) * dist;
      const lz = Math.sin(angle) * dist;
      this.createLootMesh(lx, lz, tpl, false);
    }
  }

  private createLootMesh(
    x: number,
    z: number,
    tpl: Omit<LootDrop, 'id' | 'mesh' | 'x' | 'y' | 'z' | 'collected'>,
    isAirDrop: boolean
  ) {
    if (!this.matchGroup) return;
    const y = groundHeightAt(x, z, this.currentMapId);
    const rarityColor =
      tpl.rarity === 'legendary'
        ? 0xf59e0b
        : tpl.rarity === 'epic'
        ? 0xdc2626
        : tpl.rarity === 'rare'
        ? 0x38bdf8
        : 0x94a3b8;

    let mesh: THREE.Group;
    if (isAirDrop) {
      mesh = buildAirDropModel();
      mesh.position.set(x, y + 48, z);
    } else {
      mesh = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.36, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x1e242d, roughness: 0.45, metalness: 0.65 })
      );
      box.position.y = 0.2;
      mesh.add(box);

      const glowRing = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.62, 18),
        new THREE.MeshBasicMaterial({ color: rarityColor, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
      );
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.y = 0.05;
      mesh.add(glowRing);

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.12, 2.2, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: rarityColor, transparent: true, opacity: 0.32, depthWrite: false })
      );
      beacon.position.y = 1.2;
      mesh.add(beacon);

      mesh.position.set(x, y, z);
    }

    this.matchGroup.add(mesh);
    this.lootDrops.push({
      ...tpl,
      id: `loot_${Math.random().toString(36).slice(2, 8)}`,
      mesh,
      x,
      y: isAirDrop ? y + 48 : y,
      z,
      collected: false,
      isAirDrop,
      dropVelocityY: isAirDrop ? -7.5 : 0,
    });
  }

  private spawnAirDrop() {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * Math.max(20, this.safeZone.radius * 0.65);
    const x = this.safeZone.x + Math.cos(a) * r;
    const z = this.safeZone.z + Math.sin(a) * r;
    const legendaryPick = Math.random() > 0.5 ? 'grozak' : 'awmx';
    const w = getWeaponById(legendaryPick);
    this.createLootMesh(
      x,
      z,
      {
        label: `Supply Drop: ${w.name}`,
        sublabel: 'Mythic Air-Drop Crate · Lv3 Gear + Ammo',
        rarity: 'legendary',
        type: 'airdrop',
        weaponId: legendaryPick,
        armorLevel: 3,
        helmetLevel: 3,
      },
      true
    );
    this.pushBanner('SUPPLY AIR-DROP INBOUND', 'Check red flare column & tactical map', 'gold');
  }

  private clearMatchScene() {
    if (this.matchGroup) {
      this.scene.remove(this.matchGroup);
      this.matchGroup = null;
    }
    if (this.world) {
      this.world.disposables.forEach((d) => d.dispose());
      this.world = null;
    }
    this.bots = [];
    this.lootDrops = [];
    this.vehicles = [];
    this.tracers = [];
    this.particles = [];
    this.grenades = [];
    this.playerRig = null;
    this.blueZoneMesh = null;
  }

  // --- PUBLIC CONTROLS FOR HUD / MOBILE / MODALS ---

  public setTouchMove(nx: number, ny: number, sprint: boolean) {
    this.touchMoveX = nx;
    this.touchMoveY = ny;
    this.touchSprint = sprint;
  }

  public applyLookDelta(dx: number, dy: number) {
    if (this.mode !== 'match' || this.paused || this.matchEnded) return;
    const zoom = this.getCurrentZoom();
    let sens = this.controls.cameraSensitivity;
    if (this.isAds) {
      if (zoom >= 7) sens = this.controls.scope8xSensitivity;
      else if (zoom >= 3.5) sens = this.controls.scope4xSensitivity;
      else if (zoom >= 1.8) sens = this.controls.scope2xSensitivity;
      else sens = this.controls.adsSensitivity;
    }
    const factor = 0.0026 * sens;
    this.playerYaw -= dx * factor;
    this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * factor, -1.15, 1.05);
  }

  public setFiring(active: boolean) {
    this.isFiring = active;
  }

  public toggleAds(force?: boolean) {
    if (this.stance === 'parachute' || this.activeVehicle) return;
    this.isAds = force !== undefined ? force : !this.isAds;
  }

  public togglePerspective() {
    this.perspective = this.perspective === 'TPP' ? 'FPP' : 'TPP';
    audioEngine.playUiClick();
  }

  public toggleAutoRun() {
    this.autoRun = !this.autoRun;
    audioEngine.playUiClick();
  }

  public cycleFireMode() {
    if (this.activeSlot === 2) return;
    const slot = this.slots[this.activeSlot];
    if (!slot) return;
    const def = getWeaponById(slot.weaponId);
    const idx = def.fireModes.indexOf(this.fireMode);
    this.fireMode = def.fireModes[(idx + 1) % def.fireModes.length] || 'AUTO';
    audioEngine.playUiClick();
  }

  public jumpAction() {
    if (this.activeVehicle || this.stance === 'parachute') return;
    if (this.stance === 'crouch' || this.stance === 'prone') {
      this.stance = 'stand';
      return;
    }
    const gy = groundHeightAt(this.playerX, this.playerZ, this.currentMapId);
    if (this.playerY <= gy + 0.12) {
      this.playerVelY = 7.4;
      audioEngine.playFootstep(true);
    }
  }

  public toggleCrouch() {
    if (this.activeVehicle || this.stance === 'parachute') return;
    this.stance = this.stance === 'crouch' ? 'stand' : 'crouch';
  }

  public toggleProne() {
    if (this.activeVehicle || this.stance === 'parachute') return;
    this.stance = this.stance === 'prone' ? 'stand' : 'prone';
  }

  public switchWeaponSlot(slot: 0 | 1 | 2) {
    if (slot === 1 && !this.slots[1]) return;
    if (this.activeSlot === slot) return;
    this.activeSlot = slot;
    this.isReloading = false;
    this.isAds = false;
    if (slot !== 2 && this.slots[slot]) {
      this.fireMode = getWeaponById(this.slots[slot]!.weaponId).fireModes[0] || 'AUTO';
    }
    audioEngine.playUiClick();
    this.rebuildPlayerMesh();
  }

  public startReload() {
    if (this.isReloading || this.activeSlot === 2 || this.stance === 'parachute' || this.activeVehicle) return;
    const slot = this.slots[this.activeSlot];
    if (!slot) return;
    const def = getWeaponById(slot.weaponId);
    const eff = computeEffectiveWeaponStats(def, slot.attachments);
    if (slot.ammoInMag >= eff.magSize) return;
    const avail = this.reserveAmmo[def.ammoType] || 0;
    if (avail <= 0) return;

    const op = getOperatorById(this.profile.selectedOperatorId);
    const overdriveBonus = op.activeAbility.effectType === 'overdrive' && this.abilityActiveTimer > 0 ? 0.7 : 1;
    this.isReloading = true;
    this.reloadElapsed = 0;
    this.reloadDuration = eff.reloadTime * overdriveBonus;
    audioEngine.playReload();
  }

  public startHealing(kind?: 'medkit' | 'bandage' | 'energy') {
    if (this.isHealing || this.stance === 'parachute' || this.activeVehicle) return;
    let chosen = kind;
    if (!chosen) {
      if (this.hp < 75 && this.medkits > 0) chosen = 'medkit';
      else if (this.hp < 95 && this.bandages > 0) chosen = 'bandage';
      else if (this.energyDrinks > 0) chosen = 'energy';
      else return;
    }
    if (chosen === 'medkit' && this.medkits <= 0) return;
    if (chosen === 'bandage' && this.bandages <= 0) return;
    if (chosen === 'energy' && this.energyDrinks <= 0) return;

    const op = getOperatorById(this.profile.selectedOperatorId);
    const speedMult = op.id === 'nyx' ? 0.75 : 1.0;
    this.healType = chosen;
    this.isHealing = true;
    this.healElapsed = 0;
    this.healDuration = (chosen === 'medkit' ? 3.2 : chosen === 'bandage' ? 1.8 : 2.1) * speedMult;
    audioEngine.playUiClick(true);
  }

  public throwGrenade(type: 'frag' | 'smoke' = 'frag') {
    if (this.stance === 'parachute' || this.activeVehicle || !this.matchGroup) return;
    if (type === 'frag' && this.frags <= 0) return;
    if (type === 'smoke' && this.smokes <= 0) return;
    if (type === 'frag') this.frags--;
    else this.smokes--;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshStandardMaterial({
        color: type === 'frag' ? 0x3b4938 : 0x94a3b8,
        roughness: 0.4,
        metalness: 0.6,
      })
    );
    const sx = this.playerX - Math.sin(this.playerYaw) * 0.6;
    const sy = this.playerY + 1.5;
    const sz = this.playerZ - Math.cos(this.playerYaw) * 0.6;
    mesh.position.set(sx, sy, sz);
    this.matchGroup.add(mesh);

    const throwSpeed = 24;
    this.grenades.push({
      mesh,
      type,
      x: sx,
      y: sy,
      z: sz,
      vx: -Math.sin(this.playerYaw) * Math.cos(this.playerPitch) * throwSpeed,
      vy: Math.sin(this.playerPitch) * throwSpeed + 7.5,
      vz: -Math.cos(this.playerYaw) * Math.cos(this.playerPitch) * throwSpeed,
      fuse: type === 'frag' ? 2.2 : 1.4,
    });
    audioEngine.playUiClick(true);
    this.rebuildInventoryList();
  }

  public activateOperatorAbility() {
    if (this.abilityCooldown > 0 || this.stance === 'parachute') return;
    const op = getOperatorById(this.profile.selectedOperatorId);
    this.abilityCooldown = op.activeAbility.cooldown;
    this.abilityActiveTimer = 7.5;
    audioEngine.playAbility();

    if (op.activeAbility.effectType === 'heal') {
      this.hp = Math.min(this.maxHp, this.hp + 45);
      this.boost = Math.min(100, this.boost + 35);
      this.pushBanner('NANO-HEAL SURGE', '+45 HP & Boost restored', 'blue');
    } else if (op.activeAbility.effectType === 'shield') {
      this.armor = Math.min(140, this.armor + 60);
      this.pushBanner('AEGIS REACTIVE PLATING', '+60 Ballistic Shield active', 'blue');
    } else if (op.activeAbility.effectType === 'overdrive') {
      this.stamina = 100;
      this.pushBanner('ADRENALINE OVERDRIVE', '+32% Speed & +30% Reload for 7.5s', 'crimson');
    } else {
      this.pushBanner('PULSE THREAT SCAN', 'All hostiles revealed on radar for 7.5s', 'crimson');
    }
  }

  public interactAction() {
    if (this.stance === 'parachute') return;

    // Exit vehicle if currently driving
    if (this.activeVehicle) {
      this.playerX = this.activeVehicle.x + Math.cos(this.activeVehicle.yaw) * 2.6;
      this.playerZ = this.activeVehicle.z - Math.sin(this.activeVehicle.yaw) * 2.6;
      this.playerY = groundHeightAt(this.playerX, this.playerZ, this.currentMapId);
      this.activeVehicle.speed = 0;
      this.activeVehicle = null;
      this.stance = 'stand';
      if (this.playerRig) this.playerRig.root.visible = true;
      audioEngine.playUiClick();
      return;
    }

    // Check nearby vehicle first
    for (const v of this.vehicles) {
      if (v.hp <= 0) continue;
      if (Math.hypot(v.x - this.playerX, v.z - this.playerZ) < 4.5) {
        this.activeVehicle = v;
        this.stance = 'vehicle';
        this.isAds = false;
        this.isHealing = false;
        if (this.playerRig) this.playerRig.root.visible = false;
        audioEngine.playUiClick(true);
        this.pushBanner('VEHICLE ENGAGED', 'W/S Drive · A/D Steer · E Exit', 'blue');
        return;
      }
    }

    // Check nearby loot
    const loot = this.findNearestLoot();
    if (loot) {
      this.collectLoot(loot);
    }
  }

  private findNearestLoot(): LootDrop | null {
    let best: LootDrop | null = null;
    let bestDist = 4.2;
    for (const l of this.lootDrops) {
      if (l.collected) continue;
      const d = Math.hypot(l.x - this.playerX, l.z - this.playerZ);
      if (d < bestDist && Math.abs(l.y - this.playerY) < 4) {
        bestDist = d;
        best = l;
      }
    }
    return best;
  }

  private collectLoot(l: LootDrop) {
    l.collected = true;
    l.mesh.visible = false;
    audioEngine.playUiClick(true);

    if (l.type === 'weapon' && l.weaponId) {
      const def = getWeaponById(l.weaponId);
      const targetIdx: 0 | 1 = this.activeSlot === 1 ? 1 : 0;
      this.slots[targetIdx] = {
        weaponId: l.weaponId,
        ammoInMag: def.magSize,
        skinId: this.profile.selectedWeaponSkins[l.weaponId] || 'skin_factory',
        attachments: { ...(this.profile.selectedAttachments[l.weaponId] || {}) },
      };
      this.reserveAmmo[def.ammoType] = (this.reserveAmmo[def.ammoType] || 0) + def.magSize * 2;
      this.rebuildPlayerMesh();
      this.pushBanner(`EQUIPPED ${def.name.toUpperCase()}`, `+${def.magSize * 2} ${def.ammoType} ammo`, 'blue');
    } else if (l.type === 'armor') {
      this.armorLevel = Math.max(this.armorLevel, l.armorLevel || 2);
      this.maxArmor = this.armorLevel === 3 ? 120 : 100;
      this.armor = this.maxArmor;
      this.pushBanner('LEVEL 3 VEST EQUIPPED', 'Armor restored to 100%', 'blue');
    } else if (l.type === 'helmet') {
      this.helmetLevel = Math.max(this.helmetLevel, l.helmetLevel || 2);
      this.pushBanner('LEVEL 3 HELMET EQUIPPED', 'Headshot damage reduced', 'blue');
    } else if (l.type === 'heal') {
      this.medkits += 2;
      this.energyDrinks += 2;
      this.pushBanner('MEDICAL SUPPLIES LOOTED', '+2 Medkits · +2 Energy Drinks', 'blue');
    } else if (l.type === 'grenade') {
      this.frags += 2;
      this.smokes += 2;
      this.pushBanner('ORDNANCE LOOTED', '+2 Frag · +2 Smoke Grenades', 'blue');
    } else if (l.type === 'attachment' && l.attachmentId) {
      const att = getAttachmentById(l.attachmentId);
      if (att) {
        const slot = this.slots[this.activeSlot === 1 ? 1 : 0];
        if (slot) {
          slot.attachments[att.slot] = att.id;
          this.rebuildPlayerMesh();
          this.pushBanner(`ATTACHED ${att.name.toUpperCase()}`, att.description, 'blue');
        }
      }
    } else if (l.type === 'airdrop') {
      if (l.weaponId) {
        const def = getWeaponById(l.weaponId);
        this.slots[0] = {
          weaponId: l.weaponId,
          ammoInMag: def.magSize,
          skinId: 'skin_obsidian_gold',
          attachments: { scope: def.category === 'SNIPER' ? 'scope_8x' : 'scope_4x', muzzle: 'muzzle_supp', magazine: 'mag_quickext' },
        };
        this.reserveAmmo[def.ammoType] = (this.reserveAmmo[def.ammoType] || 0) + def.magSize * 4;
      }
      this.armorLevel = 3;
      this.helmetLevel = 3;
      this.maxArmor = 120;
      this.armor = 120;
      this.medkits += 2;
      this.rebuildPlayerMesh();
      this.pushBanner('MYTHIC SUPPLY DROP SECURED', 'Air-Drop Weapon + Level 3 Armor Equipped', 'gold');
    }

    this.rebuildInventoryList();
  }

  public equipAttachmentInMatch(slotIdx: 0 | 1, slotType: AttachmentSlot, attachmentId: string | undefined) {
    const w = this.slots[slotIdx];
    if (!w) return;
    if (attachmentId) w.attachments[slotType] = attachmentId;
    else delete w.attachments[slotType];
    this.rebuildPlayerMesh();
    this.emitHud();
  }

  public discardInventoryItem(itemId: string) {
    if (itemId === 'inv_medkit' && this.medkits > 0) this.medkits--;
    else if (itemId === 'inv_bandage' && this.bandages > 0) this.bandages--;
    else if (itemId === 'inv_energy' && this.energyDrinks > 0) this.energyDrinks--;
    else if (itemId === 'inv_frag' && this.frags > 0) this.frags--;
    else if (itemId === 'inv_smoke' && this.smokes > 0) this.smokes--;
    this.rebuildInventoryList();
    this.emitHud();
  }

  public setMapPing(x: number, z: number) {
    this.mapPing = { x, z };
    audioEngine.playUiClick(true);
    this.emitHud();
  }

  public setPaused(p: boolean) {
    this.paused = p;
    if (p) this.exitPointerLock();
    this.emitHud();
  }

  public requestPointerLock() {
    if (this.mode !== 'match' || this.paused || this.matchEnded) return;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // ignore on unsupported touch browsers
    }
  }

  public exitPointerLock() {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  private rebuildInventoryList() {
    const items: InventoryItem[] = [];
    if (this.medkits > 0)
      items.push({ id: 'inv_medkit', name: 'Tactical Medkit', type: 'medkit', count: this.medkits, weight: 18, rarity: 'rare', description: 'Restores HP to 100% after 3.2s channel.' });
    if (this.bandages > 0)
      items.push({ id: 'inv_bandage', name: 'Field Bandage', type: 'bandage', count: this.bandages, weight: 5, rarity: 'common', description: 'Quickly restores 25 HP in 1.8s.' });
    if (this.energyDrinks > 0)
      items.push({ id: 'inv_energy', name: 'Vexora Energy Stim', type: 'energy', count: this.energyDrinks, weight: 8, rarity: 'rare', description: '+45 Boost for passive HP regen & sprint speed.' });
    if (this.frags > 0)
      items.push({ id: 'inv_frag', name: 'M67 Frag Grenade', type: 'frag', count: this.frags, weight: 14, rarity: 'rare', description: 'High-explosive fragmentation charge.' });
    if (this.smokes > 0)
      items.push({ id: 'inv_smoke', name: 'Thermal Smoke Canister', type: 'smoke', count: this.smokes, weight: 10, rarity: 'common', description: 'Deploys dense visual cover cloud.' });

    Object.entries(this.reserveAmmo).forEach(([ammoType, count]) => {
      if (count > 0) {
        items.push({
          id: `ammo_${ammoType}`,
          name: `${ammoType} Rounds`,
          type: 'ammo',
          count,
          weight: 0.4,
          rarity: 'common',
          ammoType: ammoType as InventoryItem['ammoType'],
          description: `Ballistic reserve ammunition for ${ammoType} firearms.`,
        });
      }
    });
    this.inventory = items;
  }

  private getCurrentZoom(): number {
    if (!this.isAds || this.activeSlot === 2) return 1;
    const slot = this.slots[this.activeSlot];
    if (!slot) return 1.25;
    const scope = getAttachmentById(slot.attachments.scope);
    return scope?.zoom || 1.3;
  }

  private pushBanner(text: string, subtext: string, tone: 'crimson' | 'blue' | 'gold') {
    this.bannerAlert = { text, subtext, tone, id: this.alertSeq++ };
    this.bannerTimer = 3.6;
  }

  // --- INPUT HANDLERS ---

  private handleResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyResolution();
  }

  private handleBlur() {
    this.keys.clear();
    this.isFiring = false;
  }

  private handlePointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.mode !== 'match') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const code = e.code;
    this.keys.add(code);

    if (code === 'Escape') {
      this.setPaused(!this.paused);
      return;
    }
    if (this.paused || this.matchEnded) return;

    if (code === 'Space') this.jumpAction();
    else if (code === 'KeyC') this.toggleCrouch();
    else if (code === 'KeyZ') this.toggleProne();
    else if (code === 'KeyR') this.startReload();
    else if (code === 'Digit1') this.switchWeaponSlot(0);
    else if (code === 'Digit2') this.switchWeaponSlot(1);
    else if (code === 'Digit3') this.switchWeaponSlot(2);
    else if (code === 'KeyV') this.togglePerspective();
    else if (code === 'KeyE' || code === 'KeyF') this.interactAction();
    else if (code === 'KeyG') this.throwGrenade('frag');
    else if (code === 'KeyT') this.throwGrenade('smoke');
    else if (code === 'KeyH' || code === 'Digit4') this.startHealing();
    else if (code === 'KeyQ') this.activateOperatorAbility();
    else if (code === 'KeyB') this.cycleFireMode();
    else if (code === 'Equal') this.toggleAutoRun();
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
  }

  private handlePointerDown(e: PointerEvent) {
    if (this.mode === 'lobby' || this.mode === 'armory') {
      this.isLobbyDragging = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    }
  }

  private handlePointerMove(e: PointerEvent) {
    if ((this.mode === 'lobby' || this.mode === 'armory') && this.isLobbyDragging) {
      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.lobbyTargetAngle += dx * 0.012;
      this.lobbyWeaponPitch = THREE.MathUtils.clamp(this.lobbyWeaponPitch + dy * 0.008, -0.5, 0.5);
    }
  }

  private handlePointerUp() {
    this.isLobbyDragging = false;
  }

  private handleMouseDown(e: MouseEvent) {
    if (this.mode !== 'match' || this.paused || this.matchEnded) return;
    if (e.button === 0) {
      if (!this.pointerLocked && !this.controls.showTouchControls) {
        this.requestPointerLock();
      }
      this.isFiring = true;
    } else if (e.button === 2) {
      this.toggleAds(true);
    }
  }

  private handleMouseUp(e: MouseEvent) {
    if (e.button === 0) this.isFiring = false;
    else if (e.button === 2) this.toggleAds(false);
  }

  private handleMouseMove(e: MouseEvent) {
    if (this.mode !== 'match' || this.paused || this.matchEnded) return;
    if (this.pointerLocked) {
      this.applyLookDelta(e.movementX, e.movementY);
    }
  }

  // --- COMBAT & BALLISTICS ---

  private firePlayerWeapon() {
    if (this.activeSlot === 2 || this.isReloading || this.stance === 'parachute' || this.activeVehicle) return;
    const slot = this.slots[this.activeSlot];
    if (!slot) return;
    if (slot.ammoInMag <= 0) {
      this.startReload();
      return;
    }

    const def = getWeaponById(slot.weaponId);
    const eff = computeEffectiveWeaponStats(def, slot.attachments);

    slot.ammoInMag--;
    this.fireTimer = 60 / eff.fireRate;
    this.isHealing = false;

    // Recoil kick & camera shake
    const adsFactor = this.isAds ? 0.62 : 1.0;
    const recoilScale = (eff.recoil / 100) * adsFactor;
    this.recoilKickPitch += 0.018 * recoilScale;
    this.recoilKickYaw += (Math.random() - 0.5) * 0.012 * recoilScale;
    this.cameraShake = Math.min(0.28, this.cameraShake + 0.045 * recoilScale);

    // Sound & Muzzle Flash
    audioEngine.playGunshot(def.category, eff.suppressed, 1);
    const eyeY = this.getEyeHeight();
    _rayOrigin.set(this.playerX, this.playerY + eyeY, this.playerZ);

    if (!eff.suppressed) {
      this.muzzleLight.position.set(
        this.playerX - Math.sin(this.playerYaw) * 1.1,
        this.playerY + eyeY - 0.1,
        this.playerZ - Math.cos(this.playerYaw) * 1.1
      );
      this.muzzleLight.intensity = 4.5;
      this.muzzleLightTimer = 0.045;
    }

    const pellets = def.pellets || 1;
    const baseSpread = ((100 - eff.accuracy) / 100) * (this.isAds ? 0.012 : 0.048);

    // Compute aim vector from camera center
    this.camera.getWorldDirection(_v1);
    const camPos = this.camera.position;

    for (let p = 0; p < pellets; p++) {
      _rayDir.copy(_v1);
      _rayDir.x += (Math.random() - 0.5) * baseSpread;
      _rayDir.y += (Math.random() - 0.5) * baseSpread;
      _rayDir.z += (Math.random() - 0.5) * baseSpread;
      _rayDir.normalize();

      this.traceShot(camPos, _rayDir, def.damage, def.headshotMult, eff.range, 'player', def.name);
    }

    if (slot.ammoInMag === 0) {
      this.startReload();
    }
    if (this.fireMode === 'SINGLE') {
      this.isFiring = false;
    }
  }

  private traceShot(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    baseDamage: number,
    headMult: number,
    maxRange: number,
    shooter: 'player' | BotAgent,
    weaponName: string
  ) {
    let closestDist = maxRange;
    let hitBot: BotAgent | null = null;
    let hitPlayer = false;
    let isHeadshot = false;
    let hitTrainingIdx = -1;

    // 1. Check Terrain / Cover intersection (stepped fast raymarch against terrain & boxes)
    const colliders = this.world?.colliders || [];
    for (let d = 2; d <= maxRange; d += 3.5) {
      const px = origin.x + dir.x * d;
      const py = origin.y + dir.y * d;
      const pz = origin.z + dir.z * d;
      if (py <= groundHeightAt(px, pz, this.currentMapId)) {
        closestDist = d;
        break;
      }
      let hitWall = false;
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (px >= c.minX && px <= c.maxX && pz >= c.minZ && pz <= c.maxZ && py <= c.maxY) {
          closestDist = d;
          hitWall = true;
          break;
        }
      }
      if (hitWall) break;
    }

    // 2. Check Bots (analytical sphere/capsule hit test with aim-assist tolerance)
    const aimPad = shooter === 'player' && this.controls.aimAssist ? 0.24 : 0.05;
    for (const bot of this.bots) {
      if (!bot.alive) continue;
      if (shooter === 'player' && bot.isTeammate) continue;
      if (shooter !== 'player' && shooter.id === bot.id) continue;
      if (shooter !== 'player' && shooter.isTeammate === bot.isTeammate) continue;

      // Test head center (y + 1.65) and torso center (y + 1.05)
      const headDist = this.raySphereDist(origin, dir, bot.x, bot.y + 1.65, bot.z, 0.28 + aimPad * 0.55);
      if (headDist > 0 && headDist < closestDist) {
        closestDist = headDist;
        hitBot = bot;
        isHeadshot = true;
        hitPlayer = false;
        hitTrainingIdx = -1;
      }
      const bodyDist = this.raySphereDist(origin, dir, bot.x, bot.y + 1.05, bot.z, 0.54 + aimPad);
      if (bodyDist > 0 && bodyDist < closestDist) {
        closestDist = bodyDist;
        hitBot = bot;
        isHeadshot = false;
        hitPlayer = false;
        hitTrainingIdx = -1;
      }
    }

    // 3. Check Training Targets
    if (shooter === 'player' && this.world?.trainingTargets.length) {
      this.world.trainingTargets.forEach((t, idx) => {
        if (t.respawnTimer > 0) return;
        const pos = t.mesh.position;
        const hd = this.raySphereDist(origin, dir, pos.x, pos.y + 2.12, pos.z, 0.3);
        const bd = this.raySphereDist(origin, dir, pos.x, pos.y + 1.48, pos.z, 0.52);
        const d = hd > 0 && (bd <= 0 || hd < bd) ? hd : bd;
        if (d > 0 && d < closestDist) {
          closestDist = d;
          hitTrainingIdx = idx;
          hitBot = null;
          isHeadshot = hd > 0 && d === hd;
        }
      });
    }

    // 4. Check Player hit (when shooter is enemy bot)
    if (shooter !== 'player' && !shooter.isTeammate && this.hp > 0) {
      const pDist = this.raySphereDist(origin, dir, this.playerX, this.playerY + 1.1, this.playerZ, 0.55);
      if (pDist > 0 && pDist < closestDist) {
        closestDist = pDist;
        hitPlayer = true;
        hitBot = null;
      }
    }

    // Spawn bullet tracer line
    const endPos = _v2.copy(origin).addScaledVector(dir, closestDist);
    const startPos = _v3.copy(origin).addScaledVector(dir, 1.15);
    if (shooter === 'player') startPos.y -= 0.14;
    this.spawnTracer(startPos, endPos, shooter === 'player' ? 0xfbbf24 : 0xef4444);

    // Apply Impact Sparks
    this.spawnImpactParticles(endPos, hitBot || hitPlayer ? 0xef4444 : 0xe2e8f0, hitBot || hitPlayer ? 6 : 4);

    // Apply Damage
    if (hitTrainingIdx >= 0 && this.world) {
      const t = this.world.trainingTargets[hitTrainingIdx];
      const dmg = Math.round(baseDamage * (isHeadshot ? headMult : 1));
      t.hp -= dmg;
      this.damageDealt += dmg;
      this.triggerHitMarker(isHeadshot, t.hp <= 0);
      if (t.hp <= 0) {
        t.respawnTimer = 2.6;
        t.mesh.rotation.x = -Math.PI / 2;
        audioEngine.playKillConfirm();
      }
      return;
    }

    if (hitBot) {
      const dmg = Math.round(baseDamage * (isHeadshot ? headMult : 1));
      let rem = dmg;
      if (hitBot.armor > 0) {
        const absorb = Math.min(hitBot.armor, Math.round(rem * 0.4));
        hitBot.armor -= absorb;
        rem -= absorb;
      }
      hitBot.hp -= rem;
      hitBot.hitFlashTimer = 0.14;

      if (shooter === 'player') {
        this.damageDealt += dmg;
        const killed = hitBot.hp <= 0;
        this.triggerHitMarker(isHeadshot, killed);
        if (killed) {
          this.handleElimination(this.profile.name, hitBot, weaponName, isHeadshot, true);
        }
      } else if (hitBot.hp <= 0) {
        this.handleElimination(shooter.name, hitBot, weaponName, isHeadshot, false);
      }
    } else if (hitPlayer && shooter !== 'player') {
      this.applyPlayerDamage(Math.round(baseDamage * 0.34), shooter.x, shooter.z, shooter.name, weaponName);
    }
  }

  private raySphereDist(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    cx: number,
    cy: number,
    cz: number,
    radius: number
  ): number {
    const ocx = origin.x - cx;
    const ocy = origin.y - cy;
    const ocz = origin.z - cz;
    const b = ocx * dir.x + ocy * dir.y + ocz * dir.z;
    const c = ocx * ocx + ocy * ocy + ocz * ocz - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return -1;
    const t = -b - Math.sqrt(disc);
    return t > 0.4 ? t : -1;
  }

  private triggerHitMarker(headshot: boolean, kill: boolean) {
    this.hitMarker = { active: true, headshot, kill, time: 0.24 };
    audioEngine.playHitMarker(headshot);
    if (kill) {
      this.hitstopTimer = 0.042;
      audioEngine.playKillConfirm();
    }
  }

  private handleElimination(
    killerName: string,
    victim: BotAgent,
    weaponName: string,
    isHeadshot: boolean,
    byPlayer: boolean
  ) {
    victim.alive = false;
    victim.rig.root.visible = false;

    // Spawn loot crate at victim location
    const wDef = getWeaponById(victim.weaponId);
    this.createLootMesh(
      victim.x,
      victim.z,
      {
        label: `${victim.name}'s Crate`,
        sublabel: `${wDef.name} + Meds`,
        rarity: 'rare',
        type: 'heal',
      },
      false
    );

    if (byPlayer) {
      this.kills++;
      if (isHeadshot) this.headshots++;
      // Kael passive: +15 HP on elimination
      if (this.profile.selectedOperatorId === 'kael') {
        this.hp = Math.min(this.maxHp, this.hp + 15);
      }
      this.pushBanner(
        isHeadshot ? `HEADSHOT ELIMINATION` : `HOSTILE ELIMINATED`,
        `${victim.name} · ${weaponName}`,
        'crimson'
      );
    }

    this.killFeed.unshift({
      id: `kf_${Date.now()}_${Math.random()}`,
      killer: killerName,
      victim: victim.name,
      weapon: weaponName,
      isHeadshot,
      isPlayerInvolved: byPlayer,
      timestamp: this.matchTime,
    });
    if (this.killFeed.length > 5) this.killFeed.pop();

    // Training Ground respawns bots
    if (this.currentGameMode === 'training') {
      window.setTimeout(() => {
        if (this.disposed || this.mode !== 'match') return;
        victim.alive = true;
        victim.hp = 100;
        victim.armor = 40;
        victim.rig.root.visible = true;
      }, 4500);
      return;
    }

    this.checkVictoryCondition();
  }

  private applyPlayerDamage(amount: number, srcX: number, srcZ: number, attackerName: string, weaponName: string) {
    if (this.matchEnded || this.currentGameMode === 'training') return;

    let dmg = amount;
    // Ronan passive reduces blast/zone damage
    if (this.profile.selectedOperatorId === 'ronan' && (weaponName === 'Blue Zone' || weaponName === 'Frag Grenade')) {
      dmg = Math.round(dmg * 0.8);
    }

    if (this.armor > 0 && weaponName !== 'Blue Zone') {
      const absorb = Math.min(this.armor, Math.round(dmg * 0.45));
      this.armor -= absorb;
      dmg -= absorb;
    }
    this.hp = Math.max(0, this.hp - dmg);
    this.cameraShake = Math.min(0.32, this.cameraShake + 0.12);

    // Directional damage indicator angle relative to player facing
    const worldAngle = Math.atan2(srcX - this.playerX, srcZ - this.playerZ);
    this.damageIndicatorAngle = worldAngle - this.playerYaw;
    this.damageIndicatorAlpha = 1.0;

    if (this.hp <= 0) {
      this.killFeed.unshift({
        id: `kf_p_${Date.now()}`,
        killer: attackerName,
        victim: this.profile.name,
        weapon: weaponName,
        isHeadshot: false,
        isPlayerInvolved: true,
        timestamp: this.matchTime,
      });
      this.finishMatch(false);
    }
  }

  private checkVictoryCondition() {
    if (this.matchEnded || this.currentGameMode === 'training') return;
    const aliveEnemies = this.bots.filter((b) => b.alive && !b.isTeammate).length;
    if (aliveEnemies === 0) {
      this.finishMatch(true);
    }
  }

  private finishMatch(victory: boolean) {
    if (this.matchEnded) return;
    this.matchEnded = true;
    this.exitPointerLock();
    audioEngine.stopAmbient();
    if (victory) audioEngine.playVictoryFanfare();

    const aliveEnemies = this.bots.filter((b) => b.alive && !b.isTeammate).length;
    const placement = victory ? 1 : aliveEnemies + 1;
    const xpEarned = Math.round((victory ? 450 : 140) + this.kills * 75 + this.matchTime * 1.2 + this.damageDealt * 0.15);
    const goldEarned = Math.round((victory ? 650 : 180) + this.kills * 95 + this.headshots * 40);
    const rpDelta =
      this.currentGameMode === 'ranked'
        ? victory
          ? 42 + this.kills * 6
          : Math.max(-22, 18 - placement * 2 + this.kills * 5)
        : victory
        ? 18
        : 6;

    const baseResult = {
      victory,
      placement,
      totalPlayers: this.totalCombatants,
      kills: this.kills,
      assists: this.assists,
      damageDealt: this.damageDealt,
      headshots: this.headshots,
      survivalTime: Math.round(this.matchTime),
      mode: this.currentGameMode,
      mapId: this.currentMapId,
      xpEarned,
      goldEarned,
      rpDelta,
      bpXpEarned: Math.round(xpEarned * 0.65),
    };
    const mmrDelta = computePostMatchMmrDelta(baseResult, this.currentGameMode);

    this.callbacks.onMatchEnd({
      ...baseResult,
      mmrDelta,
      sbmmTierLabel: this.activeSbmmTier,
    });
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3, colorHex: number) {
    if (!this.matchGroup) return;
    const geo = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.matchGroup.add(line);
    this.tracers.push({ line, life: 0.08, maxLife: 0.08 });
  }

  private spawnImpactParticles(pos: THREE.Vector3, colorHex: number, count: number, isSmoke = false) {
    if (!this.matchGroup) return;
    const geo = isSmoke ? new THREE.SphereGeometry(0.55, 8, 8) : new THREE.BoxGeometry(0.11, 0.11, 0.11);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: isSmoke ? 0.55 : 0.95,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      this.matchGroup.add(m);
      const sp = isSmoke ? 2.4 : 6.5;
      this.particles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * sp,
        vy: Math.random() * (isSmoke ? 1.8 : 5.5) + 0.6,
        vz: (Math.random() - 0.5) * sp,
        life: isSmoke ? 6.5 : 0.35 + Math.random() * 0.2,
        maxLife: isSmoke ? 6.5 : 0.55,
        scaleRate: isSmoke ? 1.6 : 0,
      });
    }
  }

  // --- MAIN FRAME LOOP ---

  private getEyeHeight(): number {
    if (this.stance === 'prone') return 0.55;
    if (this.stance === 'crouch') return 1.12;
    return 1.62;
  }

  private resolveStaticCollisions(x: number, z: number, radius: number): { x: number; z: number } {
    let rx = x;
    let rz = z;
    const colliders: StaticCollider[] = this.world?.colliders || [];
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (rx + radius > c.minX && rx - radius < c.maxX && rz + radius > c.minZ && rz - radius < c.maxZ) {
        const dl = Math.abs(rx + radius - c.minX);
        const dr = Math.abs(c.maxX - (rx - radius));
        const dt = Math.abs(rz + radius - c.minZ);
        const db = Math.abs(c.maxZ - (rz - radius));
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) rx = c.minX - radius;
        else if (m === dr) rx = c.maxX + radius;
        else if (m === dt) rz = c.minZ - radius;
        else rz = c.maxZ + radius;
      }
    }
    // Keep within coastal perimeter
    const dist = Math.hypot(rx, rz);
    if (dist > ISLAND_RADIUS - 12) {
      const s = (ISLAND_RADIUS - 12) / dist;
      rx *= s;
      rz *= s;
    }
    return { x: rx, z: rz };
  }

  private updateLobby(dt: number, elapsed: number) {
    this.lobbyTurntableAngle = THREE.MathUtils.damp(this.lobbyTurntableAngle, this.lobbyTargetAngle, 8, dt);

    if (this.mode === 'lobby') {
      if (!this.isLobbyDragging) {
        this.lobbyTargetAngle += dt * 0.14;
      }
      if (this.lobbyOperatorRig) {
        this.lobbyOperatorRig.root.rotation.y = this.lobbyTurntableAngle;
        this.lobbyOperatorRig.torso.position.y = 1.03 + Math.sin(elapsed * 2.1) * 0.014;
        this.lobbyOperatorRig.head.rotation.y = Math.sin(elapsed * 0.9) * 0.14;
      }
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, 0.25, 5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 1.5, 5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 4.65, 5, dt);
      this.camera.lookAt(0, 1.05, 0);
    } else if (this.mode === 'armory') {
      if (!this.isLobbyDragging) {
        this.lobbyTargetAngle += dt * 0.28;
      }
      if (this.lobbyWeaponPreview) {
        this.lobbyWeaponPreview.rotation.y = this.lobbyTurntableAngle + Math.PI * 0.42;
        this.lobbyWeaponPreview.rotation.x = THREE.MathUtils.damp(this.lobbyWeaponPreview.rotation.x, this.lobbyWeaponPitch, 8, dt);
        this.lobbyWeaponPreview.position.y = 1.25 + Math.sin(elapsed * 2.2) * 0.035;
      }
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, 0, 6, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, 1.38, 6, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, 3.2, 6, dt);
      this.camera.lookAt(0, 1.24, 0);
    }

    if (this.weatherPoints) {
      const pos = this.weatherPoints.geometry.attributes.position as THREE.BufferAttribute;
      const isRain = this.graphics.weather === 'rain' || this.graphics.weather === 'storm';
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + (isRain ? -dt * 14 : dt * 0.45);
        if (y < 0) y = 8;
        if (y > 8) y = 0;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  }

  private updateMatch(dt: number, elapsed: number) {
    if (this.paused || this.matchEnded) return;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    this.matchTime += dt;
    if (this.world) {
      this.world.waterUniforms.uTime.value = elapsed;
    }

    // Timers
    if (this.muzzleLightTimer > 0) {
      this.muzzleLightTimer -= dt;
      if (this.muzzleLightTimer <= 0) this.muzzleLight.intensity = 0;
    }
    if (this.hitMarker.active) {
      this.hitMarker.time -= dt;
      if (this.hitMarker.time <= 0) this.hitMarker.active = false;
    }
    if (this.damageIndicatorAlpha > 0) {
      this.damageIndicatorAlpha = Math.max(0, this.damageIndicatorAlpha - dt * 1.4);
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerAlert = null;
    }
    if (this.abilityCooldown > 0) this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    if (this.abilityActiveTimer > 0) this.abilityActiveTimer = Math.max(0, this.abilityActiveTimer - dt);

    // Passive boost regen
    if (this.boost > 0) {
      this.boost = Math.max(0, this.boost - dt * 0.65);
      if (this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + dt * 1.6);
      }
    }

    // Reloading
    if (this.isReloading) {
      this.reloadElapsed += dt;
      if (this.reloadElapsed >= this.reloadDuration) {
        this.isReloading = false;
        const slot = this.slots[this.activeSlot === 1 ? 1 : 0];
        if (slot) {
          const def = getWeaponById(slot.weaponId);
          const eff = computeEffectiveWeaponStats(def, slot.attachments);
          const need = eff.magSize - slot.ammoInMag;
          const avail = this.reserveAmmo[def.ammoType] || 0;
          const take = Math.min(need, avail);
          slot.ammoInMag += take;
          this.reserveAmmo[def.ammoType] = avail - take;
        }
      }
    }

    // Healing channel
    if (this.isHealing) {
      this.healElapsed += dt;
      if (this.healElapsed >= this.healDuration) {
        this.isHealing = false;
        if (this.healType === 'medkit' && this.medkits > 0) {
          this.medkits--;
          this.hp = this.maxHp;
        } else if (this.healType === 'bandage' && this.bandages > 0) {
          this.bandages--;
          this.hp = Math.min(this.maxHp, this.hp + 25);
        } else if (this.healType === 'energy' && this.energyDrinks > 0) {
          this.energyDrinks--;
          this.boost = Math.min(100, this.boost + 45);
        }
        this.rebuildInventoryList();
      }
    }

    // Update Player Movement or Vehicle Driving
    this.updatePlayerMovement(dt);

    // Firing
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.isFiring && this.fireTimer <= 0) {
      this.firePlayerWeapon();
    }

    // Smooth Recoil Recovery & Camera Shake Decay
    this.playerPitch = THREE.MathUtils.clamp(this.playerPitch + this.recoilKickPitch * Math.min(1, dt * 14), -1.15, 1.05);
    this.playerYaw += this.recoilKickYaw * Math.min(1, dt * 14);
    this.recoilKickPitch = THREE.MathUtils.damp(this.recoilKickPitch, 0, 12, dt);
    this.recoilKickYaw = THREE.MathUtils.damp(this.recoilKickYaw, 0, 12, dt);
    this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 14, dt);

    // Update Camera (TPP / FPP / Vehicle / Parachute)
    this.updateCamera(dt);

    // Update Bots, Training Targets, Loot, Grenades, Safe Zone
    this.updateZone(dt);
    this.updateBots(dt);
    this.updateTrainingTargets(dt, elapsed);
    this.updateLootAndAirDrops(dt, elapsed);
    this.updateGrenades(dt);
    this.updateVisualEffects(dt);

    // Keep shadow frustum centered around player
    this.sunLight.target.position.set(this.playerX, this.playerY, this.playerZ);
    this.sunLight.position.set(this.playerX + 55, this.playerY + 78, this.playerZ + 40);

    // Rain / Storm follow player
    if (this.weatherPoints) {
      this.weatherPoints.position.set(this.playerX, this.playerY, this.playerZ);
      const pos = this.weatherPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * 26;
        if (y < -4) y = 28;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    // Emit HUD snapshot at ~20Hz so React stays fast and silky
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updatePlayerMovement(dt: number) {
    const manualFwd = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - this.touchMoveY;
    if (manualFwd < -0.2) this.autoRun = false;
    const fwdInput = this.autoRun && Math.abs(manualFwd) < 0.1 ? 1 : manualFwd;
    const rightInput = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) + this.touchMoveX;
    const sprintHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprint || this.autoRun;

    if (this.activeVehicle) {
      const v = this.activeVehicle;
      const accel = 24;
      if (fwdInput > 0.1 && v.fuel > 0) {
        v.speed = Math.min(28, v.speed + accel * dt);
        v.fuel = Math.max(0, v.fuel - dt * 0.9);
      } else if (fwdInput < -0.1) {
        v.speed = Math.max(-10, v.speed - accel * 1.1 * dt);
      } else {
        v.speed = THREE.MathUtils.damp(v.speed, 0, 3.2, dt);
      }

      if (Math.abs(v.speed) > 0.4) {
        const turnSign = v.speed >= 0 ? 1 : -1;
        v.yaw -= rightInput * 2.1 * dt * turnSign;
      }

      const nx = v.x + Math.sin(v.yaw) * v.speed * dt;
      const nz = v.z + Math.cos(v.yaw) * v.speed * dt;
      const col = this.resolveStaticCollisions(nx, nz, 1.8);
      v.x = col.x;
      v.z = col.z;
      v.y = groundHeightAt(v.x, v.z, this.currentMapId);
      v.rig.root.position.set(v.x, v.y, v.z);
      v.rig.root.rotation.y = v.yaw;
      v.rig.wheels.forEach((w) => (w.rotation.x += v.speed * dt * 1.8));

      this.playerX = v.x;
      this.playerY = v.y + 0.5;
      this.playerZ = v.z;
      this.playerYaw = v.yaw + Math.PI;
      return;
    }

    const len = Math.hypot(fwdInput, rightInput);
    const nf = len > 1 ? fwdInput / len : fwdInput;
    const nr = len > 1 ? rightInput / len : rightInput;

    // Parachute descent
    if (this.stance === 'parachute') {
      const speed = 13.5;
      const vx = (-Math.sin(this.playerYaw) * nf + Math.cos(this.playerYaw) * nr) * speed;
      const vz = (-Math.cos(this.playerYaw) * nf - Math.sin(this.playerYaw) * nr) * speed;
      this.playerX += vx * dt;
      this.playerZ += vz * dt;
      this.playerY -= 8.8 * dt;
      const gy = groundHeightAt(this.playerX, this.playerZ, this.currentMapId);
      if (this.playerY <= gy + 0.1) {
        this.playerY = gy;
        this.stance = 'stand';
        audioEngine.playFootstep(true);
        this.pushBanner('TOUCHDOWN', 'Loot gear & eliminate hostiles', 'blue');
      }
      if (this.playerRig) {
        this.playerRig.parachuteGroup.visible = this.stance === 'parachute';
        this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
        this.playerRig.root.rotation.y = this.playerYaw + Math.PI;
      }
      return;
    }

    // Ground locomotion
    const op = getOperatorById(this.profile.selectedOperatorId);
    const overdrive = op.activeAbility.effectType === 'overdrive' && this.abilityActiveTimer > 0 ? 1.32 : 1;
    const boostMult = this.boost > 45 ? 1.08 : 1.0;

    let baseSpeed = 6.2;
    if (this.stance === 'prone') baseSpeed = 2.4;
    else if (this.stance === 'crouch') baseSpeed = op.id === 'viper' ? 4.4 : 3.8;
    else if (sprintHeld && nf > 0.25 && !this.isAds && this.stamina > 5) {
      baseSpeed = 9.4;
      this.stamina = Math.max(0, this.stamina - dt * 11);
    } else {
      this.stamina = Math.min(100, this.stamina + dt * 16);
    }

    if (this.isAds) baseSpeed *= 0.68;
    if (this.isHealing) baseSpeed *= 0.45;
    baseSpeed *= overdrive * boostMult;

    const dx = (-Math.sin(this.playerYaw) * nf + Math.cos(this.playerYaw) * nr) * baseSpeed * dt;
    const dz = (-Math.cos(this.playerYaw) * nf - Math.sin(this.playerYaw) * nr) * baseSpeed * dt;

    const resolved = this.resolveStaticCollisions(this.playerX + dx, this.playerZ + dz, 0.55);
    this.playerX = resolved.x;
    this.playerZ = resolved.z;

    // Gravity & terrain height
    const gy = groundHeightAt(this.playerX, this.playerZ, this.currentMapId);
    this.playerVelY -= 20 * dt;
    this.playerY += this.playerVelY * dt;
    if (this.playerY <= gy) {
      this.playerY = gy;
      this.playerVelY = 0;
    }

    // Auto-pickup nearby heal/ammo/armor if enabled
    if (this.controls.autoPickup) {
      const near = this.findNearestLoot();
      if (near && (near.type === 'heal' || near.type === 'grenade' || (near.type === 'armor' && (near.armorLevel || 0) > this.armorLevel))) {
        this.collectLoot(near);
      }
    }

    // Animate Player 3D Operator Rig
    if (this.playerRig) {
      this.playerRig.parachuteGroup.visible = false;
      this.playerRig.root.visible = this.perspective === 'TPP';
      this.playerRig.root.position.set(this.playerX, this.playerY, this.playerZ);
      this.playerRig.root.rotation.y = this.playerYaw + Math.PI;
      this.playerRig.shieldAura.visible = this.abilityActiveTimer > 0 && op.activeAbility.effectType === 'shield';

      const moving = len > 0.1;
      if (moving) {
        this.playerAnimTime += dt * (sprintHeld ? 12 : 8);
        this.footstepTimer -= dt;
        if (this.footstepTimer <= 0 && this.playerY <= gy + 0.12) {
          this.footstepTimer = sprintHeld ? 0.34 : 0.48;
          audioEngine.playFootstep(sprintHeld);
        }
      }
      const swing = moving ? Math.sin(this.playerAnimTime) * (sprintHeld ? 0.65 : 0.42) : 0;
      this.playerRig.leftLeg.rotation.x = swing;
      this.playerRig.rightLeg.rotation.x = -swing;

      const targetPivotY = this.stance === 'prone' ? -0.62 : this.stance === 'crouch' ? -0.32 : 0;
      this.playerRig.bodyPivot.position.y = THREE.MathUtils.damp(this.playerRig.bodyPivot.position.y, targetPivotY, 12, dt);
      this.playerRig.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.playerRig.bodyPivot.rotation.x,
        this.stance === 'prone' ? 1.25 : 0,
        10,
        dt
      );
    }
  }

  private updateCamera(dt: number) {
    const zoom = this.getCurrentZoom();
    const targetFov = this.activeVehicle ? 68 : this.isAds ? Math.max(12, 58 / zoom) : 60;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
    this.camera.updateProjectionMatrix();

    const shakeX = (Math.random() - 0.5) * this.cameraShake * 0.25;
    const shakeY = (Math.random() - 0.5) * this.cameraShake * 0.25;

    if (this.activeVehicle) {
      const v = this.activeVehicle;
      const dist = 7.4;
      const camX = v.x - Math.sin(v.yaw) * dist;
      const camZ = v.z - Math.cos(v.yaw) * dist;
      const camY = Math.max(groundHeightAt(camX, camZ, this.currentMapId) + 1.2, v.y + 3.4);
      this.camera.position.lerp(_v1.set(camX + shakeX, camY + shakeY, camZ), 1 - Math.exp(-8 * dt));
      this.camera.lookAt(v.x, v.y + 1.4, v.z);
      return;
    }

    const eyeY = this.playerY + this.getEyeHeight();
    const forwardX = -Math.sin(this.playerYaw) * Math.cos(this.playerPitch);
    const forwardY = Math.sin(this.playerPitch);
    const forwardZ = -Math.cos(this.playerYaw) * Math.cos(this.playerPitch);

    if (this.perspective === 'FPP' || (this.isAds && zoom >= 2)) {
      this.camera.position.set(this.playerX + shakeX, eyeY + shakeY, this.playerZ);
      this.camera.lookAt(
        this.playerX + forwardX * 40,
        eyeY + forwardY * 40,
        this.playerZ + forwardZ * 40
      );
      if (this.playerRig) this.playerRig.root.visible = false;
    } else {
      // Tactical over-the-right-shoulder TPP camera
      const dist = this.stance === 'parachute' ? 6.8 : this.isAds ? 1.85 : 3.5;
      const shoulderOffset = this.stance === 'parachute' ? 0 : 0.62;
      const rightX = Math.cos(this.playerYaw);
      const rightZ = -Math.sin(this.playerYaw);

      let camX = this.playerX - forwardX * dist + rightX * shoulderOffset;
      let camY = eyeY + 0.35 - forwardY * dist;
      let camZ = this.playerZ - forwardZ * dist + rightZ * shoulderOffset;

      const camGround = groundHeightAt(camX, camZ, this.currentMapId) + 0.55;
      if (camY < camGround) camY = camGround;

      this.camera.position.set(camX + shakeX, camY + shakeY, camZ);
      this.camera.lookAt(
        this.playerX + forwardX * 45 + rightX * shoulderOffset * 0.45,
        eyeY + forwardY * 45,
        this.playerZ + forwardZ * 45 + rightZ * shoulderOffset * 0.45
      );
    }
  }

  private updateZone(dt: number) {
    if (this.currentGameMode === 'training') return;

    if (!this.zoneShrinking) {
      this.zoneTimer -= dt;
      if (this.zoneTimer <= 0) {
        this.zoneShrinking = true;
        this.pushBanner(`ZONE PHASE ${this.zonePhase} CLOSING`, 'Move inside the Safe Zone immediately', 'blue');
      }
    } else {
      const shrinkSpeed = 3.2 + this.zonePhase * 0.6;
      this.blueZone.radius = Math.max(this.safeZone.radius, this.blueZone.radius - shrinkSpeed * dt);
      this.blueZone.x = THREE.MathUtils.damp(this.blueZone.x, this.safeZone.x, 0.35, dt);
      this.blueZone.z = THREE.MathUtils.damp(this.blueZone.z, this.safeZone.z, 0.35, dt);

      if (this.blueZone.radius <= this.safeZone.radius + 0.5) {
        this.zoneShrinking = false;
        this.zonePhase = Math.min(6, this.zonePhase + 1);
        this.zoneTimer = Math.max(18, 36 - this.zonePhase * 4);
        this.safeZone = {
          x: this.safeZone.x + (Math.random() - 0.5) * this.safeZone.radius * 0.35,
          z: this.safeZone.z + (Math.random() - 0.5) * this.safeZone.radius * 0.35,
          radius: Math.max(12, this.safeZone.radius * 0.56),
        };
      }
    }

    if (this.blueZoneMesh) {
      this.blueZoneMesh.position.set(this.blueZone.x, 38, this.blueZone.z);
      this.blueZoneMesh.scale.set(this.blueZone.radius, 1, this.blueZone.radius);
    }

    // Blue zone damage tick
    this.blueTickTimer -= dt;
    if (this.blueTickTimer <= 0) {
      this.blueTickTimer = 1.0;
      const distPlayer = Math.hypot(this.playerX - this.blueZone.x, this.playerZ - this.blueZone.z);
      if (distPlayer > this.blueZone.radius) {
        this.applyPlayerDamage(2 + this.zonePhase * 2, this.blueZone.x, this.blueZone.z, 'Blue Zone', 'Blue Zone');
      }
      for (const b of this.bots) {
        if (!b.alive) continue;
        const db = Math.hypot(b.x - this.blueZone.x, b.z - this.blueZone.z);
        if (db > this.blueZone.radius) {
          b.hp -= 3 + this.zonePhase * 2;
          if (b.hp <= 0) this.handleElimination('Blue Zone', b, 'Zone', false, false);
        }
      }
    }

    // Periodic Air Drops
    this.airDropTimer -= dt;
    if (this.airDropTimer <= 0) {
      this.airDropTimer = 42;
      this.spawnAirDrop();
    }
  }

  private updateBots(dt: number) {
    for (const bot of this.bots) {
      if (!bot.alive) continue;

      bot.retargetTimer -= dt;
      bot.fireCooldown -= dt;

      // Find nearest hostile target (player or opposing bot)
      let targetX = this.safeZone.x;
      let targetZ = this.safeZone.z;
      let targetY = groundHeightAt(targetX, targetZ, this.currentMapId);
      let combatDist = Infinity;
      let hasHostileTarget = false;

      if (!bot.isTeammate && this.stance !== 'parachute') {
        const dp = Math.hypot(this.playerX - bot.x, this.playerZ - bot.z);
        if (dp < 72) {
          combatDist = dp;
          targetX = this.playerX;
          targetZ = this.playerZ;
          targetY = this.playerY + 1.1;
          hasHostileTarget = true;
        }
      }

      for (const other of this.bots) {
        if (!other.alive || other.id === bot.id || other.isTeammate === bot.isTeammate) continue;
        const d = Math.hypot(other.x - bot.x, other.z - bot.z);
        if (d < 62 && d < combatDist) {
          combatDist = d;
          targetX = other.x;
          targetZ = other.z;
          targetY = other.y + 1.1;
          hasHostileTarget = true;
        }
      }

      // Movement logic: stay inside safe zone, follow player if teammate, strafe in combat
      const distToSafe = Math.hypot(bot.x - this.safeZone.x, bot.z - this.safeZone.z);
      if (distToSafe > this.safeZone.radius - 6) {
        bot.targetX = this.safeZone.x + (Math.random() - 0.5) * 16;
        bot.targetZ = this.safeZone.z + (Math.random() - 0.5) * 16;
      } else if (bot.isTeammate && !hasHostileTarget) {
        const distToPlayer = Math.hypot(this.playerX - bot.x, this.playerZ - bot.z);
        if (distToPlayer > 14) {
          bot.targetX = this.playerX + (Math.random() - 0.5) * 8;
          bot.targetZ = this.playerZ + (Math.random() - 0.5) * 8;
        }
      } else if (bot.retargetTimer <= 0) {
        bot.retargetTimer = 2.5 + Math.random() * 3.5;
        bot.strafeDir = Math.random() > 0.5 ? 1 : -1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * Math.max(14, this.safeZone.radius * 0.78);
        bot.targetX = this.safeZone.x + Math.cos(a) * r;
        bot.targetZ = this.safeZone.z + Math.sin(a) * r;
      }

      let moveX = 0;
      let moveZ = 0;
      if (hasHostileTarget && combatDist < 42) {
        // Aim at target and strafe
        const desiredYaw = Math.atan2(targetX - bot.x, targetZ - bot.z);
        bot.yaw = desiredYaw;
        const strafeAngle = desiredYaw + (Math.PI / 2) * bot.strafeDir;
        moveX = Math.sin(strafeAngle) * 3.6;
        moveZ = Math.cos(strafeAngle) * 3.6;

        // Shoot with tactical burst cadence
        if (bot.fireCooldown <= 0 && this.currentGameMode !== 'training') {
          const wDef = getWeaponById(bot.weaponId);
          bot.fireCooldown = 0.42 + (1 - bot.skill) * 0.9;

          const origin = _v1.set(bot.x, bot.y + 1.48, bot.z);
          const dir = _v2.set(targetX - bot.x, targetY - (bot.y + 1.48), targetZ - bot.z).normalize();
          const spread = (1 - bot.skill) * 0.14 + 0.03;
          dir.x += (Math.random() - 0.5) * spread;
          dir.y += (Math.random() - 0.5) * spread * 0.6;
          dir.z += (Math.random() - 0.5) * spread;
          dir.normalize();

          const distToPlayer = Math.hypot(bot.x - this.playerX, bot.z - this.playerZ);
          if (distToPlayer < 85) {
            audioEngine.playGunshot(wDef.category, false, Math.max(0.08, 1 - distToPlayer / 90) * 0.45);
          }
          this.traceShot(origin, dir, wDef.damage, 1.3, 85, bot, wDef.name);
        }
      } else {
        const dx = bot.targetX - bot.x;
        const dz = bot.targetZ - bot.z;
        const d = Math.hypot(dx, dz);
        if (d > 2.2) {
          const spd = 4.9;
          moveX = (dx / d) * spd;
          moveZ = (dz / d) * spd;
          bot.yaw = Math.atan2(dx, dz);
        }
      }

      const res = this.resolveStaticCollisions(bot.x + moveX * dt, bot.z + moveZ * dt, 0.55);
      bot.x = res.x;
      bot.z = res.z;
      bot.y = groundHeightAt(bot.x, bot.z, this.currentMapId);

      bot.rig.root.position.set(bot.x, bot.y, bot.z);
      bot.rig.root.rotation.y = bot.yaw;

      const moving = Math.hypot(moveX, moveZ) > 0.5;
      if (moving) {
        bot.animTime += dt * 8.5;
        const sw = Math.sin(bot.animTime) * 0.48;
        bot.rig.leftLeg.rotation.x = sw;
        bot.rig.rightLeg.rotation.x = -sw;
      }

      // Highlight bot if Viper Threat Scan active
      const op = getOperatorById(this.profile.selectedOperatorId);
      const scanned = !bot.isTeammate && this.abilityActiveTimer > 0 && op.activeAbility.effectType === 'scan';
      bot.rig.shieldAura.visible = scanned || bot.hitFlashTimer > 0;
      if (bot.hitFlashTimer > 0) bot.hitFlashTimer -= dt;
    }
  }

  private updateTrainingTargets(dt: number, elapsed: number) {
    if (!this.world?.trainingTargets.length) return;
    for (const t of this.world.trainingTargets) {
      if (t.respawnTimer > 0) {
        t.respawnTimer -= dt;
        if (t.respawnTimer <= 0) {
          t.hp = t.maxHp;
          t.mesh.rotation.x = 0;
        }
        continue;
      }
      if (t.patrolRange > 0) {
        const nx = t.baseX + Math.sin(elapsed * t.speed + t.phase) * t.patrolRange;
        t.mesh.position.x = nx;
        t.mesh.position.y = groundHeightAt(nx, t.baseZ, this.currentMapId);
      }
    }
  }

  private updateLootAndAirDrops(dt: number, elapsed: number) {
    for (const l of this.lootDrops) {
      if (l.collected) continue;
      if (l.isAirDrop && l.dropVelocityY) {
        const gy = groundHeightAt(l.x, l.z, this.currentMapId);
        if (l.y > gy) {
          l.y = Math.max(gy, l.y + l.dropVelocityY * dt);
          l.mesh.position.y = l.y;
        } else {
          l.dropVelocityY = 0;
        }
      } else {
        l.mesh.rotation.y = elapsed * 1.1;
      }
    }
  }

  private updateGrenades(dt: number) {
    if (!this.matchGroup) return;
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vy -= 18 * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;
      const gy = groundHeightAt(g.x, g.z, this.currentMapId) + 0.14;
      if (g.y <= gy) {
        g.y = gy;
        g.vy *= -0.35;
        g.vx *= 0.65;
        g.vz *= 0.65;
      }
      g.mesh.position.set(g.x, g.y, g.z);
      g.fuse -= dt;

      if (g.fuse <= 0) {
        this.matchGroup.remove(g.mesh);
        g.mesh.geometry.dispose();
        (g.mesh.material as THREE.Material).dispose();
        this.grenades.splice(i, 1);

        if (g.type === 'frag') {
          audioEngine.playExplosion();
          this.cameraShake = Math.min(0.45, this.cameraShake + 0.25);
          this.spawnImpactParticles(_v1.set(g.x, g.y + 0.4, g.z), 0xf97316, 20, false);
          this.spawnImpactParticles(_v1.set(g.x, g.y + 0.8, g.z), 0x475569, 8, true);

          // Blast radius damage to bots
          for (const b of this.bots) {
            if (!b.alive) continue;
            const d = Math.hypot(b.x - g.x, b.z - g.z);
            if (d < 10.5) {
              const dmg = Math.round((1 - d / 10.5) * 145);
              b.hp -= dmg;
              this.damageDealt += dmg;
              this.triggerHitMarker(false, b.hp <= 0);
              if (b.hp <= 0) this.handleElimination(this.profile.name, b, 'M67 Frag', false, true);
            }
          }
          const dp = Math.hypot(this.playerX - g.x, this.playerZ - g.z);
          if (dp < 8.5) {
            this.applyPlayerDamage(Math.round((1 - dp / 8.5) * 80), g.x, g.z, 'Frag Blast', 'Frag Grenade');
          }
        } else {
          // Dense tactical smoke cloud
          this.spawnImpactParticles(_v1.set(g.x, g.y + 0.8, g.z), 0xcbd5e1, 18, true);
          this.pushBanner('SMOKE COVER DEPLOYED', 'Line of sight obscured', 'blue');
        }
      }
    }
  }

  private updateVisualEffects(dt: number) {
    if (!this.matchGroup) return;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      (tr.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, tr.life / tr.maxLife);
      if (tr.life <= 0) {
        this.matchGroup.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.scaleRate > 0) {
        p.mesh.scale.addScalar(p.scaleRate * dt);
        p.vx *= 0.96;
        p.vz *= 0.96;
        p.vy *= 0.95;
      } else {
        p.vy -= 14 * dt;
      }
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, (p.life / p.maxLife) * (p.scaleRate > 0 ? 0.5 : 0.95));

      if (p.life <= 0) {
        this.matchGroup.remove(p.mesh);
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  private emitHud() {
    if (this.mode !== 'match') return;

    const aliveEnemies = this.bots.filter((b) => b.alive && !b.isTeammate).length;
    const aliveAllies = this.bots.filter((b) => b.alive && b.isTeammate).length;
    const op = getOperatorById(this.profile.selectedOperatorId);
    const scanActive = this.abilityActiveTimer > 0 && op.activeAbility.effectType === 'scan';

    // Nearby prompt (Vehicle > Loot)
    let nearbyPrompt: NearbyLootPrompt | null = null;
    if (this.activeVehicle) {
      nearbyPrompt = {
        id: this.activeVehicle.id,
        label: 'Exit Tactical Buggy',
        sublabel: 'Press [E] to dismount',
        rarity: 'rare',
        type: 'vehicle',
      };
    } else {
      for (const v of this.vehicles) {
        if (Math.hypot(v.x - this.playerX, v.z - this.playerZ) < 4.5) {
          nearbyPrompt = {
            id: v.id,
            label: 'Drive Tactical Buggy',
            sublabel: `Fuel ${Math.round(v.fuel)}% · Press [E]`,
            rarity: 'rare',
            type: 'vehicle',
          };
          break;
        }
      }
      if (!nearbyPrompt) {
        const near = this.findNearestLoot();
        if (near) {
          nearbyPrompt = {
            id: near.id,
            label: near.label,
            sublabel: `${near.sublabel} · Press [E]`,
            rarity: near.rarity,
            type: near.type,
          };
        }
      }
    }

    const teammates: TeammateState[] = this.bots
      .filter((b) => b.isTeammate)
      .map((b, i) => ({
        id: b.id,
        name: b.name,
        hp: Math.max(0, Math.round(b.hp)),
        maxHp: b.maxHp,
        armor: b.armor,
        knocked: false,
        alive: b.alive,
        x: b.x,
        z: b.z,
        color: ['#38BDF8', '#10B981', '#F59E0B'][i % 3],
      }));

    const entities: MinimapEntity[] = [];
    this.bots.forEach((b) => {
      if (!b.alive) return;
      if (b.isTeammate) {
        entities.push({ id: b.id, type: 'teammate', x: b.x, z: b.z, color: '#38BDF8', label: b.name });
      } else if (scanActive || this.currentGameMode === 'training' || Math.hypot(b.x - this.playerX, b.z - this.playerZ) < 35) {
        entities.push({ id: b.id, type: 'bot', x: b.x, z: b.z, color: '#EF4444' });
      }
    });
    this.vehicles.forEach((v) => {
      entities.push({ id: v.id, type: 'vehicle', x: v.x, z: v.z });
    });
    this.lootDrops.forEach((l) => {
      if (!l.collected && l.isAirDrop) {
        entities.push({ id: l.id, type: 'airdrop', x: l.x, z: l.z });
      }
    });

    const backpackUsed = Math.round(this.inventory.reduce((acc, it) => acc + it.count * it.weight, 0));

    const snapshot: MatchHudSnapshot = {
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      armor: Math.round(this.armor),
      maxArmor: this.maxArmor,
      armorLevel: this.armorLevel,
      helmetLevel: this.helmetLevel,
      boost: Math.round(this.boost),
      stamina: Math.round(this.stamina),
      aliveCount: 1 + aliveEnemies + aliveAllies,
      totalCount: this.totalCombatants,
      kills: this.kills,
      assists: this.assists,
      damageDealt: this.damageDealt,
      headshots: this.headshots,
      matchTime: Math.floor(this.matchTime),
      zonePhase: this.zonePhase,
      zoneTimer: Math.max(0, Math.ceil(this.zoneTimer)),
      zoneShrinking: this.zoneShrinking,
      inBlueZone: Math.hypot(this.playerX - this.blueZone.x, this.playerZ - this.blueZone.z) > this.blueZone.radius,
      safeZone: { ...this.safeZone },
      blueZone: { ...this.blueZone },
      playerPos: { x: this.playerX, y: this.playerY, z: this.playerZ },
      playerYaw: this.playerYaw,
      speedKmh: this.activeVehicle ? Math.abs(Math.round(this.activeVehicle.speed * 3.6)) : 0,
      stance: this.stance,
      altitude: Math.max(0, Math.round(this.playerY - groundHeightAt(this.playerX, this.playerZ, this.currentMapId))),
      perspective: this.perspective,
      isAds: this.isAds,
      activeZoom: this.getCurrentZoom(),
      fireMode: this.fireMode,
      autoRun: this.autoRun,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? Math.min(1, this.reloadElapsed / this.reloadDuration) : 0,
      isHealing: this.isHealing,
      healProgress: this.isHealing ? Math.min(1, this.healElapsed / this.healDuration) : 0,
      healLabel: this.healType === 'medkit' ? 'Applying Medkit' : this.healType === 'bandage' ? 'Wrapping Bandage' : 'Drinking Energy Stim',
      abilityCooldown: Math.ceil(this.abilityCooldown),
      abilityMaxCooldown: op.activeAbility.cooldown,
      abilityActive: this.abilityActiveTimer > 0,
      activeSlot: this.activeSlot,
      slots: [
        { ...this.slots[0], attachments: { ...this.slots[0].attachments } },
        this.slots[1] ? { ...this.slots[1], attachments: { ...this.slots[1].attachments } } : null,
      ],
      reserveAmmo: { ...this.reserveAmmo },
      medkits: this.medkits,
      bandages: this.bandages,
      energyDrinks: this.energyDrinks,
      frags: this.frags,
      smokes: this.smokes,
      inVehicle: Boolean(this.activeVehicle),
      vehicleHp: this.activeVehicle ? Math.round((this.activeVehicle.hp / this.activeVehicle.maxHp) * 100) : 0,
      vehicleFuel: this.activeVehicle ? Math.round(this.activeVehicle.fuel) : 0,
      nearbyPrompt,
      crosshairSpread: this.isAds ? 4 : this.isFiring ? 24 : 13,
      hitMarker: { ...this.hitMarker },
      damageIndicatorAngle: this.damageIndicatorAngle,
      damageIndicatorAlpha: this.damageIndicatorAlpha,
      bannerAlert: this.bannerAlert,
      killFeed: [...this.killFeed],
      teammates,
      entities,
      mapPing: this.mapPing,
      fps: Math.round(this.fpsSmooth),
      pingMs: 24 + Math.floor(Math.sin(this.matchTime * 0.7) * 6),
      pointerLocked: this.pointerLocked,
      paused: this.paused,
      spectatingTarget: null,
      inventory: [...this.inventory],
      backpackCapacity: 320,
      backpackUsed,
      sbmmLobbyTier: this.activeSbmmTier,
    };

    this.callbacks.onHudUpdate(snapshot);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync && gl.deleteSync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    if (rawDt > 0.001) {
      this.fpsSmooth = THREE.MathUtils.lerp(this.fpsSmooth, Math.min(this.graphics.fpsCap, 1 / rawDt), 0.12);
    }

    const elapsed = now * 0.001;
    if (this.mode === 'match') {
      this.updateMatch(dt, elapsed);
    } else {
      this.updateLobby(dt, elapsed);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.exitPointerLock();
    audioEngine.stopAmbient();

    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('blur', this.onBlurBound);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDownBound);
    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDownBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenuBound);

    this.clearMatchScene();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
