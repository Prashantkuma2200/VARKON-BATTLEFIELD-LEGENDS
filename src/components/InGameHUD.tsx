import React, { useEffect, useRef, useState } from 'react';
import {
  Backpack,
  Crosshair,
  Eye,
  Flame,
  Heart,
  Map as MapIcon,
  MessageSquare,
  Pause,
  RotateCw,
  Shield,
  Volume2,
  Zap,
  Car,
  Cloud,
} from 'lucide-react';
import { getOperatorById, getWeaponById } from '../game/data';
import { ControlSettings, HudLayoutPreset, MatchHudSnapshot, PlayerProfile } from '../game/types';
import { ISLAND_RADIUS } from '../game/worldGen';

interface InGameHUDProps {
  hud: MatchHudSnapshot;
  profile: PlayerProfile;
  controls: ControlSettings;
  hudPreset: HudLayoutPreset;
  onFireChange: (active: boolean) => void;
  onToggleAds: () => void;
  onJump: () => void;
  onCrouch: () => void;
  onProne: () => void;
  onReload: () => void;
  onSwitchSlot: (slot: 0 | 1 | 2) => void;
  onThrowGrenade: (type: 'frag' | 'smoke') => void;
  onHeal: () => void;
  onInteract: () => void;
  onAbility: () => void;
  onTogglePerspective: () => void;
  onOpenMap: () => void;
  onOpenInventory: () => void;
  onOpenPause: () => void;
  onTouchMove: (nx: number, ny: number, sprint: boolean) => void;
  onTouchLook: (dx: number, dy: number) => void;
  onRequestLock: () => void;
}

