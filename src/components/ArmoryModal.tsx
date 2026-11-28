import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Coins,
  Crosshair,
  Eye,
  Lock,
  Minus,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  ATTACHMENTS,
  computeEffectiveWeaponStats,
  getCharmById,
  getTacticalById,
  getWeaponById,
  RARITY_COLORS,
  TACTICAL_EQUIPMENT,
  WEAPON_CHARMS,
  WEAPON_SKINS,
  WEAPONS,
} from '../game/data';
import { audioEngine } from '../game/audio';
import { AttachmentSlot, PlayerProfile, WeaponCategory, WeaponDef } from '../game/types';

interface ArmoryModalProps {
  profile: PlayerProfile;
  onSelectWeapon: (weaponId: string, slot: 'primary' | 'secondary' | 'pistol' | 'melee' | 'grenade') => void;
  onUnequipSecondary: () => void;
  onUnlockWeapon: (weaponId: string, priceGold: number) => void;
  onSetAttachment: (weaponId: string, slot: AttachmentSlot, attId: string | undefined) => void;
  onSetSkin: (weaponId: string, skinId: string) => void;
  onSetCharm: (weaponId: string, charmId: string) => void;
  onSetTacticalGear: (tacticalId: string) => void;
  onUpgradeWeapon: (weaponId: string, costCoins: number) => void;
  onPreviewWeapon: (weaponId: string | null) => void;
  onArmoryZoom: (zoom: number) => void;
  onToggleAutoRotate: (enabled: boolean) => void;
  onResetArmoryView: () => void;
  onInspectWeapon: () => void;
  onReloadPreview: () => void;
  onClose: () => void;
}

type CategoryTabId = 'AR' | 'SNIPER' | 'SMG' | 'SHOTGUN' | 'LMG' | 'PISTOL' | 'MELEE' | 'GRENADE';

const CATEGORY_TABS: Array<{ id: CategoryTabId; label: string }> = [
  { id: 'AR', label: 'AR' },
  { id: 'SNIPER', label: 'Sniper' },
  { id: 'SMG', label: 'SMG' },
  { id: 'SHOTGUN', label: 'Shotgun' },
  { id: 'LMG', label: 'LMG' },
  { id: 'PISTOL', label: 'Pistol' },
  { id: 'MELEE', label: 'Melee' },
  { id: 'GRENADE', label: 'Grenade' },
];

const SLOTS: Array<{ slot: AttachmentSlot; label: string }> = [
  { slot: 'scope', label: 'Scope / Sight' },
  { slot: 'muzzle', label: 'Muzzle / Suppressor' },
  { slot: 'grip', label: 'Foregrip / Laser' },
  { slot: 'magazine', label: 'Magazine' },
  { slot: 'stock', label: 'Stock' },
];

const SAMPLE_AMMO_INVENTORY = [
  { caliber: '5.56mm NATO', count: 240, compat: 'AR · LMG', color: '#22C55E' },
  { caliber: '7.62mm Heavy', count: 180, compat: 'AR · DMR · SR · LMG', color: '#C6A65A' },
  { caliber: '9mm Tactical', count: 220, compat: 'SMG · Pistol', color: '#38BDF8' },
  { caliber: '.300 Magnum', count: 45, compat: 'Bolt-Action Sniper', color: '#EF4444' },
  { caliber: '12 Gauge Shells', count: 56, compat: 'Combat Shotguns', color: '#F59E0B' },
  { caliber: 'Tactical Ordnance', count: 8, compat: 'Frag · Smoke · Flash', color: '#A855F7' },
];

