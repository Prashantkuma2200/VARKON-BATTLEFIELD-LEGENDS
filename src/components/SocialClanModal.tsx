import React, { useState } from 'react';
import { Shield, Trophy, UserPlus, Users, X } from 'lucide-react';
import { FRIENDS_LIST, getRankInfo, REGIONAL_LEADERBOARD } from '../game/data';
import { PlayerProfile } from '../game/types';
import { audioEngine } from '../game/audio';

interface SocialClanModalProps {
  profile: PlayerProfile;
  invitedFriends: string[];
  onInviteFriend: (friendId: string) => void;
  onClose: () => void;
}

export const SocialClanModal: React.FC<SocialClanModalProps> = ({
  profile,
  invitedFriends,
  onInviteFriend,
  onClose,
}) => {
  const [tab, setTab] = useState<'friends' | 'clan' | 'leaderboard'>('friends');
  const [friends, setFriends] = useState(FRIENDS_LIST);
  const [addInput, setAddInput] = useState('');

  const addFriend = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = addInput.trim().toUpperCase();
    if (!cleaned) return;
    audioEngine.playUiClick(true);
    setFriends((prev) => [
      { id: `f_${Date.now()}`, name: cleaned, rank: 'Gold', rp: 1950, status: 'Online', operator: 'Viper-07' },
      ...prev,
    ]);
    setAddInput('');
  };

  const rank = getRankInfo(profile.rankPoints);

  return (
    <div className="fixed inset-0 z-40 bg-[#090A0D]/90 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#0F1218] border border-white/15 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'friends', label: 'Friends', icon: <Users className="w-4 h-4" /> },
                { id: 'clan', label: 'Clan HQ', icon: <Shield className="w-4 h-4" /> },
                { id: 'leaderboard', label: 'Rankings', icon: <Trophy className="w-4 h-4" /> },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  audioEngine.playUiClick();
                  setTab(t.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-display font-bold uppercase border cursor-pointer ${
                  tab === t.id
                    ? 'bg-[#DC2626] border-[#EF4444] text-white'
                    : 'bg-[#141821] border-white/10 text-[#94A3B8] hover:text-white'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <button onClick={onClose} className="p-2 bg-[#1A1F29] hover:bg-[#DC2626] text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'friends' && (
            <div className="space-y-4">
              <form onSubmit={addFriend} className="flex gap-2">
                <input
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                  placeholder="Enter Player Name or ID (e.g. VX-99102)"
                  className="flex-1 bg-[#141821] border border-white/15 px-3 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#38BDF8] text-[#090A0D] font-display font-bold text-xs cursor-pointer"
                >
                  ADD FRIEND
                </button>
              </form>

              <div className="space-y-2">
                {friends.map((f) => {
                  const invited = invitedFriends.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between bg-[#141821] border border-white/10 px-4 py-3"
                    >
                      <div>
                        <div className="font-display font-bold text-sm text-white">{f.name}</div>
                        <div className="text-xs text-[#94A3B8]">
                          {f.rank} · <span className="font-mono-num">{f.rp} RP</span> · {f.operator} ·{' '}
                          <span className={f.status === 'Online' ? 'text-[#10B981]' : 'text-[#94A3B8]'}>{f.status}</span>
                        </div>
                      </div>
                      <button
                        disabled={f.status !== 'Online'}
                        onClick={() => {
                          audioEngine.playUiClick(true);
                          onInviteFriend(f.id);
                        }}
                        className={`px-3 py-1.5 text-xs font-display font-bold border flex items-center gap-1.5 cursor-pointer ${
                          invited
                            ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#38BDF8]'
                            : f.status === 'Online'
                            ? 'bg-[#1D2430] hover:bg-[#DC2626] border-white/15 text-white'
                            : 'border-white/5 text-[#475569] cursor-not-allowed'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{invited ? 'IN SQUAD' : 'INVITE'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'clan' && (
            <div className="space-y-4">
              <div className="bg-[#141821] border border-white/12 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono-num text-[#EF4444]">CLAN TAG [{profile.clanTag}] · LEVEL 12</div>
                  <h3 className="font-display font-bold text-2xl text-white mt-0.5">{profile.clanName}</h3>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    28 / 40 Active Operators · Regional Clan Rank #14 · Season Activity 48,200 pts
                  </p>
                </div>
                <div className="text-right font-mono-num text-xs">
                  <div className="text-[#94A3B8]">YOUR CONTRIBUTION</div>
                  <div className="text-xl font-bold text-[#38BDF8]">3,420 PTS</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[#141821] border border-white/10 p-4">
                  <div className="text-xs font-display font-bold text-white uppercase mb-2">Weekly Clan Mission</div>
                  <div className="text-xs text-[#CBD5E1]">Accumulate 200 Squad Eliminations as a Clan</div>
                  <div className="mt-2 h-2 bg-[#0A0D12] overflow-hidden">
                    <div className="h-full bg-[#38BDF8]" style={{ width: '74%' }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] font-mono-num text-[#94A3B8]">
                    <span>148 / 200</span>
                    <span>Reward: 1,500 Gold</span>
                  </div>
                </div>

                <div className="bg-[#141821] border border-white/10 p-4">
                  <div className="text-xs font-display font-bold text-white uppercase mb-2">Clan Survival Bonus</div>
                  <div className="text-xs text-[#CBD5E1]">Play 15 Ranked Matches with Clanmates</div>
                  <div className="mt-2 h-2 bg-[#0A0D12] overflow-hidden">
                    <div className="h-full bg-[#DC2626]" style={{ width: '60%' }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] font-mono-num text-[#94A3B8]">
                    <span>9 / 15</span>
                    <span>Reward: Clan Banner</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'leaderboard' && (
            <div className="space-y-3">
              <div className="bg-[#141821] border border-white/10 p-3 flex items-center justify-between text-xs">
                <span className="text-[#94A3B8]">
                  Your Rank: <strong style={{ color: rank.current.color }}>{rank.current.name}</strong>
                </span>
                <span className="font-mono-num text-white font-bold">{profile.rankPoints} RP</span>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[#94A3B8]">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Operator</th>
                    <th className="py-2 px-3">Tier</th>
                    <th className="py-2 px-3 text-right">RP</th>
                    <th className="py-2 px-3 text-right">K/D</th>
                    <th className="py-2 px-3 text-right">Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {REGIONAL_LEADERBOARD.map((row) => {
                    const isSelf = row.name === profile.name;
                    return (
                      <tr
                        key={row.rank}
                        className={`border-b border-white/5 ${isSelf ? 'bg-[#7F1D1D]/30 text-white' : 'text-[#CBD5E1]'}`}
                      >
                        <td className="py-2.5 px-3 font-mono-num font-bold text-[#F59E0B]">{row.rank}</td>
                        <td className="py-2.5 px-3 font-display font-bold">
                          [{row.clan}] {row.name}
                        </td>
                        <td className="py-2.5 px-3">{row.tier}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num">
                          {isSelf ? profile.rankPoints : row.rp}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num">{row.kd.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num">
                          {isSelf ? profile.stats.wins : row.wins}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
