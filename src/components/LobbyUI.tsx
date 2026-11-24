import React, { useState } from 'react';
import {
  Award,
  Backpack,
  Calendar,
  Crosshair,
  Crown,
  Gift,
  MapPin,
  Settings,
  Shield,
  ShoppingBag,
  Swords,
  Users,
  Volume2,
  VolumeX,
  CloudRain,
  Sun,
  Moon,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import { DailyMissionsSidebar } from './DailyMissionsSidebar';
import { FRIENDS_LIST, getMapById, getOperatorById, getRankInfo, getWeaponById, MAPS } from '../game/data';
import {
  AudioSettings,
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
import { audioEngine } from '../game/audio';

interface LobbyUIProps {
  profile: PlayerProfile;
  gameMode: GameModeId;
  squadSize: SquadSize;
  mapId: MapId;
  perspective: PerspectiveMode;
  graphics: GraphicsSettings;
  audio: AudioSettings;
  invitedFriends: string[];
  onSelectMode: (mode: GameModeId) => void;
  onSelectSquad: (size: SquadSize) => void;
  onSelectMap: (mapId: MapId) => void;
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
  { id: 'classic', label: 'Classic BR', sub: 'Survival · 28 Players' },
  { id: 'ranked', label: 'Ranked BR', sub: 'Competitive · RP Stakes' },
  { id: 'arena4v4', label: '4v4 Arena', sub: 'Fast Squad Clash' },
  { id: 'sniper', label: 'Sniper Ops', sub: 'Long-Range Bolt Action' },
  { id: 'training', label: 'Training', sub: 'Range · Bots · Vehicles' },
];

export const LobbyUI: React.FC<LobbyUIProps> = ({
  profile,
  gameMode,
  squadSize,
  mapId,
  perspective,
  graphics,
  audio,
  invitedFriends,
  onSelectMode,
  onSelectSquad,
  onSelectMap,
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

  const unclaimedMissions = profile.missions.filter((m) => m.progress >= m.target && !m.claimed).length;

  const navItems: Array<{ id: LobbyModal; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'characters', label: 'Characters', icon: <Shield className="w-4 h-4" /> },
    { id: 'armory', label: 'Armory', icon: <Crosshair className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <Backpack className="w-4 h-4" /> },
    { id: 'store', label: 'Store', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'battlepass', label: 'Battle Pass', icon: <Crown className="w-4 h-4" /> },
    { id: 'missions', label: 'Missions', icon: <Award className="w-4 h-4" />, badge: unclaimedMissions },
    { id: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" /> },
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
      {/* Subtle dark top & bottom vignette scrims for contrast without hiding center 3D subject */}
      <div className="fixed inset-x-0 top-0 h-28 bg-gradient-to-b from-[#090A0D]/90 via-[#090A0D]/40 to-transparent pointer-events-none -z-10" />
      <div className="fixed inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#090A0D]/95 via-[#090A0D]/55 to-transparent pointer-events-none -z-10" />

      {/* TOP BAR */}
      <header className="flex items-center justify-between gap-4 pointer-events-auto">
        {/* Left: Player Profile & Rank */}
        <div className="flex items-center gap-3.5 bg-[#0F1218]/90 border border-[#C8D0DC]/15 px-3.5 py-2 clip-tactical-sm">
          <div
            className="w-10 h-10 flex items-center justify-center font-display font-bold text-sm text-white border border-white/20 shrink-0"
            style={{ background: `linear-gradient(135deg, ${operator.accentColor}, #141821)` }}
          >
            {profile.level}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-wide text-white truncate">
                {profile.name}
              </span>
              <span className="text-xs text-[#94A3B8] font-mono-num">[{profile.clanTag}]</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <span className="font-mono-num">{profile.playerId}</span>
              <span aria-hidden="true">·</span>
              <span style={{ color: rank.current.color }} className="font-semibold">
                {rank.current.name}
              </span>
              <span className="font-mono-num text-[#CBD5E1]">{profile.rankPoints} RP</span>
            </div>
            <div className="mt-1 h-1 w-40 bg-[#1C212A] overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${Math.round(rank.progress * 100)}%`, backgroundColor: rank.current.color }}
              />
            </div>
          </div>
        </div>

        {/* Center: Bespoke Inline SVG Title Lockup */}
        <div className="hidden lg:flex flex-col items-center select-none">
          <svg width="260" height="36" viewBox="0 0 260 36" fill="none" aria-label="VEXORA: LAST SURVIVOR">
            <path d="M8 6L22 30L36 6H29L22 19L15 6H8Z" fill="#DC2626" />
            <path d="M22 25L27 30H17L22 25Z" fill="#38BDF8" />
            <text
              x="46"
              y="22"
              fill="#F1F5F9"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="20"
              letterSpacing="4"
            >
              VEXORA
            </text>
            <line x1="46" y1="27" x2="246" y2="27" stroke="#DC2626" strokeOpacity="0.65" strokeWidth="1" />
            <text
              x="46"
              y="35"
              fill="#94A3B8"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="500"
              fontSize="8.5"
              letterSpacing="3.4"
            >
              LAST SURVIVOR
            </text>
          </svg>
        </div>

        {/* Right: Currencies & Utility Icons */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-4 bg-[#0F1218]/90 border border-[#C8D0DC]/15 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[#F59E0B] font-semibold">GOLD</span>
              <span className="font-mono-num text-white font-semibold">{profile.gold.toLocaleString()}</span>
            </div>
            <span className="text-[#475569]">/</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#38BDF8] font-semibold">VEX</span>
              <span className="font-mono-num text-white font-semibold">{profile.vexCoins.toLocaleString()}</span>
            </div>
          </div>

          {!profile.dailyRewardClaimedToday && (
            <button
              onClick={() => {
                audioEngine.playUiClick(true);
                onClaimDailyReward();
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#7F1D1D]/90 hover:bg-[#DC2626] border border-[#EF4444]/50 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Claim Daily Login Reward"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Day {profile.dailyRewardDay}</span>
            </button>
          )}

          <button
            onClick={cycleWeather}
            className="p-2.5 bg-[#0F1218]/90 hover:bg-[#1C212A] border border-[#C8D0DC]/15 text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            title={`Weather: ${graphics.weather}`}
          >
            <CloudRain className="w-4 h-4" />
          </button>

          <button
            onClick={cycleTime}
            className="p-2.5 bg-[#0F1218]/90 hover:bg-[#1C212A] border border-[#C8D0DC]/15 text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            title={`Time of Day: ${graphics.timeOfDay}`}
          >
            {graphics.timeOfDay === 'night' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onToggleMute();
            }}
            className="p-2.5 bg-[#0F1218]/90 hover:bg-[#1C212A] border border-[#C8D0DC]/15 text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            title={audio.muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {audio.muted ? <VolumeX className="w-4 h-4 text-[#EF4444]" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onOpenModal('settings');
            }}
            className="p-2.5 bg-[#0F1218]/90 hover:bg-[#1C212A] border border-[#C8D0DC]/15 text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            title="Graphics, Controls & Custom HUD Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MIDDLE ROW: Compact Perimeter Navigation Only (Center 70% completely unobstructed for 3D Operator!) */}
      <div className="flex-1 flex items-center justify-between my-3 min-h-0">
        {/* Left: Operator Summary, Collapsible Active Daily Missions Sidebar & Squad Invites */}
        <div className="flex flex-col gap-2.5 max-h-[calc(100vh-195px)] overflow-y-auto pr-0.5 pointer-events-auto">
          <div className="hidden md:block w-64 bg-[#0F1218]/86 border border-[#C8D0DC]/12 p-3">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
              <span className="font-display font-semibold tracking-wider text-[#CBD5E1]">ACTIVE OPERATOR</span>
              <button
                onClick={() => {
                  audioEngine.playUiClick();
                  onOpenModal('characters');
                }}
                className="text-[#38BDF8] hover:underline cursor-pointer"
              >
                Swap
              </button>
            </div>
            <div className="font-display font-bold text-base text-white">{operator.name}</div>
            <div className="text-xs text-[#94A3B8] mt-0.5">
              {operator.role} · {operator.activeAbility.name}
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-[#94A3B8]">Primary</span>
              <button
                onClick={() => {
                  audioEngine.playUiClick();
                  onOpenModal('armory');
                }}
                className="text-white font-semibold hover:text-[#EF4444] transition-colors cursor-pointer"
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
          <div className="hidden lg:block w-64 bg-[#0F1218]/86 border border-[#C8D0DC]/12 p-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-display font-semibold tracking-wider text-[#CBD5E1]">SQUAD ONLINE</span>
              <span className="font-mono-num text-[#94A3B8]">
                {1 + invitedFriends.length}/{squadSize === 'solo' ? 1 : squadSize === 'duo' ? 2 : 4}
              </span>
            </div>
            <div className="space-y-1.5">
              {FRIENDS_LIST.slice(0, 3).map((f) => {
                const invited = invitedFriends.includes(f.id);
                return (
                  <div key={f.id} className="flex items-center justify-between text-xs py-1">
                    <div className="min-w-0">
                      <div className="text-[#E2E8F0] font-medium truncate">{f.name}</div>
                      <div className="text-[11px] text-[#64748B]">
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
                          ? 'bg-[#38BDF8]/20 border-[#38BDF8]/50 text-[#38BDF8]'
                          : f.status === 'Online'
                          ? 'bg-[#1C212A] border-white/15 text-white hover:border-[#DC2626]'
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

        {/* Right: Clean Vertical Tactical Menu */}
        <nav className="flex flex-col gap-1.5 pointer-events-auto ml-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                audioEngine.playUiClick();
                onOpenModal(item.id);
              }}
              className="group flex items-center justify-end gap-3 px-3.5 py-2 bg-[#0F1218]/85 hover:bg-[#1C212A] border border-[#C8D0DC]/12 hover:border-[#DC2626]/60 text-xs font-display font-semibold tracking-wider text-[#CBD5E1] hover:text-white transition-all cursor-pointer whitespace-nowrap"
            >
              {item.badge ? (
                <span className="px-1.5 py-0.5 bg-[#DC2626] text-white font-mono-num text-[10px]">
                  {item.badge}
                </span>
              ) : null}
              <span>{item.label}</span>
              <span className="text-[#94A3B8] group-hover:text-[#EF4444] transition-colors">{item.icon}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* BOTTOM ACTION BAR: Mode/Map Selector (Left) + Control Hint (Center) + Prominent PLAY CTA (Right) */}
      <footer className="flex flex-col md:flex-row md:items-end justify-between gap-3 pointer-events-auto">
        {/* Left: Mode, Squad & Map Selector */}
        <div className="relative flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              audioEngine.playUiClick();
              setModeDrawerOpen((o) => !o);
            }}
            className="flex items-center gap-3 bg-[#0F1218]/92 hover:bg-[#1A1F29] border border-[#C8D0DC]/20 px-4 py-2.5 text-left transition-colors cursor-pointer clip-tactical-sm"
          >
            <MapPin className="w-4 h-4 text-[#EF4444] shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm text-white uppercase">
                  {MODE_OPTIONS.find((m) => m.id === gameMode)?.label}
                </span>
                <span className="text-xs text-[#38BDF8] font-mono-num uppercase">{squadSize}</span>
                <span className="text-xs text-[#94A3B8]">· {perspective}</span>
              </div>
              <div className="text-xs text-[#94A3B8]">
                {currentMap.name} · {currentMap.sizeLabel}
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-[#94A3B8] transition-transform ${modeDrawerOpen ? '-rotate-90' : ''}`}
            />
          </button>

          {/* Quick Training Button */}
          <button
            onClick={() => {
              audioEngine.playUiClick(true);
              onSelectMode('training');
            }}
            className={`px-3.5 py-2.5 text-xs font-display font-semibold tracking-wider border transition-colors cursor-pointer whitespace-nowrap ${
              gameMode === 'training'
                ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#0F1218]/90 border-[#C8D0DC]/15 text-[#CBD5E1] hover:text-white'
            }`}
          >
            TRAINING
          </button>

          {/* Mode & Map Selection Popover Drawer */}
          {modeDrawerOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-[min(92vw,540px)] bg-[#0E1117]/96 border border-[#C8D0DC]/20 p-4 shadow-2xl z-30">
              <div className="flex items-center justify-between mb-3">
                <span className="font-display font-bold text-sm tracking-wider text-white">
                  SELECT MODE & BATTLEGROUND
                </span>
                <button
                  onClick={() => setModeDrawerOpen(false)}
                  className="text-xs text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  Done
                </button>
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
                        ? 'bg-[#7F1D1D]/45 border-[#DC2626] text-white'
                        : 'bg-[#161A23] border-white/10 text-[#CBD5E1] hover:border-white/25'
                    }`}
                  >
                    <div className="font-display font-bold text-xs">{m.label}</div>
                    <div className="text-[11px] text-[#94A3B8]">{m.sub}</div>
                  </button>
                ))}
              </div>

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
                          ? 'bg-[#DC2626] border-[#EF4444] text-white'
                          : 'bg-[#161A23] border-white/10 text-[#94A3B8] hover:text-white'
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
                          ? 'bg-[#38BDF8]/25 border-[#38BDF8] text-[#38BDF8]'
                          : 'bg-[#161A23] border-white/10 text-[#94A3B8] hover:text-white'
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
                        ? 'bg-[#1E2736] border-[#38BDF8] text-white'
                        : 'bg-[#141821] border-white/10 text-[#CBD5E1] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-xs">{mp.name}</span>
                      <span className="text-[10px] font-mono-num text-[#94A3B8]">{mp.sizeLabel}</span>
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
          <span>Drag 3D Operator to Rotate</span>
          <span aria-hidden="true">·</span>
          <span>WASD Move · Mouse Aim & Fire · E Loot / Drive · Q Ability</span>
        </div>

        {/* Right: Prominent Tactical Crimson PLAY Button */}
        <div className="flex items-center gap-3 self-end">
          <div className="hidden sm:block text-right text-xs">
            <div className="text-[#94A3B8]">Graphics Preset</div>
            <div className="font-display font-semibold uppercase text-white">
              {graphics.preset} · {graphics.fpsCap} FPS
            </div>
          </div>

          <button
            onClick={() => {
              audioEngine.playUiClick(true);
              onPlay();
            }}
            className="group relative flex items-center justify-center gap-3 px-10 py-4 bg-gradient-to-r from-[#B91C1C] via-[#DC2626] to-[#991B1B] hover:from-[#DC2626] hover:to-[#EF4444] border border-[#F87171]/60 text-white font-display font-bold text-xl tracking-[0.18em] shadow-[0_0_28px_rgba(220,38,38,0.45)] transition-all active:scale-[0.98] cursor-pointer clip-tactical whitespace-nowrap"
          >
            <Swords className="w-5 h-5" />
            <span>PLAY</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
