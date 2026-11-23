import React, { useState } from 'react';
import { Check, Crosshair, Lock, X } from 'lucide-react';
import {
  ATTACHMENTS,
  computeEffectiveWeaponStats,
  getWeaponById,
  WEAPON_SKINS,
  WEAPONS,
} from '../game/data';
import { AttachmentSlot, PlayerProfile, WeaponCategory } from '../game/types';
import { audioEngine } from '../game/audio';

interface ArmoryModalProps {
  profile: PlayerProfile;
  onSelectWeapon: (weaponId: string, asSecondary?: boolean) => void;
  onSetAttachment: (weaponId: string, slot: AttachmentSlot, attachmentId: string | undefined) => void;
  onSetSkin: (weaponId: string, skinId: string) => void;
  onClose: () => void;
}

const CATEGORIES: WeaponCategory[] = ['AR', 'SMG', 'SNIPER', 'DMR', 'SHOTGUN'];
const ATT_SLOTS: AttachmentSlot[] = ['scope', 'muzzle', 'grip', 'magazine', 'stock'];

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  profile,
  onSelectWeapon,
  onSetAttachment,
  onSetSkin,
  onClose,
}) => {
  const [cat, setCat] = useState<WeaponCategory>(getWeaponById(profile.selectedWeaponId).category);
  const [subTab, setSubTab] = useState<'attachments' | 'skins'>('attachments');

  const weapon = getWeaponById(profile.selectedWeaponId);
  const atts = profile.selectedAttachments[weapon.id] || {};
  const skinId = profile.selectedWeaponSkins[weapon.id] || 'skin_factory';
  const eff = computeEffectiveWeaponStats(weapon, atts);

  const filtered = WEAPONS.filter((w) => w.category === cat);

  const statRows = [
    { label: 'Damage', value: eff.damage, max: 120, display: `${eff.damage}` },
    { label: 'Fire Rate', value: eff.fireRate, max: 1100, display: `${eff.fireRate} RPM` },
    { label: 'Range', value: eff.range, max: 360, display: `${eff.range}m` },
    { label: 'Accuracy', value: eff.accuracy, max: 100, display: `${eff.accuracy}` },
    { label: 'Control', value: 100 - eff.recoil, max: 100, display: `${100 - eff.recoil}` },
    { label: 'Mag Size', value: eff.magSize, max: 50, display: `${eff.magSize} rds` },
    { label: 'Reload', value: Math.max(10, 100 - eff.reloadTime * 22), max: 100, display: `${eff.reloadTime}s` },
  ];

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 md:p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="bg-[#0B0E14]/92 border border-white/15 px-4 py-2.5 flex items-center gap-3">
          <Crosshair className="w-5 h-5 text-[#EF4444]" />
          <div>
            <h2 className="font-display font-bold text-base tracking-wider text-white uppercase">
              3D Tactical Armory
            </h2>
            <p className="text-xs text-[#94A3B8]">Drag center 3D weapon to inspect · Attachments update model & stats live</p>
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

      {/* Left & Right Side Panels Leaving Center Clear for 3D Weapon Preview */}
      <div className="flex-1 flex items-center justify-between gap-4 my-4 min-h-0">
        {/* Left: Weapon Catalog */}
        <div className="w-72 max-h-full bg-[#0B0E14]/92 border border-white/15 p-3.5 flex flex-col pointer-events-auto">
          <div className="flex flex-wrap gap-1 mb-3">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  audioEngine.playUiClick();
                  setCat(c);
                }}
                className={`px-2.5 py-1 text-[11px] font-display font-bold border transition-colors cursor-pointer ${
                  cat === c
                    ? 'bg-[#DC2626] border-[#EF4444] text-white'
                    : 'bg-[#141821] border-white/10 text-[#94A3B8] hover:text-white'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filtered.map((w) => {
              const isPrimary = profile.selectedWeaponId === w.id;
              const isSecondary = profile.selectedSecondaryId === w.id;
              return (
                <div
                  key={w.id}
                  onClick={() => {
                    audioEngine.playUiClick();
                    onSelectWeapon(w.id, false);
                  }}
                  className={`p-2.5 border transition-colors cursor-pointer ${
                    isPrimary
                      ? 'bg-[#7F1D1D]/45 border-[#DC2626] text-white'
                      : 'bg-[#141821] border-white/10 text-[#CBD5E1] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm">{w.name}</span>
                    <span className="text-[10px] font-mono-num text-[#94A3B8]">{w.ammoType}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-[#94A3B8]">
                    <span>DMG {w.damage} · {w.fireRate} RPM</span>
                    <div className="flex items-center gap-1.5">
                      {isPrimary && <span className="text-[#EF4444] font-semibold">PRIMARY</span>}
                      {isSecondary && <span className="text-[#38BDF8] font-semibold">SLOT 2</span>}
                      {!isSecondary && !isPrimary && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            audioEngine.playUiClick();
                            onSelectWeapon(w.id, true);
                          }}
                          className="text-[10px] text-[#38BDF8] hover:underline cursor-pointer"
                        >
                          Set Slot 2
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Stats + Attachments / Skins */}
        <div className="w-80 max-h-full bg-[#0B0E14]/92 border border-white/15 p-4 flex flex-col pointer-events-auto">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-num text-[#38BDF8]">{weapon.code} · {weapon.ammoType}</span>
              <span className="text-[11px] font-mono-num text-[#94A3B8]">{weapon.fireModes.join(' / ')}</span>
            </div>
            <h3 className="font-display font-bold text-xl text-white">{weapon.name}</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">{weapon.description}</p>
          </div>

          {/* Live Ballistic Stat Bars */}
          <div className="space-y-1.5 mb-3 pb-3 border-b border-white/10">
            {statRows.map((s) => (
              <div key={s.label} className="text-xs">
                <div className="flex justify-between mb-0.5">
                  <span className="text-[#94A3B8]">{s.label}</span>
                  <span className="font-mono-num text-white font-semibold">{s.display}</span>
                </div>
                <div className="h-1.5 bg-[#1C212A] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#DC2626] to-[#38BDF8] transition-all duration-200"
                    style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Sub-Tabs */}
          <div className="grid grid-cols-2 gap-1 mb-3">
            <button
              onClick={() => setSubTab('attachments')}
              className={`py-1.5 text-xs font-display font-bold border cursor-pointer ${
                subTab === 'attachments'
                  ? 'bg-[#1C2432] border-[#38BDF8] text-[#38BDF8]'
                  : 'bg-[#12161E] border-white/10 text-[#94A3B8]'
              }`}
            >
              ATTACHMENTS
            </button>
            <button
              onClick={() => setSubTab('skins')}
              className={`py-1.5 text-xs font-display font-bold border cursor-pointer ${
                subTab === 'skins'
                  ? 'bg-[#1C2432] border-[#38BDF8] text-[#38BDF8]'
                  : 'bg-[#12161E] border-white/10 text-[#94A3B8]'
              }`}
            >
              WEAPON SKINS
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {subTab === 'attachments' ? (
              ATT_SLOTS.map((slot) => {
                const options = ATTACHMENTS.filter((a) => a.slot === slot);
                return (
                  <div key={slot} className="bg-[#141821] border border-white/10 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">{slot}</div>
                    <select
                      value={atts[slot] || ''}
                      onChange={(e) => {
                        audioEngine.playUiClick(true);
                        onSetAttachment(weapon.id, slot, e.target.value || undefined);
                      }}
                      className="w-full bg-[#0C0F15] border border-white/15 text-xs text-white px-2 py-1.5 focus:outline-none focus:border-[#DC2626]"
                    >
                      <option value="">Default / None</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })
            ) : (
              WEAPON_SKINS.map((sk) => {
                const owned = profile.ownedSkinIds.includes(sk.id);
                const equipped = skinId === sk.id;
                return (
                  <button
                    key={sk.id}
                    disabled={!owned}
                    onClick={() => {
                      audioEngine.playUiClick(true);
                      onSetSkin(weapon.id, sk.id);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 border text-left transition-colors ${
                      equipped
                        ? 'bg-[#7F1D1D]/45 border-[#DC2626] text-white cursor-pointer'
                        : owned
                        ? 'bg-[#141821] border-white/10 text-[#CBD5E1] hover:border-white/30 cursor-pointer'
                        : 'bg-[#10131A] border-white/5 text-[#64748B] cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-6 h-6 border border-white/25 shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${sk.primaryColor}, ${sk.emissiveColor})`,
                        }}
                      />
                      <div>
                        <div className="text-xs font-display font-bold">{sk.name}</div>
                        <div className="text-[10px] text-[#94A3B8]">{sk.killEffect}</div>
                      </div>
                    </div>
                    {equipped ? (
                      <Check className="w-4 h-4 text-[#EF4444]" />
                    ) : !owned ? (
                      <Lock className="w-3.5 h-3.5 text-[#64748B]" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
