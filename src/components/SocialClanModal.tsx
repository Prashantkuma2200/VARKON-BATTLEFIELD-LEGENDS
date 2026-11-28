import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  MessageSquare,
  Send,
  Shield,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import { FRIENDS_LIST, getRankInfo, REGIONAL_LEADERBOARD } from '../game/data';
import { PlayerProfile } from '../game/types';

interface SocialClanModalProps {
  profile: PlayerProfile;
  invitedFriends: string[];
  onInviteFriend: (friendId: string) => void;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  channel: 'squad' | 'clan' | 'global';
  sender: string;
  tag?: string;
  text: string;
  time: string;
  isSelf?: boolean;
}

const INITIAL_CHAT: ChatMessage[] = [
  {
    id: 'c1',
    channel: 'squad',
    sender: 'VEX_KIRA',
    tag: 'VK',
    text: 'Ready for Shadow Island Squad Ranked. Equip suppressors for late zone.',
    time: '2m ago',
  },
  {
    id: 'c2',
    channel: 'squad',
    sender: 'REAPER_99',
    tag: 'VK',
    text: 'On comms. Let us drop Airfield Hangar and grab the armored tactical truck.',
    time: '1m ago',
  },
  {
    id: 'c3',
    channel: 'clan',
    sender: 'COMMANDER_ZED',
    tag: 'VK',
    text: 'Clan War Window opens in 45m. Need 2 squads for Division 1 qualifiers.',
    time: '12m ago',
  },
  {
    id: 'c4',
    channel: 'global',
    sender: 'APEX_RAVEN',
    tag: 'SHDW',
    text: 'LF2 Diamond+ for Frostland Tactical Scrims. Mic required.',
    time: '4m ago',
  },
];

const QUICK_RADIO = [
  'Ready to Deploy!',
  'Drop Military Base',
  'Need 5.56mm Ammo',
  'Group Up — Moving to Zone',
  'Enemies Ahead!',
];

const CLAN_ROSTER = [
  { name: 'COMMANDER_ZED', role: 'Leader', status: 'Online', pts: 4820 },
  { name: 'VEX_KIRA', role: 'Officer', status: 'Online', pts: 3940 },
  { name: 'REAPER_99', role: 'Veteran', status: 'In Lobby', pts: 3410 },
  { name: 'NOVA_PRIME', role: 'Member', status: 'In Match', pts: 2890 },
];

