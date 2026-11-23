export type GameScreen = 'splash' | 'login' | 'lobby' | 'matchmaking' | 'loading' | 'playing' | 'results';

export type LobbyModal =
  | null
  | 'armory'
  | 'characters'
  | 'inventory'
  | 'store'
  | 'battlepass'
  | 'missions'
  | 'progression'
  | 'ranked'
  | 'modes'
  | 'social'
  | 'settings'
  | 'mail'
  | 'events';

export type GameModeId = 'classic' | 'ranked' | 'tdm' | 'arena4v4' | 'sniper' | 'training' | 'custom';
export type SquadSize = 'solo' | 'duo' | 'squad';
export type PerspectiveMode = 'TPP' | 'FPP';
export type MapId = 'aethelgard' | 'sirocco' | 'frostbite' | 'obsidian';
export type WeatherType = 'clear' | 'fog' | 'rain' | 'storm';
export type TimeOfDay = 'day' | 'sunset' | 'night';

export type GraphicsPresetId = 'smooth' | 'balanced' | 'hd' | 'ultra' | 'extreme' | 'custom';
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface GraphicsSettings {
  preset: GraphicsPresetId;
  fpsCap: 30 | 40 | 60 | 90 | 120;
  resolutionScale: number;
  textureQuality: QualityLevel;
  shadowQuality: QualityLevel;
  antiAliasing: boolean;
  effectsQuality: QualityLevel;
  viewDistance: QualityLevel;
  foliageQuality: QualityLevel;
  motionBlur: boolean;
  bloom: boolean;
  hdr: boolean;
  ambientOcclusion: boolean;
  reflections: boolean;
  dynamicShadows: boolean;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
}

export interface ControlSettings {
  cameraSensitivity: number;
  adsSensitivity: number;
  scope2xSensitivity: number;
  scope4xSensitivity: number;
  scope8xSensitivity: number;
  gyroscopeEnabled: boolean;
  gyroscopeSensitivity: number;
  aimAssist: boolean;
  leftHanded: boolean;
  autoPickup: boolean;
  showTouchControls: boolean;
}

export interface AudioSettings {
  master: number;
  sfx: number;
  music: number;
  ambient: number;
  voice: number;
  muted: boolean;
}

export interface HudElementConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

export interface HudLayoutPreset {
  id: string;
  name: string;
  elements: Record<string, HudElementConfig>;
}

export type WeaponCategory = 'AR' | 'SMG' | 'SNIPER' | 'DMR' | 'SHOTGUN';
export type FireMode = 'AUTO' | 'BURST' | 'SINGLE';
export type AttachmentSlot = 'scope' | 'muzzle' | 'grip' | 'magazine' | 'stock';

export interface AttachmentDef {
  id: string;
  name: string;
  slot: AttachmentSlot;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  zoom?: number;
  recoilMult?: number;
  accuracyBonus?: number;
  rangeBonus?: number;
  magBonus?: number;
  reloadMult?: number;
  suppressed?: boolean;
  description: string;
}

export interface WeaponDef {
  id: string;
  name: string;
  code: string;
  category: WeaponCategory;
  ammoType: '5.56mm' | '7.62mm' | '9mm' | '.300 Mag' | '12 Gauge';
  damage: number;
  headshotMult: number;
  fireRate: number;
  range: number;
  accuracy: number;
  recoil: number;
  magSize: number;
  reloadTime: number;
  bulletSpeed: number;
  weight: number;
  fireModes: FireMode[];
  pellets?: number;
  bodyColor: string;
  accentColor: string;
  description: string;
}

export interface WeaponSkinDef {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  primaryColor: string;
  secondaryColor: string;
  emissiveColor: string;
  metalness: number;
  roughness: number;
  priceGold?: number;
  priceVex?: number;
  killEffect: string;
}

