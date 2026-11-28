import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Coins,
  Lock,
  RotateCw,
  Shield,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import {
  BACKPACK_STYLES,
  CHARACTER_SKINS,
  FACE_TONES,
  getOperatorById,
  GLOVE_BOOT_COLORS,
  HAIR_COLORS,
  HAIRSTYLES,
  HELMET_STYLES,
  MASK_STYLES,
  OPERATORS,
  RARITY_COLORS,
  VICTORY_POSES,
} from '../game/data';
import { audioEngine } from '../game/audio';
import { CharacterCustomization, CharacterPoseId, PlayerProfile } from '../game/types';

interface CharactersModalProps {
  profile: PlayerProfile;
  onSelectOperator: (opId: string) => void;
  onPreviewOperator: (opId: string | null) => void;
  onSetPose: (pose: CharacterPoseId) => void;
  onUnlockOperator: (opId: string, priceGold: number) => void;
  onCustomizeOperator: (opId: string, patch: Partial<CharacterCustomization>) => void;
  onClose: () => void;
}

type CustomTab = 'skins' | 'face_hair' | 'helmet_mask' | 'boots_gloves' | 'backpack' | 'poses';
type RosterFilter = 'all' | 'unlocked' | 'locked' | 'Male' | 'Female';

const OUTFIT_SWATCHES = [
  { name: 'VARKON Olive', hex: '#333F2B' },
  { name: 'Matte Black', hex: '#181C18' },
  { name: 'Desert Khaki', hex: '#6B5C43' },
  { name: 'Crimson Ops', hex: '#691818' },
  { name: 'Arctic Slate', hex: '#4B5B6B' },
  { name: 'Sovereign Gold', hex: '#7D6632' },
];

const VISOR_SWATCHES = [
  { name: 'Metallic Gold', hex: '#C6A65A' },
  { name: 'Tactical Red', hex: '#EF4444' },
  { name: 'Recon Cyan', hex: '#38BDF8' },
  { name: 'Bio Emerald', hex: '#22C55E' },
  { name: 'Amber Flare', hex: '#F59E0B' },
];

