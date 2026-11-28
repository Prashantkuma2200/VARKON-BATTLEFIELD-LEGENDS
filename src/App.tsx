import { useCallback, useEffect, useRef, useState } from 'react';
import { ArmoryModal } from './components/ArmoryModal';
import { AuthenticatedAccount, AuthFlow } from './components/AuthFlow';
import { CharactersModal } from './components/CharactersModal';
import { EsportsReplayModal } from './components/EsportsReplayModal';
import { FullMapModal } from './components/FullMapModal';
import { InGameHUD } from './components/InGameHUD';
import { InventoryModal } from './components/InventoryModal';
import { LobbyUI } from './components/LobbyUI';
import { MailModal } from './components/MailModal';
import { MatchResultsModal } from './components/MatchResultsModal';
import { ProgressionRankedModal } from './components/ProgressionRankedModal';
import { SettingsModal } from './components/SettingsModal';
import { SocialClanModal } from './components/SocialClanModal';
import { StoreBattlePassModal } from './components/StoreBattlePassModal';
import { VehiclesModal } from './components/VehiclesModal';
import { audioEngine } from './game/audio';
import {
  BATTLE_PASS_TIERS,
  BOT_DIFFICULTIES,
  DEFAULT_AUDIO,
  DEFAULT_CONTROLS,
  DEFAULT_HUD_PRESETS,
  detectOptimalGraphics,
  getMapById,
  getWeaponById,
  INITIAL_PROFILE,
  OPERATORS,
  RANK_TIERS,
} from './game/data';
import { VexoraEngine } from './game/engine';
import { evaluateSbmm, PROGRESSION_MILESTONES, XP_FOR_LEVEL } from './game/sbmm';
import {
  AttachmentSlot,
  AudioSettings,
  BotDifficulty,
  CharacterCustomization,
  CharacterPoseId,
  ControlSettings,
  CustomRoomConfig,
  GameModeId,
  GameScreen,
  GraphicsSettings,
  HudLayoutPreset,
  LobbyModal,
  MapId,
  MatchHistoryRecord,
  MatchHudSnapshot,
  MatchResultSummary,
  PerspectiveMode,
  PlayerProfile,
  SquadSize,
  StoreItemDef,
  TimeOfDay,
  WeatherType,
} from './game/types';

const STORAGE_KEY_PROFILE = 'varkon_profile_v2';
const LEGACY_KEY_PROFILE = 'vexora_profile_v1';
const STORAGE_KEY_HUD = 'varkon_hud_presets_v1';
const STORAGE_KEY_SESSION = 'varkon_session_active';

function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE) || localStorage.getItem(LEGACY_KEY_PROFILE);
    if (!raw) return INITIAL_PROFILE;
    const parsed = JSON.parse(raw);
    const validOpIds = new Set(OPERATORS.map((o) => o.id));
    const mergedOwnedOps = Array.from(
      new Set([
        ...INITIAL_PROFILE.ownedOperatorIds,
        ...(Array.isArray(parsed.ownedOperatorIds)
          ? parsed.ownedOperatorIds.filter((id: string) => validOpIds.has(id))
          : []),
      ])
    );
    const resolvedSelectedOp =
      typeof parsed.selectedOperatorId === 'string' && validOpIds.has(parsed.selectedOperatorId)
        ? parsed.selectedOperatorId
        : INITIAL_PROFILE.selectedOperatorId;
    const mergedOwnedWeapons = Array.from(
      new Set([
        ...(INITIAL_PROFILE.ownedWeaponIds || []),
        ...(Array.isArray(parsed.ownedWeaponIds) ? parsed.ownedWeaponIds : []),
      ])
    );
    return {
      ...INITIAL_PROFILE,
      ...parsed,
      selectedOperatorId: resolvedSelectedOp,
      ownedOperatorIds: mergedOwnedOps,
      ownedWeaponIds: mergedOwnedWeapons,
      selectedPistolId: parsed.selectedPistolId || INITIAL_PROFILE.selectedPistolId,
      selectedMeleeId: parsed.selectedMeleeId || INITIAL_PROFILE.selectedMeleeId,
      selectedGrenadeId: parsed.selectedGrenadeId || INITIAL_PROFILE.selectedGrenadeId,
      selectedTacticalId: parsed.selectedTacticalId || INITIAL_PROFILE.selectedTacticalId,
      selectedWeaponCharms: {
        ...(INITIAL_PROFILE.selectedWeaponCharms || {}),
        ...(parsed.selectedWeaponCharms || {}),
      },
      characterCustomizations: {
        ...(INITIAL_PROFILE.characterCustomizations || {}),
        ...(parsed.characterCustomizations || {}),
      },
      stats: { ...INITIAL_PROFILE.stats, ...(parsed.stats || {}) },
      missions: Array.isArray(parsed.missions) && parsed.missions.length ? parsed.missions : INITIAL_PROFILE.missions,
      mail: Array.isArray(parsed.mail) && parsed.mail.length ? parsed.mail : INITIAL_PROFILE.mail,
      matchHistory:
        Array.isArray(parsed.matchHistory) && parsed.matchHistory.length
          ? parsed.matchHistory
          : INITIAL_PROFILE.matchHistory,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : INITIAL_PROFILE.transactions,
      registeredTournaments: Array.isArray(parsed.registeredTournaments)
        ? parsed.registeredTournaments
        : INITIAL_PROFILE.registeredTournaments,
      savedHighlightIds: Array.isArray(parsed.savedHighlightIds)
        ? parsed.savedHighlightIds
        : INITIAL_PROFILE.savedHighlightIds,
      weaponLevels: { ...INITIAL_PROFILE.weaponLevels, ...(parsed.weaponLevels || {}) },
      claimedMilestoneIds: Array.isArray(parsed.claimedMilestoneIds) ? parsed.claimedMilestoneIds : [],
      claimedRankRewards: Array.isArray(parsed.claimedRankRewards)
        ? parsed.claimedRankRewards
        : INITIAL_PROFILE.claimedRankRewards,
      unlockedTitles:
        Array.isArray(parsed.unlockedTitles) && parsed.unlockedTitles.length
          ? parsed.unlockedTitles
          : INITIAL_PROFILE.unlockedTitles,
    };
  } catch {
    return INITIAL_PROFILE;
  }
}