export interface OperatorDef {
  id: string;
  name: string;
  codename: string;
  role: string;
  gender: 'Male' | 'Female';
  level: number;
  activeAbility: {
    name: string;
    description: string;
    cooldown: number;
    effectType: 'scan' | 'overdrive' | 'heal' | 'shield';
  };
  passiveAbility: {
    name: string;
    description: string;
  };
  armorColor: string;
  suitColor: string;
  accentColor: string;
  visorColor: string;
  skinTone: string;
  hairColor: string;
  priceGold: number;
}

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  sizeLabel: string;
  maxPlayers: number;
  biome: 'temperate' | 'desert' | 'arctic' | 'urban';
  groundColor: string;
  groundSecondary: string;
  rockColor: string;
  foliageColor: string;
  waterColor: string;
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  sunColor: string;
  defaultWeather: WeatherType;
  pois: Array<{ name: string; x: number; z: number; lootTier: 'High' | 'Medium' | 'Military' }>;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'medkit' | 'bandage' | 'energy' | 'frag' | 'smoke' | 'ammo' | 'attachment';
  count: number;
  weight: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description: string;
  attachmentId?: string;
  ammoType?: WeaponDef['ammoType'];
}

export interface PlayerLoadoutSlot {
  weaponId: string;
  ammoInMag: number;
  skinId: string;
  attachments: Partial<Record<AttachmentSlot, string>>;
}

export interface KillFeedEntry {
  id: string;
  killer: string;
  victim: string;
  weapon: string;
  isHeadshot: boolean;
  isPlayerInvolved: boolean;
  timestamp: number;
}

export interface TeammateState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  knocked: boolean;
  alive: boolean;
  x: number;
  z: number;
  color: string;
}

export interface MinimapEntity {
  id: string;
  type: 'bot' | 'teammate' | 'loot' | 'airdrop' | 'vehicle';
  x: number;
  z: number;
  alive?: boolean;
  color?: string;
  label?: string;
}

export interface NearbyLootPrompt {
  id: string;
  label: string;
  sublabel: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'weapon' | 'armor' | 'helmet' | 'heal' | 'grenade' | 'attachment' | 'vehicle' | 'airdrop';
}

export interface MatchHudSnapshot {
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  armorLevel: number;
  helmetLevel: number;
  boost: number;
  stamina: number;
  aliveCount: number;
  totalCount: number;
  kills: number;
  assists: number;
  damageDealt: number;
  headshots: number;
  matchTime: number;
  zonePhase: number;
  zoneTimer: number;
  zoneShrinking: boolean;
  inBlueZone: boolean;
  safeZone: { x: number; z: number; radius: number };
  blueZone: { x: number; z: number; radius: number };
  playerPos: { x: number; y: number; z: number };
  playerYaw: number;
  speedKmh: number;
  stance: 'stand' | 'crouch' | 'prone' | 'parachute' | 'vehicle';
  altitude: number;
  perspective: PerspectiveMode;
  isAds: boolean;
  activeZoom: number;
  fireMode: FireMode;
  autoRun: boolean;
  isReloading: boolean;
  reloadProgress: number;
  isHealing: boolean;
  healProgress: number;
  healLabel: string;
  abilityCooldown: number;
  abilityMaxCooldown: number;
  abilityActive: boolean;
  activeSlot: 0 | 1 | 2;
  slots: [PlayerLoadoutSlot, PlayerLoadoutSlot | null];
  reserveAmmo: Record<string, number>;
  medkits: number;
  bandages: number;
  energyDrinks: number;
  frags: number;
  smokes: number;
  inVehicle: boolean;
  vehicleHp: number;
  vehicleFuel: number;
  nearbyPrompt: NearbyLootPrompt | null;
  crosshairSpread: number;
  hitMarker: { active: boolean; headshot: boolean; kill: boolean; time: number };
  damageIndicatorAngle: number | null;
  damageIndicatorAlpha: number;
  bannerAlert: { text: string; subtext?: string; tone: 'crimson' | 'blue' | 'gold'; id: number } | null;
  killFeed: KillFeedEntry[];
  teammates: TeammateState[];
  entities: MinimapEntity[];
  mapPing: { x: number; z: number } | null;
  fps: number;
  pingMs: number;
  pointerLocked: boolean;
  paused: boolean;
  spectatingTarget: string | null;
  inventory: InventoryItem[];
  backpackCapacity: number;
  backpackUsed: number;
  sbmmLobbyTier: string;
}

