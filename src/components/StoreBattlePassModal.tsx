import React, { useState } from 'react';
import { Award, Calendar, Check, Crown, ShoppingBag, X } from 'lucide-react';
import { BATTLE_PASS_TIERS, STORE_ITEMS } from '../game/data';
import { PlayerProfile, StoreItemDef } from '../game/types';
import { audioEngine } from '../game/audio';

interface StoreBattlePassModalProps {
  initialTab: 'store' | 'battlepass' | 'missions' | 'events';
  profile: PlayerProfile;
  onBuyStoreItem: (item: StoreItemDef, currency: 'gold' | 'vex') => void;
  onUnlockPremiumBp: () => void;
  onClaimBpReward: (tier: number, track: 'free' | 'premium') => void;
  onClaimMission: (missionId: string) => void;
  onClaimDailyReward: () => void;
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
  onClose,
}) => {
  const [tab, setTab] = useState(initialTab);
  const [storeFilter, setStoreFilter] = useState<'all' | StoreItemDef['category']>('all');

  const filteredStore =
    storeFilter === 'all' ? STORE_ITEMS : STORE_ITEMS.filter((i) => i.category === storeFilter);

  return (
    <div className="fixed inset-0 z-40 bg-[#090A0D]/90 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#0F1218] border border-white/15 flex flex-col max-h-[90vh]">
        {/* Header & Primary Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'store', label: 'Store', icon: <ShoppingBag className="w-4 h-4" /> },
                { id: 'battlepass', label: 'Battle Pass', icon: <Crown className="w-4 h-4" /> },
                { id: 'missions', label: 'Missions', icon: <Award className="w-4 h-4" /> },
                { id: 'events', label: 'Events', icon: <Calendar className="w-4 h-4" /> },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  audioEngine.playUiClick();
                  setTab(t.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-display font-bold tracking-wider uppercase border transition-colors cursor-pointer ${
                  tab === t.id
                    ? 'bg-[#DC2626] border-[#EF4444] text-white'
                    : 'bg-[#151923] border-white/10 text-[#94A3B8] hover:text-white'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs font-mono-num">
              <span className="text-[#F59E0B]">GOLD </span>
              <span className="text-white font-bold">{profile.gold.toLocaleString()}</span>
              <span className="text-white/25 mx-2">/</span>
              <span className="text-[#38BDF8]">VEX </span>
              <span className="text-white font-bold">{profile.vexCoins.toLocaleString()}</span>
            </div>
            <button onClick={onClose} className="p-2 bg-[#1A1F29] hover:bg-[#DC2626] text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'store' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['all', 'All Items'],
                      ['weapon_skin', 'Weapon Skins'],
                      ['outfit', 'Outfits'],
                      ['bundle', 'Bundles'],
                      ['vehicle_skin', 'Vehicles'],
                      ['parachute', 'Parachutes'],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => setStoreFilter(val)}
                      className={`px-3 py-1.5 text-xs font-medium border cursor-pointer ${
                        storeFilter === val
                          ? 'bg-[#1D2533] border-[#38BDF8] text-[#38BDF8]'
                          : 'bg-[#141821] border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[#94A3B8]">Cosmetic items only · Fair competitive balance</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStore.map((item) => {
                  const owned = profile.ownedStoreItems.includes(item.id);
                  return (
                    <div key={item.id} className="bg-[#141821] border border-white/10 flex flex-col">
                      <div
                        className="h-28 p-4 flex flex-col justify-between border-b border-white/10"
                        style={{
                          background: `linear-gradient(135deg, ${item.secondaryColor} 0%, ${item.accentColor}44 100%)`,
                        }}
                      >
                        <div className="flex justify-between text-[11px] font-mono-num uppercase">
                          <span className="text-[#CBD5E1]">{item.category.replace('_', ' ')}</span>
                          <span
                            style={{
                              color:
                                item.rarity === 'legendary'
                                  ? '#F59E0B'
                                  : item.rarity === 'epic'
                                  ? '#EF4444'
                                  : '#38BDF8',
                            }}
                          >
                            {item.rarity}
                          </span>
                        </div>
                        <div className="font-display font-bold text-base text-white">{item.name}</div>
                      </div>
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                        <p className="text-xs text-[#94A3B8]">{item.description}</p>
                        {owned ? (
                          <div className="flex items-center justify-center gap-1.5 py-2 bg-[#10B981]/15 border border-[#10B981]/40 text-xs font-semibold text-[#10B981]">
                            <Check className="w-3.5 h-3.5" /> OWNED & AVAILABLE
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              disabled={profile.gold < item.priceGold}
                              onClick={() => {
                                audioEngine.playUiClick(true);
                                onBuyStoreItem(item, 'gold');
                              }}
                              className={`py-2 text-xs font-mono-num font-bold border cursor-pointer ${
                                profile.gold >= item.priceGold
                                  ? 'bg-[#F59E0B]/15 hover:bg-[#F59E0B] border-[#F59E0B]/60 text-[#F59E0B] hover:text-black'
                                  : 'bg-[#0D1016] border-white/10 text-[#475569] cursor-not-allowed'
                              }`}
                            >
                              {item.priceGold.toLocaleString()} GOLD
                            </button>
                            <button
                              disabled={profile.vexCoins < item.priceVex}
                              onClick={() => {
                                audioEngine.playUiClick(true);
                                onBuyStoreItem(item, 'vex');
                              }}
                              className={`py-2 text-xs font-mono-num font-bold border cursor-pointer ${
                                profile.vexCoins >= item.priceVex
                                  ? 'bg-[#38BDF8]/15 hover:bg-[#38BDF8] border-[#38BDF8]/60 text-[#38BDF8] hover:text-black'
                                  : 'bg-[#0D1016] border-white/10 text-[#475569] cursor-not-allowed'
                              }`}
                            >
                              {item.priceVex} VEX
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'battlepass' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[#141821] border border-white/12 p-4">
                <div>
                  <div className="text-xs font-mono-num text-[#EF4444]">SEASON 01 · OBSIDIAN VANGUARD</div>
                  <h3 className="font-display font-bold text-xl text-white">
                    Battle Pass Tier {profile.battlePassLevel}
                  </h3>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="w-48 h-2 bg-[#0A0D12] overflow-hidden">
                      <div
                        className="h-full bg-[#DC2626]"
                        style={{ width: `${Math.min(100, (profile.battlePassXp / 500) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono-num text-[#94A3B8]">{profile.battlePassXp} / 500 XP</span>
                  </div>
                </div>

                {!profile.battlePassPremium ? (
                  <button
                    disabled={profile.vexCoins < 300}
                    onClick={() => {
                      audioEngine.playUiClick(true);
                      onUnlockPremiumBp();
                    }}
                    className={`px-5 py-2.5 font-display font-bold text-sm border cursor-pointer ${
                      profile.vexCoins >= 300
                        ? 'bg-[#F59E0B] hover:bg-[#FBBF24] border-[#FDE68A] text-black'
                        : 'bg-[#1A1F29] border-white/10 text-[#64748B] cursor-not-allowed'
                    }`}
                  >
                    UNLOCK PREMIUM PASS (300 VEX)
                  </button>
                ) : (
                  <span className="text-xs font-display font-bold text-[#F59E0B] tracking-wider">
                    PREMIUM PASS ACTIVE
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {BATTLE_PASS_TIERS.map((t) => {
                  const unlocked = profile.battlePassLevel >= t.tier;
                  const freeClaimed = profile.claimedBpFree.includes(t.tier);
                  const premClaimed = profile.claimedBpPremium.includes(t.tier);
                  return (
                    <div key={t.tier} className="bg-[#141821] border border-white/10 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-display font-bold text-white">TIER 0{t.tier}</span>
                        <span className={unlocked ? 'text-[#10B981]' : 'text-[#64748B]'}>
                          {unlocked ? 'Unlocked' : 'Locked'}
                        </span>
                      </div>

                      <div className="bg-[#0D1016] border border-white/10 p-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-[#94A3B8]">FREE TRACK</div>
                          <div className="text-xs font-semibold text-white">{t.freeReward}</div>
                        </div>
                        <button
                          disabled={!unlocked || freeClaimed}
                          onClick={() => onClaimBpReward(t.tier, 'free')}
                          className={`px-2.5 py-1 text-[11px] font-semibold border cursor-pointer ${
                            freeClaimed
                              ? 'border-[#10B981]/40 text-[#10B981]'
                              : unlocked
                              ? 'bg-[#38BDF8] text-black border-[#38BDF8]'
                              : 'border-white/10 text-[#475569] cursor-not-allowed'
                          }`}
                        >
                          {freeClaimed ? 'Claimed' : 'Claim'}
                        </button>
                      </div>

                      <div className="bg-[#0D1016] border border-[#F59E0B]/30 p-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-[#F59E0B]">PREMIUM TRACK</div>
                          <div className="text-xs font-semibold text-white">{t.premiumReward}</div>
                        </div>
                        <button
                          disabled={!unlocked || !profile.battlePassPremium || premClaimed}
                          onClick={() => onClaimBpReward(t.tier, 'premium')}
                          className={`px-2.5 py-1 text-[11px] font-semibold border cursor-pointer ${
                            premClaimed
                              ? 'border-[#10B981]/40 text-[#10B981]'
                              : unlocked && profile.battlePassPremium
                              ? 'bg-[#F59E0B] text-black border-[#F59E0B]'
                              : 'border-white/10 text-[#475569] cursor-not-allowed'
                          }`}
                        >
                          {premClaimed ? 'Claimed' : 'Claim'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'missions' && (
            <div className="space-y-3">
              {profile.missions.map((m) => {
                const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                const ready = m.progress >= m.target && !m.claimed;
                return (
                  <div
                    key={m.id}
                    className="bg-[#141821] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] uppercase">
                        <span className="text-[#38BDF8] font-semibold">{m.category}</span>
                        <span>·</span>
                        <span>
                          Reward: {m.rewardGold} Gold + {m.rewardBpXp} BP XP
                        </span>
                      </div>
                      <div className="font-display font-bold text-sm text-white mt-0.5">{m.title}</div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 max-w-xs h-1.5 bg-[#0A0D12] overflow-hidden">
                          <div className="h-full bg-[#DC2626]" style={{ width: `${pct}%` }} />
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
                      className={`px-4 py-2 text-xs font-display font-bold border cursor-pointer whitespace-nowrap ${
                        m.claimed
                          ? 'border-[#10B981]/40 text-[#10B981]'
                          : ready
                          ? 'bg-[#DC2626] hover:bg-[#EF4444] border-[#F87171] text-white'
                          : 'bg-[#0D1016] border-white/10 text-[#64748B] cursor-not-allowed'
                      }`}
                    >
                      {m.claimed ? 'CLAIMED' : ready ? 'CLAIM REWARD' : 'IN PROGRESS'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'events' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#141821] border border-[#DC2626]/40 p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="text-xs font-mono-num text-[#EF4444]">7-DAY DEPLOYMENT LOGIN</div>
                  <h3 className="font-display font-bold text-xl text-white mt-1">
                    Day {profile.dailyRewardDay} Tactical Drop
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Log in daily to earn bonus Gold, VexCoins, and exclusive seasonal weapon finishes.
                  </p>
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-center font-mono-num text-xs">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <div
                      key={d}
                      className={`py-2 border ${
                        d < profile.dailyRewardDay
                          ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                          : d === profile.dailyRewardDay
                          ? 'bg-[#7F1D1D]/50 border-[#EF4444] text-white font-bold'
                          : 'bg-[#0D1016] border-white/10 text-[#64748B]'
                      }`}
                    >
                      D{d}
                    </div>
                  ))}
                </div>
                <button
                  disabled={profile.dailyRewardClaimedToday}
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onClaimDailyReward();
                  }}
                  className={`py-2.5 text-xs font-display font-bold border cursor-pointer ${
                    profile.dailyRewardClaimedToday
                      ? 'border-[#10B981]/40 text-[#10B981] cursor-not-allowed'
                      : 'bg-[#DC2626] hover:bg-[#EF4444] border-[#F87171] text-white'
                  }`}
                >
                  {profile.dailyRewardClaimedToday ? 'TODAY CLAIMED (+800 GOLD)' : 'CLAIM DAY REWARD (+800 GOLD)'}
                </button>
              </div>

              <div className="bg-[#141821] border border-white/12 p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="text-xs font-mono-num text-[#38BDF8]">LIMITED-TIME TOURNAMENT</div>
                  <h3 className="font-display font-bold text-xl text-white mt-1">
                    Vexora Apex Championship
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Queue Ranked Battle Royale or Sniper Ops to climb the regional leaderboard and earn double Rank Points.
                  </p>
                </div>
                <div className="bg-[#0D1016] border border-white/10 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Your Career Wins</span>
                    <span className="font-mono-num text-white font-bold">{profile.stats.wins}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Career Eliminations</span>
                    <span className="font-mono-num text-[#EF4444] font-bold">{profile.stats.kills}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94A3B8]">Total Combat Damage</span>
                    <span className="font-mono-num text-[#38BDF8] font-bold">
                      {profile.stats.damage.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