function loadHudPresets(): HudLayoutPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HUD);
    if (!raw) return DEFAULT_HUD_PRESETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_HUD_PRESETS;
  } catch {
    return DEFAULT_HUD_PRESETS;
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VexoraEngine | null>(null);
  const launchTimersRef = useRef<number[]>([]);

  const [screen, setScreen] = useState<GameScreen>('splash');
  const [lobbyModal, setLobbyModal] = useState<LobbyModal>(null);
  const [profile, setProfile] = useState<PlayerProfile>(loadProfile);
  const [graphics, setGraphics] = useState<GraphicsSettings>(detectOptimalGraphics);
  const [controls, setControls] = useState<ControlSettings>(DEFAULT_CONTROLS);
  const [audio, setAudio] = useState<AudioSettings>(DEFAULT_AUDIO);
  const [hudPresets, setHudPresets] = useState<HudLayoutPreset[]>(loadHudPresets);
  const [activeHudPresetId, setActiveHudPresetId] = useState<string>(DEFAULT_HUD_PRESETS[0].id);

  // Matchmaking selections
  const [gameMode, setGameMode] = useState<GameModeId>('classic');
  const [squadSize, setSquadSize] = useState<SquadSize>('squad');
  const [mapId, setMapId] = useState<MapId>('aethelgard');
  const [perspective, setPerspective] = useState<PerspectiveMode>('TPP');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('normal');
  const [invitedFriends, setInvitedFriends] = useState<string[]>(['f1']);

  // Live Match state
  const [hud, setHud] = useState<MatchHudSnapshot | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultSummary | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [invModalOpen, setInvModalOpen] = useState(false);
  const [matchSettingsOpen, setMatchSettingsOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [queueSeconds, setQueueSeconds] = useState(0);

  // Persist profile & HUD presets
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch {
      // ignore storage quota
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HUD, JSON.stringify(hudPresets));
    } catch {
      // ignore
    }
  }, [hudPresets]);

  // Sync audio engine
  useEffect(() => {
    audioEngine.updateSettings(audio);
  }, [audio]);

  const clearLaunchTimers = useCallback(() => {
    launchTimersRef.current.forEach((id) => window.clearTimeout(id));
    launchTimersRef.current = [];
  }, []);

  useEffect(() => () => clearLaunchTimers(), [clearLaunchTimers]);

  // Matchmaking elapsed counter
  useEffect(() => {
    if (screen !== 'matchmaking') {
      setQueueSeconds(0);
      return;
    }
    const id = window.setInterval(() => setQueueSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [screen]);

  const handleMatchEnd = useCallback((result: MatchResultSummary) => {
    setMatchResult(result);
    setMapModalOpen(false);
    setInvModalOpen(false);
    setMatchSettingsOpen(false);
    setScreen('results');

    setProfile((prev) => {
      let nextLevel = prev.level;
      let remXp = prev.xp + result.xpEarned;
      while (remXp >= XP_FOR_LEVEL(nextLevel)) {
        remXp -= XP_FOR_LEVEL(nextLevel);
        nextLevel += 1;
      }

      const nextBpXp = prev.battlePassXp + result.bpXpEarned;
      const bpUp = Math.floor(nextBpXp / 500);

      const updatedMissions = prev.missions.map((m) => {
        if (m.claimed) return m;
        let inc = 0;
        if (m.metric === 'kills') inc = result.kills;
        else if (m.metric === 'matches') inc = 1;
        else if (m.metric === 'damage') inc = result.damageDealt;
        else if (m.metric === 'headshots') inc = result.headshots;
        else if (m.metric === 'wins' && result.victory) inc = 1;
        return { ...m, progress: Math.min(m.target, m.progress + inc) };
      });

      const primaryWeapon = getWeaponById(prev.selectedWeaponId).name;
      const dur = Math.max(30, result.survivalTime);
      const replayEvents: MatchHistoryRecord['events'] = [
        {
          timeSec: Math.max(12, Math.round(dur * 0.2)),
          type: 'elimination',
          label: 'Opening Engagement',
          detail: `${result.kills} total eliminations · ${result.damageDealt} total damage`,
          weapon: primaryWeapon,
          distanceM: 44,
        },
        ...(result.headshots > 0
          ? [
              {
                timeSec: Math.max(24, Math.round(dur * 0.55)),
                type: 'headshot' as const,
                label: 'Precision Headshot',
                detail: `${result.headshots} lethal headshot${result.headshots > 1 ? 's' : ''} confirmed`,
                weapon: primaryWeapon,
                distanceM: 88,
              },
            ]
          : []),
        {
          timeSec: dur,
          type: result.victory ? 'victory' : 'zone',
          label: result.victory ? '#1 VARKON LAST SURVIVOR' : `Placed #${result.placement}/${result.totalPlayers}`,
          detail: `${result.rpDelta >= 0 ? '+' : ''}${result.rpDelta} RP · ${result.mmrDelta >= 0 ? '+' : ''}${result.mmrDelta} MMR`,
        },
      ];

      const newRecord: MatchHistoryRecord = {
        id: `mh_${Date.now()}`,
        dateLabel: 'Just now',
        mode: result.mode,
        mapId: result.mapId,
        placement: result.placement,
        totalPlayers: result.totalPlayers,
        kills: result.kills,
        damage: result.damageDealt,
        headshots: result.headshots,
        rpDelta: result.rpDelta,
        victory: result.victory,
        durationSec: dur,
        events: replayEvents,
      };

      return {
        ...prev,
        level: nextLevel,
        xp: remXp,
        rankPoints: Math.max(0, prev.rankPoints + result.rpDelta),
        mmr: Math.max(600, prev.mmr + result.mmrDelta),
        gold: prev.gold + result.goldEarned,
        battlePassLevel: Math.min(50, prev.battlePassLevel + bpUp),
        battlePassXp: nextBpXp % 500,
        stats: {
          matches: prev.stats.matches + 1,
          wins: prev.stats.wins + (result.victory ? 1 : 0),
          kills: prev.stats.kills + result.kills,
          headshots: prev.stats.headshots + result.headshots,
          damage: prev.stats.damage + result.damageDealt,
        },
        matchHistory: [newRecord, ...prev.matchHistory].slice(0, 15),
        missions: updatedMissions,
      };
    });
  }, []);

  // Mount isolated 3D VexoraEngine once
  useEffect(() => {
    if (!canvasMountRef.current) return;
    const engine = new VexoraEngine(canvasMountRef.current, profile, graphics, controls, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onMatchEnd: handleMatchEnd,
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync profile, graphics, controls & lobby preview mode into live 3D engine
  useEffect(() => {
    engineRef.current?.updateProfile(profile);
  }, [profile]);

  useEffect(() => {
    engineRef.current?.updateGraphics(graphics);
  }, [graphics]);

  useEffect(() => {
    engineRef.current?.updateControls(controls);
  }, [controls]);

  useEffect(() => {
    if (screen === 'lobby') {
      engineRef.current?.setLobbyPreviewMode(lobbyModal === 'armory' ? 'armory' : 'lobby');
    }
  }, [lobbyModal, screen]);

  // Global keyboard shortcuts for Map (M) & Inventory (Tab) during match
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== 'playing') return;
      if (e.code === 'KeyM') {
        e.preventDefault();
        setMapModalOpen((o) => {
          const next = !o;
          if (next) engineRef.current?.exitPointerLock();
          return next;
        });
      } else if (e.code === 'Tab') {
        e.preventDefault();
        setInvModalOpen((o) => {
          const next = !o;
          if (next) engineRef.current?.exitPointerLock();
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  const startDeploymentPipeline = useCallback(
    (
      targetMode: GameModeId,
      targetSquad: SquadSize,
      targetMap: MapId,
      targetPersp: PerspectiveMode,
      customBotSkill?: number
    ) => {
      clearLaunchTimers();
      setLobbyModal(null);
      setMatchResult(null);
      setMapModalOpen(false);
      setInvModalOpen(false);
      setMatchSettingsOpen(false);

      const skipQueue = targetMode === 'training' || targetMode === 'custom';
      const queueDelay = skipQueue ? 0 : 1200;

      if (!skipQueue) {
        setScreen('matchmaking');
      }

      const tStartLoad = window.setTimeout(() => {
        setScreen('loading');
        setLoadingProgress(18);
      }, queueDelay);

      const tMidLoad = window.setTimeout(() => setLoadingProgress(64), queueDelay + 240);
      const tFullLoad = window.setTimeout(() => setLoadingProgress(100), queueDelay + 520);
      const tDeploy = window.setTimeout(() => {
        setScreen('playing');
        engineRef.current?.startMatch(targetMode, targetSquad, targetMap, targetPersp, customBotSkill);
      }, queueDelay + 680);

      launchTimersRef.current = [tStartLoad, tMidLoad, tFullLoad, tDeploy];
    },
    [clearLaunchTimers]
  );

  const launchMatch = () => {
    const diffEntry = BOT_DIFFICULTIES.find((d) => d.id === botDifficulty);
    const botSkillOverride =
      gameMode === 'training' || gameMode === 'custom' ? diffEntry?.skillValue : undefined;
    startDeploymentPipeline(gameMode, squadSize, mapId, perspective, botSkillOverride);
  };

  const cancelMatchmaking = () => {
    clearLaunchTimers();
    audioEngine.playUiClick();
    setScreen('lobby');
  };

  const returnToLobby = () => {
    clearLaunchTimers();
    setMatchResult(null);
    setMapModalOpen(false);
    setInvModalOpen(false);
    setMatchSettingsOpen(false);
    setScreen('lobby');
    engineRef.current?.enterLobby();
  };

  // Auth Handlers
  const handleSplashComplete = () => {
    const hasSession = localStorage.getItem(STORAGE_KEY_SESSION) === '1';
    setScreen(hasSession ? 'lobby' : 'login');
  };

  const handleAuthenticated = (account: AuthenticatedAccount) => {
    localStorage.setItem(STORAGE_KEY_SESSION, '1');
    setProfile((prev) => ({
      ...prev,
      name: account.name,
      playerId: account.playerId,
      authProvider: account.authProvider,
      email: account.email || prev.email,
      linkedProviders: account.linkedProviders,
      createdAt: account.createdAt,
    }));
    setScreen('lobby');
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY_SESSION);
    setLobbyModal(null);
    setScreen('login');
  };

  // Profile Mutation Handlers
  const handleSelectWeapon = (
    weaponId: string,
    slot: 'primary' | 'secondary' | 'pistol' | 'melee' | 'grenade'
  ) => {
    setProfile((p) => {
      if (slot === 'secondary') return { ...p, selectedSecondaryId: weaponId };
      if (slot === 'pistol') return { ...p, selectedPistolId: weaponId };
      if (slot === 'melee') return { ...p, selectedMeleeId: weaponId };
      if (slot === 'grenade') return { ...p, selectedGrenadeId: weaponId };
      return { ...p, selectedWeaponId: weaponId };
    });
  };

  const handleUnequipSecondary = () => {
    setProfile((p) => ({ ...p, selectedSecondaryId: '' }));
  };

  const handleUnlockWeapon = (weaponId: string, priceGold: number) => {
    setProfile((p) => {
      const owned = p.ownedWeaponIds || [];
      if (p.gold < priceGold || owned.includes(weaponId)) return p;
      return {
        ...p,
        gold: p.gold - priceGold,
        ownedWeaponIds: [...owned, weaponId],
      };
    });
  };

  const handleSetAttachment = (weaponId: string, slot: AttachmentSlot, attId: string | undefined) => {
    setProfile((p) => {
      const nextMap = { ...(p.selectedAttachments[weaponId] || {}) };
      if (attId) nextMap[slot] = attId;
      else delete nextMap[slot];
      return {
        ...p,
        selectedAttachments: { ...p.selectedAttachments, [weaponId]: nextMap },
      };
    });
  };

  const handleSetSkin = (weaponId: string, skinId: string) => {
    setProfile((p) => ({
      ...p,
      selectedWeaponSkins: { ...p.selectedWeaponSkins, [weaponId]: skinId },
    }));
  };

  const handleSetCharm = (weaponId: string, charmId: string) => {
    setProfile((p) => ({
      ...p,
      selectedWeaponCharms: { ...(p.selectedWeaponCharms || {}), [weaponId]: charmId },
    }));
  };

  const handleSetTacticalGear = (tacticalId: string) => {
    setProfile((p) => ({ ...p, selectedTacticalId: tacticalId }));
  };

  const handleUpgradeWeapon = (weaponId: string, costCoins: number) => {
    setProfile((p) => {
      const curLv = p.weaponLevels[weaponId] || 1;
      if (curLv >= 5 || p.gold < costCoins) return p;
      return {
        ...p,
        gold: p.gold - costCoins,
        weaponLevels: { ...p.weaponLevels, [weaponId]: curLv + 1 },
      };
    });
  };

  const handleUnlockOperator = (opId: string, priceGold: number) => {
    setProfile((p) => {
      if (p.gold < priceGold || p.ownedOperatorIds.includes(opId)) return p;
      return {
        ...p,
        gold: p.gold - priceGold,
        ownedOperatorIds: [...p.ownedOperatorIds, opId],
        selectedOperatorId: opId,
      };
    });
  };

  const handleCustomizeOperator = (opId: string, patch: Partial<CharacterCustomization>) => {
    setProfile((p) => ({
      ...p,
      operatorOutfitTint: patch.outfitColor
        ? { ...p.operatorOutfitTint, [opId]: patch.outfitColor }
        : p.operatorOutfitTint,
      operatorVisorTint: patch.visorColor
        ? { ...p.operatorVisorTint, [opId]: patch.visorColor }
        : p.operatorVisorTint,
      characterCustomizations: {
        ...(p.characterCustomizations || {}),
        [opId]: { ...(p.characterCustomizations?.[opId] || {}), ...patch },
      },
    }));
  };

  const handlePreviewOperator = useCallback((opId: string | null) => {
    engineRef.current?.setPreviewOperator(opId);
  }, []);

  const handleSetPose = useCallback((pose: CharacterPoseId) => {
    engineRef.current?.setCharacterPose(pose);
  }, []);

  const handlePreviewWeapon = useCallback((weaponId: string | null) => {
    engineRef.current?.setPreviewWeapon(weaponId);
  }, []);

  const handleArmoryZoom = useCallback((zoom: number) => {
    engineRef.current?.setArmoryZoom(zoom);
  }, []);

  const handleToggleArmoryRotate = useCallback((enabled: boolean) => {
    engineRef.current?.setArmoryAutoRotate(enabled);
  }, []);

  const handleResetArmoryView = useCallback(() => {
    engineRef.current?.resetArmoryView();
  }, []);

  const handleInspectWeapon = useCallback(() => {
    engineRef.current?.triggerWeaponInspect();
  }, []);

  const handleReloadPreview = useCallback(() => {
    engineRef.current?.triggerWeaponReloadPreview();
  }, []);

  const handleBuyStoreItem = (item: StoreItemDef, currency: 'gold' | 'vex') => {
    setProfile((p) => {
      if (p.ownedStoreItems.includes(item.id)) return p;
      if (currency === 'gold' && p.gold < item.priceGold) return p;
      if (currency === 'vex' && p.vexCoins < item.priceVex) return p;

      const nextSkins =
        item.weaponSkinId && !p.ownedSkinIds.includes(item.weaponSkinId)
          ? [...p.ownedSkinIds, item.weaponSkinId]
          : p.ownedSkinIds;

      const nextTint = item.operatorOutfitColor
        ? { ...p.operatorOutfitTint, [p.selectedOperatorId]: item.operatorOutfitColor }
        : p.operatorOutfitTint;

      const nextWeaponSkins = item.weaponSkinId
        ? { ...p.selectedWeaponSkins, [p.selectedWeaponId]: item.weaponSkinId }
        : p.selectedWeaponSkins;

      const tx = {
        id: `tx_${Date.now()}`,
        itemName: item.name,
        currency: (currency === 'gold' ? 'V-Coins' : 'V-Credits') as 'V-Coins' | 'V-Credits',
        amount: currency === 'gold' ? item.priceGold : item.priceVex,
        dateLabel: 'Just now',
      };

      return {
        ...p,
        gold: currency === 'gold' ? p.gold - item.priceGold : p.gold,
        vexCoins: currency === 'vex' ? p.vexCoins - item.priceVex : p.vexCoins,
        ownedStoreItems: [...p.ownedStoreItems, item.id],
        ownedSkinIds: nextSkins,
        operatorOutfitTint: nextTint,
        selectedWeaponSkins: nextWeaponSkins,
        transactions: [tx, ...(p.transactions || [])].slice(0, 25),
      };
    });
  };

  const handleUnlockPremiumBp = () => {
    setProfile((p) => {
      if (p.battlePassPremium || p.vexCoins < 300) return p;
      return {
        ...p,
        vexCoins: p.vexCoins - 300,
        battlePassPremium: true,
        transactions: [
          {
            id: `tx_bp_${Date.now()}`,
            itemName: 'Season 1 Premium Battle Pass',
            currency: 'V-Credits' as const,
            amount: 300,
            dateLabel: 'Just now',
          },
          ...(p.transactions || []),
        ],
      };
    });
  };

  const handleClaimBpReward = (tier: number, track: 'free' | 'premium') => {
    const def = BATTLE_PASS_TIERS.find((t) => t.tier === tier);
    if (!def) return;
    setProfile((p) => {
      if (track === 'free' && p.claimedBpFree.includes(tier)) return p;
      if (track === 'premium' && (!p.battlePassPremium || p.claimedBpPremium.includes(tier))) return p;

      let gold = p.gold;
      let vex = p.vexCoins;
      const skins = [...p.ownedSkinIds];

      if (track === 'free') {
        gold += def.goldFree;
        if (def.skinFree && !skins.includes(def.skinFree)) skins.push(def.skinFree);
      } else {
        gold += def.goldPrem || 0;
        vex += def.vexPrem || 0;
        if (def.skinPrem && !skins.includes(def.skinPrem)) skins.push(def.skinPrem);
      }

      return {
        ...p,
        gold,
        vexCoins: vex,
        ownedSkinIds: skins,
        claimedBpFree: track === 'free' ? [...p.claimedBpFree, tier] : p.claimedBpFree,
        claimedBpPremium: track === 'premium' ? [...p.claimedBpPremium, tier] : p.claimedBpPremium,
      };
    });
  };

  const handleClaimMission = (missionId: string) => {
    setProfile((p) => {
      const m = p.missions.find((x) => x.id === missionId);
      if (!m || m.claimed || m.progress < m.target) return p;
      const nextBpXp = p.battlePassXp + m.rewardBpXp;
      return {
        ...p,
        gold: p.gold + m.rewardGold,
        battlePassLevel: Math.min(50, p.battlePassLevel + Math.floor(nextBpXp / 500)),
        battlePassXp: nextBpXp % 500,
        missions: p.missions.map((x) => (x.id === missionId ? { ...x, claimed: true } : x)),
      };
    });
  };

  const handleClaimMilestone = (milestoneId: string) => {
    const ms = PROGRESSION_MILESTONES.find((m) => m.id === milestoneId);
    if (!ms) return;
    setProfile((p) => {
      if (p.claimedMilestoneIds.includes(milestoneId)) return p;
      const skins =
        ms.rewardSkinId && !p.ownedSkinIds.includes(ms.rewardSkinId)
          ? [...p.ownedSkinIds, ms.rewardSkinId]
          : p.ownedSkinIds;
      const titles =
        ms.rewardTitle && !p.unlockedTitles.includes(ms.rewardTitle)
          ? [...p.unlockedTitles, ms.rewardTitle]
          : p.unlockedTitles;
      const outfitTint = ms.rewardOutfitColor
        ? { ...p.operatorOutfitTint, [p.selectedOperatorId]: ms.rewardOutfitColor }
        : p.operatorOutfitTint;

      return {
        ...p,
        gold: p.gold + (ms.rewardGold || 0),
        vexCoins: p.vexCoins + (ms.rewardVex || 0),
        ownedSkinIds: skins,
        unlockedTitles: titles,
        equippedTitle: ms.rewardTitle || p.equippedTitle,
        operatorOutfitTint: outfitTint,
        claimedMilestoneIds: [...p.claimedMilestoneIds, milestoneId],
      };
    });
  };

  const handleClaimRankReward = (rankName: string) => {
    const tier = RANK_TIERS.find((r) => r.name === rankName);
    if (!tier) return;
    setProfile((p) => {
      if (p.rankPoints < tier.minRp || p.claimedRankRewards.includes(rankName)) return p;
      const isCredits = tier.reward.includes('V-Credits');
      const amountMatch = tier.reward.replace(/,/g, '').match(/\d+/);
      const amount = amountMatch ? parseInt(amountMatch[0], 10) : 500;
      return {
        ...p,
        gold: isCredits ? p.gold : p.gold + amount,
        vexCoins: isCredits ? p.vexCoins + amount : p.vexCoins,
        claimedRankRewards: [...p.claimedRankRewards, rankName],
      };
    });
  };

  const handleLinkAccount = (provider: 'email' | 'google' | 'apple', email?: string) => {
    setProfile((p) => {
      const existing = p.linkedProviders || [p.authProvider];
      const next = existing.includes(provider) ? existing : [...existing, provider];
      return {
        ...p,
        authProvider: p.authProvider === 'guest' ? provider : p.authProvider,
        email: email || p.email,
        linkedProviders: next,
      };
    });
  };

  const handleUpdateGamerTag = (newTag: string) => {
    setProfile((p) => ({ ...p, name: newTag }));
  };

  const handleClaimDailyReward = () => {
    setProfile((p) => {
      if (p.dailyRewardClaimedToday) return p;
      return { ...p, gold: p.gold + 800, dailyRewardClaimedToday: true };
    });
  };

  const handleClaimMail = (mailId: string) => {
    setProfile((p) => {
      const msg = p.mail.find((m) => m.id === mailId);
      if (!msg || msg.claimed) return p;
      return {
        ...p,
        gold: p.gold + (msg.rewardGold || 0),
        vexCoins: p.vexCoins + (msg.rewardVex || 0),
        mail: p.mail.map((m) => (m.id === mailId ? { ...m, claimed: true } : m)),
      };
    });
  };

  const handleClaimAllMail = () => {
    setProfile((p) => {
      let addGold = 0;
      let addVex = 0;
      const nextMail = p.mail.map((m) => {
        if (m.claimed) return m;
        addGold += m.rewardGold || 0;
        addVex += m.rewardVex || 0;
        return { ...m, claimed: true };
      });
      return {
        ...p,
        gold: p.gold + addGold,
        vexCoins: p.vexCoins + addVex,
        mail: nextMail,
      };
    });
  };

  const handleLaunchCustomRoom = (config: CustomRoomConfig) => {
    setGameMode(config.mode);
    setMapId(config.mapId);
    setSquadSize(config.squadSize);
    setPerspective(config.perspective);
    setBotDifficulty(config.botDifficulty);
    const diff = BOT_DIFFICULTIES.find((d) => d.id === config.botDifficulty);
    startDeploymentPipeline(
      config.mode,
      config.squadSize,
      config.mapId,
      config.perspective,
      diff?.skillValue
    );
  };

  const handleLaunchEventMode = (eventMode: GameModeId, eventMap: MapId) => {
    setGameMode(eventMode);
    setMapId(eventMap);
    startDeploymentPipeline(eventMode, squadSize, eventMap, perspective);
  };

  const handleToggleTournamentRegister = (tournamentId: string) => {
    setProfile((p) => {
      const cur = p.registeredTournaments || [];
      const next = cur.includes(tournamentId)
        ? cur.filter((id) => id !== tournamentId)
        : [...cur, tournamentId];
      return { ...p, registeredTournaments: next };
    });
  };

  const handleToggleSaveHighlight = (matchId: string) => {
    setProfile((p) => {
      const cur = p.savedHighlightIds || [];
      const next = cur.includes(matchId) ? cur.filter((id) => id !== matchId) : [...cur, matchId];
      return { ...p, savedHighlightIds: next };
    });
  };

  const handleInviteFriend = (friendId: string) => {
    setInvitedFriends((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId].slice(0, 3)
    );
  };

  const activeHudPreset = hudPresets.find((p) => p.id === activeHudPresetId) || hudPresets[0];
  const currentMap = getMapById(mapId);
  const currentSbmm = evaluateSbmm(profile, gameMode);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0E120E]">
      {/* Isolated Full-Viewport Three.js WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full z-0" />

      {/* SPLASH & LOGIN / REGISTRATION FLOW */}
      {(screen === 'splash' || screen === 'login') && (
        <AuthFlow
          mode={screen}
          existingName={profile.name}
          existingPlayerId={profile.playerId}
          onSplashComplete={handleSplashComplete}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {/* LOBBY SCREEN */}
      {screen === 'lobby' && !lobbyModal && (
        <LobbyUI
          profile={profile}
          gameMode={gameMode}
          squadSize={squadSize}
          mapId={mapId}
          perspective={perspective}
          botDifficulty={botDifficulty}
          graphics={graphics}
          audio={audio}
          invitedFriends={invitedFriends}
          onSelectMode={setGameMode}
          onSelectSquad={setSquadSize}
          onSelectMap={setMapId}
          onSelectBotDifficulty={setBotDifficulty}
          onTogglePerspective={() => setPerspective((p) => (p === 'TPP' ? 'FPP' : 'TPP'))}
          onOpenModal={setLobbyModal}
          onToggleMute={() => setAudio((a) => ({ ...a, muted: !a.muted }))}
          onUpdateWeatherTime={(weather: WeatherType, timeOfDay: TimeOfDay) =>
            setGraphics((g) => ({ ...g, weather, timeOfDay }))
          }
          onInviteFriend={handleInviteFriend}
          onClaimDailyReward={handleClaimDailyReward}
          onClaimMission={handleClaimMission}
          onPlay={launchMatch}
        />
      )}

      {/* LOBBY INTERACTIVE 3D & MARKETPLACE MODALS */}
      {screen === 'lobby' && lobbyModal === 'armory' && (
        <ArmoryModal
          profile={profile}
          onSelectWeapon={handleSelectWeapon}
          onUnequipSecondary={handleUnequipSecondary}
          onUnlockWeapon={handleUnlockWeapon}
          onSetAttachment={handleSetAttachment}
          onSetSkin={handleSetSkin}
          onSetCharm={handleSetCharm}
          onSetTacticalGear={handleSetTacticalGear}
          onUpgradeWeapon={handleUpgradeWeapon}
          onPreviewWeapon={handlePreviewWeapon}
          onArmoryZoom={handleArmoryZoom}
          onToggleAutoRotate={handleToggleArmoryRotate}
          onResetArmoryView={handleResetArmoryView}
          onInspectWeapon={handleInspectWeapon}
          onReloadPreview={handleReloadPreview}
          onClose={() => setLobbyModal(null)}
        />
      )}

      {screen === 'lobby' && lobbyModal === 'characters' && (
        <CharactersModal
          profile={profile}
          onSelectOperator={(opId) => setProfile((p) => ({ ...p, selectedOperatorId: opId }))}
          onPreviewOperator={handlePreviewOperator}
          onSetPose={handleSetPose}
          onUnlockOperator={handleUnlockOperator}
          onCustomizeOperator={handleCustomizeOperator}
          onClose={() => setLobbyModal(null)}
        />
      )}

      {screen === 'lobby' && lobbyModal === 'vehicles' && (
        <VehiclesModal
          profile={profile}
          onSelectVehicle={(vehicleId) => setProfile((p) => ({ ...p, selectedVehicleId: vehicleId }))}
          onCustomizeVehicleCamo={(vehicleId, hex) =>
            setProfile((p) => ({
              ...p,
              selectedVehicleCamo: { ...(p.selectedVehicleCamo || {}), [vehicleId]: hex },
            }))
          }
          onClose={() => setLobbyModal(null)}
        />
      )}

      {screen === 'lobby' && lobbyModal === 'inventory' && (
        <InventoryModal
          mode="lobby"
          profile={profile}
          onEquipAttachment={(slotIdx, slotType, attId) => {
            const wId = slotIdx === 0 ? profile.selectedWeaponId : profile.selectedSecondaryId;
            handleSetAttachment(wId, slotType, attId);
          }}
          onClose={() => setLobbyModal(null)}
        />
      )}

      {screen === 'lobby' &&
        (lobbyModal === 'store' ||
          lobbyModal === 'battlepass' ||
          lobbyModal === 'missions' ||
          lobbyModal === 'events') && (
          <StoreBattlePassModal
            initialTab={lobbyModal}
            profile={profile}
            onBuyStoreItem={handleBuyStoreItem}
            onUnlockPremiumBp={handleUnlockPremiumBp}
            onClaimBpReward={handleClaimBpReward}
            onClaimMission={handleClaimMission}
            onClaimDailyReward={handleClaimDailyReward}
            onLaunchEventMode={handleLaunchEventMode}
            onClose={() => setLobbyModal(null)}
          />
        )}

      {screen === 'lobby' &&
        (lobbyModal === 'profile' || lobbyModal === 'progression' || lobbyModal === 'ranked') && (
          <ProgressionRankedModal
            initialTab={lobbyModal}
            profile={profile}
            gameMode={gameMode}
            onClaimMilestone={handleClaimMilestone}
            onClaimRankReward={handleClaimRankReward}
            onLinkAccount={handleLinkAccount}
            onUpdateGamerTag={handleUpdateGamerTag}
            onLogout={handleLogout}
            onClose={() => setLobbyModal(null)}
          />
        )}

      {screen === 'lobby' && (lobbyModal === 'esports' || lobbyModal === 'replays') && (
        <EsportsReplayModal
          initialTab={lobbyModal === 'replays' ? 'replays' : 'custom'}
          profile={profile}
          onLaunchCustomRoom={handleLaunchCustomRoom}
          onToggleTournamentRegister={handleToggleTournamentRegister}
          onToggleSaveHighlight={handleToggleSaveHighlight}
          onClose={() => setLobbyModal(null)}
        />
      )}

      {screen === 'lobby' && lobbyModal === 'mail' && (
        <MailModal
          messages={profile.mail}
          onClaimMail={handleClaimMail}
          onClaimAll={handleClaimAllMail}
          onClose={() => setLobbyModal(null)}
        />
      )}

      {screen === 'lobby' && lobbyModal === 'social' && (
        <SocialClanModal
          profile={profile}
          invitedFriends={invitedFriends}
          onInviteFriend={handleInviteFriend}
          onClose={() => setLobbyModal(null)}
        />
      )}

      {screen === 'lobby' && lobbyModal === 'settings' && (
        <SettingsModal
          graphics={graphics}
          controls={controls}
          audio={audio}
          hudPresets={hudPresets}
          activeHudPresetId={activeHudPresetId}
          onChangeGraphics={setGraphics}
          onChangeControls={setControls}
          onChangeAudio={setAudio}
          onSaveHudPreset={(preset) =>
            setHudPresets((prev) => prev.map((p) => (p.id === preset.id ? preset : p)))
          }
          onSelectHudPreset={setActiveHudPresetId}
          onResetHudPresets={() => {
            setHudPresets(DEFAULT_HUD_PRESETS);
            setActiveHudPresetId(DEFAULT_HUD_PRESETS[0].id);
          }}
          onClose={() => setLobbyModal(null)}
        />
      )}

      {/* SBMM MATCHMAKING QUEUE OVERLAY */}
      {screen === 'matchmaking' && (
        <div className="fixed inset-0 z-50 bg-[#0A0D0A]/86 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121712] border border-[#C6A65A]/45 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-num uppercase tracking-[0.2em] text-[#C6A65A]">
                SIMULATED SBMM QUEUE (LOCAL AI BOTS)
              </span>
              <span className="font-mono-num text-xs text-[#22C55E]">
                00:{String(queueSeconds).padStart(2, '0')}
              </span>
            </div>

            <div>
              <h2 className="font-display font-bold text-2xl text-[#F2F2ED] uppercase">
                Preparing Offline Prototype Match...
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                {currentMap.name} · {gameMode.toUpperCase()} ({squadSize.toUpperCase()} · {perspective})
              </p>
            </div>

            <div className="bg-[#182017] border border-white/10 p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Skill Tier</span>
                <span className="font-display font-bold" style={{ color: currentSbmm.tierColor }}>
                  {currentSbmm.tierName} ({currentSbmm.mmr} MMR)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Lobby Bracket</span>
                <span className="font-mono-num text-white">
                  {currentSbmm.bracketMin} – {currentSbmm.bracketMax} MMR
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Matchmaking Policy</span>
                <span className="text-[#C6A65A]">{currentSbmm.strictnessLabel}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={cancelMatchmaking}
              className="w-full py-2.5 bg-[#1D251B] hover:bg-[#7F1D1D] border border-white/15 font-display font-bold text-xs tracking-wider text-white uppercase cursor-pointer"
            >
              Cancel Queue
            </button>
          </div>
        </div>
      )}

      {/* ANIMATED TACTICAL DEPLOYMENT LOADING SCREEN */}
      {screen === 'loading' && (
        <div
          className="fixed inset-0 z-50 bg-[#0A0D0A] bg-cover bg-center flex flex-col justify-end p-6 md:p-10"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(10,13,10,0.28) 0%, rgba(10,13,10,0.88) 72%, rgba(10,13,10,0.97) 100%), url('/assets/aistudio/Varkon__Battlefield_Legends_Loading_Screen_e1cfe15e.png')`,
          }}
        >
          <div className="w-full max-w-2xl mx-auto space-y-3 bg-[#101410]/85 border border-[#C6A65A]/30 p-5">
            <div className="flex items-center justify-between text-xs font-mono-num uppercase tracking-[0.2em]">
              <span className="text-[#C6A65A]">VARKON DEPLOYMENT PROTOCOL</span>
              <span className="text-[#94A3B8]">
                {gameMode.toUpperCase()} · {squadSize.toUpperCase()} · {perspective}
              </span>
            </div>
            <h2 className="font-display font-bold text-3xl text-[#F2F2ED] uppercase">{currentMap.name}</h2>
            <p className="text-xs text-[#CBD5E1]">{currentMap.subtitle}</p>
            <div className="h-2.5 bg-[#182017] border border-[#C6A65A]/25 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#8E7338] via-[#C6A65A] to-[#F2DF9F] transition-all duration-200"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono-num text-[#94A3B8]">
              <span>Streaming 3D PBR Battlefield, Vehicles, Ballistics & Tactical AI</span>
              <span className="text-[#C6A65A] font-bold">{loadingProgress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE MATCH HUD & IN-MATCH MODALS */}
      {screen === 'playing' && hud && (
        <>
          <InGameHUD
            hud={hud}
            profile={profile}
            controls={controls}
            hudPreset={activeHudPreset}
            onFireChange={(active) => engineRef.current?.setFiring(active)}
            onToggleAds={() => engineRef.current?.toggleAds()}
            onJump={() => engineRef.current?.jumpAction()}
            onCrouch={() => engineRef.current?.toggleCrouch()}
            onProne={() => engineRef.current?.toggleProne()}
            onReload={() => engineRef.current?.startReload()}
            onSwitchSlot={(s) => engineRef.current?.switchWeaponSlot(s)}
            onThrowGrenade={(t) => engineRef.current?.throwGrenade(t)}
            onHeal={() => engineRef.current?.startHealing()}
            onInteract={() => engineRef.current?.interactAction()}
            onAbility={() => engineRef.current?.activateOperatorAbility()}
            onTogglePerspective={() => engineRef.current?.togglePerspective()}
            onOpenMap={() => {
              engineRef.current?.exitPointerLock();
              setMapModalOpen(true);
            }}
            onOpenInventory={() => {
              engineRef.current?.exitPointerLock();
              setInvModalOpen(true);
            }}
            onOpenPause={() => engineRef.current?.setPaused(true)}
            onTouchMove={(nx, ny, sp) => engineRef.current?.setTouchMove(nx, ny, sp)}
            onTouchLook={(dx, dy) => engineRef.current?.applyLookDelta(dx, dy)}
            onRequestLock={() => engineRef.current?.requestPointerLock()}
          />

          {mapModalOpen && (
            <FullMapModal
              hud={hud}
              mapId={mapId}
              onPing={(x, z) => engineRef.current?.setMapPing(x, z)}
              onClose={() => setMapModalOpen(false)}
            />
          )}

          {invModalOpen && (
            <InventoryModal
              mode="match"
              hud={hud}
              profile={profile}
              onUseHeal={(kind) => engineRef.current?.startHealing(kind)}
              onDiscard={(id) => engineRef.current?.discardInventoryItem(id)}
              onEquipAttachment={(sIdx, sType, attId) =>
                engineRef.current?.equipAttachmentInMatch(sIdx, sType, attId)
              }
              onClose={() => setInvModalOpen(false)}
            />
          )}

          {/* Pause Overlay */}
          {hud.paused && !matchSettingsOpen && (
            <div className="fixed inset-0 z-40 bg-[#0A0D0A]/86 flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-[#121712] border border-[#C6A65A]/35 p-6 space-y-4">
                <div>
                  <div className="text-xs font-mono-num text-[#C6A65A] uppercase">MATCH PAUSED</div>
                  <h2 className="font-display font-bold text-2xl text-[#F2F2ED] uppercase">
                    {currentMap.name}
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    WASD Move · Shift Sprint · C Crouch · Z Prone · R Reload · G Frag · T Smoke · H Heal · Q Ability · E Vehicle/Loot
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      engineRef.current?.setPaused(false);
                      if (!controls.showTouchControls) engineRef.current?.requestPointerLock();
                    }}
                    className="w-full py-3 bg-[#C6A65A] hover:bg-[#D9B86C] font-display font-bold text-sm tracking-wider text-[#101410] uppercase cursor-pointer"
                  >
                    Resume Match
                  </button>
                  <button
                    onClick={() => setMatchSettingsOpen(true)}
                    className="w-full py-2.5 bg-[#182017] hover:bg-[#232D21] border border-white/15 font-display font-bold text-xs tracking-wider text-white uppercase cursor-pointer"
                  >
                    Graphics, Controls & Custom HUD
                  </button>
                  <button
                    onClick={returnToLobby}
                    className="w-full py-2.5 bg-transparent hover:bg-[#7F1D1D]/40 border border-[#EF4444]/40 font-display font-bold text-xs tracking-wider text-[#F87171] uppercase cursor-pointer"
                  >
                    Leave Match to Lobby
                  </button>
                </div>
              </div>
            </div>
          )}

          {matchSettingsOpen && (
            <SettingsModal
              graphics={graphics}
              controls={controls}
              audio={audio}
              hudPresets={hudPresets}
              activeHudPresetId={activeHudPresetId}
              onChangeGraphics={setGraphics}
              onChangeControls={setControls}
              onChangeAudio={setAudio}
              onSaveHudPreset={(preset) =>
                setHudPresets((prev) => prev.map((p) => (p.id === preset.id ? preset : p)))
              }
              onSelectHudPreset={setActiveHudPresetId}
              onResetHudPresets={() => {
                setHudPresets(DEFAULT_HUD_PRESETS);
                setActiveHudPresetId(DEFAULT_HUD_PRESETS[0].id);
              }}
              onClose={() => setMatchSettingsOpen(false)}
            />
          )}
        </>
      )}

      {/* MATCH RESULTS SCREEN */}
      {screen === 'results' && matchResult && (
        <MatchResultsModal
          result={matchResult}
          profile={profile}
          onPlayAgain={launchMatch}
          onReturnLobby={returnToLobby}
          onWatchReplay={() => {
            returnToLobby();
            setLobbyModal('replays');
          }}
        />
      )}
    </div>
  );
}
