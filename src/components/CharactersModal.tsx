import React from 'react';
import { Check, Lock, Shield, X, Zap } from 'lucide-react';
import { getOperatorById, OPERATORS } from '../game/data';
import { PlayerProfile } from '../game/types';
import { audioEngine } from '../game/audio';

interface CharactersModalProps {
  profile: PlayerProfile;
  onSelectOperator: (opId: string) => void;
  onUnlockOperator: (opId: string, priceGold: number) => void;
  onCustomizeOperator: (opId: string, outfitColor?: string, visorColor?: string) => void;
  onClose: () => void;
}

const OUTFIT_SWATCHES = [
  { label: 'Obsidian', hex: '#141821' },
  { label: 'Crimson Spec', hex: '#63171B' },
  { label: 'Cobalt Recon', hex: '#163654' },
  { label: 'Desert Sand', hex: '#63533E' },
  { label: 'Arctic Slate', hex: '#596778' },
  { label: 'Forest Ops', hex: '#253D2C' },
];

const VISOR_SWATCHES = [
  { label: 'Crimson', hex: '#EF4444' },
  { label: 'Neon Blue', hex: '#38BDF8' },
  { label: 'Amber Gold', hex: '#F59E0B' },
  { label: 'Emerald', hex: '#10B981' },
  { label: 'Silver Ice', hex: '#E2E8F0' },
];

export const CharactersModal: React.FC<CharactersModalProps> = ({
  profile,
  onSelectOperator,
  onUnlockOperator,
  onCustomizeOperator,
  onClose,
}) => {
  const current = getOperatorById(profile.selectedOperatorId);

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="bg-[#0B0E14]/92 border border-white/15 px-4 py-2.5 flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#38BDF8]" />
          <div>
            <h2 className="font-display font-bold text-base tracking-wider text-white uppercase">
              Operators & Tactical Gear
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Drag center 3D operator to rotate · Customize armor finishes, visors & active abilities
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            audioEngine.playUiClick();
            onClose();
          }}
          className="px-4 py-2 bg-[#0B0E14]/92 hover:bg-[#DC2626] border border-white/15 text-xs font-display font-bold tracking-wider text-white flex items-center gap-2 cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>BACK TO LOBBY</span>
        </button>
      </div>

      {/* Left & Right Panels Leaving Center Clear */}
      <div className="flex-1 flex items-center justify-between gap-4 my-4 min-h-0">
        {/* Left: Operator Roster */}
        <div className="w-72 bg-[#0B0E14]/92 border border-white/15 p-3.5 space-y-2 pointer-events-auto">
          <div className="text-xs font-display font-semibold tracking-wider text-[#94A3B8] mb-2">
            ROSTER ({profile.ownedOperatorIds.length}/{OPERATORS.length} UNLOCKED)
          </div>
          {OPERATORS.map((op) => {
            const owned = profile.ownedOperatorIds.includes(op.id);
            const selected = profile.selectedOperatorId === op.id;
            return (
              <div
                key={op.id}
                onClick={() => {
                  if (owned) {
                    audioEngine.playUiClick();
                    onSelectOperator(op.id);
                  }
                }}
                className={`p-3 border transition-colors ${
                  selected
                    ? 'bg-[#7F1D1D]/45 border-[#DC2626] text-white cursor-pointer'
                    : owned
                    ? 'bg-[#141821] border-white/10 text-[#CBD5E1] hover:border-white/25 cursor-pointer'
                    : 'bg-[#10131A] border-white/10 text-[#94A3B8]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display font-bold text-sm text-white">{op.name}</div>
                    <div className="text-[11px] text-[#94A3B8]">
                      {op.role} · {op.gender}
                    </div>
                  </div>
                  {selected ? (
                    <Check className="w-4 h-4 text-[#EF4444]" />
                  ) : owned ? (
                    <span className="text-[10px] font-mono-num text-[#38BDF8]">LVL {op.level}</span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        audioEngine.playUiClick(true);
                        onUnlockOperator(op.id, op.priceGold);
                      }}
                      disabled={profile.gold < op.priceGold}
                      className={`px-2 py-1 text-[11px] font-mono-num font-bold border flex items-center gap-1 cursor-pointer ${
                        profile.gold >= op.priceGold
                          ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B] hover:text-black'
                          : 'bg-transparent border-white/10 text-[#64748B] cursor-not-allowed'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      {op.priceGold}G
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Abilities & Live 3D Outfit / Visor Customization */}
        <div className="w-80 bg-[#0B0E14]/92 border border-white/15 p-4 space-y-4 pointer-events-auto">
          <div>
            <div className="text-[11px] font-mono-num text-[#38BDF8]">{current.codename}</div>
            <h3 className="font-display font-bold text-xl text-white">{current.name}</h3>
            <div className="text-xs text-[#94A3B8]">Role: {current.role} · Tactical Tier {current.level}</div>
          </div>

          <div className="space-y-2.5 border-y border-white/10 py-3">
            <div className="bg-[#141821] border border-white/10 p-2.5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-display font-bold text-[#EF4444] flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> ACTIVE: {current.activeAbility.name}
                </span>
                <span className="font-mono-num text-[11px] text-[#94A3B8]">{current.activeAbility.cooldown}s CD</span>
              </div>
              <p className="text-xs text-[#CBD5E1]">{current.activeAbility.description}</p>
            </div>

            <div className="bg-[#141821] border border-white/10 p-2.5">
              <div className="font-display font-bold text-xs text-[#38BDF8] mb-1">
                PASSIVE: {current.passiveAbility.name}
              </div>
              <p className="text-xs text-[#CBD5E1]">{current.passiveAbility.description}</p>
            </div>
          </div>

          {/* Armor Suit Color Customizer */}
          <div>
            <div className="text-xs font-display font-semibold text-[#CBD5E1] uppercase mb-2">
              Ballistic Armor Finish
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {OUTFIT_SWATCHES.map((sw) => {
                const active = (profile.operatorOutfitTint[current.id] || current.armorColor) === sw.hex;
                return (
                  <button
                    key={sw.label}
                    onClick={() => {
                      audioEngine.playUiClick();
                      onCustomizeOperator(current.id, sw.hex, undefined);
                    }}
                    className={`flex items-center gap-2 px-2 py-1.5 border text-[11px] cursor-pointer ${
                      active ? 'border-[#38BDF8] bg-[#1C2432] text-white' : 'border-white/10 bg-[#12161E] text-[#94A3B8]'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 border border-white/30 shrink-0" style={{ backgroundColor: sw.hex }} />
                    <span className="truncate">{sw.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tactical Visor Tint */}
          <div>
            <div className="text-xs font-display font-semibold text-[#CBD5E1] uppercase mb-2">
              HUD Visor Optics
            </div>
            <div className="flex items-center gap-2">
              {VISOR_SWATCHES.map((vs) => {
                const active = (profile.operatorVisorTint[current.id] || current.visorColor) === vs.hex;
                return (
                  <button
                    key={vs.label}
                    onClick={() => {
                      audioEngine.playUiClick();
                      onCustomizeOperator(current.id, undefined, vs.hex);
                    }}
                    title={vs.label}
                    className={`w-8 h-8 border-2 transition-transform cursor-pointer ${
                      active ? 'border-white scale-110' : 'border-white/20'
                    }`}
                    style={{ backgroundColor: vs.hex }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