export interface MatchResultSummary {
  victory: boolean;
  placement: number;
  totalPlayers: number;
  kills: number;
  assists: number;
  damageDealt: number;
  headshots: number;
  survivalTime: number;
  mode: GameModeId;
  mapId: MapId;
  xpEarned: number;
  goldEarned: number;
  rpDelta: number;
  mmrDelta: number;
  bpXpEarned: number;
  sbmmTierLabel: string;
}

export interface MatchHistoryRecord {
  id: string;
  dateLabel: string;
  mode: GameModeId;
  mapId: MapId;
  placement: number;
  totalPlayers: number;
  kills: number;
  damage: number;
  headshots: number;
  rpDelta: number;
  victory: boolean;
}

export interface ProgressionMilestone {
  id: string;
  title: string;
  description: string;
  category: 'level' | 'combat' | 'rank';
  metric: 'level' | 'kills' | 'wins' | 'headshots' | 'damage' | 'rankPoints';
  target: number;
  rewardLabel: string;
  rewardGold?: number;
  rewardVex?: number;
  rewardSkinId?: string;
  rewardOutfitColor?: string;
  rewardTitle?: string;
}

export interface SbmmAssessment {
  mmr: number;
  tierName: 'Recruit' | 'Tactical' | 'Veteran' | 'Elite' | 'Apex Legend';
  tierColor: string;
  kdRatio: number;
  winRatePct: number;
  avgDamage: number;
  headshotPct: number;
  strictnessLabel: string;
  bracketMin: number;
  bracketMax: number;
  botSkillMean: number;
  botSkillSpread: number;
  estimatedQueueSec: number;
}

export interface MissionDef {
  id: string;
  title: string;
  category: 'daily' | 'weekly' | 'achievement';
  target: number;
  progress: number;
  rewardGold: number;
  rewardBpXp: number;
  claimed: boolean;
  metric: 'kills' | 'matches' | 'damage' | 'wins' | 'headshots';
}

export interface StoreItemDef {
  id: string;
  name: string;
  category: 'outfit' | 'weapon_skin' | 'vehicle_skin' | 'parachute' | 'emote' | 'bundle';
  rarity: 'rare' | 'epic' | 'legendary';
  priceGold: number;
  priceVex: number;
  accentColor: string;
  secondaryColor: string;
  description: string;
  weaponSkinId?: string;
  operatorOutfitColor?: string;
}

export interface MailMessage {
  id: string;
  title: string;
  sender: string;
  date: string;
  body: string;
  rewardGold?: number;
  rewardVex?: number;
  claimed: boolean;
}

export interface PlayerProfile {
  name: string;
  playerId: string;
  authProvider: 'guest' | 'email' | 'google' | 'apple';
  equippedTitle: string;
  unlockedTitles: string[];
  level: number;
  xp: number;
  rankPoints: number;
  mmr: number;
  gold: number;
  vexCoins: number;
  battlePassLevel: number;
  battlePassXp: number;
  battlePassPremium: boolean;
  claimedBpFree: number[];
  claimedBpPremium: number[];
  claimedMilestoneIds: string[];
  claimedRankRewards: string[];
  weaponLevels: Record<string, number>;
  selectedOperatorId: string;
  selectedWeaponId: string;
  selectedSecondaryId: string;
  selectedWeaponSkins: Record<string, string>;
  selectedAttachments: Record<string, Partial<Record<AttachmentSlot, string>>>;
  operatorOutfitTint: Record<string, string>;
  operatorVisorTint: Record<string, string>;
  ownedStoreItems: string[];
  ownedSkinIds: string[];
  ownedOperatorIds: string[];
  stats: {
    matches: number;
    wins: number;
    kills: number;
    headshots: number;
    damage: number;
  };
  matchHistory: MatchHistoryRecord[];
  missions: MissionDef[];
  mail: MailMessage[];
  dailyRewardDay: number;
  dailyRewardClaimedToday: boolean;
  clanName: string;
  clanTag: string;
  language: string;
  colorblindMode: 'none' | 'protanopia' | 'deuteranopia';
}
