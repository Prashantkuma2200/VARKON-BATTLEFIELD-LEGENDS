import React from 'react';
import { Backpack, Shield, Trash2, X } from 'lucide-react';
import { ATTACHMENTS, computeEffectiveWeaponStats, getAttachmentById, getWeaponById } from '../game/data';
import { AttachmentSlot, MatchHudSnapshot, PlayerProfile } from '../game/types';

interface InventoryModalProps {
  mode: 'match' | 'lobby';
  hud?: MatchHudSnapshot | null;
  profile: PlayerProfile;
  onUseHeal?: (kind: 'medkit' | 'bandage' | 'energy') => void;
  onDiscard?: (itemId: string) => void;
  onEquipAttachment?: (slotIdx: 0 | 1, slotType: AttachmentSlot, attId: string | undefined) => void;
  onClose: () => void;
}

const SLOTS: AttachmentSlot[] = ['scope', 'muzzle', 'grip', 'magazine', 'stock'];

export const InventoryModal: React.FC<InventoryModalProps> = ({
  mode,
  hud,
  profile,
  onUseHeal,
  onDiscard,
  onEquipAttachment,
  onClose,
}) => {
  const primarySlot =
    mode === 'match' && hud
      ? hud.slots[0]
      : {
          weaponId: profile.selectedWeaponId,
          ammoInMag: getWeaponById(profile.selectedWeaponId).magSize,
          skinId: profile.selectedWeaponSkins[profile.selectedWeaponId] || 'skin_factory',
          attachments: profile.selectedAttachments[profile.selectedWeaponId] || {},
        };

  const secondarySlot =
    mode === 'match' && hud
      ? hud.slots[1]
      : {
          weaponId: profile.selectedSecondaryId,
          ammoInMag: getWeaponById(profile.selectedSecondaryId).magSize,
          skinId: profile.selectedWeaponSkins[profile.selectedSecondaryId] || 'skin_factory',
          attachments: profile.selectedAttachments[profile.selectedSecondaryId] || {},
        };

  const items = mode === 'match' && hud ? hud.inventory : [];
  const cap = mode === 'match' && hud ? hud.backpackCapacity : 320;
  const used = mode === 'match' && hud ? hud.backpackUsed : 85;

  return (
    <div className="fixed inset-0 z-40 bg-[#090A0D]/88 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#0F1218] border border-white/15 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Backpack className="w-5 h-5 text-[#EF4444]" />
            <div>
              <h2 className="font-display font-bold text-base tracking-wider text-white uppercase">
                Tactical Loadout & Backpack
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Capacity: <span className="font-mono-num text-white">{used}</span> / {cap} wt · Quick-use supplies & swap weapon attachments
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-[#1A1F29] hover:bg-[#DC2626] text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Armor & Backpack Items */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-[#141821] border border-white/10 p-3.5">
              <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-2">
                <span className="font-display font-semibold text-white uppercase flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#38BDF8]" /> Protection Gear
                </span>
                <span className="font-mono-num">
                  Armor {mode === 'match' && hud ? hud.armor : 100} / {mode === 'match' && hud ? hud.maxArmor : 100}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#0D1016] border border-white/10 p-2.5">
                  <div className="text-[#94A3B8]">Ballistic Helmet</div>
                  <div className="font-display font-bold text-white mt-0.5">
                    Level {mode === 'match' && hud ? hud.helmetLevel : 2}
                  </div>
                </div>
                <div className="bg-[#0D1016] border border-white/10 p-2.5">
                  <div className="text-[#94A3B8]">Tactical Plate Vest</div>
                  <div className="font-display font-bold text-white mt-0.5">
                    Level {mode === 'match' && hud ? hud.armorLevel : 2}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#141821] border border-white/10 p-3.5 flex-1">
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="font-display font-semibold text-white uppercase">Supplies & Ammunition</span>
                <span className="font-mono-num text-[#94A3B8]">{Math.round((used / cap) * 100)}% Full</span>
              </div>

              <div className="h-1.5 bg-[#0A0D12] mb-3 overflow-hidden">
                <div className="h-full bg-[#38BDF8]" style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} />
              </div>

              {mode === 'lobby' ? (
                <div className="space-y-2 text-xs text-[#94A3B8]">
                  <p>Default deployment kit includes:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#0D1016] p-2 border border-white/10 text-white">2x Tactical Medkit</div>
                    <div className="bg-[#0D1016] p-2 border border-white/10 text-white">4x Field Bandage</div>
                    <div className="bg-[#0D1016] p-2 border border-white/10 text-white">2x Energy Stim</div>
                    <div className="bg-[#0D1016] p-2 border border-white/10 text-white">3x Frag · 2x Smoke</div>
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="text-xs text-[#64748B] py-8 text-center">Backpack is empty. Loot crates on the island.</div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const usable = item.type === 'medkit' || item.type === 'bandage' || item.type === 'energy';
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 bg-[#0D1016] border border-white/10 p-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-white truncate">{item.name}</span>
                            <span className="font-mono-num text-[#38BDF8]">x{item.count}</span>
                          </div>
                          <div className="text-[11px] text-[#94A3B8] truncate">{item.description}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {usable && onUseHeal && (
                            <button
                              onClick={() => {
                                onUseHeal(item.type as 'medkit' | 'bandage' | 'energy');
                                onClose();
                              }}
                              className="px-2.5 py-1 bg-[#10B981]/20 hover:bg-[#10B981] border border-[#10B981]/50 text-[#10B981] hover:text-black text-xs font-semibold cursor-pointer"
                            >
                              Use
                            </button>
                          )}
                          {item.type !== 'ammo' && onDiscard && (
                            <button
                              onClick={() => onDiscard(item.id)}
                              className="p-1.5 bg-[#1C212A] hover:bg-[#7F1D1D] text-[#94A3B8] hover:text-white cursor-pointer"
                              title="Discard 1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Equipped Weapons & Live Attachment Slots */}
          <div className="lg:col-span-7 space-y-4">
            {[primarySlot, secondarySlot].map((slot, sIdx) => {
              if (!slot) return null;
              const def = getWeaponById(slot.weaponId);
              const eff = computeEffectiveWeaponStats(def, slot.attachments);

              return (
                <div key={sIdx} className="bg-[#141821] border border-white/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[11px] text-[#94A3B8] font-mono-num">
                        WEAPON SLOT {sIdx + 1} · {def.category} · {def.ammoType}
                      </div>
                      <h3 className="font-display font-bold text-lg text-white">{def.name}</h3>
                    </div>
                    <div className="text-right font-mono-num text-xs text-[#CBD5E1]">
                      <div>DMG {eff.damage} · ACC {eff.accuracy}</div>
                      <div className="text-[#94A3B8]">MAG {eff.magSize} · REC {eff.recoil}</div>
                    </div>
                  </div>

                  {/* Attachment Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {SLOTS.map((attSlot) => {
                      const currentId = slot.attachments[attSlot];
                      const currentAtt = getAttachmentById(currentId);
                      const options = ATTACHMENTS.filter((a) => a.slot === attSlot);
                      return (
                        <div key={attSlot} className="bg-[#0D1016] border border-white/10 p-2">
                          <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">{attSlot}</div>
                          {onEquipAttachment ? (
                            <select
                              value={currentId || ''}
                              onChange={(e) =>
                                onEquipAttachment(sIdx as 0 | 1, attSlot, e.target.value || undefined)
                              }
                              className="w-full bg-[#161B24] border border-white/15 text-xs text-white px-2 py-1 focus:outline-none focus:border-[#38BDF8]"
                            >
                              <option value="">None</option>
                              {options.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-xs text-white font-medium truncate">
                              {currentAtt ? currentAtt.name : 'Empty Slot'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
