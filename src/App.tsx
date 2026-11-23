import { useCallback, useEffect, useRef, useState } from 'react';
import { ArmoryModal } from './components/ArmoryModal';
import { CharactersModal } from './components/CharactersModal';
import { FullMapModal } from './components/FullMapModal';
import { InGameHUD } from './components/InGameHUD';
import { InventoryModal } from './components/InventoryModal';
import { LobbyUI } from './components/LobbyUI';
import { MatchResultsModal } from './components/MatchResultsModal';
import { SettingsModal } from './components/SettingsModal';
import { SocialClanModal } from './components/SocialClanModal';
import { StoreBattlePassModal } from './components/StoreBattlePassModal';
import { audioEngine } from './game/audio';
import {
  BATTLE_PASS_TIERS,
  DEFAULT_AUDIO,
  DEFAULT_CONTROLS,
  DEFAULT_HUD_PRESETS,
  detectOptimalGraphics,
  getMapById,
  INITIAL_PROFILE,
} from './game/data';
import { VexoraEngine } from './game/engine';
import {
  AttachmentSlot,
  AudioSettings,
  ControlSettings,
  GameModeId,
  GameScreen,
  GraphicsSettings,
  HudLayoutPreset,
  LobbyModal,
  MapId,
  MatchHudSnapshot,
  MatchResultSummary,
  PerspectiveMode,
  PlayerProfile,
  SquadSize,
  StoreItemDef,
  TimeOfDay,
  WeatherType,
} from './game/types';

const STORAGE_KEY_PROFILE = 'vexora_profile_v1';
const STORAGE_KEY_HUD = 'vexora_hud_presets_v1';

