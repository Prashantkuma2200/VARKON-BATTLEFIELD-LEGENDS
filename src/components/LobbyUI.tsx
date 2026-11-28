import React, { useState } from 'react';
import {
  Award,
  Backpack,
  Calendar,
  ChevronRight,
  CloudRain,
  Crosshair,
  Crown,
  Film,
  Gift,
  Mail,
  MapPin,
  Moon,
  Settings,
  Shield,
  ShoppingBag,
  Sun,
  Swords,
  Trophy,
  Truck,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import {
  BOT_DIFFICULTIES,
  FRIENDS_LIST,
  getMapById,
  getOperatorById,
  getRankInfo,
  getWeaponById,
  MAPS,
} from '../game/data';
import { evaluateSbmm } from '../game/sbmm';
import {
  AudioSettings,
  BotDifficulty,
  GameModeId,
  GraphicsSettings,
  LobbyModal,
  MapId,
  PerspectiveMode,
  PlayerProfile,
  SquadSize,
  TimeOfDay,
  WeatherType,
} from '../game/types';
import { DailyMissionsSidebar } from './DailyMissionsSidebar';

interface LobbyUIProps {
  profile: PlayerProfile;
  gameMode: GameModeId;
  squadSize: SquadSize;
  mapId: MapId;
  perspective: PerspectiveMode;
  botDifficulty: BotDifficulty;
  graphics: GraphicsSettings;
  audio: AudioSettings;
  invitedFriends: string[];
  onSelectMode: (mode: GameModeId) => void;
  onSelectSquad: (size: SquadSize) => void;
  onSelectMap: (mapId: MapId) => void;
  onSelectBotDifficulty: (diff: BotDifficulty) => void;
  onTogglePerspective: () => void;
  onOpenModal: (modal: LobbyModal) => void;
  onToggleMute: () => void;
  onUpdateWeatherTime: (weather: WeatherType, tod: TimeOfDay) => void;
  onInviteFriend: (friendId: string) => void;
  onClaimDailyReward: () => void;
  onClaimMission: (missionId: string) => void;
  onPlay: () => void;
}

const MODE_OPTIONS: Array<{ id: GameModeId; label: string; sub: string }> = [
  { id: 'classic', label: 'Battle Royale', sub: 'Survival · Classic' },
  { id: 'ranked', label: 'Ranked BR', sub: 'Strict SBMM · RP Stakes' },
  { id: 'tdm', label: 'Team Deathmatch', sub: 'Fast Respawn Combat' },
  { id: 'arena4v4', label: 'Clash Squad', sub: '4v4 Tactical Arena' },
  { id: 'sniper', label: 'Sniper Ops', sub: 'Long-Range Bolt Action' },
  { id: 'training', label: 'Training Ground', sub: 'Range · Bots · Vehicles' },
];

export const LobbyUI: React.FC<LobbyUIProps> = ({
  profile,
  gameMode,
  squadSize,
  mapId,
  perspective,
  botDifficulty,
  graphics,
  audio,
  invitedFriends,
  onSelectMode,
  onSelectSquad,
  onSelectMap,
  onSelectBotDifficulty,
  onTogglePerspective,
  onOpenModal,
  onToggleMute,
  onUpdateWeatherTime,
  onInviteFriend,
  onClaimDailyReward,
  onClaimMission,
  onPlay,
}) => {
  const [modeDrawerOpen, setModeDrawerOpen] = useState(false);
  const rank = getRankInfo(profile.rankPoints);
  const operator = getOperatorById(profile.selectedOperatorId);
  const weapon = getWeaponById(profile.selectedWeaponId);
  const currentMap = getMapById(mapId);
  const sbmm = evaluateSbmm(profile, gameMode);

  const unclaimedMissions = profile.missions.filter((m) => m.progress >= m.target && !m.claimed).length;
  const unreadMail = profile.mail.filter((m) => !m.claimed).length;

  const navItems: Array<{ id: LobbyModal; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'characters', label: 'Characters', icon: <Shield className="w-4 h-4" /> },
    { id: 'armory', label: 'Armory', icon: <Crosshair className="w-4 h-4" /> },
    { id: 'vehicles', label: 'Vehicles', icon: <Truck className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <Backpack className="w-4 h-4" /> },
    { id: 'store', label: 'Store', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'battlepass', label: 'Battle Pass', icon: <Crown className="w-4 h-4" /> },
    { id: 'missions', label: 'Missions', icon: <Award className="w-4 h-4" />, badge: unclaimedMissions },
    { id: 'ranked', label: 'Ranked & Career', icon: <Trophy className="w-4 h-4" /> },
    { id: 'events', label: 'Live Events', icon: <Calendar className="w-4 h-4" /> },
    { id: 'esports', label: 'Esports & Rooms', icon: <Swords className="w-4 h-4" /> },
    { id: 'replays', label: 'Replays', icon: <Film className="w-4 h-4" /> },
    { id: 'social', label: 'Friends & Clan', icon: <Users className="w-4 h-4" /> },
  ];

  const cycleWeather = () => {
    audioEngine.playUiClick();
    const order: WeatherType[] = ['clear', 'fog', 'rain', 'storm'];
    const next = order[(order.indexOf(graphics.weather) + 1) % order.length];
    onUpdateWeatherTime(next, graphics.timeOfDay);
  };

  const cycleTime = () => {
    audioEngine.playUiClick();
    const order: TimeOfDay[] = ['day', 'sunset', 'night'];
    const next = order[(order.indexOf(graphics.timeOfDay) + 1) % order.length];
    onUpdateWeatherTime(graphics.weather, next);
  };

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-20">
      {/* Subtle dark top & bottom vignette scrims for contrast without hiding center 3D soldier */}
      <div className="fixed inset-x-0 top-0 h-28 bg-gradient-to-b from-[#101410]/92 via-[#101410]/45 to-transparent pointer-events-none -z-10" />
      <div className="fixed inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#101410]/95 via-[#101410]/55 to-transparent pointer-events-none -z-10" />

      {/* TOP BAR */}
      <header className="flex items-center justify-between gap-4 pointer-events-auto">
        {/* Left: Clickable Operative Profile & Military Rank */}
        <button
          type="button"
          onClick={() => {
            audioEngine.playUiClick();
            onOpenModal('profile');
          }}
          className="flex items-center gap-3.5 bg-[#121712]/92 hover:bg-[#1A2218] border border-[#C6A65A]/30 px-3.5 py-2 clip-tactical-sm text-left transition-colors cursor-pointer"
          title="Open Operative Profile, Career & Account Linking"
        >
          <div
            className="w-10 h-10 flex items-center justify-center font-display font-bold text-sm text-[#101410] border border-[#C6A65A]/60 shrink-0"
            style={{ background: 'linear-gradient(135deg, #C6A65A, #6D5929)' }}
          >
            {profile.level}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-wide text-[#F2F2ED] truncate">
                {profile.name}
              </span>
              <span className="text-xs text-[#C6A65A] font-mono-num">[{profile.clanTag}]</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <span className="font-mono-num">{profile.playerId}</span>
              <span aria-hidden="true">·</span>
              <span style={{ color: rank.current.color }} className="font-semibold">
                {rank.current.name}
              </span>
              <span className="font-mono-num text-[#F2F2ED]/85">{profile.rankPoints} RP</span>
            </div>
            <div className="mt-1 h-1 w-40 bg-[#1E261C] overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${Math.round(rank.progress * 100)}%`, backgroundColor: '#C6A65A' }}
              />
            </div>
          </div>
        </button>

        {/* Center: Original VARKON Military Insignia SVG Lockup */}
        <div className="hidden lg:flex flex-col items-center select-none">
          <svg width="286" height="38" viewBox="0 0 286 38" fill="none" aria-label="VARKON: BATTLEFIELD LEGENDS">
            <path d="M6 6L22 31L38 6H30L22 19L14 6H6Z" fill="#C6A65A" />
            <path d="M22 2L25 9H19L22 2Z" fill="#B83232" />
            <text
              x="48"
              y="22"
              fill="#F2F2ED"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="21"
              letterSpacing="4.2"
            >
              VARKON
            </text>
            <line x1="48" y1="27" x2="274" y2="27" stroke="#C6A65A" strokeOpacity="0.65" strokeWidth="1" />
            <text
              x="48"
              y="36"
              fill="#C6A65A"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="600"
              fontSize="8.5"
              letterSpacing="2.8"
            >
              BATTLEFIELD LEGENDS
            </text>
          </svg>
        </div>

        {/* Right: V-Coins, V-Credits, Mail & Utility Icons */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-4 bg-[#121712]/92 border border-[#C6A65A]/25 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[#C6A65A] font-semibold">V-COINS</span>
              <span className="font-mono-num text-[#F2F2ED] font-semibold">{profile.gold.toLocaleString()}</span>
            </div>
            <span className="text-white/20">/</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#38BDF8] font-semibold">V-CREDITS</span>
              <span className="font-mono-num text-[#F2F2ED] font-semibold">{profile.vexCoins.toLocaleString()}</span>
            </div>
          </div>

          {!profile.dailyRewardClaimedToday && (
            <button
              onClick={() => {
                audioEngine.playUiClick(true);
                onClaimDailyReward();
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#B83232] hover:bg-[#DC2626] border border-[#F87171]/40 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Claim Daily Login Supply Drop"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Day {profile.dailyRewardDay}</span>
            </button>
          )}

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onOpenModal('mail');
            }}
            className="relative p-2.5 bg-[#121712]/92 hover:bg-[#242E1F] border border-[#C6A65A]/25 text-[#F2F2ED] transition-colors cursor-pointer"
            title="Command HQ Mail"
          >
            <Mail className="w-4 h-4" />
            {unreadMail > 0 && (
              <span className="absolute -top-1 -right-1 px-1 bg-[#B83232] text-white font-mono-num text-[9px] font-bold">
                {unreadMail}
              </span>
            )}
          </button>

          <button
            onClick={cycleWeather}
            className="hidden sm:block p-2.5 bg-[#121712]/92 hover:bg-[#242E1F] border border-[#C6A65A]/25 text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            title={`Weather: ${graphics.weather}`}
          >
            <CloudRain className="w-4 h-4" />
          </button>

          <button
            onClick={cycleTime}
            className="hidden sm:block p-2.5 bg-[#121712]/92 hover:bg-[#242E1F] border border-[#C6A65A]/25 text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            title={`Time of Day: ${graphics.timeOfDay}`}
          >
            {graphics.timeOfDay === 'night' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onToggleMute();
            }}
            className="p-2.5 bg-[#121712]/92 hover:bg-[#242E1F] border border-[#C6A65A]/25 text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            title={audio.muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {audio.muted ? <VolumeX className="w-4 h-4 text-[#EF4444]" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onOpenModal('settings');
            }}
            className="p-2.5 bg-[#121712]/92 hover:bg-[#242E1F] border border-[#C6A65A]/25 text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            title="Graphics, Controls, Sensitivity & Custom HUD Editor"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MIDDLE ROW: Compact Perimeter Navigation Only (Center completely unobstructed for 3D Soldier!) */}
      <div className="flex-1 flex items-center justify-between my-3 min-h-0">
        {/* Left: Operator Summary, Collapsible Active Daily Missions Sidebar & Squad Invites */}
        <div className="flex flex-col gap-2.5 max-h-[calc(100vh-195px)] overflow-y-auto pr-0.5 pointer-events-auto">
          <div className="hidden md:block w-64 bg-[#121712]/88 border border-[#C6A65A]/25 p-3">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1.5">
              <span className="font-display font-semibold tracking-wider text-[#C6A65A]">ACTIVE SOLDIER</span>
              <button
                onClick={() => {
                  audioEngine.playUiClick();
                  onOpenModal('characters');
                }}
                className="text-[#F2F2ED] hover:text-[#C6A65A] hover:underline cursor-pointer"
              >
                Customize
              </button>
            </div>
            <div className="font-display font-bold text-base text-[#F2F2ED]">{operator.name}</div>
            <div className="text-xs text-[#94A3B8] mt-0.5">
              {operator.role} · {operator.activeAbility.name}
            </div>
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Primary</span>
              <button
                onClick={() => {
                  audioEngine.playUiClick();
                  onOpenModal('armory');
                }}
                className="text-[#C6A65A] font-semibold hover:text-[#F2F2ED] transition-colors cursor-pointer"
              >
                {weapon.name}
              </button>
            </div>
          </div>

          {/* Collapsible Active Daily Missions Sidebar */}
          <DailyMissionsSidebar
            missions={profile.missions}
            onClaimMission={onClaimMission}
            onOpenAllMissions={() => onOpenModal('missions')}
          />

          {/* Friends Online / Squad Invite quick box */}
          <div className="hidden xl:block w-64 bg-[#121712]/88 border border-[#C6A65A]/22 p-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-display font-semibold tracking-wider text-[#C6A65A]">SQUAD ROSTER</span>
              <span className="font-mono-num text-[#CBD5E1]">
                {1 + invitedFriends.length}/{squadSize === 'solo' ? 1 : squadSize === 'duo' ? 2 : 4}
              </span>
            </div>
            <div className="space-y-1.5">
              {FRIENDS_LIST.slice(0, 3).map((f) => {
                const invited = invitedFriends.includes(f.id);
                return (
                  <div key={f.id} className="flex items-center justify-between text-xs py-1">
                    <div className="min-w-0">
                      <div className="text-[#F2F2ED] font-medium truncate">{f.name}</div>
                      <div className="text-[11px] text-[#94A3B8]">
                        {f.rank} · {f.status}
                      </div>
                    </div>
                    <button
                      disabled={f.status !== 'Online'}
                      onClick={() => {
                        audioEngine.playUiClick(true);
                        onInviteFriend(f.id);
                      }}
                      className={`px-2 py-1 text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                        invited
                          ? 'bg-[#333F2B] border-[#C6A65A]/60 text-[#C6A65A]'
                          : f.status === 'Online'
                          ? 'bg-[#1A2118] border-white/15 text-white hover:border-[#C6A65A]'
                          : 'bg-transparent border-white/5 text-[#475569] cursor-not-allowed'
                      }`}
                    >
                      {invited ? 'Joined' : <UserPlus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Clean Vertical Military Tactical Menu */}
        <nav className="flex flex-col gap-1 pointer-events-auto ml-auto max-h-[calc(100vh-195px)] overflow-y-auto pl-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                audioEngine.playUiClick();
                onOpenModal(item.id);
              }}
              className="group flex items-center justify-end gap-2.5 px-3 py-1.5 bg-[#121712]/88 hover:bg-[#242E1F] border border-[#C6A65A]/20 hover:border-[#C6A65A]/70 text-xs font-display font-semibold tracking-wider text-[#F2F2ED]/85 hover:text-white transition-all cursor-pointer whitespace-nowrap"
            >
              {item.badge ? (
                <span className="px-1.5 py-0.5 bg-[#B83232] text-white font-mono-num text-[10px]">
                  {item.badge}
                </span>
              ) : null}
              <span>{item.label}</span>
              <span className="text-[#C6A65A] group-hover:text-[#F2F2ED] transition-colors">{item.icon}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* BOTTOM ACTION BAR: Mode/Map Selector (Left) + Control Hint (Center) + Prominent Gold PLAY CTA (Right) */}
      <footer className="flex flex-col md:flex-row md:items-end justify-between gap-3 pointer-events-auto">
        {/* Left: Mode, Squad & Map Selector */}
        <div className="relative flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              audioEngine.playUiClick();
              setModeDrawerOpen((o) => !o);
            }}
            className="flex items-center gap-3 bg-[#121712]/94 hover:bg-[#1E261C] border border-[#C6A65A]/35 px-4 py-2.5 text-left transition-colors cursor-pointer clip-tactical-sm"
          >
            <MapPin className="w-4 h-4 text-[#C6A65A] shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm text-[#F2F2ED] uppercase">
                  {MODE_OPTIONS.find((m) => m.id === gameMode)?.label || 'Custom Match'}
                </span>
                <span className="text-xs text-[#C6A65A] font-mono-num uppercase">{squadSize}</span>
                <span className="text-xs text-[#94A3B8]">· {perspective}</span>
              </div>
              <div className="text-xs text-[#94A3B8]">
                {currentMap.name} · {currentMap.sizeLabel} · SBMM {sbmm.tierName}
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-[#C6A65A] transition-transform ${modeDrawerOpen ? '-rotate-90' : ''}`}
            />
          </button>

          {/* Quick Training & Custom Room buttons */}
          <button
            onClick={() => {
              audioEngine.playUiClick(true);
              onSelectMode('training');
            }}
            className={`px-3 py-2.5 text-xs font-display font-semibold tracking-wider border transition-colors cursor-pointer whitespace-nowrap ${
              gameMode === 'training'
                ? 'bg-[#333F2B] border-[#C6A65A] text-[#C6A65A]'
                : 'bg-[#121712]/92 border-[#C6A65A]/22 text-[#CBD5E1] hover:text-white'
            }`}
          >
            TRAINING
          </button>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onOpenModal('esports');
            }}
            className="px-3 py-2.5 text-xs font-display font-semibold tracking-wider bg-[#121712]/92 hover:bg-[#242E1F] border border-[#C6A65A]/22 text-[#CBD5E1] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            CUSTOM ROOM
          </button>

          {/* Mode & Map Selection Popover Drawer */}
          {modeDrawerOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-[min(94vw,580px)] bg-[#121712]/98 border border-[#C6A65A]/35 p-4 shadow-2xl z-30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-display font-bold text-sm tracking-wider text-[#C6A65A]">
                    SELECT GAME MODE & BATTLEGROUND
                  </span>
                  <div className="text-[10px] font-mono-num text-[#94A3B8]">
                    Prototype Notice: Matches run locally with simulated AI bots & SBMM preview
                  </div>
                </div>
                <button
                  onClick={() => setModeDrawerOpen(false)}
                  className="text-xs text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  Done
                </button>
              </div>

              {/* Concept Visual Strip for Modes & Top-Down Shadow Island Map */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="relative h-20 border border-white/10 overflow-hidden bg-[#0E120E]">
                  <img
                    src="/assets/aistudio/07_Game_Modes_26dd03b5.png"
                    alt="VARKON Game Modes"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101410]/90 via-transparent to-transparent flex items-end p-1.5">
                    <span className="text-[10px] font-display font-bold text-[#F2F2ED] uppercase">
                      Mode: {gameMode}
                    </span>
                  </div>
                </div>
                <div className="relative h-20 border border-white/10 overflow-hidden bg-[#0E120E]">
                  <img
                    src="/assets/aistudio/07_battle_royale_map_bf70cb74.png"
                    alt="Shadow Island Top-Down Tactical Map"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-85"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101410]/90 via-transparent to-transparent flex items-end justify-between p-1.5">
                    <span className="text-[10px] font-display font-bold text-[#C6A65A] uppercase">
                      {currentMap.name}
                    </span>
                    <span className="text-[9px] font-mono-num text-[#CBD5E1]">{currentMap.sizeLabel}</span>
                  </div>
                </div>
              </div>

              {/* Game Mode Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
                {MODE_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      audioEngine.playUiClick();
                      onSelectMode(m.id);
                    }}
                    className={`p-2 text-left border transition-colors cursor-pointer ${
                      gameMode === m.id
                        ? 'bg-[#333F2B] border-[#C6A65A] text-white'
                        : 'bg-[#182017] border-white/10 text-[#CBD5E1] hover:border-white/25'
                    }`}
                  >
                    <div className="font-display font-bold text-xs">{m.label}</div>
                    <div className="text-[11px] text-[#94A3B8]">{m.sub}</div>
                  </button>
                ))}
              </div>

              {/* Training Bot Difficulty Selector when Training is selected */}
              {gameMode === 'training' && (
                <div className="mb-3 p-2.5 bg-[#182017] border border-[#C6A65A]/30">
                  <div className="text-[10px] font-mono-num uppercase text-[#C6A65A] mb-1.5">
                    Training Ground AI Bot Difficulty
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {BOT_DIFFICULTIES.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          audioEngine.playUiClick();
                          onSelectBotDifficulty(b.id);
                        }}
                        className={`py-1.5 text-[11px] font-display font-bold uppercase border cursor-pointer ${
                          botDifficulty === b.id
                            ? 'bg-[#C6A65A] text-[#101410] border-[#F2F2ED]/40'
                            : 'bg-[#101410] text-[#94A3B8] border-white/10 hover:text-white'
                        }`}
                        title={b.desc}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Squad Size & Perspective */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-1">
                  {(['solo', 'duo', 'squad'] as SquadSize[]).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => {
                        audioEngine.playUiClick();
                        onSelectSquad(sz);
                      }}
                      className={`px-3 py-1.5 text-xs font-display font-semibold uppercase border transition-colors cursor-pointer ${
                        squadSize === sz
                          ? 'bg-[#B83232] border-[#EF4444] text-white'
                          : 'bg-[#182017] border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  {(['TPP', 'FPP'] as PerspectiveMode[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        if (perspective !== p) {
                          audioEngine.playUiClick();
                          onTogglePerspective();
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-display font-semibold border transition-colors cursor-pointer ${
                        perspective === p
                          ? 'bg-[#C6A65A]/25 border-[#C6A65A] text-[#C6A65A]'
                          : 'bg-[#182017] border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Maps */}
              <div className="grid grid-cols-2 gap-2">
                {MAPS.map((mp) => (
                  <button
                    key={mp.id}
                    onClick={() => {
                      audioEngine.playUiClick();
                      onSelectMap(mp.id);
                    }}
                    className={`p-2.5 text-left border transition-colors cursor-pointer ${
                      mapId === mp.id
                        ? 'bg-[#242E1F] border-[#C6A65A] text-white'
                        : 'bg-[#161C15] border-white/10 text-[#CBD5E1] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-xs">{mp.name}</span>
                      <span className="text-[10px] font-mono-num text-[#C6A65A]">{mp.sizeLabel}</span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5 truncate">{mp.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Clean Flat Control Hint */}
        <div className="hidden xl:flex items-center gap-2 text-xs text-[#94A3B8] pb-2">
          <span>Drag 3D Soldier to Rotate</span>
          <span aria-hidden="true">·</span>
          <span>WASD Move · Mouse Aim & Fire · E Loot / Vehicle · Q Ability</span>
        </div>

        {/* Right: Prominent Metallic Gold PLAY Button */}
        <div className="flex items-center gap-3 self-end">
          <div className="hidden sm:block text-right text-xs">
            <div className="text-[#94A3B8]">3D Prototype · Local AI Bots</div>
            <div className="font-display font-semibold uppercase text-[#F2F2ED]">
              {graphics.preset} · {graphics.fpsCap} FPS
            </div>
          </div>

          <button
            onClick={() => {
              audioEngine.playUiClick(true);
              onPlay();
            }}
            className="group relative flex items-center justify-center gap-3 px-10 py-4 bg-gradient-to-r from-[#9E7C36] via-[#C6A65A] to-[#8C6D2E] hover:from-[#D5B66E] hover:to-[#C6A65A] border border-[#F2F2ED]/50 text-[#101410] font-display font-bold text-xl tracking-[0.2em] shadow-[0_0_28px_rgba(198,166,90,0.4)] transition-all active:scale-[0.98] cursor-pointer clip-tactical whitespace-nowrap"
          >
            <Swords className="w-5 h-5" />
            <span>PLAY</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
