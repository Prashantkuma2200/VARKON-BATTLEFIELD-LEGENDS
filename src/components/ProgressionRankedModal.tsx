import React, { useState } from 'react';
import {
  Award,
  Check,
  Crosshair,
  Link2,
  LogOut,
  Medal,
  Shield,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import { ACHIEVEMENTS, getMapById, getRankInfo, RANK_TIERS } from '../game/data';
import { evaluateSbmm, getMilestoneCurrentValue, PROGRESSION_MILESTONES, XP_FOR_LEVEL } from '../game/sbmm';
import { GameModeId, PlayerProfile } from '../game/types';

interface ProgressionRankedModalProps {
  initialTab: 'profile' | 'progression' | 'ranked';
  profile: PlayerProfile;
  gameMode: GameModeId;
  onClaimMilestone: (milestoneId: string) => void;
  onClaimRankReward: (rankName: string) => void;
  onLinkAccount: (provider: 'email' | 'google' | 'apple', email?: string) => void;
  onUpdateGamerTag: (newTag: string) => void;
  onLogout: () => void;
  onClose: () => void;
}

export const ProgressionRankedModal: React.FC<ProgressionRankedModalProps> = ({
  initialTab,
  profile,
  gameMode,
  onClaimMilestone,
  onClaimRankReward,
  onLinkAccount,
  onUpdateGamerTag,
  onLogout,
  onClose,
}) => {
  const [tab, setTab] = useState<'profile' | 'progression' | 'ranked'>(initialTab);
  const [linkEmail, setLinkEmail] = useState(profile.email || '');
  const [editingTag, setEditingTag] = useState(profile.name);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  const rank = getRankInfo(profile.rankPoints);
  const sbmm = evaluateSbmm(profile, gameMode);
  const nextLevelXp = XP_FOR_LEVEL(profile.level);
  const levelPct = Math.min(100, Math.round((profile.xp / nextLevelXp) * 100));
  const linked = profile.linkedProviders || [profile.authProvider];

  return (
    <div className="fixed inset-0 z-40 bg-[#0A0D0A]/92 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#121712] border border-[#C6A65A]/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#C6A65A]/20 bg-[#161D15]">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'profile', label: 'Operative Profile', icon: <User className="w-4 h-4" /> },
                { id: 'progression', label: 'Career & Achievements', icon: <Award className="w-4 h-4" /> },
                { id: 'ranked', label: 'Ranks & SBMM', icon: <Trophy className="w-4 h-4" /> },
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* PROFILE & ACCOUNT LINKING */}
          {tab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Operative Summary */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-[#182017] border border-[#C6A65A]/25 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-mono-num text-[#C6A65A] uppercase">
                        {profile.equippedTitle} · {profile.playerId}
                      </div>
                      <h3 className="font-display font-bold text-2xl text-[#F2F2ED] mt-0.5">
                        {profile.name}{' '}
                        <span className="text-sm text-[#94A3B8] font-mono-num">[{profile.clanTag}]</span>
                      </h3>
                      <div className="text-xs text-[#94A3B8] mt-1">
                        Account Created: {profile.createdAt || '2026-11-01'} · Auth:{' '}
                        <span className="text-[#C6A65A] uppercase">{profile.authProvider}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-[#94A3B8] uppercase">Career Level</div>
                      <div className="font-mono-num font-bold text-3xl text-[#C6A65A]">
                        Lv.{profile.level}
                        <span className="text-xs text-[#94A3B8]"> / 100</span>
                      </div>
                    </div>
                  </div>

                  {/* Level XP Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] font-mono-num text-[#CBD5E1] mb-1">
                      <span>LEVEL PROGRESS</span>
                      <span>
                        {profile.xp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP ({levelPct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-[#0D110D] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#596747] to-[#C6A65A]"
                        style={{ width: `${levelPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Combat Telemetry KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
                    {[
                      { label: 'K/D Ratio', value: sbmm.kdRatio.toFixed(2), color: '#F2F2ED' },
                      { label: 'Win Rate', value: `${sbmm.winRatePct}%`, color: '#C6A65A' },
                      { label: 'Avg Damage', value: sbmm.avgDamage.toLocaleString(), color: '#38BDF8' },
                      { label: 'Headshot %', value: `${sbmm.headshotPct}%`, color: '#EF4444' },
                    ].map((k) => (
                      <div key={k.label} className="bg-[#101410] border border-white/10 p-3">
                        <div className="text-[11px] text-[#94A3B8]">{k.label}</div>
                        <div className="font-mono-num font-bold text-lg mt-0.5" style={{ color: k.color }}>
                          {k.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Matches */}
                <div className="bg-[#182017] border border-white/10 p-4">
                  <div className="font-display font-bold text-xs tracking-wider text-[#C6A65A] uppercase mb-3">
                    Recent Match History
                  </div>
                  <div className="space-y-2">
                    {profile.matchHistory.slice(0, 5).map((mh) => (
                      <div
                        key={mh.id}
                        className="flex flex-wrap items-center justify-between gap-2 bg-[#101410] border border-white/8 px-3 py-2 text-xs"
                      >
                        <div>
                          <span className="font-display font-bold text-white uppercase">
                            #{mh.placement} {mh.victory ? 'VICTORY' : 'COMBAT'}
                          </span>
                          <span className="text-[#94A3B8] ml-2">
                            {mh.mode.toUpperCase()} · {getMapById(mh.mapId).name} · {mh.dateLabel}
                          </span>
                        </div>
                        <div className="font-mono-num flex items-center gap-3">
                          <span className="text-[#F2F2ED]">{mh.kills} Kills</span>
                          <span className="text-[#38BDF8]">{mh.damage} DMG</span>
                          <span className={mh.rpDelta >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                            {mh.rpDelta >= 0 ? `+${mh.rpDelta}` : mh.rpDelta} RP
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Account Linking & Callsign Controls */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-[#182017] border border-[#C6A65A]/25 p-4 space-y-3">
                  <div className="flex items-center gap-2 font-display font-bold text-xs tracking-wider text-[#C6A65A] uppercase">
                    <Link2 className="w-4 h-4" />
                    <span>Account Linking & Cross-Device Sync</span>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    Upgrade a Guest account by linking Email, Google, or Apple. All V-Coins, skins, ranks, and Battle Pass tiers are preserved.
                  </p>

                  {linkMsg && (
                    <div className="p-2.5 bg-[#333F2B]/70 border border-[#C6A65A]/50 text-xs text-[#F2F2ED]">
                      {linkMsg}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={linkEmail}
                        onChange={(e) => setLinkEmail(e.target.value)}
                        placeholder="Link email address"
                        className="flex-1 bg-[#0E120E] border border-white/15 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#C6A65A]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(linkEmail.trim())) {
                            setLinkMsg('Enter a valid email address to link.');
                            return;
                          }
                          audioEngine.playUiClick(true);
                          onLinkAccount('email', linkEmail.trim());
                          setLinkMsg(`Email ${linkEmail.trim()} linked to ${profile.playerId}.`);
                        }}
                        className="px-3 py-2 bg-[#C6A65A] text-[#101410] font-display font-bold text-xs uppercase cursor-pointer"
                      >
                        {linked.includes('email') ? 'Linked' : 'Link'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(['google', 'apple'] as const).map((prov) => {
                        const isLinked = linked.includes(prov);
                        return (
                          <button
                            key={prov}
                            type="button"
                            disabled={isLinked}
                            onClick={() => {
                              audioEngine.playUiClick(true);
                              onLinkAccount(prov);
                              setLinkMsg(`${prov.toUpperCase()} account linked successfully.`);
                            }}
                            className={`py-2 text-xs font-display font-bold uppercase border cursor-pointer ${
                              isLinked
                                ? 'bg-[#333F2B]/60 border-[#22C55E]/50 text-[#22C55E] cursor-default'
                                : 'bg-[#101410] hover:bg-[#242E1F] border-white/15 text-[#F2F2ED]'
                            }`}
                          >
                            {isLinked ? `${prov} Linked` : `Link ${prov}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-[#182017] border border-white/10 p-4 space-y-3">
                  <div className="font-display font-bold text-xs tracking-wider text-[#F2F2ED] uppercase">
                    Update Callsign
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingTag}
                      onChange={(e) => setEditingTag(e.target.value)}
                      maxLength={18}
                      className="flex-1 bg-[#0E120E] border border-white/15 px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#C6A65A]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = editingTag.trim();
                        if (clean.length >= 3) {
                          audioEngine.playUiClick(true);
                          onUpdateGamerTag(clean);
                          setLinkMsg(`Gamer Tag updated to ${clean}.`);
                        }
                      }}
                      className="px-3 py-2 bg-[#333F2B] hover:bg-[#495A3E] border border-[#C6A65A]/40 text-xs font-display font-bold text-white uppercase cursor-pointer"
                    >
                      Save
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick();
                      onLogout();
                    }}
                    className="w-full py-2.5 bg-[#B83232]/20 hover:bg-[#B83232] border border-[#B83232]/60 text-xs font-display font-bold tracking-wider text-[#FCA5A5] hover:text-white uppercase flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Switch Account / Logout</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CAREER MILESTONES & ACHIEVEMENTS */}
          {tab === 'progression' && (
            <div className="space-y-6">
              {/* Achievements Grid */}
              <div>
                <div className="font-display font-bold text-xs tracking-wider text-[#C6A65A] uppercase mb-3">
                  Combat Achievements & Profile Badges
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ACHIEVEMENTS.map((ach) => {
                    const current =
                      ach.metric === 'level'
                        ? profile.level
                        : profile.stats[ach.metric];
                    const unlocked = current >= ach.target;
                    const pct = Math.min(100, Math.round((current / ach.target) * 100));
                    return (
                      <div
                        key={ach.id}
                        className={`p-3.5 border ${
                          unlocked
                            ? 'bg-[#1B2419] border-[#C6A65A]/50'
                            : 'bg-[#141914] border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Medal className="w-4 h-4 shrink-0" style={{ color: ach.badgeColor }} />
                            <span className="font-display font-bold text-sm text-[#F2F2ED]">
                              {ach.title}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-mono-num font-bold uppercase ${
                              unlocked ? 'text-[#22C55E]' : 'text-[#94A3B8]'
                            }`}
                          >
                            {unlocked ? 'UNLOCKED' : `${pct}%`}
                          </span>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-1">{ach.description}</p>
                        <div className="mt-2.5 h-1.5 bg-[#0A0D0A] overflow-hidden">
                          <div
                            className="h-full"
                            style={{ width: `${pct}%`, backgroundColor: ach.badgeColor }}
                          />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] font-mono-num text-[#CBD5E1]">
                          <span>
                            {Math.min(current, ach.target).toLocaleString()} / {ach.target.toLocaleString()}
                          </span>
                          <span className="text-[#C6A65A]">+{ach.rewardCoins} V-Coins</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Career Milestones */}
              <div>
                <div className="font-display font-bold text-xs tracking-wider text-[#C6A65A] uppercase mb-3">
                  Career Progression Milestones
                </div>
                <div className="space-y-2.5">
                  {PROGRESSION_MILESTONES.map((ms) => {
                    const current = getMilestoneCurrentValue(profile, ms);
                    const pct = Math.min(100, Math.round((current / ms.target) * 100));
                    const claimed = profile.claimedMilestoneIds.includes(ms.id);
                    const ready = current >= ms.target && !claimed;
                    return (
                      <div
                        key={ms.id}
                        className="bg-[#182017] border border-white/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex-1">
                          <div className="text-[11px] font-mono-num text-[#C6A65A] uppercase">
                            {ms.category} · Reward: {ms.rewardLabel}
                          </div>
                          <div className="font-display font-bold text-sm text-[#F2F2ED]">{ms.title}</div>
                          <div className="text-xs text-[#94A3B8]">{ms.description}</div>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="flex-1 max-w-xs h-1.5 bg-[#0A0D0A] overflow-hidden">
                              <div className="h-full bg-[#C6A65A]" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-mono-num text-[#CBD5E1]">
                              {Math.min(current, ms.target).toLocaleString()} / {ms.target.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <button
                          disabled={!ready}
                          onClick={() => {
                            audioEngine.playUiClick(true);
                            onClaimMilestone(ms.id);
                          }}
                          className={`px-4 py-2 text-xs font-display font-bold uppercase border cursor-pointer whitespace-nowrap ${
                            claimed
                              ? 'border-[#22C55E]/40 text-[#22C55E] cursor-default'
                              : ready
                              ? 'bg-[#C6A65A] hover:bg-[#D9B86C] border-[#F2F2ED]/40 text-[#101410]'
                              : 'bg-[#101410] border-white/10 text-[#64748B] cursor-not-allowed'
                          }`}
                        >
                          {claimed ? 'Claimed' : ready ? 'Claim Reward' : 'Locked'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* COMPETITIVE RANKING & SBMM TELEMETRY */}
          {tab === 'ranked' && (
            <div className="space-y-5">
              {/* SBMM Live Bracket Telemetry */}
              <div className="bg-[#182017] border border-[#C6A65A]/35 p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5">
                  <div className="text-[11px] font-mono-num text-[#C6A65A] uppercase">
                    Active Skill-Based Matchmaking (SBMM)
                  </div>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="font-display font-bold text-3xl" style={{ color: sbmm.tierColor }}>
                      {sbmm.tierName}
                    </span>
                    <span className="font-mono-num text-sm text-[#F2F2ED]">{sbmm.mmr} MMR</span>
                  </div>
                  <div className="text-xs text-[#94A3B8] mt-1">{sbmm.strictnessLabel}</div>
                </div>
                <div className="md:col-span-7 grid grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-[#101410] border border-white/10 p-3">
                    <div className="text-[#94A3B8]">Match Bracket</div>
                    <div className="font-mono-num font-bold text-[#F2F2ED] mt-0.5">
                      {sbmm.bracketMin} – {sbmm.bracketMax}
                    </div>
                  </div>
                  <div className="bg-[#101410] border border-white/10 p-3">
                    <div className="text-[#94A3B8]">Current Rank</div>
                    <div className="font-display font-bold mt-0.5" style={{ color: rank.current.color }}>
                      {rank.current.name} ({profile.rankPoints} RP)
                    </div>
                  </div>
                  <div className="bg-[#101410] border border-white/10 p-3">
                    <div className="text-[#94A3B8]">Opponent Skill</div>
                    <div className="font-mono-num font-bold text-[#C6A65A] mt-0.5">
                      {Math.round(sbmm.botSkillMean * 100)}% Calibration
                    </div>
                  </div>
                </div>
              </div>

              {/* 10 Military Competitive Ranks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display font-bold text-xs tracking-wider text-[#C6A65A] uppercase">
                    10 Competitive Military Ranks · Season 1
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    Rank points earned from Placement, Kills, Assists & Teamwork
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {RANK_TIERS.map((tier, idx) => {
                    const reached = profile.rankPoints >= tier.minRp;
                    const claimed = profile.claimedRankRewards.includes(tier.name);
                    const isCurrent = rank.current.name === tier.name;
                    return (
                      <div
                        key={tier.name}
                        className={`p-3 border flex flex-col justify-between gap-2 ${
                          isCurrent
                            ? 'bg-[#242E1F] border-[#C6A65A]'
                            : reached
                            ? 'bg-[#171E16] border-white/15'
                            : 'bg-[#101410] border-white/8 opacity-75'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono-num text-[#94A3B8]">
                            <span>TIER {idx + 1}</span>
                            <span>{tier.minRp}+ RP</span>
                          </div>
                          <div
                            className="font-display font-bold text-sm mt-1 flex items-center gap-1.5"
                            style={{ color: tier.color }}
                          >
                            <Shield className="w-3.5 h-3.5 shrink-0" />
                            <span>{tier.name}</span>
                          </div>
                          <div className="text-[11px] text-[#CBD5E1] mt-1">{tier.reward}</div>
                        </div>

                        <button
                          disabled={!reached || claimed}
                          onClick={() => {
                            audioEngine.playUiClick(true);
                            onClaimRankReward(tier.name);
                          }}
                          className={`w-full py-1.5 text-[11px] font-display font-bold uppercase border cursor-pointer ${
                            claimed
                              ? 'border-[#22C55E]/40 text-[#22C55E] cursor-default'
                              : reached
                              ? 'bg-[#C6A65A] hover:bg-[#D9B86C] text-[#101410] border-[#F2F2ED]/30'
                              : 'border-white/10 text-[#64748B] cursor-not-allowed'
                          }`}
                        >
                          {claimed ? (
                            <span className="inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Claimed
                            </span>
                          ) : reached ? (
                            'Claim Tier'
                          ) : (
                            'Locked'
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
