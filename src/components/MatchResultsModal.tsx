import React, { useState } from 'react';
import { Award, CheckCircle2, Crosshair, Film, Flag, RotateCcw, Shield, Trophy } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { getMapById, getRankInfo } from '../game/data';
import { MatchResultSummary, PlayerProfile } from '../game/types';

interface MatchResultsModalProps {
  result: MatchResultSummary;
  profile: PlayerProfile;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
  onWatchReplay?: () => void;
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
  onWatchReplay,
}) => {
  const [reported, setReported] = useState(false);
  const rank = getRankInfo(profile.rankPoints);
  const map = getMapById(result.mapId);

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0D0A]/94 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#121712] border border-[#C6A65A]/35 overflow-hidden">
        {/* Cinematic Top Banner with VARKON Victory Scene backdrop */}
        <div
          className="relative px-6 py-7 border-b border-[#C6A65A]/25 flex flex-wrap items-center justify-between gap-4 bg-cover bg-center"
          style={{
            backgroundImage: result.victory
              ? `linear-gradient(115deg, rgba(16,20,16,0.92) 0%, rgba(198,166,90,0.34) 55%, rgba(16,20,16,0.94) 100%), url('/assets/aistudio/01_Main_Poster_and_Characters_5d5d57fc.png')`
              : `linear-gradient(115deg, rgba(16,20,16,0.94) 0%, rgba(184,50,50,0.38) 55%, rgba(16,20,16,0.96) 100%), url('/assets/aistudio/09_scope_combat_view_1e739d3e.png')`,
          }}
        >
          <div>
            <div className="text-xs font-mono-num uppercase tracking-widest text-[#C6A65A]">
              {result.mode.toUpperCase()} · {map.name} · {result.sbmmTierLabel}
            </div>
            <h1
              className="font-display font-bold text-3xl sm:text-4xl tracking-wider uppercase mt-1"
              style={{ color: result.victory ? '#E0C37C' : '#EF4444' }}
            >
              {result.victory ? 'VARKON: LAST SURVIVOR' : 'ELIMINATED IN COMBAT'}
            </h1>
            <div className="text-xs text-[#CBD5E1] mt-1">
              {result.victory
                ? 'Battlefield secured against local AI bots. Prototype rewards saved to your local profile.'
                : 'Tactical extraction complete. Review match telemetry or redeploy.'}
            </div>
          </div>

          <div className="text-right bg-[#101410]/80 border border-[#C6A65A]/30 px-4 py-2.5">
            <div className="text-[10px] font-mono-num text-[#94A3B8] uppercase">Placement</div>
            <div className="font-mono-num font-bold text-3xl text-white">
              #{result.placement}
              <span className="text-base text-[#64748B]">/{result.totalPlayers}</span>
            </div>
          </div>
        </div>

        {/* Combat Telemetry Grid */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#182017] border border-white/10 p-3.5">
              <div className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#EF4444]" /> Eliminations
              </div>
              <div className="font-mono-num font-bold text-2xl text-white mt-1">{result.kills}</div>
            </div>
            <div className="bg-[#182017] border border-white/10 p-3.5">
              <div className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#38BDF8]" /> Damage Dealt
              </div>
              <div className="font-mono-num font-bold text-2xl text-white mt-1">{result.damageDealt}</div>
            </div>
            <div className="bg-[#182017] border border-white/10 p-3.5">
              <div className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#C6A65A]" /> Headshots
              </div>
              <div className="font-mono-num font-bold text-2xl text-white mt-1">{result.headshots}</div>
            </div>
            <div className="bg-[#182017] border border-white/10 p-3.5">
              <div className="text-xs text-[#94A3B8] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#22C55E]" /> Survival Time
              </div>
              <div className="font-mono-num font-bold text-2xl text-white mt-1">
                {formatDuration(result.survivalTime)}
              </div>
            </div>
          </div>

          {/* Rank Progression, SBMM & Rewards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#182017] border border-[#C6A65A]/25 p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-display font-bold text-white uppercase">
                  Rank & SBMM Rating
                </span>
                <div className="flex items-center gap-2 font-mono-num font-bold">
                  <span className={result.rpDelta >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                    {result.rpDelta >= 0 ? `+${result.rpDelta}` : result.rpDelta} RP
                  </span>
                  <span className="text-white/20">|</span>
                  <span className={result.mmrDelta >= 0 ? 'text-[#38BDF8]' : 'text-[#F59E0B]'}>
                    {result.mmrDelta >= 0 ? `+${result.mmrDelta}` : result.mmrDelta} MMR
                  </span>
                </div>
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-display font-bold text-lg" style={{ color: rank.current.color }}>
                  {rank.current.name}
                </span>
                <span className="font-mono-num text-sm text-white">
                  {profile.rankPoints} RP · {profile.mmr} MMR
                </span>
              </div>
              <div className="h-2 bg-[#0A0D0A] overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${Math.round(rank.progress * 100)}%`, backgroundColor: rank.current.color }}
                />
              </div>
            </div>

            <div className="bg-[#182017] border border-white/10 p-4 flex flex-col justify-between">
              <div className="font-display font-bold text-xs text-white uppercase mb-2">
                Prototype Match Rewards (Local Save)
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#101410] border border-[#C6A65A]/25 py-2">
                  <div className="text-[10px] text-[#94A3B8]">V-COINS</div>
                  <div className="font-mono-num font-bold text-sm text-[#C6A65A]">+{result.goldEarned}</div>
                </div>
                <div className="bg-[#101410] border border-white/10 py-2">
                  <div className="text-[10px] text-[#94A3B8]">CAREER XP</div>
                  <div className="font-mono-num font-bold text-sm text-[#38BDF8]">+{result.xpEarned}</div>
                </div>
                <div className="bg-[#101410] border border-white/10 py-2">
                  <div className="text-[10px] text-[#94A3B8]">PASS XP</div>
                  <div className="font-mono-num font-bold text-sm text-[#22C55E]">+{result.bpXpEarned}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              {onWatchReplay && (
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick();
                    onWatchReplay();
                  }}
                  className="px-4 py-2.5 bg-[#182017] hover:bg-[#232D21] border border-[#C6A65A]/30 text-xs font-display font-bold text-[#C6A65A] uppercase flex items-center gap-1.5 cursor-pointer"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Replay & Kill Cam</span>
                </button>
              )}
              <button
                type="button"
                disabled={reported}
                onClick={() => {
                  audioEngine.playUiClick();
                  setReported(true);
                }}
                className="px-3.5 py-2.5 bg-[#182017] hover:bg-[#7F1D1D]/50 border border-white/10 text-xs font-display font-bold text-[#94A3B8] hover:text-white uppercase flex items-center gap-1.5 cursor-pointer"
              >
                {reported ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span className="text-[#86EFAC]">Match Flagged</span>
                  </>
                ) : (
                  <>
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report Issue</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  audioEngine.playUiClick();
                  onReturnLobby();
                }}
                className="px-5 py-3 bg-[#1A2218] hover:bg-[#242F22] border border-white/15 text-xs font-display font-bold tracking-wider text-white uppercase cursor-pointer"
              >
                Return to Lobby
              </button>
              <button
                onClick={() => {
                  audioEngine.playUiClick(true);
                  onPlayAgain();
                }}
                className="px-7 py-3 bg-[#C6A65A] hover:bg-[#D9B86C] border border-[#F2F2ED]/40 text-xs font-display font-bold tracking-wider text-[#101410] uppercase flex items-center gap-2 cursor-pointer clip-tactical-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Deploy Again</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