export const SocialClanModal: React.FC<SocialClanModalProps> = ({
  profile,
  invitedFriends,
  onInviteFriend,
  onClose,
}) => {
  const [tab, setTab] = useState<'friends' | 'chat' | 'clan' | 'leaderboard'>('friends');
  const [friends, setFriends] = useState(FRIENDS_LIST);
  const [addInput, setAddInput] = useState('');

  // Chat state with basic anti-spam cooldown
  const [chatChannel, setChatChannel] = useState<'squad' | 'clan' | 'global'>('squad');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState('');
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const lastSentAt = useRef<number>(0);

  // Fair-Play Report dialog state
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>('Aimbot / Recoil Exploit');
  const [reportSubmitted, setReportSubmitted] = useState<string | null>(null);

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

  const sendChat = (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (now - lastSentAt.current < 1200) {
      setRateLimitNotice('Anti-Spam Shield: wait a moment before sending another message.');
      return;
    }
    lastSentAt.current = now;
    setRateLimitNotice(null);
    audioEngine.playUiClick();
    setMessages((prev) => [
      ...prev,
      {
        id: `m_${now}`,
        channel: chatChannel,
        sender: profile.name,
        tag: profile.clanTag,
        text: trimmed.slice(0, 180),
        time: 'Just now',
        isSelf: true,
      },
    ]);
    setChatInput('');
  };

  const submitReport = () => {
    if (!reportTarget) return;
    audioEngine.playUiClick(true);
    setReportSubmitted(`Fair-Play Ticket logged against ${reportTarget} (${reportReason}). VARKON Shield is reviewing telemetry.`);
    setReportTarget(null);
  };

  const rank = getRankInfo(profile.rankPoints);
  const visibleMessages = messages.filter((m) => m.channel === chatChannel);

  return (
    <div className="fixed inset-0 z-40 bg-[#0A0D0A]/92 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#121712] border border-[#C6A65A]/30 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-[#C6A65A]/20 bg-[#161D15]">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'friends', label: 'Squad & Friends', icon: <Users className="w-4 h-4" /> },
                { id: 'chat', label: 'Tactical Comms', icon: <MessageSquare className="w-4 h-4" /> },
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
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-display font-bold uppercase border cursor-pointer transition-colors ${
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {reportSubmitted && (
            <div className="bg-[#142516] border border-[#22C55E]/40 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[#86EFAC]">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {reportSubmitted}
              </span>
              <button
                type="button"
                onClick={() => setReportSubmitted(null)}
                className="text-white/70 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* FRIENDS TAB */}
          {tab === 'friends' && (
            <div className="space-y-4">
              <form onSubmit={addFriend} className="flex gap-2">
                <input
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                  placeholder="Enter Operative Callsign or ID (e.g. VK-99102)"
                  className="flex-1 bg-[#182017] border border-white/15 px-3 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#C6A65A]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C6A65A] hover:bg-[#D9B86C] text-[#101410] font-display font-bold text-xs uppercase cursor-pointer"
                >
                  Add Operative
                </button>
              </form>

              <div className="space-y-2">
                {friends.map((f) => {
                  const invited = invitedFriends.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between bg-[#182017] border border-white/10 px-4 py-3"
                    >
                      <div>
                        <div className="font-display font-bold text-sm text-[#F2F2ED]">{f.name}</div>
                        <div className="text-[11px] text-[#94A3B8]">
                          {f.rank} ({f.rp} RP) · {f.operator} ·{' '}
                          <span className={f.status === 'Online' ? 'text-[#22C55E]' : 'text-[#C6A65A]'}>
                            {f.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            audioEngine.playUiClick();
                            onInviteFriend(f.id);
                          }}
                          className={`px-3 py-1.5 text-xs font-display font-bold uppercase border flex items-center gap-1.5 cursor-pointer ${
                            invited
                              ? 'bg-[#14301B] border-[#22C55E] text-[#86EFAC]'
                              : 'bg-[#222B20] border-[#C6A65A]/30 text-[#F2F2ED] hover:border-[#C6A65A]'
                          }`}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{invited ? 'In Squad' : 'Invite'}</span>
                        </button>
                        <button
                          type="button"
                          title="Report Player"
                          onClick={() => setReportTarget(f.name)}
                          className="p-1.5 bg-[#1D251B] hover:bg-[#7F1D1D] border border-white/10 text-[#94A3B8] hover:text-white cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LIVE TACTICAL COMMS TAB */}
          {tab === 'chat' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {(['squad', 'clan', 'global'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChatChannel(ch)}
                      className={`px-3 py-1.5 text-xs font-display font-bold uppercase border cursor-pointer ${
                        chatChannel === ch
                          ? 'bg-[#C6A65A] border-[#E0C37C] text-[#101410]'
                          : 'bg-[#182017] border-white/10 text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {ch} Channel
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-mono-num text-[#94A3B8]">
                  VARKON Comms Encryption · Active
                </span>
              </div>

              <div className="bg-[#0D110D] border border-white/10 p-3.5 h-64 overflow-y-auto space-y-2.5">
                {visibleMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2.5 border text-xs ${
                      msg.isSelf
                        ? 'bg-[#20281D] border-[#C6A65A]/35 ml-8'
                        : 'bg-[#161C15] border-white/10 mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-display font-bold text-[#C6A65A]">
                        {msg.tag ? `[${msg.tag}] ` : ''}
                        {msg.sender}
                      </span>
                      <span className="text-[#64748B] font-mono-num">{msg.time}</span>
                    </div>
                    <div className="text-[#ECEFE9]">{msg.text}</div>
                  </div>
                ))}
              </div>

              {/* Quick Tactical Radio */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_RADIO.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => sendChat(phrase)}
                    className="px-2.5 py-1 bg-[#182017] hover:bg-[#253023] border border-[#C6A65A]/25 text-[11px] text-[#CBD5E1] hover:text-white cursor-pointer"
                  >
                    {phrase}
                  </button>
                ))}
              </div>

              {rateLimitNotice && (
                <div className="text-xs text-[#F59E0B] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{rateLimitNotice}</span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat(chatInput);
                }}
                className="flex gap-2"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Message ${chatChannel.toUpperCase()} channel...`}
                  className="flex-1 bg-[#182017] border border-white/15 px-3 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#C6A65A]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C6A65A] hover:bg-[#D9B86C] text-[#101410] font-display font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {/* CLAN HQ TAB */}
          {tab === 'clan' && (
            <div className="space-y-4">
              <div className="bg-[#182017] border border-[#C6A65A]/30 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono-num text-[#C6A65A] uppercase">
                    CLAN TAG [{profile.clanTag}] · DIVISION 1
                  </div>
                  <h3 className="font-display font-bold text-2xl text-[#F2F2ED] mt-0.5">
                    {profile.clanName}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Clan Level 14 · 42/50 Active Operatives · Weekly Clan War Rank #12 Global
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-right">
                  <div className="bg-[#101510] border border-white/10 px-4 py-2.5">
                    <div className="text-[10px] text-[#94A3B8]">CLAN WAR PTS</div>
                    <div className="font-mono-num font-bold text-lg text-[#C6A65A]">48,920</div>
                  </div>
                  <div className="bg-[#101510] border border-white/10 px-4 py-2.5">
                    <div className="text-[10px] text-[#94A3B8]">WIN STREAK</div>
                    <div className="font-mono-num font-bold text-lg text-[#22C55E]">7 WINS</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#182017] border border-white/10 p-4 space-y-2.5">
                  <div className="text-xs font-display font-bold text-[#C6A65A] uppercase">
                    Active Clan Roster
                  </div>
                  {CLAN_ROSTER.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between bg-[#111611] border border-white/8 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-display font-bold text-white">{m.name}</span>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-[#232C20] text-[#C6A65A] uppercase">
                          {m.role}
                        </span>
                      </div>
                      <span className="font-mono-num text-[#94A3B8]">{m.pts} pts</span>
                    </div>
                  ))}
                </div>

                <div className="bg-[#182017] border border-white/10 p-4 space-y-3">
                  <div className="text-xs font-display font-bold text-[#C6A65A] uppercase">
                    Active Clan War Objectives
                  </div>
                  {[
                    { label: 'Squad Eliminations in Shadow Island', cur: 312, max: 400 },
                    { label: 'Ranked Top-3 Finishes', cur: 19, max: 25 },
                    { label: 'Supply Drops Captured', cur: 28, max: 30 },
                  ].map((obj) => (
                    <div key={obj.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#CBD5E1]">{obj.label}</span>
                        <span className="font-mono-num text-white">
                          {obj.cur}/{obj.max}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#0A0D0A]">
                        <div
                          className="h-full bg-[#C6A65A]"
                          style={{ width: `${Math.min(100, (obj.cur / obj.max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* REGIONAL LEADERBOARD TAB */}
          {tab === 'leaderboard' && (
            <div className="space-y-3">
              <div className="bg-[#182017] border border-[#C6A65A]/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[#CBD5E1]">
                  Your Standing: <strong className="text-white">{profile.name}</strong> ·{' '}
                  <strong style={{ color: rank.current.color }}>{rank.current.name}</strong>
                </span>
                <span className="font-mono-num text-[#C6A65A]">
                  {profile.rankPoints} RP · {profile.stats.wins} Wins · {profile.stats.kills} Kills
                </span>
              </div>

              <div className="border border-white/10 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161D15] text-[#94A3B8] font-display uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Operative</th>
                      <th className="py-2.5 px-3">Clan</th>
                      <th className="py-2.5 px-3">Tier</th>
                      <th className="py-2.5 px-3 text-right">RP</th>
                      <th className="py-2.5 px-3 text-right">K/D</th>
                      <th className="py-2.5 px-3 text-right">Wins</th>
                      <th className="py-2.5 px-3 text-right">Fair-Play</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[#111611]">
                    {REGIONAL_LEADERBOARD.map((row) => (
                      <tr key={row.rank} className="hover:bg-white/[0.03]">
                        <td className="py-2.5 px-3 font-mono-num font-bold text-[#C6A65A]">#{row.rank}</td>
                        <td className="py-2.5 px-3 font-display font-bold text-white">{row.name}</td>
                        <td className="py-2.5 px-3 font-mono-num text-[#94A3B8]">[{row.clan}]</td>
                        <td className="py-2.5 px-3 text-[#38BDF8]">{row.tier}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num text-white">{row.rp}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num text-[#CBD5E1]">{row.kd}</td>
                        <td className="py-2.5 px-3 text-right font-mono-num text-[#22C55E]">{row.wins}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setReportTarget(row.name)}
                            className="p-1 text-[#64748B] hover:text-[#EF4444] cursor-pointer"
                            title="Report Suspicious Activity"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fair-Play Anti-Cheat Report Dialog */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121712] border border-[#B83232]/60 p-5 space-y-4">
            <div className="flex items-center gap-2 text-[#EF4444]">
              <Flag className="w-4 h-4" />
              <h3 className="font-display font-bold text-sm uppercase">
                VARKON Fair-Play Anti-Cheat Report
              </h3>
            </div>
            <p className="text-xs text-[#CBD5E1]">
              Reporting operative <strong className="text-white">{reportTarget}</strong>. Server-side
              ballistic & movement telemetry will be audited automatically.
            </p>
            <div className="space-y-1.5">
              {[
                'Aimbot / Recoil Exploit',
                'Wallhack / Vision Cheat',
                'Speed or Movement Manipulation',
                'Teaming / Griefing / Toxicity',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setReportReason(reason)}
                  className={`w-full text-left px-3 py-2 text-xs border cursor-pointer ${
                    reportReason === reason
                      ? 'bg-[#B83232]/25 border-[#EF4444] text-white'
                      : 'bg-[#182017] border-white/10 text-[#94A3B8]'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="px-4 py-2 bg-[#1A2218] text-xs font-display font-bold text-[#CBD5E1] uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                className="px-4 py-2 bg-[#B83232] hover:bg-[#DC2626] text-xs font-display font-bold text-white uppercase cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
