import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Camera,
  Check,
  Crosshair,
  Film,
  KeyRound,
  Pause,
  Play,
  Shield,
  Sliders,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import { BOT_DIFFICULTIES, getMapById, MAPS, TOURNAMENTS } from '../game/data';
import {
  BotDifficulty,
  CustomRoomConfig,
  GameModeId,
  MapId,
  MatchHistoryRecord,
  PerspectiveMode,
  PlayerProfile,
  SquadSize,
} from '../game/types';

interface EsportsReplayModalProps {
  initialTab: 'custom' | 'tournaments' | 'replays';
  profile: PlayerProfile;
  onLaunchCustomRoom: (config: CustomRoomConfig) => void;
  onToggleTournamentRegister: (tournamentId: string) => void;
  onToggleSaveHighlight: (matchId: string) => void;
  onClose: () => void;
}

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const EsportsReplayModal: React.FC<EsportsReplayModalProps> = ({
  initialTab,
  profile,
  onLaunchCustomRoom,
  onToggleTournamentRegister,
  onToggleSaveHighlight,
  onClose,
}) => {
  const [tab, setTab] = useState<'custom' | 'tournaments' | 'replays'>(initialTab);

  // Custom Room State
  const [roomConfig, setRoomConfig] = useState<CustomRoomConfig>({
    roomId: `VK-${Math.floor(100000 + Math.random() * 899999)}`,
    roomName: `${profile.name}'s Tactical Scrim`,
    password: '',
    mode: 'custom',
    mapId: 'aethelgard',
    squadSize: 'squad',
    perspective: 'TPP',
    maxPlayers: 28,
    zoneSpeed: 'Tournament',
    lootRate: 'High Loot',
    friendlyFire: false,
    allowSpectators: true,
    botDifficulty: 'normal',
  });
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinNotice, setJoinNotice] = useState<string | null>(null);

  // Replay & Kill Cam State
  const history = profile.matchHistory;
  const [selectedMatchId, setSelectedMatchId] = useState<string>(history[0]?.id || '');
  const selectedMatch: MatchHistoryRecord | undefined =
    history.find((m) => m.id === selectedMatchId) || history[0];
  const duration = selectedMatch?.durationSec || 360;
  const [playTime, setPlayTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(1);
  const [cameraMode, setCameraMode] = useState<
    'First-Person' | 'Third-Person' | 'Free Camera' | 'Cinematic' | 'Squad Spectator'
  >('Third-Person');

  useEffect(() => {
    if (!isPlaying || tab !== 'replays') return;
    const id = window.setInterval(() => {
      setPlayTime((t) => {
        const next = t + playbackSpeed;
        if (next >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [isPlaying, playbackSpeed, duration, tab]);

  const events = selectedMatch?.events || [
    {
      timeSec: 45,
      type: 'elimination' as const,
      label: 'Combat Engagement',
      detail: `${selectedMatch?.kills || 0} Eliminations · ${selectedMatch?.damage || 0} Damage`,
      weapon: 'M4-VEX Tactical',
      distanceM: 52,
    },
  ];
  const activeEvent =
    [...events].reverse().find((ev) => ev.timeSec <= playTime) || events[0];

  return (
    <div className="fixed inset-0 z-40 bg-[#0A0D0A]/92 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#121712] border border-[#C6A65A]/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#C6A65A]/20 bg-[#161D15]">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'custom', label: 'Custom Rooms', icon: <Sliders className="w-4 h-4" /> },
                { id: 'tournaments', label: 'Esports & Cups', icon: <Trophy className="w-4 h-4" /> },
                { id: 'replays', label: 'Replays & Kill Cam', icon: <Film className="w-4 h-4" /> },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  audioEngine.playUiClick();
                  setTab(t.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-display font-bold tracking-wider uppercase border transition-colors cursor-pointer whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-[#C6A65A] border-[#E0C37C] text-[#101410]'
                    : 'bg-[#1A2218] border-white/10 text-[#CBD5E1] hover:text-white'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              audioEngine.playUiClick();
              onClose();
            }}
            className="p-2 bg-[#1D251B] hover:bg-[#B83232] text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* CUSTOM ROOMS */}
          {tab === 'custom' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 bg-[#182017] border border-[#C6A65A]/25 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-mono-num text-[#C6A65A] uppercase">
                      PRIVATE SCRIM & TOURNAMENT ROOM
                    </div>
                    <h3 className="font-display font-bold text-lg text-[#F2F2ED] uppercase">
                      Configure Custom Match
                    </h3>
                  </div>
                  <div className="px-3 py-1.5 bg-[#101410] border border-[#C6A65A]/40 font-mono-num text-xs text-[#C6A65A]">
                    ROOM ID: {roomConfig.roomId}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1 uppercase">Room Name</label>
                    <input
                      type="text"
                      value={roomConfig.roomName}
                      onChange={(e) => setRoomConfig({ ...roomConfig, roomName: e.target.value })}
                      className="w-full bg-[#0E120E] border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-[#C6A65A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1 uppercase">
                      Room Password (Optional)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={roomConfig.password}
                        onChange={(e) => setRoomConfig({ ...roomConfig, password: e.target.value })}
                        placeholder="Open Room"
                        className="w-full bg-[#0E120E] border border-white/15 pl-8 pr-3 py-2 text-white focus:outline-none focus:border-[#C6A65A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1 uppercase">Battleground Map</label>
                    <select
                      value={roomConfig.mapId}
                      onChange={(e) => setRoomConfig({ ...roomConfig, mapId: e.target.value as MapId })}
                      className="w-full bg-[#0E120E] border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-[#C6A65A]"
                    >
                      {MAPS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.sizeLabel})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1 uppercase">Ruleset Mode</label>
                    <select
                      value={roomConfig.mode}
                      onChange={(e) => setRoomConfig({ ...roomConfig, mode: e.target.value as GameModeId })}
                      className="w-full bg-[#0E120E] border border-white/15 px-3 py-2 text-white focus:outline-none focus:border-[#C6A65A]"
                    >
                      <option value="custom">Custom Battle Royale</option>
                      <option value="tdm">Team Deathmatch</option>
                      <option value="arena4v4">Clash Squad (4v4)</option>
                      <option value="sniper">Sniper Only Challenge</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1 uppercase">Squad Format</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['solo', 'duo', 'squad'] as SquadSize[]).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setRoomConfig({ ...roomConfig, squadSize: sz })}
                          className={`py-2 font-display font-bold uppercase border cursor-pointer ${
                            roomConfig.squadSize === sz
                              ? 'bg-[#C6A65A] text-[#101410] border-[#E0C37C]'
                              : 'bg-[#0E120E] text-[#94A3B8] border-white/10'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#94A3B8] mb-1 uppercase">Camera & AI Difficulty</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={roomConfig.perspective}
                        onChange={(e) =>
                          setRoomConfig({ ...roomConfig, perspective: e.target.value as PerspectiveMode })
                        }
                        className="bg-[#0E120E] border border-white/15 px-2 py-2 text-white"
                      >
                        <option value="TPP">TPP</option>
                        <option value="FPP">FPP</option>
                      </select>
                      <select
                        value={roomConfig.botDifficulty}
                        onChange={(e) =>
                          setRoomConfig({ ...roomConfig, botDifficulty: e.target.value as BotDifficulty })
                        }
                        className="bg-[#0E120E] border border-white/15 px-2 py-2 text-white"
                      >
                        {BOT_DIFFICULTIES.map((b) => (
                          <option key={b.id} value={b.id}>
                            AI: {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Rule Toggles */}
                <div className="flex flex-wrap gap-4 pt-2 border-t border-white/10 text-xs text-[#CBD5E1]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roomConfig.allowSpectators}
                      onChange={(e) => setRoomConfig({ ...roomConfig, allowSpectators: e.target.checked })}
                      className="accent-[#C6A65A]"
                    />
                    <span>Enable Broadcast Spectators (Delayed)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roomConfig.friendlyFire}
                      onChange={(e) => setRoomConfig({ ...roomConfig, friendlyFire: e.target.checked })}
                      className="accent-[#C6A65A]"
                    />
                    <span>Hardcore Friendly Fire</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onLaunchCustomRoom(roomConfig);
                  }}
                  className="w-full py-3 bg-gradient-to-r from-[#A5843E] via-[#C6A65A] to-[#8F6F2E] hover:from-[#D5B56A] hover:to-[#C6A65A] text-[#101410] font-display font-bold text-sm tracking-[0.18em] uppercase cursor-pointer clip-tactical-sm"
                >
                  LAUNCH CUSTOM ROOM MATCH
                </button>
              </div>

              {/* Join Room Panel */}
              <div className="lg:col-span-4 bg-[#182017] border border-white/10 p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="font-display font-bold text-xs tracking-wider text-[#C6A65A] uppercase">
                    Join Room by ID
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    Enter a Room ID shared by your clan leader or tournament host.
                  </p>
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="e.g. VK-492810"
                    className="w-full bg-[#0E120E] border border-white/15 px-3 py-2 text-xs font-mono-num text-white focus:outline-none focus:border-[#C6A65A]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick();
                      if (!joinRoomId.trim()) {
                        setJoinNotice('Enter a valid Room ID first.');
                      } else {
                        setJoinNotice(
                          `Local prototype mode: live remote rooms require dedicated multiplayer servers. Launching local custom lobby for ${joinRoomId.trim().toUpperCase()}.`
                        );
                      }
                    }}
                    className="w-full py-2.5 bg-[#333F2B] hover:bg-[#495A3E] border border-[#C6A65A]/40 text-xs font-display font-bold text-white uppercase cursor-pointer"
                  >
                    Connect to Room
                  </button>
                  {joinNotice && (
                    <div className="p-2.5 bg-[#101410] border border-[#C6A65A]/30 text-[11px] text-[#CBD5E1]">
                      {joinNotice}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-[#101410] border border-white/10 text-[11px] text-[#94A3B8] space-y-1">
                  <div className="font-display font-bold text-[#F2F2ED] uppercase">Room Summary</div>
                  <div>Map: {getMapById(roomConfig.mapId).name}</div>
                  <div>Zone Speed: {roomConfig.zoneSpeed} · Loot: {roomConfig.lootRate}</div>
                  <div>AI Calibration: {roomConfig.botDifficulty.toUpperCase()}</div>
                </div>
              </div>
            </div>
          )}

          {/* ESPORTS & TOURNAMENTS */}
          {tab === 'tournaments' && (
            <div className="space-y-4">
              <div className="relative p-5 border border-[#C6A65A]/40 overflow-hidden bg-[#161D15]">
                <img
                  src="/assets/aistudio/03_Battle_Royale_Gameplay_HUD_ce5b42db.png"
                  alt="VARKON Championship Banner"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
                />
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-mono-num text-[#C6A65A] uppercase">
                      VARKON ESPORTS CIRCUIT · SEASON 1
                    </div>
                    <h3 className="font-display font-bold text-2xl text-[#F2F2ED] uppercase mt-0.5">
                      Operation Legacy Championships
                    </h3>
                    <p className="text-xs text-[#CBD5E1] mt-1">
                      Register solo or with your clan squad to compete for V-Credits, Championship Trophies, and VARKON Elite titles.
                    </p>
                  </div>
                  <div className="text-right font-mono-num text-xs">
                    <div className="text-[#94A3B8]">REGISTERED EVENTS</div>
                    <div className="text-2xl font-bold text-[#C6A65A]">
                      {(profile.registeredTournaments || []).length} / {TOURNAMENTS.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {TOURNAMENTS.map((tour) => {
                  const isReg = (profile.registeredTournaments || []).includes(tour.id);
                  const map = getMapById(tour.mapId);
                  return (
                    <div
                      key={tour.id}
                      className="bg-[#182017] border border-white/12 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono-num">
                          <span className="text-[#C6A65A] uppercase">{tour.format}</span>
                          <span
                            className={
                              tour.status === 'Live'
                                ? 'text-[#EF4444] font-bold'
                                : tour.status === 'Open'
                                ? 'text-[#22C55E] font-bold'
                                : 'text-[#94A3B8]'
                            }
                          >
                            {tour.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="font-display font-bold text-base text-[#F2F2ED] mt-1">
                          {tour.name}
                        </div>
                        <div className="text-xs text-[#94A3B8] mt-1">
                          {map.name} · {tour.schedule} · Min Rank: {tour.minRank}
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-xs bg-[#101410] border border-white/8 px-3 py-2">
                          <span className="text-[#C6A65A] font-semibold">{tour.prizePool}</span>
                          <span className="font-mono-num text-[#CBD5E1] flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {tour.teamsRegistered + (isReg ? 1 : 0)}/{tour.maxTeams}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          audioEngine.playUiClick(true);
                          onToggleTournamentRegister(tour.id);
                        }}
                        className={`w-full py-2 text-xs font-display font-bold tracking-wider uppercase border cursor-pointer ${
                          isReg
                            ? 'bg-[#333F2B] border-[#22C55E]/60 text-[#22C55E]'
                            : 'bg-[#C6A65A] hover:bg-[#D9B86C] border-[#F2F2ED]/30 text-[#101410]'
                        }`}
                      >
                        {isReg ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Registered · Click to Withdraw
                          </span>
                        ) : (
                          'Register Squad'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MATCH REPLAYS, KILL CAM & HIGHLIGHTS */}
          {tab === 'replays' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Match List */}
              <div className="lg:col-span-4 space-y-2">
                <div className="font-display font-bold text-xs tracking-wider text-[#C6A65A] uppercase mb-2">
                  Recorded Matches ({history.length})
                </div>
                {history.map((mh) => {
                  const active = selectedMatch?.id === mh.id;
                  const saved = (profile.savedHighlightIds || []).includes(mh.id);
                  return (
                    <button
                      key={mh.id}
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick();
                        setSelectedMatchId(mh.id);
                        setPlayTime(0);
                        setIsPlaying(false);
                      }}
                      className={`w-full text-left p-3 border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#242E1F] border-[#C6A65A]'
                          : 'bg-[#171E16] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-display font-bold text-[#F2F2ED] uppercase">
                          #{mh.placement} {getMapById(mh.mapId).name}
                        </span>
                        {saved && <Bookmark className="w-3.5 h-3.5 text-[#C6A65A] fill-[#C6A65A]" />}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">
                        {mh.mode.toUpperCase()} · {mh.dateLabel}
                      </div>
                      <div className="text-[11px] font-mono-num text-[#CBD5E1] mt-1">
                        {mh.kills} Kills · {mh.headshots} HS · {mh.damage} DMG
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Interactive Replay Viewport & Timeline */}
              <div className="lg:col-span-8 space-y-4">
                {selectedMatch && (
                  <>
                    <div className="relative h-56 bg-[#0C100C] border border-[#C6A65A]/30 overflow-hidden flex flex-col justify-between p-4">
                      <img
                        src="/assets/aistudio/07_battle_royale_map_bf70cb74.png"
                        alt="Tactical Replay Map Feed"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover opacity-35"
                      />
                      <div className="relative z-10 flex items-center justify-between text-xs">
                        <span className="px-2.5 py-1 bg-[#101410]/90 border border-[#C6A65A]/40 font-mono-num text-[#C6A65A]">
                          REPLAY · {cameraMode.toUpperCase()} · {playbackSpeed}x
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            audioEngine.playUiClick(true);
                            onToggleSaveHighlight(selectedMatch.id);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#101410]/90 hover:bg-[#333F2B] border border-white/20 text-[#F2F2ED] cursor-pointer"
                        >
                          <Bookmark className="w-3.5 h-3.5 text-[#C6A65A]" />
                          <span>
                            {(profile.savedHighlightIds || []).includes(selectedMatch.id)
                              ? 'Saved in Highlights'
                              : 'Save Highlight'}
                          </span>
                        </button>
                      </div>

                      {/* Kill Cam / Active Event Telemetry Overlay */}
                      <div className="relative z-10 bg-[#101410]/90 border border-[#C6A65A]/35 p-3.5">
                        <div className="flex items-center justify-between text-[11px] font-mono-num text-[#C6A65A]">
                          <span>{activeEvent.type.toUpperCase()} TELEMETRY</span>
                          <span>{fmtClock(activeEvent.timeSec)}</span>
                        </div>
                        <div className="font-display font-bold text-base text-[#F2F2ED] mt-0.5">
                          {activeEvent.label}
                        </div>
                        <div className="text-xs text-[#CBD5E1] mt-0.5">{activeEvent.detail}</div>
                        {activeEvent.weapon && (
                          <div className="mt-1.5 text-[11px] font-mono-num text-[#94A3B8] flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-[#EF4444]">
                              <Crosshair className="w-3 h-3" /> {activeEvent.weapon}
                            </span>
                            {activeEvent.distanceM && <span>Distance: {activeEvent.distanceM}m</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Playback Scrubber & Camera Selector */}
                    <div className="bg-[#182017] border border-white/10 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              audioEngine.playUiClick();
                              setIsPlaying((p) => !p);
                            }}
                            className="px-3.5 py-1.5 bg-[#C6A65A] text-[#101410] font-display font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer"
                          >
                            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span>{isPlaying ? 'Pause' : 'Play'}</span>
                          </button>

                          {([0.5, 1, 2] as const).map((spd) => (
                            <button
                              key={spd}
                              type="button"
                              onClick={() => setPlaybackSpeed(spd)}
                              className={`px-2 py-1.5 text-[11px] font-mono-num border cursor-pointer ${
                                playbackSpeed === spd
                                  ? 'bg-[#333F2B] border-[#C6A65A] text-[#C6A65A]'
                                  : 'bg-[#101410] border-white/10 text-[#94A3B8]'
                              }`}
                            >
                              {spd}x
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs">
                          <Camera className="w-3.5 h-3.5 text-[#C6A65A]" />
                          <select
                            value={cameraMode}
                            onChange={(e) => setCameraMode(e.target.value as typeof cameraMode)}
                            className="bg-[#101410] border border-white/15 px-2 py-1 text-xs text-white"
                          >
                            <option value="First-Person">First-Person</option>
                            <option value="Third-Person">Third-Person</option>
                            <option value="Free Camera">Free Camera</option>
                            <option value="Cinematic">Cinematic</option>
                            <option value="Squad Spectator">Squad Spectator</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono-num text-xs text-[#C6A65A]">{fmtClock(playTime)}</span>
                        <input
                          type="range"
                          min={0}
                          max={duration}
                          value={playTime}
                          onChange={(e) => setPlayTime(Number(e.target.value))}
                          className="flex-1 accent-[#C6A65A]"
                        />
                        <span className="font-mono-num text-xs text-[#94A3B8]">{fmtClock(duration)}</span>
                      </div>

                      {/* Event Jump Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {events.map((ev, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              audioEngine.playUiClick();
                              setPlayTime(ev.timeSec);
                            }}
                            className={`px-2.5 py-1 text-[11px] border cursor-pointer transition-colors ${
                              activeEvent === ev
                                ? 'bg-[#C6A65A]/20 border-[#C6A65A] text-[#F2F2ED]'
                                : 'bg-[#101410] border-white/10 text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            <span className="font-mono-num text-[#C6A65A] mr-1.5">
                              {fmtClock(ev.timeSec)}
                            </span>
                            {ev.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
