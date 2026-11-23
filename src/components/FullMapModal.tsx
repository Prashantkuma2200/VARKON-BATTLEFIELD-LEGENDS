import React, { useRef, useState } from 'react';
import { MapPin, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { getMapById } from '../game/data';
import { MapId, MatchHudSnapshot } from '../game/types';
import { ISLAND_RADIUS } from '../game/worldGen';

interface FullMapModalProps {
  hud: MatchHudSnapshot;
  mapId: MapId;
  onPing: (x: number, z: number) => void;
  onClose: () => void;
}

export const FullMapModal: React.FC<FullMapModalProps> = ({ hud, mapId, onPing, onClose }) => {
  const map = getMapById(mapId);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const worldToPct = (v: number) => 50 + (v / (ISLAND_RADIUS * 2.1)) * 100;

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current?.moved) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width; // 0..1
    const ny = (e.clientY - rect.top) / rect.height;
    const wx = (nx - 0.5) * ISLAND_RADIUS * 2.1;
    const wz = (ny - 0.5) * ISLAND_RADIUS * 2.1;
    onPing(wx, wz);
  };

  const pingDist = hud.mapPing
    ? Math.round(Math.hypot(hud.mapPing.x - hud.playerPos.x, hud.mapPing.z - hud.playerPos.z))
    : null;

  return (
    <div className="fixed inset-0 z-40 bg-[#090A0D]/90 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#0F1218] border border-white/15 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <h2 className="font-display font-bold text-base tracking-wider text-white uppercase">
              {map.name} · Tactical Map
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Click anywhere to set destination ping · Drag to pan · Scroll or use zoom controls
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(1, Number((z - 0.35).toFixed(2))))}
              className="p-1.5 bg-[#1A1F29] hover:bg-[#242B38] border border-white/10 text-white cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-mono-num text-xs text-[#CBD5E1] w-10 text-center">{zoom.toFixed(1)}x</span>
            <button
              onClick={() => setZoom((z) => Math.min(2.6, Number((z + 0.35).toFixed(2))))}
              className="p-1.5 bg-[#1A1F29] hover:bg-[#242B38] border border-white/10 text-white cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 bg-[#1A1F29] hover:bg-[#242B38] border border-white/10 text-white cursor-pointer"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-[#7F1D1D] hover:bg-[#DC2626] text-white ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Interactive Map Canvas Viewport */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-[380px] aspect-square max-h-[68vh] mx-auto w-full bg-[#071522] overflow-hidden cursor-crosshair"
          onWheel={(e) => {
            e.preventDefault();
            setZoom((z) => Math.max(1, Math.min(2.6, z + (e.deltaY < 0 ? 0.2 : -0.2))));
          }}
          onPointerDown={(e) => {
            dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current || zoom <= 1) return;
            const dx = e.clientX - dragRef.current.x;
            const dy = e.clientY - dragRef.current.y;
            if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true;
            dragRef.current.x = e.clientX;
            dragRef.current.y = e.clientY;
            setPan((p) => ({
              x: Math.max(-220, Math.min(220, p.x + dx)),
              y: Math.max(-220, Math.min(220, p.y + dy)),
            }));
          }}
          onPointerUp={() => {
            window.setTimeout(() => {
              dragRef.current = null;
            }, 0);
          }}
        >
          <div
            onClick={handleMapClick}
            className="relative w-full h-full origin-center"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {/* Island Terrain Disc */}
            <div
              className="absolute rounded-full border-2 border-[#475569]/40"
              style={{
                left: '10%',
                top: '10%',
                width: '80%',
                height: '80%',
                background: `radial-gradient(circle at 46% 42%, ${map.groundSecondary}, ${map.groundColor} 72%, #1A2832 100%)`,
              }}
            />

            {/* Grid Overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
                backgroundSize: '12.5% 12.5%',
              }}
            />

            {/* Blue Zone */}
            <div
              className="absolute rounded-full border-2 border-[#38BDF8] bg-[#38BDF8]/8 pointer-events-none"
              style={{
                left: `${worldToPct(hud.blueZone.x)}%`,
                top: `${worldToPct(hud.blueZone.z)}%`,
                width: `${(hud.blueZone.radius / (ISLAND_RADIUS * 1.05)) * 100}%`,
                height: `${(hud.blueZone.radius / (ISLAND_RADIUS * 1.05)) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* Safe Zone */}
            <div
              className="absolute rounded-full border-2 border-dashed border-white/90 pointer-events-none"
              style={{
                left: `${worldToPct(hud.safeZone.x)}%`,
                top: `${worldToPct(hud.safeZone.z)}%`,
                width: `${(hud.safeZone.radius / (ISLAND_RADIUS * 1.05)) * 100}%`,
                height: `${(hud.safeZone.radius / (ISLAND_RADIUS * 1.05)) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* POIs */}
            {map.pois.map((poi) => (
              <div
                key={poi.name}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center"
                style={{ left: `${worldToPct(poi.x)}%`, top: `${worldToPct(poi.z)}%` }}
              >
                <div className="text-[10px] font-display font-bold tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] whitespace-nowrap">
                  {poi.name}
                </div>
                <div className="text-[9px] text-[#CBD5E1]/80">{poi.lootTier} Loot</div>
              </div>
            ))}

            {/* Entities: Vehicles, AirDrops, Teammates */}
            {hud.entities.map((e) => (
              <div
                key={e.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${worldToPct(e.x)}%`, top: `${worldToPct(e.z)}%` }}
              >
                {e.type === 'vehicle' && <div className="w-2.5 h-2.5 bg-[#CBD5E1] border border-black" title="Vehicle" />}
                {e.type === 'airdrop' && (
                  <div className="w-3.5 h-3.5 bg-[#F59E0B] border border-black rotate-45" title="Supply Air-Drop" />
                )}
                {e.type === 'teammate' && (
                  <div className="w-3 h-3 rounded-full bg-[#38BDF8] border border-white" title={e.label} />
                )}
                {e.type === 'bot' && <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />}
              </div>
            ))}

            {/* Destination Ping */}
            {hud.mapPing && (
              <div
                className="absolute -translate-x-1/2 -translate-y-full pointer-events-none flex flex-col items-center"
                style={{ left: `${worldToPct(hud.mapPing.x)}%`, top: `${worldToPct(hud.mapPing.z)}%` }}
              >
                <span className="px-1.5 py-0.5 bg-[#F59E0B] text-black font-mono-num font-bold text-[10px] mb-0.5">
                  {pingDist}m
                </span>
                <MapPin className="w-5 h-5 text-[#F59E0B] fill-[#F59E0B]/30" />
              </div>
            )}

            {/* Player Heading Arrow */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${worldToPct(hud.playerPos.x)}%`,
                top: `${worldToPct(hud.playerPos.z)}%`,
                transform: `translate(-50%, -50%) rotate(${(-hud.playerYaw * 180) / Math.PI}deg)`,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <polygon points="9,1 16,16 9,12 2,16" fill="#FFFFFF" stroke="#090A0D" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* Footer Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-white/10 text-xs text-[#94A3B8]">
          <div className="flex flex-wrap items-center gap-4">
            <span>White Arrow: You</span>
            <span className="text-[#38BDF8]">Blue Ring: Danger Zone</span>
            <span className="text-white">Dashed: Safe Zone</span>
            <span className="text-[#F59E0B]">Gold Diamond: Air Drop</span>
            <span className="text-[#CBD5E1]">Square: Vehicle</span>
          </div>
          {pingDist !== null && (
            <span className="font-mono-num text-[#F59E0B] font-semibold">Ping Distance: {pingDist}m</span>
          )}
        </div>
      </div>
    </div>
  );
};