export const CharactersModal: React.FC<CharactersModalProps> = ({
  profile,
  onSelectOperator,
  onPreviewOperator,
  onSetPose,
  onUnlockOperator,
  onCustomizeOperator,
  onClose,
}) => {
  const [inspectedId, setInspectedId] = useState<string>(profile.selectedOperatorId || OPERATORS[0].id);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all');
  const [customTab, setCustomTab] = useState<CustomTab>('skins');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const inspectedOp = getOperatorById(inspectedId);
  const isOwned = profile.ownedOperatorIds.includes(inspectedOp.id) || inspectedOp.priceGold === 0;
  const isEquipped = profile.selectedOperatorId === inspectedOp.id;

  const custom: Partial<CharacterCustomization> = profile.characterCustomizations?.[inspectedOp.id] || {};
  const activeOutfit = custom.outfitColor || profile.operatorOutfitTint[inspectedOp.id] || inspectedOp.armorColor;
  const activeVisor = custom.visorColor || profile.operatorVisorTint[inspectedOp.id] || inspectedOp.visorColor;
  const activeFaceTone = custom.faceTone || inspectedOp.skinTone;
  const activeHairStyle = custom.hairStyle || inspectedOp.defaultHairStyle;
  const activeHairColor = custom.hairColor || inspectedOp.hairColor;
  const activeHelmet = custom.helmetStyle || inspectedOp.defaultHelmet;
  const activeMask = custom.maskStyle || inspectedOp.defaultMask;
  const activeBackpack = custom.backpackStyle || inspectedOp.defaultBackpack;
  const activeBootGlove = custom.glovesBootsColor || '#12151A';
  const activeSkinId = custom.skinId || 'cskin_default';
  const activePose: CharacterPoseId = custom.pose || 'idle';

  // Sync live 3D character preview when switching inspected soldier or unmounting
  useEffect(() => {
    onPreviewOperator(inspectedOp.id);
    return () => {
      onPreviewOperator(null);
    };
  }, [inspectedOp.id, onPreviewOperator]);

  const filteredRoster = useMemo(() => {
    return OPERATORS.filter((op) => {
      const owned = profile.ownedOperatorIds.includes(op.id) || op.priceGold === 0;
      if (rosterFilter === 'unlocked') return owned;
      if (rosterFilter === 'locked') return !owned;
      if (rosterFilter === 'Male' || rosterFilter === 'Female') return op.gender === rosterFilter;
      return true;
    });
  }, [profile.ownedOperatorIds, rosterFilter]);

  const flashToast = (msg: string) => {
    setSaveToast(msg);
    window.setTimeout(() => setSaveToast((cur) => (cur === msg ? null : cur)), 2200);
  };

  const handleConfirmSelect = () => {
    audioEngine.playUiClick();
    if (!isOwned) {
      if (profile.gold < inspectedOp.priceGold) {
        flashToast(`Need ${inspectedOp.priceGold.toLocaleString()} V-Coins to unlock ${inspectedOp.name}`);
        return;
      }
      onUnlockOperator(inspectedOp.id, inspectedOp.priceGold);
      flashToast(`${inspectedOp.name} unlocked & equipped locally`);
      return;
    }
    onSelectOperator(inspectedOp.id);
    flashToast(`${inspectedOp.name} saved as active soldier`);
  };

  const applyCustomization = (patch: Partial<CharacterCustomization>) => {
    audioEngine.playUiClick();
    onCustomizeOperator(inspectedOp.id, patch);
    if (patch.pose) {
      onSetPose(patch.pose);
    }
  };

  const statRows = [
    { label: 'Mobility', value: inspectedOp.stats.mobility, color: '#38BDF8' },
    { label: 'Armor', value: inspectedOp.stats.armor, color: '#C6A65A' },
    { label: 'Tactics', value: inspectedOp.stats.tactics, color: '#22C55E' },
    { label: 'Stealth', value: inspectedOp.stats.stealth, color: '#A855F7' },
  ];

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 overflow-hidden">
      {/* TOP HEADER BAR */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 bg-[#101410]/92 border border-[#C6A65A]/30 px-3.5 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick();
              onPreviewOperator(null);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B2219] hover:bg-[#333F2B] border border-[#C6A65A]/30 text-xs font-display font-bold tracking-wider uppercase text-[#F2F2ED] cursor-pointer transition"
          >
            <ArrowLeft className="w-4 h-4 text-[#C6A65A]" />
            Lobby
          </button>
          <div>
            <div className="font-display font-bold text-base sm:text-lg tracking-wider uppercase text-[#F2F2ED] leading-none">
              VARKON · Character Selection
            </div>
            <div className="text-[10px] font-mono-num uppercase tracking-widest text-[#C6A65A] mt-0.5">
              12 Original Soldiers · Live 3D Customization · Local Sample Data
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {saveToast && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#1D2B1B] border border-[#22C55E]/50 text-[11px] font-mono-num text-[#86EFAC]">
              <Check className="w-3.5 h-3.5" />
              {saveToast}
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-[#182017] border border-[#C6A65A]/30 px-2.5 py-1 text-xs font-mono-num text-[#C6A65A]">
            <Coins className="w-3.5 h-3.5" />
            <span>{profile.gold.toLocaleString()}</span>
            <span className="text-[10px] text-[#94A3B8]">V-COINS</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 bg-[#161C15] border border-white/10 px-2.5 py-1 text-[10px] font-mono-num text-[#CBD5E1]">
            <RotateCw className="w-3 h-3 text-[#C6A65A]" />
            DRAG CENTER TO ROTATE 360°
          </div>
        </div>
      </div>

      {/* MIDDLE ROW: LEFT ROSTER · OPEN 3D VIEWPORT · RIGHT DOSSIER */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row justify-between gap-2.5 my-2.5 overflow-hidden">
        {/* LEFT PANEL: 12-SOLDIER CHARACTER ROSTER */}
        <aside className="pointer-events-auto w-full lg:w-[270px] xl:w-[290px] max-h-[30vh] lg:max-h-full bg-[#101410]/90 border border-[#C6A65A]/25 backdrop-blur-md flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 bg-[#161C15]/90">
            <div className="flex items-center justify-between text-[11px] font-mono-num text-[#C6A65A] uppercase">
              <span>SOLDIER ROSTER</span>
              <span>
                {profile.ownedOperatorIds.length}/{OPERATORS.length} UNLOCKED
              </span>
            </div>
            {/* Compact Filter Row */}
            <div className="grid grid-cols-5 gap-1 mt-2">
              {(['all', 'unlocked', 'locked', 'Male', 'Female'] as RosterFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    setRosterFilter(f);
                  }}
                  className={`py-1 text-[9px] font-mono-num uppercase border cursor-pointer transition ${
                    rosterFilter === f
                      ? 'bg-[#333F2B] border-[#C6A65A] text-[#F2F2ED]'
                      : 'bg-[#141914] border-white/10 text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'unlocked' ? 'Open' : f === 'locked' ? 'Lock' : f === 'Male' ? 'M' : 'F'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
            {filteredRoster.map((op) => {
              const owned = profile.ownedOperatorIds.includes(op.id) || op.priceGold === 0;
              const selected = inspectedOp.id === op.id;
              const equipped = profile.selectedOperatorId === op.id;

              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    setInspectedId(op.id);
                  }}
                  className={`w-full text-left p-2.5 border transition cursor-pointer flex items-center justify-between gap-2 ${
                    selected
                      ? 'bg-[#263220] border-[#C6A65A] shadow-[inset_3px_0_0_#C6A65A]'
                      : 'bg-[#141914]/90 border-white/10 hover:border-[#C6A65A]/45'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 shrink-0 border flex items-center justify-center font-display font-bold text-xs text-white"
                      style={{
                        backgroundColor: op.armorColor,
                        borderColor: selected ? '#C6A65A' : op.accentColor,
                      }}
                    >
                      {op.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-bold text-sm text-[#F2F2ED] uppercase truncate">
                          {op.name}
                        </span>
                        <span className="text-[9px] font-mono-num px-1 bg-black/50 border border-white/10 text-[#94A3B8]">
                          {op.gender === 'Female' ? 'F' : 'M'}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">{op.role}</div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {equipped ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-mono-num px-1.5 py-0.5 bg-[#C6A65A] text-[#101410] font-bold uppercase">
                        <Check className="w-2.5 h-2.5" />
                        EQP
                      </span>
                    ) : !owned ? (
                      <div className="flex flex-col items-end">
                        <Lock className="w-3 h-3 text-[#C6A65A]" />
                        <span className="text-[9px] font-mono-num text-[#C6A65A]">{op.priceGold}</span>
                      </div>
                    ) : (
                      <span className="text-[9px] font-mono-num text-[#596747] uppercase">READY</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CENTER OPEN 3D CHARACTER VIEWPORT (pointer-events-none so 3D drag works directly) */}
        <div className="hidden lg:flex flex-1 flex-col items-center justify-between py-2 pointer-events-none">
          <div className="bg-[#101410]/70 border border-[#C6A65A]/30 px-3 py-1 text-[10px] font-mono-num uppercase tracking-widest text-[#F2F2ED]">
            {inspectedOp.name} · {inspectedOp.className} ·{' '}
            <span className="text-[#C6A65A]">
              {VICTORY_POSES.find((p) => p.id === activePose)?.name || 'Combat Ready'}
            </span>
          </div>
          {!isOwned && (
            <div className="bg-[#101410]/85 border border-[#B83232]/60 px-3.5 py-1.5 text-[11px] font-mono-num text-[#FCA5A5] uppercase">
              LOCKED SOLDIER PREVIEW · {inspectedOp.priceGold.toLocaleString()} V-COINS (LOCAL SAMPLE)
            </div>
          )}
        </div>

        {/* RIGHT PANEL: CHARACTER INFORMATION, BALANCED STATS & ABILITY */}
        <aside className="pointer-events-auto w-full lg:w-[310px] xl:w-[335px] max-h-[30vh] lg:max-h-full bg-[#101410]/90 border border-[#C6A65A]/25 backdrop-blur-md flex flex-col overflow-y-auto p-3.5 space-y-3">
          {/* Identity */}
          <div className="border-b border-white/10 pb-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono-num uppercase tracking-[0.2em] text-[#C6A65A]">
                {inspectedOp.codename}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono-num px-2 py-0.5 bg-[#1B2319] border border-[#596747]/50 text-[#D9E2D0] uppercase">
                <User className="w-3 h-3 text-[#C6A65A]" />
                {inspectedOp.gender} · {inspectedOp.className}
              </span>
            </div>
            <h2 className="font-display font-bold text-2xl text-[#F2F2ED] uppercase leading-tight mt-0.5">
              {inspectedOp.name}
            </h2>
            <div className="text-[11px] text-[#C6A65A] font-medium">{inspectedOp.role}</div>
            <p className="text-[11px] text-[#CBD5E1] mt-1.5 leading-relaxed">{inspectedOp.backstory}</p>
          </div>

          {/* Balanced Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono-num uppercase">
              <span className="text-[#94A3B8]">COMBAT PROFILE</span>
              <span className="text-[#596747]">BALANCED · NON-P2W</span>
            </div>
            {statRows.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-[#CBD5E1] uppercase font-mono-num">{s.label}</span>
                  <span className="font-mono-num text-[#F2F2ED] font-bold">{s.value}/100</span>
                </div>
                <div className="h-1.5 bg-[#1B2219] overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${s.value}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Active Special Ability (Balanced with Cooldown) */}
          <div className="bg-[#171E16] border border-[#C6A65A]/30 p-2.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono-num text-[#C6A65A] uppercase">
                <Zap className="w-3.5 h-3.5" />
                Active Ability
              </span>
              <span className="text-[10px] font-mono-num px-1.5 py-0.5 bg-black/50 border border-[#C6A65A]/30 text-[#F2F2ED]">
                CD {inspectedOp.activeAbility.cooldown}s
              </span>
            </div>
            <div className="font-display font-bold text-sm text-[#F2F2ED] uppercase">
              {inspectedOp.activeAbility.name}
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-snug">
              {inspectedOp.activeAbility.description}
            </p>
          </div>

          {/* Passive Specialization */}
          <div className="bg-[#141914] border border-white/10 p-2.5 space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono-num text-[#596747] uppercase">
              <Shield className="w-3.5 h-3.5 text-[#86EFAC]" />
              Passive Trait
            </div>
            <div className="font-display font-bold text-xs text-[#F2F2ED] uppercase">
              {inspectedOp.passiveAbility.name}
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-snug">
              {inspectedOp.passiveAbility.description}
            </p>
          </div>
        </aside>
      </div>

      {/* BOTTOM BAR: SKIN SELECTION & CUSTOMIZATION + SELECT CHARACTER CTA */}
      <div className="pointer-events-auto bg-[#101410]/94 border border-[#C6A65A]/30 backdrop-blur-md p-2.5 sm:p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left/Center Customization Tabs & Options */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'skins', label: 'Skins & Armor' },
                { id: 'face_hair', label: 'Face & Hair' },
                { id: 'helmet_mask', label: 'Helmet & Mask' },
                { id: 'boots_gloves', label: 'Gloves & Boots' },
                { id: 'backpack', label: 'Backpack' },
                { id: 'poses', label: 'Poses & Emotes' },
              ] as Array<{ id: CustomTab; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  audioEngine.playUiClick();
                  setCustomTab(t.id);
                }}
                className={`px-2.5 py-1 text-[10px] font-display font-bold tracking-wider uppercase whitespace-nowrap border cursor-pointer transition ${
                  customTab === t.id
                    ? 'bg-[#333F2B] border-[#C6A65A] text-[#F2F2ED]'
                    : 'bg-[#161C15] border-white/10 text-[#94A3B8] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Active Customization Controls */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {customTab === 'skins' && (
              <>
                {CHARACTER_SKINS.map((sk) => {
                  const selected = activeSkinId === sk.id;
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() =>
                        applyCustomization({
                          skinId: sk.id,
                          outfitColor: sk.outfitColor,
                          visorColor: sk.visorColor,
                          glovesBootsColor: sk.glovesBootsColor,
                        })
                      }
                      className={`shrink-0 px-2.5 py-1.5 border text-left cursor-pointer transition ${
                        selected
                          ? 'bg-[#263220] border-[#C6A65A]'
                          : 'bg-[#161B16] border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 border border-white/30"
                          style={{ backgroundColor: sk.outfitColor }}
                        />
                        <span className="font-display font-bold text-[11px] text-[#F2F2ED] uppercase">
                          {sk.name}
                        </span>
                      </div>
                      <div
                        className="text-[9px] font-mono-num uppercase mt-0.5"
                        style={{ color: RARITY_COLORS[sk.rarity] }}
                      >
                        {sk.rarity}
                      </div>
                    </button>
                  );
                })}
                <div className="h-8 w-px bg-white/10 mx-1 shrink-0" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-mono-num text-[#94A3B8] uppercase">Armor:</span>
                  {OUTFIT_SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      title={sw.name}
                      onClick={() => applyCustomization({ outfitColor: sw.hex })}
                      className={`w-6 h-6 border-2 cursor-pointer ${
                        activeOutfit.toLowerCase() === sw.hex.toLowerCase()
                          ? 'border-[#C6A65A] scale-110'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  <span className="text-[9px] font-mono-num text-[#94A3B8] uppercase">Visor:</span>
                  {VISOR_SWATCHES.map((sw) => (
                    <button
                      key={sw.hex}
                      type="button"
                      title={sw.name}
                      onClick={() => applyCustomization({ visorColor: sw.hex })}
                      className={`w-6 h-6 border-2 cursor-pointer ${
                        activeVisor.toLowerCase() === sw.hex.toLowerCase()
                          ? 'border-white scale-110'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    />
                  ))}
                </div>
              </>
            )}

            {customTab === 'face_hair' && (
              <>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono-num text-[#C6A65A] uppercase">Face:</span>
                  {FACE_TONES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      title={t.name}
                      onClick={() => applyCustomization({ faceTone: t.hex })}
                      className={`w-7 h-7 border-2 cursor-pointer ${
                        activeFaceTone.toLowerCase() === t.hex.toLowerCase()
                          ? 'border-[#C6A65A] scale-110'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: t.hex }}
                    />
                  ))}
                </div>
                <div className="h-7 w-px bg-white/10 mx-1 shrink-0" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono-num text-[#C6A65A] uppercase">Hair:</span>
                  {HAIRSTYLES.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => applyCustomization({ hairStyle: h.id, helmetStyle: 'none' })}
                      className={`px-2.5 py-1.5 text-[10px] font-mono-num uppercase border cursor-pointer ${
                        activeHairStyle === h.id
                          ? 'bg-[#333F2B] border-[#C6A65A] text-white'
                          : 'bg-[#161B16] border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  {HAIR_COLORS.map((hc) => (
                    <button
                      key={hc.id}
                      type="button"
                      title={hc.name}
                      onClick={() => applyCustomization({ hairColor: hc.hex })}
                      className={`w-6 h-6 border-2 cursor-pointer ${
                        activeHairColor.toLowerCase() === hc.hex.toLowerCase()
                          ? 'border-[#C6A65A] scale-110'
                          : 'border-white/20'
                      }`}
                      style={{ backgroundColor: hc.hex }}
                    />
                  ))}
                </div>
              </>
            )}

            {customTab === 'helmet_mask' && (
              <>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono-num text-[#C6A65A] uppercase">Helmet:</span>
                  {HELMET_STYLES.map((hm) => (
                    <button
                      key={hm.id}
                      type="button"
                      onClick={() => applyCustomization({ helmetStyle: hm.id })}
                      className={`px-2.5 py-1.5 border text-left cursor-pointer ${
                        activeHelmet === hm.id
                          ? 'bg-[#333F2B] border-[#C6A65A] text-white'
                          : 'bg-[#161B16] border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <div className="text-[10px] font-display font-bold uppercase">{hm.name}</div>
                    </button>
                  ))}
                </div>
                <div className="h-7 w-px bg-white/10 mx-1 shrink-0" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono-num text-[#C6A65A] uppercase">Mask:</span>
                  {MASK_STYLES.map((mk) => (
                    <button
                      key={mk.id}
                      type="button"
                      onClick={() => applyCustomization({ maskStyle: mk.id })}
                      className={`px-2.5 py-1.5 border text-left cursor-pointer ${
                        activeMask === mk.id
                          ? 'bg-[#333F2B] border-[#C6A65A] text-white'
                          : 'bg-[#161B16] border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <div className="text-[10px] font-display font-bold uppercase">{mk.name}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {customTab === 'boots_gloves' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-num text-[#C6A65A] uppercase shrink-0">
                  Gloves & Combat Boots Finish:
                </span>
                {GLOVE_BOOT_COLORS.map((gb) => (
                  <button
                    key={gb.id}
                    type="button"
                    onClick={() => applyCustomization({ glovesBootsColor: gb.hex })}
                    className={`flex items-center gap-2 px-3 py-1.5 border cursor-pointer shrink-0 ${
                      activeBootGlove.toLowerCase() === gb.hex.toLowerCase()
                        ? 'bg-[#263220] border-[#C6A65A] text-white'
                        : 'bg-[#161B16] border-white/10 text-[#94A3B8]'
                    }`}
                  >
                    <span className="w-4 h-4 border border-white/30" style={{ backgroundColor: gb.hex }} />
                    <span className="text-[11px] font-display font-bold uppercase">{gb.name}</span>
                  </button>
                ))}
              </div>
            )}

            {customTab === 'backpack' && (
              <div className="flex items-center gap-2">
                {BACKPACK_STYLES.map((bp) => (
                  <button
                    key={bp.id}
                    type="button"
                    onClick={() => applyCustomization({ backpackStyle: bp.id })}
                    className={`px-3 py-1.5 border text-left cursor-pointer shrink-0 ${
                      activeBackpack === bp.id
                        ? 'bg-[#263220] border-[#C6A65A] text-white'
                        : 'bg-[#161B16] border-white/10 text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <div className="text-[11px] font-display font-bold uppercase">{bp.name}</div>
                    <div className="text-[9px] text-[#94A3B8]">{bp.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {customTab === 'poses' && (
              <div className="flex items-center gap-2">
                {VICTORY_POSES.map((pose) => (
                  <button
                    key={pose.id}
                    type="button"
                    onClick={() => applyCustomization({ pose: pose.id })}
                    className={`px-3 py-1.5 border text-left cursor-pointer shrink-0 flex items-center gap-2 ${
                      activePose === pose.id
                        ? 'bg-[#263220] border-[#C6A65A] text-white'
                        : 'bg-[#161B16] border-white/10 text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#C6A65A]" />
                    <div>
                      <div className="text-[11px] font-display font-bold uppercase">{pose.name}</div>
                      <div className="text-[9px] text-[#94A3B8]">{pose.tag}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM-RIGHT: SELECT CHARACTER CTA BUTTON */}
        <div className="shrink-0 flex items-center gap-2 lg:pl-3 lg:border-l lg:border-white/10">
          <button
            type="button"
            onClick={handleConfirmSelect}
            className={`w-full lg:w-[220px] py-3 px-4 font-display font-bold text-sm tracking-wider uppercase cursor-pointer transition flex items-center justify-center gap-2 ${
              !isOwned
                ? 'bg-[#B83232] hover:bg-[#DC2626] text-white border border-[#F87171]/40'
                : isEquipped
                ? 'bg-[#333F2B] hover:bg-[#415037] text-[#C6A65A] border border-[#C6A65A]'
                : 'bg-[#C6A65A] hover:bg-[#DFBE6E] text-[#101410] shadow-[0_0_20px_rgba(198,166,90,0.3)]'
            }`}
          >
            {!isOwned ? (
              <>
                <Lock className="w-4 h-4" />
                Unlock ({inspectedOp.priceGold.toLocaleString()})
              </>
            ) : isEquipped ? (
              <>
                <Check className="w-4 h-4" />
                Character Selected
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Select Character
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