function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (!raw) return INITIAL_PROFILE;
    return { ...INITIAL_PROFILE, ...JSON.parse(raw) };
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

  const [screen, setScreen] = useState<GameScreen>('lobby');
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
  const [invitedFriends, setInvitedFriends] = useState<string[]>(['f1']);

  // Live Match state
  const [hud, setHud] = useState<MatchHudSnapshot | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultSummary | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [invModalOpen, setInvModalOpen] = useState(false);
  const [matchSettingsOpen, setMatchSettingsOpen] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

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

  const handleMatchEnd = useCallback((result: MatchResultSummary) => {
    setMatchResult(result);
    setMapModalOpen(false);
    setInvModalOpen(false);
    setMatchSettingsOpen(false);
    setScreen('results');

    setProfile((prev) => {
      const nextXp = prev.xp + result.xpEarned;
      const levelUp = Math.floor(nextXp / 2000);
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

      return {
        ...prev,
        level: prev.level + levelUp,
        xp: nextXp % 2000,
        rankPoints: Math.max(0, prev.rankPoints + result.rpDelta),
        gold: prev.gold + result.goldEarned,
        battlePassLevel: Math.min(6, prev.battlePassLevel + bpUp),
        battlePassXp: nextBpXp % 500,
        stats: {
          matches: prev.stats.matches + 1,
          wins: prev.stats.wins + (result.victory ? 1 : 0),
          kills: prev.stats.kills + result.kills,
          headshots: prev.stats.headshots + result.headshots,
          damage: prev.stats.damage + result.damageDealt,
        },
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

  const launchMatch = () => {
    setLobbyModal(null);
    setMatchResult(null);
    setMapModalOpen(false);
    setInvModalOpen(false);
    setMatchSettingsOpen(false);
    setScreen('loading');
    setLoadingProgress(15);

    const t1 = window.setTimeout(() => setLoadingProgress(62), 180);
    const t2 = window.setTimeout(() => setLoadingProgress(100), 420);
    const t3 = window.setTimeout(() => {
      setScreen('playing');
      engineRef.current?.startMatch(gameMode, squadSize, mapId, perspective);
    }, 560);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  };

  const returnToLobby = () => {
    setMatchResult(null);
    setMapModalOpen(false);
    setInvModalOpen(false);
    setMatchSettingsOpen(false);
    setScreen('lobby');
    engineRef.current?.enterLobby();
  };

  // Profile Mutation Handlers
  const handleSelectWeapon = (weaponId: string, asSecondary?: boolean) => {
    setProfile((p) =>
      asSecondary ? { ...p, selectedSecondaryId: weaponId } : { ...p, selectedWeaponId: weaponId }
    );
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

  const handleCustomizeOperator = (opId: string, outfitColor?: string, visorColor?: string) => {
    setProfile((p) => ({
      ...p,
      operatorOutfitTint: outfitColor ? { ...p.operatorOutfitTint, [opId]: outfitColor } : p.operatorOutfitTint,
      operatorVisorTint: visorColor ? { ...p.operatorVisorTint, [opId]: visorColor } : p.operatorVisorTint,
    }));
  };

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

      return {
        ...p,
        gold: currency === 'gold' ? p.gold - item.priceGold : p.gold,
        vexCoins: currency === 'vex' ? p.vexCoins - item.priceVex : p.vexCoins,
        ownedStoreItems: [...p.ownedStoreItems, item.id],
        ownedSkinIds: nextSkins,
        operatorOutfitTint: nextTint,
        selectedWeaponSkins: nextWeaponSkins,
      };
    });
  };

  const handleUnlockPremiumBp = () => {
    setProfile((p) => {
      if (p.battlePassPremium || p.vexCoins < 300) return p;
      return { ...p, vexCoins: p.vexCoins - 300, battlePassPremium: true };
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
        battlePassLevel: Math.min(6, p.battlePassLevel + Math.floor(nextBpXp / 500)),
        battlePassXp: nextBpXp % 500,
        missions: p.missions.map((x) => (x.id === missionId ? { ...x, claimed: true } : x)),
      };
    });
  };

  const handleClaimDailyReward = () => {
    setProfile((p) => {
      if (p.dailyRewardClaimedToday) return p;
      return { ...p, gold: p.gold + 800, dailyRewardClaimedToday: true };
    });
  };

  const handleInviteFriend = (friendId: string) => {
    setInvitedFriends((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId].slice(0, 3)
    );
  };

  const activeHudPreset = hudPresets.find((p) => p.id === activeHudPresetId) || hudPresets[0];
  const currentMap = getMapById(mapId);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090A0D]">
      {/* Isolated Full-Viewport Three.js WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full z-0" />

      {/* LOBBY SCREEN */}
      {screen === 'lobby' && !lobbyModal && (
        <LobbyUI
          profile={profile}
          gameMode={gameMode}
          squadSize={squadSize}
          mapId={mapId}
          perspective={perspective}
          graphics={graphics}
          audio={audio}
          invitedFriends={invitedFriends}
          onSelectMode={setGameMode}
          onSelectSquad={setSquadSize}
          onSelectMap={setMapId}
          onTogglePerspective={() => setPerspective((p) => (p === 'TPP' ? 'FPP' : 'TPP'))}
          onOpenModal={setLobbyModal}
          onToggleMute={() => setAudio((a) => ({ ...a, muted: !a.muted }))}
          onUpdateWeatherTime={(weather: WeatherType, timeOfDay: TimeOfDay) =>
            setGraphics((g) => ({ ...g, weather, timeOfDay }))
          }
          onInviteFriend={handleInviteFriend}
          onClaimDailyReward={handleClaimDailyReward}
          onPlay={launchMatch}
        />
      )}

      {/* LOBBY INTERACTIVE 3D & MARKETPLACE MODALS */}
      {screen === 'lobby' && lobbyModal === 'armory' && (
        <ArmoryModal
          profile={profile}
          onSelectWeapon={handleSelectWeapon}
          onSetAttachment={handleSetAttachment}
          onSetSkin={handleSetSkin}
          onClose={() => setLobbyModal(null)}
        />
      )}

      {screen === 'lobby' && lobbyModal === 'characters' && (
        <CharactersModal
          profile={profile}
          onSelectOperator={(opId) => setProfile((p) => ({ ...p, selectedOperatorId: opId }))}
          onUnlockOperator={handleUnlockOperator}
          onCustomizeOperator={handleCustomizeOperator}
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

      {/* ANIMATED TACTICAL DEPLOYMENT LOADING SCREEN */}
      {screen === 'loading' && (
        <div className="fixed inset-0 z-50 bg-[#090A0D] flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md space-y-4">
            <div className="text-xs font-mono-num uppercase tracking-[0.25em] text-[#EF4444]">
              VEXORA DEPLOYMENT PROTOCOL
            </div>
            <h2 className="font-display font-bold text-3xl text-white uppercase">{currentMap.name}</h2>
            <p className="text-xs text-[#94A3B8]">
              {currentMap.subtitle} · {gameMode.toUpperCase()} ({squadSize.toUpperCase()} · {perspective})
            </p>
            <div className="h-2 bg-[#161B24] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#DC2626] to-[#38BDF8] transition-all duration-200"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono-num text-[#64748B]">
              <span>Streaming 3D PBR Terrain, Vehicles & Combat AI</span>
              <span className="text-white">{loadingProgress}%</span>
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
            <div className="fixed inset-0 z-40 bg-[#090A0D]/86 flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-[#0F1218] border border-white/15 p-6 space-y-4">
                <div>
                  <div className="text-xs font-mono-num text-[#38BDF8] uppercase">MATCH PAUSED</div>
                  <h2 className="font-display font-bold text-2xl text-white uppercase">{currentMap.name}</h2>
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
                    className="w-full py-3 bg-[#DC2626] hover:bg-[#EF4444] font-display font-bold text-sm tracking-wider text-white uppercase cursor-pointer"
                  >
                    Resume Match
                  </button>
                  <button
                    onClick={() => setMatchSettingsOpen(true)}
                    className="w-full py-2.5 bg-[#161B24] hover:bg-[#222938] border border-white/15 font-display font-bold text-xs tracking-wider text-white uppercase cursor-pointer"
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
        />
      )}
    </div>
  );
}
