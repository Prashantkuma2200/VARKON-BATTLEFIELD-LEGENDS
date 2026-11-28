import React, { useState } from 'react';
import { Award, Calendar, Check, Clock, Crown, History, Play, ShoppingBag, X } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { BATTLE_PASS_TIERS, LIVE_EVENTS, RARITY_COLORS, STORE_ITEMS } from '../game/data';
import { GameModeId, MapId, PlayerProfile, StoreItemDef } from '../game/types';

interface StoreBattlePassModalProps {
  initialTab: 'store' | 'battlepass' | 'missions' | 'events';
  profile: PlayerProfile;
  onBuyStoreItem: (item: StoreItemDef, currency: 'gold' | 'vex') => void;
  onUnlockPremiumBp: () => void;
  onClaimBpReward: (tier: number, track: 'free' | 'premium') => void;
  onClaimMission: (missionId: string) => void;
  onClaimDailyReward: () => void;
  onLaunchEventMode?: (mode: GameModeId, mapId: MapId) => void;
  onClose: () => void;
}

export const StoreBattlePassModal: React.FC<StoreBattlePassModalProps> = ({
  initialTab,
  profile,
  onBuyStoreItem,
  onUnlockPremiumBp,
  onClaimBpReward,
  onClaimMission,
  onClaimDailyReward,
  onLaunchEventMode,
  onClose,
}) => {
  const [tab, setTab] = useState(initialTab);
  const [storeFilter, setStoreFilter] = useState<'all' | 'daily_deals' | 'history' | StoreItemDef['category']>('all');
  const [confirmPurchase, setConfirmPurchase] = useState<{ item: StoreItemDef; currency: 'gold' | 'vex' } | null>(null);
  const [bpPage, setBpPage] = useState(0); // 10 tiers per page across 50 tiers
  const [missionFilter, setMissionFilter] = useState<'all' | 'daily' | 'weekly' | 'achievement'>('all');

  const filteredStore =
    storeFilter === 'all'
      ? STORE_ITEMS
      : storeFilter === 'daily_deals'
      ? STORE_ITEMS.filter((i) => i.isDailyDeal)
      : storeFilter === 'history'
      ? []
      : STORE_ITEMS.filter((i) => i.category === storeFilter);

  const bpPageTiers = BATTLE_PASS_TIERS.slice(bpPage * 10, bpPage * 10 + 10);
  const filteredMissions =
    missionFilter === 'all'
      ? profile.missions
      : profile.missions.filter((m) => m.category === missionFilter);

  return (
    <div className="fixed inset-0 z-40 bg-[#0A0D0A]/92 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#121712] border border-[#C6A65A]/30 flex flex-col max-h-[90vh]">
        {/* Header & Primary Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#C6A65A]/20 bg-[#161D15]">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'store', label: 'Store', icon: <ShoppingBag className="w-4 h-4" /> },
                { id: 'battlepass', label: '50-Tier Pass', icon: <Crown className="w-4 h-4" /> },
                { id: 'missions', label: 'Missions', icon: <Award className="w-4 h-4" /> },
                { id: 'events', label: 'Live Events', icon: <Calendar className="w-4 h-4" /> },
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

          <div className="flex items-center gap-4">
            <div className="text-xs font-mono-num">
              <span className="text-[#C6A65A]">V-COINS </span>
              <span className="text-white font-bold">{profile.gold.toLocaleString()}</span>
              <span className="text-white/25 mx-2">/</span>
              <span className="text-[#38BDF8]">V-CREDITS </span>
              <span className="text-white font-bold">{profile.vexCoins.toLocaleString()}</span>
            </div>
            <button onClick={onClose} className="p-2 bg-[#1D251B] hover:bg-[#B83232] text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* STORE TAB */}
          {tab === 'store' && (
            <div>
              <div className="mb-3 bg-[#182017] border border-[#C6A65A]/25 px-3.5 py-2 text-[11px] text-[#CBD5E1] flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong className="text-[#C6A65A]">Direct-Purchase Cosmetics Only:</strong> No loot-box gambling · No pay-to-win stats.
                </span>
                <span className="font-mono-num text-[#94A3B8]">
                  Prototype Mode: Simulated local currencies (no real money)
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['all', 'Featured'],
                      ['daily_deals', 'Daily Deals'],
                      ['weapon_skin', 'Weapon Skins'],
                      ['outfit', 'Outfits'],
                      ['bundle', 'Bundles'],
                      ['vehicle_skin', 'Vehicles'],
                      ['parachute', 'Parachutes'],
                      ['emote', 'Emotes'],
                      ['history', 'Transactions'],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => setStoreFilter(val)}
                      className={`px-3 py-1.5 text-xs font-medium border cursor-pointer ${
                        storeFilter === val
                          ? 'bg-[#333F2B] border-[#C6A65A] text-[#C6A65A]'
                          : 'bg-[#182017] border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[#94A3B8] inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#C6A65A]" />
                  <span>Daily rotation resets in 08:42:15 · Cosmetic fairness guaranteed</span>
                </span>
              </div>

              {storeFilter === 'history' ? (
                <div className="space-y-2">
                  {(profile.transactions || []).length === 0 ? (
                    <div className="text-xs text-[#94A3B8] p-6 text-center bg-[#182017] border border-white/10">
                      No store purchases recorded yet.
                    </div>
                  ) : (
                    (profile.transactions || []).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between bg-[#182017] border border-white/10 px-4 py-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <History className="w-4 h-4 text-[#C6A65A]" />
                          <div>
                            <div className="font-display font-bold text-[#F2F2ED]">{tx.itemName}</div>
                            <div className="text-[11px] text-[#94A3B8]">{tx.dateLabel}</div>
                          </div>
                        </div>
                        <span className="font-mono-num font-bold text-[#C6A65A]">
                          -{tx.amount.toLocaleString()} {tx.currency}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStore.map((item) => {
                    const owned = profile.ownedStoreItems.includes(item.id);
                    const rarityColor = RARITY_COLORS[item.rarity];
                    return (
                      <div key={item.id} className="bg-[#182017] border border-white/12 flex flex-col">
                        <div
                          className="h-28 p-4 flex flex-col justify-between border-b border-white/10"
                          style={{
                            background: `linear-gradient(135deg, ${item.secondaryColor} 0%, ${item.accentColor}44 100%)`,
                          }}
                        >
                          <div className="flex justify-between text-[11px] font-mono-num uppercase">
                            <span className="text-[#F2F2ED]/85">
                              {item.category.replace('_', ' ')}
                              {item.discountPct ? ` · -${item.discountPct}%` : ''}
                            </span>
                            <span className="font-bold" style={{ color: rarityColor }}>
                              {item.rarity}
                            </span>
                          </div>
                          <div className="font-display font-bold text-base text-[#F2F2ED]">{item.name}</div>
                        </div>
                        <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                          <p className="text-xs text-[#94A3B8]">{item.description}</p>
                          {owned ? (
                            <div className="flex items-center justify-center gap-1.5 py-2 bg-[#22C55E]/15 border border-[#22C55E]/40 text-xs font-semibold text-[#22C55E]">
                              <Check className="w-3.5 h-3.5" /> OWNED IN INVENTORY
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                disabled={profile.gold < item.priceGold}
                                onClick={() => {
                                  audioEngine.playUiClick();
                                  setConfirmPurchase({ item, currency: 'gold' });
                                }}
                                className={`py-2 text-xs font-mono-num font-bold border cursor-pointer ${
                                  profile.gold >= item.priceGold
                                    ? 'bg-[#C6A65A]/15 hover:bg-[#C6A65A] border-[#C6A65A]/60 text-[#C6A65A] hover:text-[#101410]'
                                    : 'bg-[#0E120E] border-white/10 text-[#475569] cursor-not-allowed'
                                }`}
                              >
                                {item.priceGold.toLocaleString()} V-C
                              </button>
                              <button
                                disabled={profile.vexCoins < item.priceVex}
                                onClick={() => {
                                  audioEngine.playUiClick();
                                  setConfirmPurchase({ item, currency: 'vex' });
                                }}
                                className={`py-2 text-xs font-mono-num font-bold border cursor-pointer ${
                                  profile.vexCoins >= item.priceVex
                                    ? 'bg-[#38BDF8]/15 hover:bg-[#38BDF8] border-[#38BDF8]/60 text-[#38BDF8] hover:text-[#101410]'
                                    : 'bg-[#0E120E] border-white/10 text-[#475569] cursor-not-allowed'
                                }`}
                              >
                                {item.priceVex} V-CR
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Purchase Confirmation Modal */}
              {confirmPurchase && (
                <div className="fixed inset-0 z-50 bg-[#0A0D0A]/85 flex items-center justify-center p-4">
                  <div className="w-full max-w-md bg-[#161D15] border border-[#C6A65A]/50 p-5 space-y-4">
                    <div className="text-xs font-mono-num text-[#C6A65A] uppercase">Confirm Purchase</div>
                    <h3 className="font-display font-bold text-lg text-[#F2F2ED]">
                      {confirmPurchase.item.name}
                    </h3>
                    <p className="text-xs text-[#94A3B8]">{confirmPurchase.item.description}</p>
                    <div className="p-3 bg-[#101410] border border-white/10 flex items-center justify-between text-xs font-mono-num">
                      <span className="text-[#94A3B8]">TOTAL COST</span>
                      <span className="text-[#C6A65A] font-bold">
                        {confirmPurchase.currency === 'gold'
                          ? `${confirmPurchase.item.priceGold.toLocaleString()} V-Coins`
                          : `${confirmPurchase.item.priceVex.toLocaleString()} V-Credits`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setConfirmPurchase(null)}
                        className="py-2.5 bg-[#101410] border border-white/15 text-xs font-display font-bold text-[#CBD5E1] uppercase cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          audioEngine.playUiClick(true);
                          onBuyStoreItem(confirmPurchase.item, confirmPurchase.currency);
                          setConfirmPurchase(null);
                        }}
                        className="py-2.5 bg-[#C6A65A] hover:bg-[#D9B86C] text-xs font-display font-bold text-[#101410] uppercase cursor-pointer"
                      >
                        Confirm & Unlock
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 50-TIER BATTLE PASS */}
          {tab === 'battlepass' && (
            <div className="space-y-4">
              <div
                className="relative bg-[#182017] border border-[#C6A65A]/35 p-5 flex flex-wrap items-center justify-between gap-4 bg-cover bg-center overflow-hidden"
                style={{
                  backgroundImage: `linear-gradient(95deg, rgba(16,20,16,0.94) 0%, rgba(16,20,16,0.78) 55%, rgba(16,20,16,0.9) 100%), url('/assets/aistudio/08_Battle_Pass_and_Rewards_92ae3d0e.png')`,
                }}
              >
                <div>
                  <div className="text-[11px] font-mono-num text-[#C6A65A] uppercase">
                    SEASON 1 · OPERATION LEGACY · 50 REWARD TIERS (SIMULATED LOCAL PROGRESSION)
                  </div>
                  <h3 className="font-display font-bold text-2xl text-[#F2F2ED] mt-0.5">
                    Pass Tier {profile.battlePassLevel} / 50
                  </h3>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-48 h-2 bg-[#0A0D0A] overflow-hidden">
                      <div
                        className="h-full bg-[#C6A65A]"
                        style={{ width: `${Math.min(100, (profile.battlePassXp / 500) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono-num text-[#CBD5E1]">{profile.battlePassXp} / 500 BP XP</span>
                  </div>
                </div>
                {profile.battlePassPremium ? (
                  <div className="px-4 py-2 bg-[#333F2B] border border-[#C6A65A] text-xs font-display font-bold text-[#C6A65A] uppercase">
                    Elite Premium Pass Active
                  </div>
                ) : (
                  <button
                    disabled={profile.vexCoins < 300}
                    onClick={() => {
                      audioEngine.playUiClick(true);
                      onUnlockPremiumBp();
                    }}
                    className={`px-5 py-2.5 text-xs font-display font-bold uppercase border cursor-pointer ${
                      profile.vexCoins >= 300
                        ? 'bg-[#C6A65A] hover:bg-[#D9B86C] border-[#F2F2ED]/40 text-[#101410]'
                        : 'bg-[#101410] border-white/10 text-[#64748B] cursor-not-allowed'
                    }`}
                  >
                    Upgrade Elite Pass (300 V-Credits)
                  </button>
                )}
              </div>

              {/* 5 Page Switcher for Tiers 1-50 */}
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 4].map((pg) => (
                  <button
                    key={pg}
                    onClick={() => setBpPage(pg)}
                    className={`px-3 py-1.5 text-xs font-mono-num font-bold border cursor-pointer ${
                      bpPage === pg
                        ? 'bg-[#C6A65A] text-[#101410] border-[#E0C37C]'
                        : 'bg-[#182017] text-[#CBD5E1] border-white/10'
                    }`}
                  >
                    Tiers {pg * 10 + 1}–{pg * 10 + 10}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {bpPageTiers.map((t) => {
                  const unlocked = profile.battlePassLevel >= t.tier;
                  const freeClaimed = profile.claimedBpFree.includes(t.tier);
                  const premClaimed = profile.claimedBpPremium.includes(t.tier);
                  return (
                    <div
                      key={t.tier}
                      className={`p-3 border flex flex-col justify-between gap-2.5 ${
                        unlocked ? 'bg-[#182017] border-[#C6A65A]/40' : 'bg-[#101410] border-white/8 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono-num font-bold text-xs text-[#C6A65A]">TIER {t.tier}</span>
                        <span className="text-[10px] text-[#94A3B8]">{unlocked ? 'Unlocked' : 'Locked'}</span>
                      </div>

                      <div className="p-2 bg-[#101410] border border-white/10 space-y-1.5">
                        <div className="text-[10px] text-[#94A3B8] uppercase">Free Track</div>
                        <div className="text-xs font-semibold text-[#F2F2ED] truncate">{t.freeReward}</div>
                        <button
                          disabled={!unlocked || freeClaimed}
                          onClick={() => {
                            audioEngine.playUiClick(true);
                            onClaimBpReward(t.tier, 'free');
                          }}
                          className={`w-full py-1 text-[10px] font-display font-bold uppercase border cursor-pointer ${
                            freeClaimed
                              ? 'border-[#22C55E]/40 text-[#22C55E]'
                              : unlocked
                              ? 'bg-[#333F2B] hover:bg-[#495A3E] border-[#C6A65A]/40 text-white'
                              : 'border-white/5 text-[#64748B] cursor-not-allowed'
                          }`}
                        >
                          {freeClaimed ? 'Claimed' : 'Claim'}
                        </button>
                      </div>

                      <div className="p-2 bg-[#1B1810] border border-[#C6A65A]/30 space-y-1.5">
                        <div className="text-[10px] text-[#C6A65A] uppercase">Elite Track</div>
                        <div className="text-xs font-semibold text-[#F2F2ED] truncate">{t.premiumReward}</div>
                        <button
                          disabled={!unlocked || !profile.battlePassPremium || premClaimed}
                          onClick={() => {
                            audioEngine.playUiClick(true);
                            onClaimBpReward(t.tier, 'premium');
                          }}
                          className={`w-full py-1 text-[10px] font-display font-bold uppercase border cursor-pointer ${
                            premClaimed
                              ? 'border-[#22C55E]/40 text-[#22C55E]'
                              : unlocked && profile.battlePassPremium
                              ? 'bg-[#C6A65A] hover:bg-[#D9B86C] text-[#101410] border-[#F2F2ED]/30'
                              : 'border-white/5 text-[#64748B] cursor-not-allowed'
                          }`}
                        >
                          {premClaimed ? 'Claimed' : profile.battlePassPremium ? 'Claim' : 'Premium'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MISSIONS TAB */}
          {tab === 'missions' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'daily', 'weekly', 'achievement'] as const).map((mf) => (
                  <button
                    key={mf}
                    onClick={() => setMissionFilter(mf)}
                    className={`px-3 py-1.5 text-xs font-display font-bold uppercase border cursor-pointer ${
                      missionFilter === mf
                        ? 'bg-[#C6A65A] text-[#101410] border-[#E0C37C]'
                        : 'bg-[#182017] text-[#CBD5E1] border-white/10'
                    }`}
                  >
                    {mf}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredMissions.map((m) => {
                  const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                  const ready = m.progress >= m.target && !m.claimed;
                  return (
                    <div
                      key={m.id}
                      className="bg-[#182017] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] uppercase">
                          <span className="text-[#C6A65A] font-semibold">{m.category}</span>
                          <span>·</span>
                          <span>
                            Reward: {m.rewardGold} V-Coins + {m.rewardBpXp} BP XP
                          </span>
                        </div>
                        <div className="font-display font-bold text-sm text-[#F2F2ED] mt-0.5">{m.title}</div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1 max-w-xs h-1.5 bg-[#0A0D0A] overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: m.claimed ? '#22C55E' : ready ? '#C6A65A' : '#B83232',
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono-num text-[#CBD5E1]">
                            {Math.min(m.progress, m.target)} / {m.target}
                          </span>
                        </div>
                      </div>
                      <button
                        disabled={!ready}
                        onClick={() => {
                          audioEngine.playUiClick(true);
                          onClaimMission(m.id);
                        }}
                        className={`px-4 py-2 text-xs font-display font-bold border cursor-pointer whitespace-nowrap uppercase ${
                          m.claimed
                            ? 'border-[#22C55E]/40 text-[#22C55E]'
                            : ready
                            ? 'bg-[#C6A65A] hover:bg-[#D9B86C] border-[#F2F2ED]/40 text-[#101410]'
                            : 'bg-[#101410] border-white/10 text-[#64748B] cursor-not-allowed'
                        }`}
                      >
                        {m.claimed ? 'Claimed' : ready ? 'Claim Reward' : 'In Progress'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LIVE EVENTS & SEASONS TAB */}
          {tab === 'events' && (
            <div className="space-y-5">
              {/* 7-Day Daily Login Supply Drop */}
              <div className="bg-[#182017] border border-[#C6A65A]/40 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-mono-num text-[#C6A65A]">7-DAY DEPLOYMENT LOGIN</div>
                  <h3 className="font-display font-bold text-xl text-[#F2F2ED]">
                    Day {profile.dailyRewardDay} Supply Drop
                  </h3>
                  <div className="flex gap-1.5 text-center font-mono-num text-xs">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <div
                        key={d}
                        className={`w-9 py-1.5 border ${
                          d < profile.dailyRewardDay
                            ? 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]'
                            : d === profile.dailyRewardDay
                            ? 'bg-[#333F2B] border-[#C6A65A] text-[#C6A65A] font-bold'
                            : 'bg-[#101410] border-white/10 text-[#64748B]'
                        }`}
                      >
                        D{d}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  disabled={profile.dailyRewardClaimedToday}
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onClaimDailyReward();
                  }}
                  className={`px-6 py-3 text-xs font-display font-bold border uppercase cursor-pointer whitespace-nowrap ${
                    profile.dailyRewardClaimedToday
                      ? 'border-[#22C55E]/40 text-[#22C55E] cursor-not-allowed'
                      : 'bg-[#C6A65A] hover:bg-[#D9B86C] border-[#F2F2ED]/30 text-[#101410]'
                  }`}
                >
                  {profile.dailyRewardClaimedToday ? 'Today Claimed (+800 V-Coins)' : 'Claim Day Drop (+800 V-Coins)'}
                </button>
              </div>

              {/* Active Seasonal & Festival Events */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {LIVE_EVENTS.map((ev) => (
                  <div key={ev.id} className="bg-[#182017] border border-white/12 flex flex-col overflow-hidden">
                    <div className="relative h-36 bg-[#101410]">
                      <img
                        src={ev.banner}
                        alt={ev.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#182017] via-transparent to-[#101410]/60" />
                      <div className="absolute top-2.5 left-3 right-3 flex justify-between text-[10px] font-mono-num">
                        <span className="text-[#C6A65A] uppercase">{ev.category}</span>
                        <span className="text-[#F2F2ED]">Ends {ev.endsIn}</span>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <h4 className="font-display font-bold text-base text-[#F2F2ED]">{ev.title}</h4>
                        <p className="text-xs text-[#94A3B8] mt-1">{ev.description}</p>
                        <div className="text-[11px] font-mono-num text-[#C6A65A] mt-2">
                          Reward: {ev.reward}
                        </div>
                      </div>
                      {onLaunchEventMode && (
                        <button
                          type="button"
                          onClick={() => {
                            audioEngine.playUiClick(true);
                            onLaunchEventMode(ev.mode, ev.mapId);
                          }}
                          className="w-full py-2 bg-[#333F2B] hover:bg-[#C6A65A] hover:text-[#101410] border border-[#C6A65A]/45 text-xs font-display font-bold text-[#F2F2ED] uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Deploy Event Mode</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
