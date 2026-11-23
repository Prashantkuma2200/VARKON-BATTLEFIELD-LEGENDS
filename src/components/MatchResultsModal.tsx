import React from 'react';
import { Award, Crosshair, RotateCcw, Shield, Trophy } from 'lucide-react';
import { getMapById, getRankInfo } from '../game/data';
import { MatchResultSummary, PlayerProfile } from '../game/types';

interface MatchResultsModalProps {
  result: MatchResultSummary;
  profile: PlayerProfile;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export const MatchResultsModal: React.FC<MatchResultsModalProps> = ({
  result,
  profile,
  onPlayAgain,
  onReturnLobby,
}) => {
  const rank = getRankInfo(profile.rankPoints);
  const map = getMapById(result.mapId);

  return (
    <div className="fixed inset-0 z-50 bg-[#090A0D]/92 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#0F1218] border border-white/15 overflow-hidden">
        {/* Cinematic Top Banner */}
        <div
          className="px-6 py-7 border-b border-white/10 flex flex-wrap items-center justify-between gap-4"
          style={{
            background: result.victory
              ? 'linear-gradient(120deg, rgba(245,158,11,0.28) 0%, rgba(15,18,24,0.95) 65%)'
              : 'linear-gradient(120deg, rgba(220,38,38,0.28) 0%, rgba(15,18,24,0.95) 65%)',
          }}
        >
          <div>
            <div className="text-xs font-mono-num uppercase tracking-widest text-[#CBD5E1]">
              {result.mode.toUpperCase()} · {map.name}
            </div>
            <h1
              className="font-display font-bold text-3xl sm:text-4xl tracking-wider uppercase mt-1"
              style={{ color: result.victory ? '#FBBF24' : '#EF4444' }}
            >
              {result.victory ? 'VEXORA LAST SURVIVOR' : 'ELIMINATED IN COMBAT'}
            </h1>
          </div>

          <div className="text-right">
            <div className="text-xs text-[#94A3B8]">PLACEMENT</div>
            <div className="font-mono-num font-bold text-3xl text-white">
              #{result.placement}
              <span className="text-base text-[#64748B]">/{result.totalPlayers}</span>
            </div>
          </div>
        </div>

        {/* Combat Telemetry Grid */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#141821] border border-white/10 p-3.5">
              <div className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#EF4444]" /> Eliminations
              </div>
              <div className="font-mono-num font-bold text-2xl text-white mt-1">{result.kills}</div>
            </div>
            <div className="bg-[#141821] border border-white/10 p-3.5">
              <div className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#38BDF8]" /> Damage Dealt
              </div>
              <div className="font-mono-num font-bold text-2xl text-white mt-1">{result.damageDealt}</div>
            </div>
            <div className="bg-[#141821] border border-white/10 p-3.5">
              <div className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#F59E0B]" /> Headshots
              </div>
              <div className="font-mono-num font-bold text-2xl text-white mt-1">{result.headshots}</div>
            </div>
            <div className="bg-[#141821] border border-white/10 p-3.5">
              <div className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#10B981]" /> Survival Time
              </div>
              <div className="font-mono-num font-bold text-2xl text-white mt-1">
                {formatDuration(result.survivalTime)}
              </div>
            </div>
          </div>

          {/* Rank Progression & Rewards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#141821] border border-white/10 p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-display font-bold text-white uppercase">Rank Rating</span>
                <span
                  className={`font-mono-num font-bold ${
                    result.rpDelta >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                  }`}
                >
                  {result.rpDelta >= 0 ? `+${result.rpDelta}` : result.rpDelta} RP
                </span>
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-display font-bold text-lg" style={{ color: rank.current.color }}>
                  {rank.current.name}
                </span>
                <span className="font-mono-num text-sm text-white">{profile.rankPoints} RP</span>
              </div>
              <div className="h-2 bg-[#0A0D12] overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${Math.round(rank.progress * 100)}%`, backgroundColor: rank.current.color }}
                />
              </div>
            </div>

            <div className="bg-[#141821] border border-white/10 p-4 flex flex-col justify-between">
              <div className="font-display font-bold text-xs text-white uppercase mb-2">Match Rewards Earned</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#0D1016] border border-white/10 py-2">
                  <div className="text-[10px] text-[#94A3B8]">GOLD</div>
                  <div className="font-mono-num font-bold text-sm text-[#F59E0B]">+{result.goldEarned}</div>
                </div>
                <div className="bg-[#0D1016] border border-white/10 py-2">
                  <div className="text-[10px] text-[#94A3B8]">CAREER XP</div>
                  <div className="font-mono-num font-bold text-sm text-[#38BDF8]">+{result.xpEarned}</div>
                </div>
                <div className="bg-[#0D1016] border border-white/10 py-2">
                  <div className="text-[10px] text-[#94A3B8]">PASS XP</div>
                  <div className="font-mono-num font-bold text-sm text-[#EF4444]">+{result.bpXpEarned}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onReturnLobby}
              className="px-5 py-3 bg-[#1A1F29] hover:bg-[#262E3D] border border-white/15 text-xs font-display font-bold tracking-wider text-white uppercase cursor-pointer"
            >
              Return to Lobby
            </button>
            <button
              onClick={onPlayAgain}
              className="px-7 py-3 bg-[#DC2626] hover:bg-[#EF4444] border border-[#F87171]/60 text-xs font-display font-bold tracking-wider text-white uppercase flex items-center gap-2 cursor-pointer clip-tactical-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Deploy Again</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