const QUICK_CHATS = [
  'Enemies ahead!',
  'Move to Safe Zone!',
  'Need Medkit!',
  'Follow me!',
  'Good shot!',
];

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const InGameHUD: React.FC<InGameHUDProps> = ({
  hud,
  profile,
  controls,
  hudPreset,
  onFireChange,
  onToggleAds,
  onJump,
  onCrouch,
  onProne,
  onReload,
  onSwitchSlot,
  onThrowGrenade,
  onHeal,
  onInteract,
  onAbility,
  onTogglePerspective,
  onOpenMap,
  onOpenInventory,
  onOpenPause,
  onTouchMove,
  onTouchLook,
  onRequestLock,
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [chatBubble, setChatBubble] = useState<string | null>(null);
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const joyOriginRef = useRef<{ x: number; y: number } | null>(null);
  const lookTouchRef = useRef<{ id: number; x: number; y: number } | null>(null);

  const operator = getOperatorById(profile.selectedOperatorId);
  const activeSlotObj = hud.activeSlot === 2 ? null : hud.slots[hud.activeSlot];
  const activeWeaponDef = activeSlotObj ? getWeaponById(activeSlotObj.weaponId) : null;

  // Render live tactical minimap
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background ocean + island circle
    ctx.fillStyle = '#0A1926';
    ctx.fillRect(0, 0, w, h);

    const scale = w / (ISLAND_RADIUS * 2.15);
    const toX = (wx: number) => w * 0.5 + wx * scale;
    const toY = (wz: number) => h * 0.5 + wz * scale;

    // Island land disc
    ctx.fillStyle = '#1D2926';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, ISLAND_RADIUS * 0.84 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Subtle tactical grid
    ctx.strokeStyle = 'rgba(200,208,220,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((w * i) / 4, 0);
      ctx.lineTo((w * i) / 4, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (h * i) / 4);
      ctx.lineTo(w, (h * i) / 4);
      ctx.stroke();
    }

    // Blue Zone ring
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(hud.blueZone.x), toY(hud.blueZone.z), Math.max(2, hud.blueZone.radius * scale), 0, Math.PI * 2);
    ctx.stroke();

    // Safe Zone white target ring
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(toX(hud.safeZone.x), toY(hud.safeZone.z), Math.max(2, hud.safeZone.radius * scale), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Entities (vehicles, airdrops, teammates, scanned bots)
    hud.entities.forEach((e) => {
      const ex = toX(e.x);
      const ey = toY(e.z);
      if (e.type === 'vehicle') {
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(ex - 2, ey - 2, 4, 4);
      } else if (e.type === 'airdrop') {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'teammate') {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'bot') {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(ex, ey, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Map Ping
    if (hud.mapPing) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(toX(hud.mapPing.x), toY(hud.mapPing.z), 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player arrow
    const px = toX(hud.playerPos.x);
    const py = toY(hud.playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-hud.playerYaw);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.lineTo(4, 4.5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [hud.blueZone, hud.safeZone, hud.entities, hud.playerPos, hud.playerYaw, hud.mapPing]);

  // Compass heading (0-359 deg)
  const headingDeg = (((-hud.playerYaw * 180) / Math.PI) % 360 + 360) % 360;
  const cardinal =
    headingDeg < 22.5 || headingDeg >= 337.5
      ? 'N'
      : headingDeg < 67.5
      ? 'NE'
      : headingDeg < 112.5
      ? 'E'
      : headingDeg < 157.5
      ? 'SE'
      : headingDeg < 202.5
      ? 'S'
      : headingDeg < 247.5
      ? 'SW'
      : headingDeg < 292.5
      ? 'W'
      : 'NW';

  const sendQuickChat = (msg: string) => {
    setChatBubble(`${profile.name}: ${msg}`);
    setQuickChatOpen(false);
    window.setTimeout(() => setChatBubble(null), 3200);
  };

  const getBtnStyle = (id: string): React.CSSProperties => {
    const el = hudPreset.elements[id];
    if (!el) return {};
    return {
      left: `${el.x}%`,
      top: `${el.y}%`,
      transform: `translate(-50%, -50%) scale(${el.scale})`,
      opacity: el.opacity,
    };
  };

  const isScopedOptic = hud.isAds && hud.activeZoom >= 2;

  return (
    <div className="fixed inset-0 pointer-events-none z-20 select-none">
      {/* Blue Zone Warning Edge Vignette */}
      {hud.inBlueZone && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 85px rgba(56, 189, 248, 0.55)' }}
        />
      )}

      {/* Low HP Crimson Vignette */}
      {hud.hp <= 30 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 90px rgba(220, 38, 38, 0.6)' }}
        />
      )}

      {/* Optical Scope Overlay for 2x / 4x / 8x ADS */}
      {isScopedOptic && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-[min(78vh,78vw)] h-[min(78vh,78vw)] rounded-full border-2 border-[#090A0D] shadow-[0_0_0_9999px_rgba(6,8,12,0.92)] flex items-center justify-center">
            <div className="absolute inset-x-0 h-[1px] bg-white/45" />
            <div className="absolute inset-y-0 w-[1px] bg-white/45" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            <div className="absolute bottom-8 px-2 py-0.5 bg-[#090A0D]/80 text-[11px] font-mono-num text-[#38BDF8]">
              {hud.activeZoom.toFixed(0)}x OPTIC
            </div>
          </div>
        </div>
      )}

      {/* Touch Look Zone (Right Half of Screen when Touch Controls Enabled) */}
      {controls.showTouchControls && (
        <div
          className="fixed inset-y-0 right-0 w-1/2 pointer-events-auto"
          onTouchStart={(e) => {
            const t = e.changedTouches[0];
            lookTouchRef.current = { id: t.identifier, x: t.clientX, y: t.clientY };
          }}
          onTouchMove={(e) => {
            if (!lookTouchRef.current) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
              const t = e.changedTouches[i];
              if (t.identifier === lookTouchRef.current.id) {
                onTouchLook((t.clientX - lookTouchRef.current.x) * 1.4, (t.clientY - lookTouchRef.current.y) * 1.4);
                lookTouchRef.current.x = t.clientX;
                lookTouchRef.current.y = t.clientY;
              }
            }
          }}
          onTouchEnd={() => {
            lookTouchRef.current = null;
          }}
        />
      )}

      {/* TOP SECTION: Alive/Kills + Compass + Zone + Minimap */}
      <div className="flex items-start justify-between p-3 md:p-4 gap-3">
        {/* Top-Left: Alive, Kills, Match Timer, Teammates */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center gap-3 bg-[#0A0D12]/88 border border-white/12 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[#94A3B8]">ALIVE</span>
              <span className="font-mono-num font-bold text-base text-white">{hud.aliveCount}</span>
            </div>
            <span className="text-white/20">|</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#94A3B8]">KILLS</span>
              <span className="font-mono-num font-bold text-base text-[#EF4444]">{hud.kills}</span>
            </div>
            <span className="text-white/20">|</span>
            <div className="font-mono-num text-[#CBD5E1]">{formatClock(hud.matchTime)}</div>
            <span className="hidden sm:inline text-white/20">|</span>
            <div className="hidden sm:inline font-mono-num text-[#64748B]">{hud.fps} FPS</div>
          </div>

          {/* Teammate Status Stack */}
          {hud.teammates.length > 0 && (
            <div className="space-y-1 w-44">
              {hud.teammates.map((tm) => (
                <div key={tm.id} className="bg-[#0A0D12]/82 border border-white/10 px-2.5 py-1.5">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-medium text-white truncate" style={{ color: tm.alive ? tm.color : '#64748B' }}>
                      {tm.name}
                    </span>
                    <span className="font-mono-num text-[#94A3B8]">{tm.alive ? `${tm.hp}` : 'OUT'}</span>
                  </div>
                  <div className="h-1 bg-[#1C212A] overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${tm.alive ? (tm.hp / tm.maxHp) * 100 : 0}%`, backgroundColor: tm.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Chat & Voice */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setQuickChatOpen((o) => !o)}
              className="p-2 bg-[#0A0D12]/85 hover:bg-[#1C212A] border border-white/12 text-[#CBD5E1] cursor-pointer"
              title="Quick Tactical Chat"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onTogglePerspective}
              className="px-2.5 py-1.5 bg-[#0A0D12]/85 hover:bg-[#1C212A] border border-white/12 text-[11px] font-mono-num text-[#38BDF8] cursor-pointer"
              title="Toggle TPP / FPP (V)"
            >
              {hud.perspective}
            </button>
            <button
              onClick={onOpenPause}
              className="p-2 bg-[#0A0D12]/85 hover:bg-[#1C212A] border border-white/12 text-[#CBD5E1] cursor-pointer"
              title="Pause / Settings (Esc)"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          </div>

          {quickChatOpen && (
            <div className="bg-[#0B0E14]/94 border border-white/15 p-1.5 w-48 space-y-1">
              {QUICK_CHATS.map((msg) => (
                <button
                  key={msg}
                  onClick={() => sendQuickChat(msg)}
                  className="w-full text-left px-2 py-1 text-xs text-[#CBD5E1] hover:bg-[#1C212A] hover:text-white cursor-pointer"
                >
                  {msg}
                </button>
              ))}
            </div>
          )}

          {chatBubble && (
            <div className="bg-[#0B0E14]/90 border border-[#38BDF8]/40 px-2.5 py-1 text-xs text-[#38BDF8]">
              {chatBubble}
            </div>
          )}
        </div>

        {/* Top-Center: Tactical Compass & Zone Phase */}
        <div className="hidden sm:flex flex-col items-center gap-1">
          <div className="flex items-center gap-4 bg-[#0A0D12]/86 border border-white/12 px-5 py-1 text-xs font-mono-num">
            <span className="text-[#64748B]">{Math.round((headingDeg - 30 + 360) % 360)}°</span>
            <span className="text-white font-bold text-sm">
              {cardinal} {Math.round(headingDeg)}°
            </span>
            <span className="text-[#64748B]">{Math.round((headingDeg + 30) % 360)}°</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] bg-[#0A0D12]/80 px-3 py-0.5 border border-white/10">
            <span className={hud.zoneShrinking ? 'text-[#38BDF8] font-semibold' : 'text-[#94A3B8]'}>
              PHASE {hud.zonePhase} {hud.zoneShrinking ? 'CLOSING' : 'SAFE ZONE'}
            </span>
            <span className="font-mono-num text-white font-semibold">{formatClock(hud.zoneTimer)}</span>
          </div>
        </div>

        {/* Top-Right: Minimap & Kill Feed */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <button
            onClick={onOpenMap}
            className="relative border border-white/20 bg-[#0A0D12]/90 overflow-hidden cursor-pointer group"
            title="Open Full Interactive Map (M)"
          >
            <canvas ref={minimapCanvasRef} width={132} height={132} className="block w-[112px] h-[112px] md:w-[132px] md:h-[132px]" />
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-[#090A0D]/85 text-[10px] font-mono-num text-[#CBD5E1] flex items-center gap-1">
              <MapIcon className="w-2.5 h-2.5 text-[#38BDF8]" />
              <span>M</span>
            </div>
          </button>

          {/* Kill Feed */}
          <div className="flex flex-col items-end gap-1 max-w-64 pointer-events-none">
            {hud.killFeed.map((kf) => (
              <div
                key={kf.id}
                className={`px-2 py-0.5 text-[11px] bg-[#0A0D12]/85 border ${
                  kf.isPlayerInvolved ? 'border-[#DC2626]/65 text-white' : 'border-white/10 text-[#CBD5E1]'
                }`}
              >
                <span className={kf.killer === profile.name ? 'text-[#38BDF8] font-semibold' : ''}>{kf.killer}</span>
                <span className="text-[#94A3B8] mx-1">[{kf.weapon}{kf.isHeadshot ? ' HS' : ''}]</span>
                <span className="text-[#EF4444]">{kf.victim}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER FEEDBACK: Crosshair, Hitmarker, Directional Damage, Banners, Prompts */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
        {/* Dynamic Crosshair (hidden during scoped optic) */}
        {!isScopedOptic && !hud.inVehicle && hud.stance !== 'parachute' && (
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-white/90" />
            <div
              className="absolute w-2.5 h-[2px] bg-white/90"
              style={{ transform: `translateX(-${hud.crosshairSpread}px)` }}
            />
            <div
              className="absolute w-2.5 h-[2px] bg-white/90"
              style={{ transform: `translateX(${hud.crosshairSpread}px)` }}
            />
            <div
              className="absolute h-2.5 w-[2px] bg-white/90"
              style={{ transform: `translateY(-${hud.crosshairSpread}px)` }}
            />
            <div
              className="absolute h-2.5 w-[2px] bg-white/90"
              style={{ transform: `translateY(${hud.crosshairSpread}px)` }}
            />
          </div>
        )}

        {/* Hitmarker X */}
        {hud.hitMarker.active && (
          <div
            className="absolute w-7 h-7 pointer-events-none"
            style={{ color: hud.hitMarker.headshot || hud.hitMarker.kill ? '#EF4444' : '#FFFFFF' }}
          >
            <svg viewBox="0 0 28 28" className="w-full h-full">
              <line x1="4" y1="4" x2="10" y2="10" stroke="currentColor" strokeWidth="2.4" />
              <line x1="24" y1="4" x2="18" y2="10" stroke="currentColor" strokeWidth="2.4" />
              <line x1="4" y1="24" x2="10" y2="18" stroke="currentColor" strokeWidth="2.4" />
              <line x1="24" y1="24" x2="18" y2="18" stroke="currentColor" strokeWidth="2.4" />
            </svg>
          </div>
        )}

        {/* Directional Damage Indicator Arc */}
        {hud.damageIndicatorAlpha > 0.02 && hud.damageIndicatorAngle !== null && (
          <div
            className="absolute w-44 h-44 pointer-events-none"
            style={{
              opacity: hud.damageIndicatorAlpha,
              transform: `rotate(${hud.damageIndicatorAngle}rad)`,
            }}
          >
            <div className="w-16 h-2 mx-auto bg-[#EF4444] rounded-full shadow-[0_0_12px_#EF4444]" />
          </div>
        )}
      </div>

      {/* Tactical Alert Banner (Kill / Air Drop / Zone) */}
      {hud.bannerAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <div
            className={`px-5 py-2 border bg-[#0A0D12]/92 ${
              hud.bannerAlert.tone === 'crimson'
                ? 'border-[#EF4444]/70 text-[#F87171]'
                : hud.bannerAlert.tone === 'gold'
                ? 'border-[#F59E0B]/70 text-[#FBBF24]'
                : 'border-[#38BDF8]/70 text-[#38BDF8]'
            }`}
          >
            <div className="font-display font-bold text-sm tracking-widest uppercase">{hud.bannerAlert.text}</div>
            {hud.bannerAlert.subtext && (
              <div className="text-xs text-[#CBD5E1] mt-0.5">{hud.bannerAlert.subtext}</div>
            )}
          </div>
        </div>
      )}

      {/* Parachute Altitude Gauge */}
      {hud.stance === 'parachute' && (
        <div className="fixed right-6 top-1/2 -translate-y-1/2 bg-[#0A0D12]/88 border border-[#38BDF8]/40 px-3 py-2 text-center">
          <div className="text-[10px] text-[#94A3B8]">ALTITUDE</div>
          <div className="font-mono-num font-bold text-xl text-[#38BDF8]">{hud.altitude}m</div>
          <div className="text-[10px] text-[#CBD5E1] mt-0.5">WASD Steer Drop</div>
        </div>
      )}

      {/* Reload / Heal Channel Bar */}
      {(hud.isReloading || hud.isHealing) && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-52 bg-[#0A0D12]/90 border border-white/15 px-3 py-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white font-medium">{hud.isReloading ? 'Reloading...' : hud.healLabel}</span>
            <span className="font-mono-num text-[#38BDF8]">
              {Math.round((hud.isReloading ? hud.reloadProgress : hud.healProgress) * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-[#1C212A] overflow-hidden">
            <div
              className="h-full bg-[#38BDF8]"
              style={{ width: `${Math.round((hud.isReloading ? hud.reloadProgress : hud.healProgress) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Nearby Loot / Vehicle Interact Prompt */}
      {hud.nearbyPrompt && (
        <div className="fixed bottom-44 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={onInteract}
            className="flex items-center gap-3 px-4 py-2 bg-[#0B0E14]/94 hover:bg-[#1C212A] border border-[#38BDF8]/60 text-left cursor-pointer"
          >
            <span className="px-2 py-0.5 bg-[#38BDF8] text-[#090A0D] font-mono-num font-bold text-xs">E</span>
            <div>
              <div className="text-xs font-display font-bold text-white">{hud.nearbyPrompt.label}</div>
              <div className="text-[11px] text-[#94A3B8]">{hud.nearbyPrompt.sublabel}</div>
            </div>
          </button>
        </div>
      )}

      {/* Click-to-Lock Mouse Hint on Desktop */}
      {!hud.pointerLocked && !controls.showTouchControls && !hud.paused && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={onRequestLock}
            className="px-4 py-1.5 bg-[#0A0D12]/88 hover:bg-[#1C212A] border border-white/20 text-xs text-[#E2E8F0] cursor-pointer"
          >
            Click Viewport to Lock Aim · ESC to Pause · M Map · TAB Inventory
          </button>
        </div>
      )}

      {/* Vehicle Speedometer & Fuel Bar */}
      {hud.inVehicle && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-[#0A0D12]/90 border border-white/15 px-5 py-2.5">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-[#38BDF8]" />
            <span className="font-mono-num font-bold text-xl text-white">{hud.speedKmh}</span>
            <span className="text-xs text-[#94A3B8]">KM/H</span>
          </div>
          <div className="text-xs">
            <span className="text-[#94A3B8]">FUEL </span>
            <span className="font-mono-num text-[#F59E0B] font-semibold">{hud.vehicleFuel}%</span>
          </div>
          <div className="text-xs">
            <span className="text-[#94A3B8]">HULL </span>
            <span className="font-mono-num text-[#10B981] font-semibold">{hud.vehicleHp}%</span>
          </div>
        </div>
      )}

      {/* BOTTOM SECTION: Health/Armor + Weapons + Quick Utility Buttons */}
      <div className="fixed inset-x-0 bottom-0 p-3 md:p-4 flex items-end justify-between gap-3 pointer-events-none">
        {/* Left Quick Actions (Backpack, Heal, Ability) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onOpenInventory}
            className="flex flex-col items-center justify-center w-12 h-12 bg-[#0A0D12]/88 hover:bg-[#1C212A] border border-white/15 text-[#CBD5E1] cursor-pointer"
            title="Backpack Inventory (Tab)"
          >
            <Backpack className="w-4 h-4" />
            <span className="text-[9px] font-mono-num mt-0.5">TAB</span>
          </button>

          <button
            onClick={onHeal}
            className="flex flex-col items-center justify-center w-12 h-12 bg-[#0A0D12]/88 hover:bg-[#1C212A] border border-white/15 text-[#10B981] cursor-pointer"
            title="Quick Heal (H)"
          >
            <Heart className="w-4 h-4" />
            <span className="text-[10px] font-mono-num text-white">{hud.medkits + hud.bandages}</span>
          </button>

          <button
            onClick={onAbility}
            disabled={hud.abilityCooldown > 0}
            className={`flex flex-col items-center justify-center w-14 h-12 border transition-colors cursor-pointer ${
              hud.abilityActive
                ? 'bg-[#38BDF8]/30 border-[#38BDF8] text-[#38BDF8]'
                : hud.abilityCooldown > 0
                ? 'bg-[#0A0D12]/70 border-white/10 text-[#64748B]'
                : 'bg-[#7F1D1D]/80 hover:bg-[#DC2626] border-[#EF4444]/60 text-white'
            }`}
            title={`${operator.activeAbility.name} (Q)`}
          >
            <Zap className="w-4 h-4" />
            <span className="text-[10px] font-mono-num">
              {hud.abilityCooldown > 0 ? `${hud.abilityCooldown}s` : 'Q'}
            </span>
          </button>
        </div>

        {/* Center: Health, Boost, Armor, Helmet + Primary/Secondary Weapon Slots */}
        <div className="flex flex-col items-center gap-2 pointer-events-auto max-w-xl w-full">
          {/* Weapons Row */}
          <div className="flex items-center gap-2 w-full justify-center">
            {[0, 1].map((idx) => {
              const slot = hud.slots[idx as 0 | 1];
              if (!slot) return null;
              const def = getWeaponById(slot.weaponId);
              const isAct = hud.activeSlot === idx;
              const reserve = hud.reserveAmmo[def.ammoType] || 0;
              return (
                <button
                  key={idx}
                  onClick={() => onSwitchSlot(idx as 0 | 1)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2 border min-w-[160px] md:min-w-[200px] transition-colors cursor-pointer ${
                    isAct
                      ? 'bg-[#141923]/95 border-[#DC2626] text-white'
                      : 'bg-[#0A0D12]/82 border-white/12 text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono-num text-[#64748B]">[{idx + 1}]</span>
                      <span className="font-display font-bold text-xs tracking-wide">{def.name}</span>
                    </div>
                    <div className="text-[10px] text-[#64748B]">{def.ammoType}</div>
                  </div>
                  <div className="text-right font-mono-num">
                    <span className="text-base font-bold text-white">{slot.ammoInMag}</span>
                    <span className="text-xs text-[#64748B]">/{reserve}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Health & Armor Bar */}
          <div className="w-full max-w-md bg-[#0A0D12]/90 border border-white/15 px-3 py-2">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <div className="flex items-center gap-3">
                <span className="text-[#CBD5E1] font-mono-num">
                  HP <strong className="text-white">{hud.hp}</strong>
                </span>
                <span className="text-[#38BDF8] font-mono-num">
                  ARMOR Lv{hud.armorLevel} ({hud.armor})
                </span>
                <span className="text-[#94A3B8] font-mono-num">HELM Lv{hud.helmetLevel}</span>
              </div>
              <span className="text-[#F59E0B] font-mono-num uppercase text-[10px]">{hud.stance}</span>
            </div>

            {/* Boost thin strip */}
            <div className="h-1 bg-[#1C212A] mb-1 overflow-hidden">
              <div className="h-full bg-[#F59E0B]" style={{ width: `${hud.boost}%` }} />
            </div>

            {/* Primary HP bar */}
            <div className="h-2.5 bg-[#1C212A] overflow-hidden">
              <div
                className="h-full transition-all duration-150"
                style={{
                  width: `${Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))}%`,
                  backgroundColor: hud.hp <= 30 ? '#EF4444' : hud.hp <= 60 ? '#F59E0B' : '#E2E8F0',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Quick Ordnance (Frag, Smoke, Reload) */}
        <div className="hidden md:flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => onThrowGrenade('frag')}
            className="flex flex-col items-center justify-center w-12 h-12 bg-[#0A0D12]/88 hover:bg-[#1C212A] border border-white/15 text-[#F97316] cursor-pointer"
            title="Throw Frag Grenade (G)"
          >
            <Flame className="w-4 h-4" />
            <span className="text-[10px] font-mono-num text-white">{hud.frags}</span>
          </button>
          <button
            onClick={() => onThrowGrenade('smoke')}
            className="flex flex-col items-center justify-center w-12 h-12 bg-[#0A0D12]/88 hover:bg-[#1C212A] border border-white/15 text-[#94A3B8] cursor-pointer"
            title="Throw Smoke Canister (T)"
          >
            <Cloud className="w-4 h-4" />
            <span className="text-[10px] font-mono-num text-white">{hud.smokes}</span>
          </button>
          <button
            onClick={onReload}
            className="flex flex-col items-center justify-center w-12 h-12 bg-[#0A0D12]/88 hover:bg-[#1C212A] border border-white/15 text-[#CBD5E1] cursor-pointer"
            title="Reload (R)"
          >
            <RotateCw className="w-4 h-4" />
            <span className="text-[9px] font-mono-num mt-0.5">R</span>
          </button>
        </div>
      </div>

      {/* CUSTOMIZABLE MOBILE TOUCH CONTROLS OVERLAY */}
      {controls.showTouchControls && (
        <div className="fixed inset-0 pointer-events-none">
          {/* Virtual Left Joystick */}
          <div
            style={getBtnStyle('joystick')}
            className="fixed w-28 h-28 rounded-full border border-white/25 bg-[#0A0D12]/55 pointer-events-auto flex items-center justify-center touch-none"
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              joyOriginRef.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              if (!joyOriginRef.current) return;
              const t = e.changedTouches[0];
              const maxR = 42;
              let dx = t.clientX - joyOriginRef.current.x;
              let dy = t.clientY - joyOriginRef.current.y;
              const dist = Math.hypot(dx, dy);
              if (dist > maxR) {
                dx = (dx / dist) * maxR;
                dy = (dy / dist) * maxR;
              }
              setJoyOffset({ x: dx, y: dy });
              onTouchMove(dx / maxR, dy / maxR, dist > maxR * 0.85 && dy < -15);
            }}
            onTouchEnd={() => {
              joyOriginRef.current = null;
              setJoyOffset({ x: 0, y: 0 });
              onTouchMove(0, 0, false);
            }}
          >
            <div
              className="w-11 h-11 rounded-full bg-white/80 border-2 border-[#DC2626]"
              style={{ transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)` }}
            />
          </div>

          {/* Right Fire Button */}
          <button
            style={getBtnStyle('fireRight')}
            onPointerDown={() => onFireChange(true)}
            onPointerUp={() => onFireChange(false)}
            onPointerLeave={() => onFireChange(false)}
            className="fixed w-16 h-16 rounded-full bg-[#DC2626]/85 border-2 border-white/50 text-white flex items-center justify-center pointer-events-auto active:scale-95"
          >
            <Crosshair className="w-7 h-7" />
          </button>

          {/* Left Fire Button */}
          <button
            style={getBtnStyle('fireLeft')}
            onPointerDown={() => onFireChange(true)}
            onPointerUp={() => onFireChange(false)}
            onPointerLeave={() => onFireChange(false)}
            className="fixed w-12 h-12 rounded-full bg-[#B91C1C]/80 border border-white/40 text-white flex items-center justify-center pointer-events-auto"
          >
            <Crosshair className="w-5 h-5" />
          </button>

          {/* ADS / Scope */}
          <button
            style={getBtnStyle('ads')}
            onClick={onToggleAds}
            className={`fixed w-12 h-12 rounded-full border text-xs font-display font-bold flex items-center justify-center pointer-events-auto ${
              hud.isAds ? 'bg-[#38BDF8] text-[#090A0D] border-white' : 'bg-[#0A0D12]/80 text-white border-white/30'
            }`}
          >
            <Eye className="w-5 h-5" />
          </button>

          {/* Jump */}
          <button
            style={getBtnStyle('jump')}
            onClick={onJump}
            className="fixed w-11 h-11 rounded-full bg-[#0A0D12]/80 border border-white/30 text-white text-[10px] font-display font-bold pointer-events-auto"
          >
            JUMP
          </button>

          {/* Crouch */}
          <button
            style={getBtnStyle('crouch')}
            onClick={onCrouch}
            className="fixed w-11 h-11 rounded-full bg-[#0A0D12]/80 border border-white/30 text-white text-[10px] font-display font-bold pointer-events-auto"
          >
            CRCH
          </button>

          {/* Prone */}
          <button
            style={getBtnStyle('prone')}
            onClick={onProne}
            className="fixed w-10 h-10 rounded-full bg-[#0A0D12]/80 border border-white/30 text-white text-[10px] font-display font-bold pointer-events-auto"
          >
            PRN
          </button>

          {/* Reload */}
          <button
            style={getBtnStyle('reload')}
            onClick={onReload}
            className="fixed w-11 h-11 rounded-full bg-[#0A0D12]/80 border border-white/30 text-white flex items-center justify-center pointer-events-auto"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Grenade */}
          <button
            style={getBtnStyle('grenade')}
            onClick={() => onThrowGrenade('frag')}
            className="fixed w-11 h-11 rounded-full bg-[#0A0D12]/80 border border-[#F97316]/50 text-[#F97316] flex items-center justify-center pointer-events-auto"
          >
            <Flame className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Weapon Small Spec Readout (unused variable guard) */}
      <span className="sr-only">{activeWeaponDef?.name}</span>
    </div>
  );
};