function mapCategoryToTab(cat: WeaponCategory): CategoryTabId {
  return cat === 'DMR' ? 'SNIPER' : cat;
}

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  profile,
  onSelectWeapon,
  onUnequipSecondary,
  onUnlockWeapon,
  onSetAttachment,
  onSetSkin,
  onSetCharm,
  onSetTacticalGear,
  onUpgradeWeapon,
  onPreviewWeapon,
  onArmoryZoom,
  onToggleAutoRotate,
  onResetArmoryView,
  onInspectWeapon,
  onReloadPreview,
  onClose,
}) => {
  const [inspectedWeaponId, setInspectedWeaponId] = useState<string>(profile.selectedWeaponId);
  const [catTab, setCatTab] = useState<CategoryTabId>(
    mapCategoryToTab(getWeaponById(profile.selectedWeaponId).category)
  );
  const [leftView, setLeftView] = useState<'weapons' | 'inventory'>('weapons');
  const [rightTab, setRightTab] = useState<'attachments' | 'skins' | 'charms' | 'tactical'>('attachments');
  const [searchQuery, setSearchQuery] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'locked'>('all');
  const [zoom, setZoom] = useState(1.0);
  const [autoRotate360, setAutoRotate360] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const ownedWeaponSet = useMemo(() => {
    const base = new Set(profile.ownedWeaponIds || WEAPONS.filter((w) => !w.priceGold).map((w) => w.id));
    WEAPONS.forEach((w) => {
      if (!w.priceGold) base.add(w.id);
    });
    return base;
  }, [profile.ownedWeaponIds]);

  const weapon = getWeaponById(inspectedWeaponId);
  const isWeaponOwned = ownedWeaponSet.has(weapon.id);
  const attachments = profile.selectedAttachments[weapon.id] || {};
  const weaponLevel = profile.weaponLevels[weapon.id] || 1;
  const effective = computeEffectiveWeaponStats(weapon, attachments, weaponLevel);
  const activeSkinId = profile.selectedWeaponSkins[weapon.id] || 'skin_factory';
  const activeSkin = WEAPON_SKINS.find((s) => s.id === activeSkinId) || WEAPON_SKINS[0];
  const activeCharmId = profile.selectedWeaponCharms?.[weapon.id] || 'charm_none';
  const activeCharm = getCharmById(activeCharmId);
  const upgradeCost = 800 + weaponLevel * 600;

  const isFirearm = weapon.category !== 'MELEE' && weapon.category !== 'GRENADE';

  const primaryW = getWeaponById(profile.selectedWeaponId);
  const secondaryW = profile.selectedSecondaryId ? getWeaponById(profile.selectedSecondaryId) : null;
  const pistolW = getWeaponById(profile.selectedPistolId || 'p19v');
  const meleeW = getWeaponById(profile.selectedMeleeId || 'kbarv');
  const grenadeW = getWeaponById(profile.selectedGrenadeId || 'frag_m67');
  const tacticalGear = getTacticalById(profile.selectedTacticalId || 'tac_medkit_rig');

  // Keep 3D Armory preview synced with inspected weapon
  useEffect(() => {
    onPreviewWeapon(weapon.id);
    return () => {
      onPreviewWeapon(null);
      onArmoryZoom(1.0);
    };
  }, [weapon.id, onPreviewWeapon, onArmoryZoom]);

  // Sync 360-degree auto-rotation toggle with 3D engine
  useEffect(() => {
    onToggleAutoRotate(autoRotate360);
    return () => {
      onToggleAutoRotate(true);
    };
  }, [autoRotate360, onToggleAutoRotate]);

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2200);
  };

  const handleZoomChange = (nextZoom: number) => {
    const clamped = Math.max(0.7, Math.min(1.6, Number(nextZoom.toFixed(2))));
    setZoom(clamped);
    onArmoryZoom(clamped);
  };

  const handleToggle360Rotate = () => {
    audioEngine.playUiClick();
    setAutoRotate360((prev) => {
      const next = !prev;
      flashToast(
        next ? '360° Auto-Rotate enabled — orbiting skin & charm' : '360° Auto-Rotate paused — drag to inspect manually'
      );
      return next;
    });
  };

  const filteredWeapons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return WEAPONS.filter((w) => {
      const owned = ownedWeaponSet.has(w.id);
      if (ownershipFilter === 'owned' && !owned) return false;
      if (ownershipFilter === 'locked' && owned) return false;
      if (q) {
        return (
          w.name.toLowerCase().includes(q) ||
          w.code.toLowerCase().includes(q) ||
          w.category.toLowerCase().includes(q) ||
          w.ammoType.toLowerCase().includes(q)
        );
      }
      if (catTab === 'SNIPER') return w.category === 'SNIPER' || w.category === 'DMR';
      return w.category === catTab;
    });
  }, [catTab, ownershipFilter, ownedWeaponSet, searchQuery]);

  const getEquippedBadge = (w: WeaponDef): string | null => {
    if (profile.selectedWeaponId === w.id) return 'PRIMARY';
    if (profile.selectedSecondaryId === w.id) return 'SECONDARY';
    if ((profile.selectedPistolId || 'p19v') === w.id) return 'PISTOL';
    if ((profile.selectedMeleeId || 'kbarv') === w.id) return 'MELEE';
    if ((profile.selectedGrenadeId || 'frag_m67') === w.id) return 'GRENADE';
    return null;
  };

  const handleEquipInspected = (targetSlot?: 'primary' | 'secondary' | 'pistol' | 'melee' | 'grenade') => {
    audioEngine.playUiClick();
    if (!isWeaponOwned) {
      const price = weapon.priceGold || 1500;
      if (profile.gold < price) {
        flashToast(`Need ${price.toLocaleString()} V-Coins to unlock ${weapon.name}`);
        return;
      }
      onUnlockWeapon(weapon.id, price);
      flashToast(`${weapon.name} unlocked locally`);
      return;
    }

    let slot = targetSlot;
    if (!slot) {
      if (weapon.category === 'PISTOL') slot = 'pistol';
      else if (weapon.category === 'MELEE') slot = 'melee';
      else if (weapon.category === 'GRENADE') slot = 'grenade';
      else slot = 'primary';
    }
    onSelectWeapon(weapon.id, slot);
    flashToast(`${weapon.name} equipped to ${slot.toUpperCase()} slot`);
  };

  const inspectSlotWeapon = (wId: string) => {
    audioEngine.playUiClick();
    const w = getWeaponById(wId);
    setInspectedWeaponId(w.id);
    setCatTab(mapCategoryToTab(w.category));
    setSearchQuery('');
  };

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 overflow-hidden">
      {/* TOP BAR + 6-SLOT LOADOUT STRIP */}
      <div className="pointer-events-auto bg-[#101410]/92 border border-[#C6A65A]/30 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick();
                onPreviewWeapon(null);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B2219] hover:bg-[#333F2B] border border-[#C6A65A]/30 text-xs font-display font-bold tracking-wider uppercase text-[#F2F2ED] cursor-pointer transition"
            >
              <ArrowLeft className="w-4 h-4 text-[#C6A65A]" />
              Lobby
            </button>
            <div>
              <div className="font-display font-bold text-base sm:text-lg tracking-wider uppercase text-[#F2F2ED] leading-none">
                VARKON · Weapon Inventory & Loadout
              </div>
              <div className="text-[10px] font-mono-num uppercase tracking-widest text-[#C6A65A] mt-0.5">
                8 Weapon Categories · 6 Loadout Slots · Sample Prototype Stats
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {toast && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1D2B1B] border border-[#22C55E]/50 text-[11px] font-mono-num text-[#86EFAC]">
                <Check className="w-3.5 h-3.5" />
                {toast}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search weapons..."
                className="w-36 sm:w-44 pl-8 pr-6 py-1 bg-[#161C15] border border-white/15 focus:border-[#C6A65A] outline-none text-xs text-[#F2F2ED] placeholder:text-[#64748B]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-[#182017] border border-[#C6A65A]/30 px-2.5 py-1 text-xs font-mono-num text-[#C6A65A]">
              <Coins className="w-3.5 h-3.5" />
              <span>{profile.gold.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 6 ACTIVE LOADOUT SLOTS STRIP */}
        <div className="px-3 py-1.5 bg-[#141A13]/90 grid grid-cols-3 md:grid-cols-6 gap-1.5">
          <button
            type="button"
            onClick={() => inspectSlotWeapon(primaryW.id)}
            className={`text-left px-2 py-1 border cursor-pointer transition ${
              weapon.id === primaryW.id ? 'bg-[#263220] border-[#C6A65A]' : 'bg-[#101410]/80 border-white/10 hover:border-[#C6A65A]/40'
            }`}
          >
            <div className="text-[9px] font-mono-num text-[#C6A65A] uppercase">1 · Primary</div>
            <div className="font-display font-bold text-[11px] text-[#F2F2ED] uppercase truncate">{primaryW.name}</div>
          </button>

          <div
            className={`px-2 py-1 border flex items-center justify-between gap-1 ${
              secondaryW && weapon.id === secondaryW.id
                ? 'bg-[#263220] border-[#C6A65A]'
                : 'bg-[#101410]/80 border-white/10'
            }`}
          >
            <button
              type="button"
              onClick={() => secondaryW && inspectSlotWeapon(secondaryW.id)}
              className="text-left min-w-0 flex-1 cursor-pointer"
            >
              <div className="text-[9px] font-mono-num text-[#38BDF8] uppercase">2 · Secondary</div>
              <div className="font-display font-bold text-[11px] text-[#F2F2ED] uppercase truncate">
                {secondaryW ? secondaryW.name : 'Empty Slot'}
              </div>
            </button>
            {secondaryW && (
              <button
                type="button"
                title="Unequip Secondary"
                onClick={() => {
                  audioEngine.playUiClick();
                  onUnequipSecondary();
                  flashToast('Secondary slot cleared');
                }}
                className="p-0.5 text-[#94A3B8] hover:text-[#EF4444] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => inspectSlotWeapon(pistolW.id)}
            className={`text-left px-2 py-1 border cursor-pointer transition ${
              weapon.id === pistolW.id ? 'bg-[#263220] border-[#C6A65A]' : 'bg-[#101410]/80 border-white/10 hover:border-[#C6A65A]/40'
            }`}
          >
            <div className="text-[9px] font-mono-num text-[#94A3B8] uppercase">3 · Pistol</div>
            <div className="font-display font-bold text-[11px] text-[#F2F2ED] uppercase truncate">{pistolW.name}</div>
          </button>

          <button
            type="button"
            onClick={() => inspectSlotWeapon(meleeW.id)}
            className={`text-left px-2 py-1 border cursor-pointer transition ${
              weapon.id === meleeW.id ? 'bg-[#263220] border-[#C6A65A]' : 'bg-[#101410]/80 border-white/10 hover:border-[#C6A65A]/40'
            }`}
          >
            <div className="text-[9px] font-mono-num text-[#94A3B8] uppercase">4 · Melee</div>
            <div className="font-display font-bold text-[11px] text-[#F2F2ED] uppercase truncate">{meleeW.name}</div>
          </button>

          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick();
              setRightTab('tactical');
            }}
            className={`text-left px-2 py-1 border cursor-pointer transition ${
              rightTab === 'tactical' ? 'bg-[#263220] border-[#C6A65A]' : 'bg-[#101410]/80 border-white/10 hover:border-[#C6A65A]/40'
            }`}
          >
            <div className="text-[9px] font-mono-num text-[#22C55E] uppercase">5 · Tactical</div>
            <div className="font-display font-bold text-[11px] text-[#F2F2ED] uppercase truncate">
              {tacticalGear.name}
            </div>
          </button>

          <button
            type="button"
            onClick={() => inspectSlotWeapon(grenadeW.id)}
            className={`text-left px-2 py-1 border cursor-pointer transition ${
              weapon.id === grenadeW.id ? 'bg-[#263220] border-[#C6A65A]' : 'bg-[#101410]/80 border-white/10 hover:border-[#C6A65A]/40'
            }`}
          >
            <div className="text-[9px] font-mono-num text-[#F59E0B] uppercase">6 · Grenade</div>
            <div className="font-display font-bold text-[11px] text-[#F2F2ED] uppercase truncate">{grenadeW.name}</div>
          </button>
        </div>
      </div>

      {/* MAIN BODY: LEFT INVENTORY · OPEN 3D STAGE + CONTROLS · RIGHT STATS & CUSTOMIZER */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row justify-between gap-2.5 mt-2.5 overflow-hidden">
        {/* LEFT PANEL: 8-CATEGORY WEAPON INVENTORY & AMMO */}
        <aside className="pointer-events-auto w-full lg:w-[295px] xl:w-[315px] max-h-[32vh] lg:max-h-full bg-[#101410]/90 border border-[#C6A65A]/25 backdrop-blur-md flex flex-col overflow-hidden">
          <div className="flex border-b border-white/10 bg-[#161C15]/90">
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick();
                setLeftView('weapons');
              }}
              className={`flex-1 py-2 text-[11px] font-display font-bold uppercase tracking-wider cursor-pointer ${
                leftView === 'weapons'
                  ? 'bg-[#333F2B] text-[#F2F2ED] border-b-2 border-[#C6A65A]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Weapons ({ownedWeaponSet.size}/{WEAPONS.length})
            </button>
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick();
                setLeftView('inventory');
              }}
              className={`flex-1 py-2 text-[11px] font-display font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1 ${
                leftView === 'inventory'
                  ? 'bg-[#333F2B] text-[#F2F2ED] border-b-2 border-[#C6A65A]'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-[#C6A65A]" />
              Ammo & Gear
            </button>
          </div>

          {leftView === 'weapons' ? (
            <>
              {/* 8 Weapon Category Tabs */}
              <div className="p-2 border-b border-white/10 space-y-1.5">
                <div className="grid grid-cols-4 gap-1">
                  {CATEGORY_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick();
                        setCatTab(t.id);
                        setSearchQuery('');
                      }}
                      className={`py-1 text-[10px] font-display font-bold uppercase border cursor-pointer transition ${
                        catTab === t.id && !searchQuery
                          ? 'bg-[#C6A65A] border-[#C6A65A] text-[#101410]'
                          : 'bg-[#161C15] border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Owned / Locked Filter */}
                <div className="grid grid-cols-3 gap-1">
                  {(['all', 'owned', 'locked'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick();
                        setOwnershipFilter(f);
                      }}
                      className={`py-0.5 text-[9px] font-mono-num uppercase border cursor-pointer ${
                        ownershipFilter === f
                          ? 'bg-[#333F2B] border-[#C6A65A] text-[#F2F2ED]'
                          : 'bg-[#121612] border-white/10 text-[#94A3B8]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weapon List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {filteredWeapons.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#94A3B8]">
                    No weapons match your current filter.
                  </div>
                ) : (
                  filteredWeapons.map((w) => {
                    const owned = ownedWeaponSet.has(w.id);
                    const badge = getEquippedBadge(w);
                    const isSelected = w.id === weapon.id;

                    return (
                      <div
                        key={w.id}
                        onClick={() => {
                          audioEngine.playUiClick();
                          setInspectedWeaponId(w.id);
                        }}
                        className={`p-2.5 border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#263220] border-[#C6A65A] shadow-[inset_3px_0_0_#C6A65A]'
                            : 'bg-[#141914]/90 border-white/10 hover:border-[#C6A65A]/45'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-display font-bold text-sm text-[#F2F2ED] uppercase truncate">
                                {w.name}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono-num text-[#94A3B8] mt-0.5">
                              {w.code} · {w.ammoType} · DMG {w.damage}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            {badge ? (
                              <span className="text-[9px] font-mono-num px-1.5 py-0.5 bg-[#C6A65A] text-[#101410] font-bold uppercase">
                                {badge}
                              </span>
                            ) : !owned ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-mono-num px-1.5 py-0.5 bg-[#3B1818] border border-[#EF4444]/40 text-[#FCA5A5]">
                                <Lock className="w-2.5 h-2.5" />
                                {w.priceGold}
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono-num text-[#86EFAC] uppercase">OWNED</span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-white/10 flex gap-1.5">
                            {!owned ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEquipInspected();
                                }}
                                className="flex-1 py-1.5 bg-[#B83232] hover:bg-[#DC2626] text-[10px] font-display font-bold uppercase text-white cursor-pointer"
                              >
                                Unlock ({w.priceGold?.toLocaleString()} V-Coins)
                              </button>
                            ) : w.category === 'PISTOL' || w.category === 'MELEE' || w.category === 'GRENADE' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEquipInspected();
                                }}
                                className="flex-1 py-1.5 bg-[#C6A65A] hover:bg-[#DFBE6E] text-[10px] font-display font-bold uppercase text-[#101410] cursor-pointer"
                              >
                                {badge ? `Equipped (${badge})` : `Equip ${w.category}`}
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEquipInspected('primary');
                                  }}
                                  className="flex-1 py-1.5 bg-[#C6A65A] hover:bg-[#DFBE6E] text-[10px] font-display font-bold uppercase text-[#101410] cursor-pointer"
                                >
                                  Equip Primary
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEquipInspected('secondary');
                                  }}
                                  className="flex-1 py-1.5 bg-[#1B241A] hover:bg-[#333F2B] border border-[#38BDF8]/40 text-[10px] font-display font-bold uppercase text-[#38BDF8] cursor-pointer"
                                >
                                  Equip 2nd
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* INVENTORY SUMMARY TAB (Ammo, Skins, Attachments, Grenades) */
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div>
                <div className="text-[10px] font-mono-num text-[#C6A65A] uppercase mb-1.5">
                  AMMUNITION RESERVES (SAMPLE INVENTORY)
                </div>
                <div className="space-y-1.5">
                  {SAMPLE_AMMO_INVENTORY.map((ammo) => (
                    <div
                      key={ammo.caliber}
                      className="flex items-center justify-between bg-[#151B14] border border-white/10 px-2.5 py-2"
                    >
                      <div>
                        <div className="font-display font-bold text-xs text-[#F2F2ED] uppercase">
                          {ammo.caliber}
                        </div>
                        <div className="text-[9px] font-mono-num text-[#94A3B8]">{ammo.compat}</div>
                      </div>
                      <span
                        className="font-mono-num text-xs font-bold px-2 py-0.5 bg-black/50 border border-white/10"
                        style={{ color: ammo.color }}
                      >
                        x{ammo.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-[#151B14] border border-white/10 p-2">
                  <div className="font-mono-num text-base font-bold text-[#C6A65A]">
                    {profile.ownedSkinIds.length}/{WEAPON_SKINS.length}
                  </div>
                  <div className="text-[9px] font-mono-num text-[#94A3B8] uppercase">Owned Skins</div>
                </div>
                <div className="bg-[#151B14] border border-white/10 p-2">
                  <div className="font-mono-num text-base font-bold text-[#38BDF8]">{ATTACHMENTS.length}</div>
                  <div className="text-[9px] font-mono-num text-[#94A3B8] uppercase">Attachments</div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* CENTER OPEN 3D WEAPON STAGE WITH COMPACT BOTTOM CONTROLS */}
        <div className="hidden lg:flex flex-1 flex-col items-center justify-between py-2 pointer-events-none">
          <div className="bg-[#101410]/80 border border-[#C6A65A]/30 px-3 py-1 text-[10px] font-mono-num uppercase tracking-widest text-[#F2F2ED] flex items-center gap-2">
            <RotateCw
              className={`w-3 h-3 text-[#C6A65A] ${autoRotate360 ? 'animate-spin' : ''}`}
              style={autoRotate360 ? { animationDuration: '5s' } : undefined}
            />
            <span>
              {weapon.name} ·{' '}
              <span className={autoRotate360 ? 'text-[#86EFAC]' : 'text-[#94A3B8]'}>
                {autoRotate360 ? '360° Auto-Orbit' : 'Manual 360° Drag'}
              </span>{' '}
              · Skin: <span className="text-[#C6A65A]">{activeSkin.name}</span> · Charm:{' '}
              <span className="text-[#C6A65A]">{activeCharm.name}</span>
            </span>
          </div>

          {/* 3D Preview Controls Dock (Zoom, 360° Rotation Toggle, Reset Angle, Inspect, Reload Preview) */}
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 bg-[#101410]/90 border border-[#C6A65A]/30 px-3 py-2 backdrop-blur-md">
            <div className="flex items-center gap-1.5 pr-2 border-r border-white/10">
              <button
                type="button"
                title="Zoom Out"
                onClick={() => handleZoomChange(zoom - 0.15)}
                className="p-1 bg-[#182017] hover:bg-[#333F2B] border border-white/15 text-[#F2F2ED] cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.05}
                value={zoom}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="w-20 accent-[#C6A65A] cursor-pointer"
              />
              <button
                type="button"
                title="Zoom In"
                onClick={() => handleZoomChange(zoom + 0.15)}
                className="p-1 bg-[#182017] hover:bg-[#333F2B] border border-white/15 text-[#F2F2ED] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono-num text-[#C6A65A] w-9 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoRotate360}
              onClick={handleToggle360Rotate}
              title="Toggle continuous 360-degree weapon rotation to inspect skin and charm from all angles"
              className={`flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-display font-bold uppercase cursor-pointer transition ${
                autoRotate360
                  ? 'bg-[#333F2B] border-[#C6A65A] text-[#F2F2ED]'
                  : 'bg-[#161C15] hover:bg-[#222B1F] border-white/20 text-[#94A3B8] hover:text-[#F2F2ED]'
              }`}
            >
              <RotateCw
                className={`w-3.5 h-3.5 ${autoRotate360 ? 'text-[#C6A65A] animate-spin' : 'text-[#94A3B8]'}`}
                style={autoRotate360 ? { animationDuration: '4s' } : undefined}
              />
              <span>360° Rotate</span>
              <span
                className={`px-1 py-0.5 text-[9px] font-mono-num leading-none ${
                  autoRotate360 ? 'bg-[#C6A65A] text-[#101410] font-bold' : 'bg-black/40 text-[#94A3B8]'
                }`}
              >
                {autoRotate360 ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onResetArmoryView();
                handleZoomChange(1.0);
                flashToast('Weapon camera angle reset');
              }}
              title="Reset Weapon Angle & Zoom"
              className="p-1.5 bg-[#1B2219] hover:bg-[#333F2B] border border-white/15 text-[#94A3B8] hover:text-[#F2F2ED] cursor-pointer transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onInspectWeapon}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1B2219] hover:bg-[#333F2B] border border-[#C6A65A]/40 text-[10px] font-display font-bold uppercase text-[#F2F2ED] cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#C6A65A]" />
              Inspect 3D
            </button>

            <button
              type="button"
              onClick={onReloadPreview}
              disabled={!isFirearm}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1B2219] hover:bg-[#333F2B] disabled:opacity-40 border border-[#38BDF8]/40 text-[10px] font-display font-bold uppercase text-[#38BDF8] cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Preview
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: 7 WEAPON STATS + ATTACHMENTS / SKINS / CHARMS / TACTICAL + SAVE LOADOUT */}
        <aside className="pointer-events-auto w-full lg:w-[345px] xl:w-[365px] max-h-[42vh] lg:max-h-full bg-[#101410]/92 border border-[#C6A65A]/25 backdrop-blur-md flex flex-col overflow-hidden">
          {/* Weapon Header + Mastery */}
          <div className="p-3 border-b border-white/10">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-mono-num text-[#C6A65A] uppercase tracking-widest">
                  {weapon.category} · {weapon.ammoType} · {weapon.fireModes.join('/')}
                </div>
                <h2 className="font-display font-bold text-xl text-[#F2F2ED] uppercase leading-tight">
                  {weapon.name}
                </h2>
              </div>
              {isFirearm && isWeaponOwned && (
                <button
                  type="button"
                  disabled={weaponLevel >= 5 || profile.gold < upgradeCost}
                  onClick={() => {
                    audioEngine.playUiClick();
                    onUpgradeWeapon(weapon.id, upgradeCost);
                    flashToast(`${weapon.name} Mastery Lv.${Math.min(5, weaponLevel + 1)}`);
                  }}
                  className="shrink-0 px-2 py-1 bg-[#1B241A] hover:bg-[#333F2B] disabled:opacity-40 border border-[#C6A65A]/45 text-[9px] font-mono-num text-[#C6A65A] uppercase cursor-pointer"
                >
                  {weaponLevel >= 5 ? 'MAX LV.5' : `LV.${weaponLevel} ↑ (${upgradeCost})`}
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-1 leading-snug">{weapon.description}</p>

            {/* 7 Complete Balanced Sample Stats */}
            <div className="mt-2.5 space-y-1.5">
              <div className="flex justify-between text-[9px] font-mono-num uppercase">
                <span className="text-[#94A3B8]">BALLISTIC METRICS</span>
                <span className="text-[#596747]">BALANCED SAMPLE STATS</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {[
                  { label: 'Damage', val: effective.damage, max: 125, display: String(effective.damage), color: '#EF4444' },
                  { label: 'Accuracy', val: effective.accuracy, max: 100, display: `${effective.accuracy}%`, color: '#22C55E' },
                  { label: 'Range', val: effective.range, max: 350, display: `${effective.range}m`, color: '#38BDF8' },
                  { label: 'Fire Rate', val: effective.fireRate, max: 1100, display: `${effective.fireRate}`, color: '#C6A65A' },
                  { label: 'Recoil', val: effective.recoil, max: 90, display: `${effective.recoil}`, color: '#F59E0B' },
                  { label: 'Reload', val: Math.max(10, 100 - effective.reloadTime * 20), max: 100, display: `${effective.reloadTime}s`, color: '#A855F7' },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#94A3B8] uppercase font-mono-num">{s.label}</span>
                      <span className="font-mono-num text-[#F2F2ED] font-bold">{s.display}</span>
                    </div>
                    <div className="h-1 bg-[#1B2219] mt-0.5 overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(6, (s.val / s.max) * 100))}%`,
                          backgroundColor: s.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono-num bg-[#151B14] border border-white/10 px-2 py-1 mt-1">
                <span className="text-[#94A3B8] uppercase">Magazine Capacity</span>
                <span className="text-[#C6A65A] font-bold">
                  {weapon.category === 'MELEE'
                    ? 'Unlimited Steel'
                    : weapon.category === 'GRENADE'
                    ? `${effective.magSize} Carry Limit`
                    : `${effective.magSize} Rounds / Mag`}
                </span>
              </div>
            </div>
          </div>

          {/* Customization Sub-Tabs */}
          <div className="grid grid-cols-4 border-b border-white/10 bg-[#151B14]">
            {(
              [
                { id: 'attachments', label: 'Parts', icon: Wrench },
                { id: 'skins', label: 'Skins', icon: Sparkles },
                { id: 'charms', label: 'Charms', icon: Crosshair },
                { id: 'tactical', label: 'Tactical', icon: Package },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  audioEngine.playUiClick();
                  setRightTab(t.id);
                }}
                className={`py-2 text-[10px] font-display font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1 ${
                  rightTab === t.id
                    ? 'bg-[#333F2B] text-[#F2F2ED] border-b-2 border-[#C6A65A]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <t.icon className="w-3 h-3 text-[#C6A65A]" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Active Customization Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {rightTab === 'attachments' && (
              <>
                {!isFirearm ? (
                  <div className="p-3 bg-[#151B14] border border-white/10 text-xs text-[#94A3B8]">
                    {weapon.category === 'GRENADE'
                      ? 'Tactical grenades do not take optical or barrel attachments. Customize finishes in Skins or inspect the 3D canister.'
                      : 'Melee weapons do not take ballistic attachments. Customize finish in Skins.'}
                  </div>
                ) : (
                  SLOTS.map(({ slot, label }) => {
                    const options = ATTACHMENTS.filter((a) => a.slot === slot);
                    const currentId = attachments[slot];
                    return (
                      <div key={slot}>
                        <div className="text-[10px] font-mono-num uppercase text-[#C6A65A] mb-1">{label}</div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              audioEngine.playUiClick();
                              onSetAttachment(weapon.id, slot, undefined);
                            }}
                            className={`px-2 py-1 text-[10px] font-mono-num border cursor-pointer ${
                              !currentId
                                ? 'bg-[#333F2B] border-[#C6A65A] text-white'
                                : 'bg-[#151B14] border-white/10 text-[#94A3B8]'
                            }`}
                          >
                            Default
                          </button>
                          {options.map((att) => (
                            <button
                              key={att.id}
                              type="button"
                              title={att.description}
                              onClick={() => {
                                audioEngine.playUiClick();
                                onSetAttachment(weapon.id, slot, att.id);
                              }}
                              className={`px-2 py-1 text-[10px] font-mono-num border cursor-pointer ${
                                currentId === att.id
                                  ? 'bg-[#333F2B] border-[#C6A65A] text-[#F2F2ED]'
                                  : 'bg-[#151B14] border-white/10 text-[#94A3B8] hover:text-white'
                              }`}
                            >
                              {att.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {rightTab === 'skins' && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-mono-num text-[#94A3B8] uppercase">
                  Cosmetic finishes only — zero stat advantage
                </div>
                {WEAPON_SKINS.map((sk) => {
                  const owned = profile.ownedSkinIds.includes(sk.id) || sk.id === 'skin_factory';
                  const active = activeSkinId === sk.id;
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      disabled={!owned}
                      onClick={() => {
                        audioEngine.playUiClick();
                        onSetSkin(weapon.id, sk.id);
                        flashToast(`Applied ${sk.name} skin`);
                      }}
                      className={`w-full text-left p-2.5 border flex items-center justify-between transition ${
                        active
                          ? 'bg-[#263220] border-[#C6A65A]'
                          : owned
                          ? 'bg-[#151B14] border-white/10 hover:border-[#C6A65A]/40 cursor-pointer'
                          : 'bg-[#121612] border-white/5 opacity-55 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 border border-white/25"
                          style={{
                            background: `linear-gradient(135deg, ${sk.primaryColor} 55%, ${sk.emissiveColor} 100%)`,
                          }}
                        />
                        <div>
                          <div className="font-display font-bold text-xs text-[#F2F2ED] uppercase">{sk.name}</div>
                          <div className="text-[9px] font-mono-num uppercase" style={{ color: RARITY_COLORS[sk.rarity] }}>
                            {sk.rarity} · {sk.killEffect}
                          </div>
                        </div>
                      </div>
                      {active ? (
                        <Check className="w-4 h-4 text-[#C6A65A]" />
                      ) : !owned ? (
                        <Lock className="w-3.5 h-3.5 text-[#94A3B8]" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {rightTab === 'charms' && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-mono-num text-[#94A3B8] uppercase">
                  Mounted on left receiver rail in live 3D view
                </div>
                {WEAPON_CHARMS.map((ch) => {
                  const active = activeCharmId === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick();
                        onSetCharm(weapon.id, ch.id);
                        flashToast(`Charm set: ${ch.name}`);
                      }}
                      className={`w-full text-left p-2.5 border flex items-center justify-between cursor-pointer transition ${
                        active ? 'bg-[#263220] border-[#C6A65A]' : 'bg-[#151B14] border-white/10 hover:border-[#C6A65A]/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 border border-white/25 rotate-45 shrink-0"
                          style={{ backgroundColor: ch.color }}
                        />
                        <div>
                          <div className="font-display font-bold text-xs text-[#F2F2ED] uppercase">{ch.name}</div>
                          <div className="text-[9px] text-[#94A3B8]">{ch.description}</div>
                        </div>
                      </div>
                      {active && <Check className="w-4 h-4 text-[#C6A65A]" />}
                    </button>
                  );
                })}
              </div>
            )}

            {rightTab === 'tactical' && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-mono-num text-[#C6A65A] uppercase">
                  Loadout Slot 5 · Tactical Equipment
                </div>
                {TACTICAL_EQUIPMENT.map((tg) => {
                  const active = tacticalGear.id === tg.id;
                  return (
                    <button
                      key={tg.id}
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick();
                        onSetTacticalGear(tg.id);
                        flashToast(`Equipped Tactical Gear: ${tg.name}`);
                      }}
                      className={`w-full text-left p-2.5 border flex items-center justify-between cursor-pointer transition ${
                        active ? 'bg-[#263220] border-[#C6A65A]' : 'bg-[#151B14] border-white/10 hover:border-[#C6A65A]/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-display font-bold text-xs text-[#F2F2ED] uppercase">{tg.name}</span>
                          <span
                            className="text-[9px] font-mono-num uppercase"
                            style={{ color: RARITY_COLORS[tg.rarity] }}
                          >
                            {tg.category}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#94A3B8] mt-0.5">{tg.description}</div>
                        <div className="text-[9px] font-mono-num text-[#596747] mt-0.5">{tg.cooldownLabel}</div>
                      </div>
                      {active && <Check className="w-4 h-4 text-[#C6A65A] shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile 3D Action Row + Save Loadout CTA */}
          <div className="p-2.5 border-t border-white/10 bg-[#141A13] space-y-2">
            <div className="flex lg:hidden items-center gap-1.5">
              <button
                type="button"
                role="switch"
                aria-checked={autoRotate360}
                onClick={handleToggle360Rotate}
                className={`flex-1 py-1.5 border text-[10px] font-display font-bold uppercase cursor-pointer flex items-center justify-center gap-1 ${
                  autoRotate360
                    ? 'bg-[#333F2B] border-[#C6A65A] text-[#F2F2ED]'
                    : 'bg-[#161C15] border-white/20 text-[#94A3B8]'
                }`}
              >
                <RotateCw
                  className={`w-3 h-3 ${autoRotate360 ? 'text-[#C6A65A] animate-spin' : 'text-[#94A3B8]'}`}
                  style={autoRotate360 ? { animationDuration: '4s' } : undefined}
                />
                360° {autoRotate360 ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={onInspectWeapon}
                className="flex-1 py-1.5 bg-[#1B2219] border border-[#C6A65A]/40 text-[10px] font-display font-bold uppercase text-[#F2F2ED] cursor-pointer"
              >
                Inspect 3D
              </button>
              <button
                type="button"
                onClick={onReloadPreview}
                disabled={!isFirearm}
                className="flex-1 py-1.5 bg-[#1B2219] border border-[#38BDF8]/40 text-[10px] font-display font-bold uppercase text-[#38BDF8] cursor-pointer disabled:opacity-40"
              >
                Reload
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick();
                flashToast('6-slot loadout saved locally to VARKON profile');
              }}
              className="w-full py-2.5 bg-[#C6A65A] hover:bg-[#DFBE6E] text-[#101410] font-display font-bold text-xs tracking-wider uppercase cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Save Loadout
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
