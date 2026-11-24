import React, { useState } from 'react';
import {
  Award,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Target,
} from 'lucide-react';
import { audioEngine } from '../game/audio';
import { MissionDef } from '../game/types';

interface DailyMissionsSidebarProps {
  missions: MissionDef[];
  onClaimMission: (missionId: string) => void;
  onOpenAllMissions: () => void;
}

export const DailyMissionsSidebar: React.FC<DailyMissionsSidebarProps> = ({
  missions,
  onClaimMission,
  onOpenAllMissions,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const dailyMissions = (missions ?? []).filter((m) => m.category === 'daily');
  const completedCount = dailyMissions.filter((m) => m.progress >= m.target).length;
  const readyToClaimCount = dailyMissions.filter(
    (m) => m.progress >= m.target && !m.claimed
  ).length;
  const otherUnclaimedCount = (missions ?? []).filter(
    (m) => m.category !== 'daily' && m.progress >= m.target && !m.claimed
  ).length;

  const overallPct =
    dailyMissions.length > 0
      ? Math.round(
          (dailyMissions.reduce(
            (sum, m) => sum + Math.min(1, m.progress / Math.max(1, m.target)),
            0
          ) /
            dailyMissions.length) *
            100
        )
      : 0;

  return (
    <aside
      aria-label="Active Daily Missions"
      className={`pointer-events-auto bg-[#0F1218]/90 border border-[#C8D0DC]/15 clip-tactical-sm transition-all duration-200 ${
        isOpen ? 'w-64' : 'w-56 md:w-64'
      }`}
    >
      {/* Collapsible Header Bar */}
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="active-daily-missions-list"
        onClick={() => {
          audioEngine.playUiClick();
          setIsOpen((prev) => !prev);
        }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
        title={isOpen ? 'Collapse Active Daily Missions' : 'Expand Active Daily Missions'}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Target className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
          <span className="font-display font-bold text-xs tracking-wider text-white uppercase truncate">
            Active Daily Missions
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {readyToClaimCount > 0 && (
            <span
              className="px-1.5 py-0.5 bg-[#DC2626] text-white font-mono-num text-[10px] font-bold leading-none"
              title={`${readyToClaimCount} reward${readyToClaimCount > 1 ? 's' : ''} ready to claim`}
            >
              {readyToClaimCount}
            </span>
          )}
          <span className="font-mono-num text-[11px] text-[#94A3B8]">
            {completedCount}/{dailyMissions.length}
          </span>
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
          )}
        </div>
      </button>

      {/* Overall Daily Completion Progress Hairline */}
      <div className="h-[2px] w-full bg-[#1C212A] overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${overallPct}%`,
            backgroundColor:
              readyToClaimCount > 0
                ? '#F59E0B'
                : completedCount === dailyMissions.length && dailyMissions.length > 0
                ? '#10B981'
                : '#DC2626',
          }}
        />
      </div>

      {/* Collapsible Mission List Body */}
      <div
        id="active-daily-missions-list"
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-2.5 space-y-2 max-h-56 overflow-y-auto">
            {dailyMissions.length === 0 ? (
              <div className="text-[11px] text-[#94A3B8] py-2 text-center">
                No active daily missions assigned.
              </div>
            ) : (
              dailyMissions.map((mission) => {
                const clampedProgress = Math.min(mission.progress, mission.target);
                const pct = Math.min(
                  100,
                  Math.round((clampedProgress / Math.max(1, mission.target)) * 100)
                );
                const isReady = mission.progress >= mission.target && !mission.claimed;

                return (
                  <div
                    key={mission.id}
                    className={`p-2 border transition-colors ${
                      mission.claimed
                        ? 'bg-[#0C1110]/70 border-[#10B981]/25'
                        : isReady
                        ? 'bg-[#1D1514]/85 border-[#F59E0B]/50'
                        : 'bg-[#141821]/85 border-white/8'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-[11px] font-medium leading-snug ${
                          mission.claimed ? 'text-[#94A3B8] line-through' : 'text-[#E2E8F0]'
                        }`}
                      >
                        {mission.title}
                      </span>
                      <span className="font-mono-num text-[10px] text-[#CBD5E1] shrink-0">
                        {clampedProgress}/{mission.target}
                      </span>
                    </div>

                    {/* Mission Progress Track */}
                    <div className="mt-1.5 h-1.5 w-full bg-[#090C11] overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: mission.claimed
                            ? '#10B981'
                            : isReady
                            ? '#F59E0B'
                            : '#DC2626',
                        }}
                      />
                    </div>

                    {/* Rewards + Quick Claim Action */}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono-num">
                        <span className="text-[#F59E0B]">+{mission.rewardGold}G</span>
                        <span className="text-white/20">·</span>
                        <span className="text-[#38BDF8]">+{mission.rewardBpXp} BP</span>
                      </div>

                      {mission.claimed ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-display font-bold tracking-wider text-[#10B981] uppercase">
                          <Check className="w-3 h-3" />
                          Claimed
                        </span>
                      ) : isReady ? (
                        <button
                          type="button"
                          onClick={() => {
                            audioEngine.playUiClick(true);
                            onClaimMission(mission.id);
                          }}
                          className="px-2 py-0.5 bg-[#DC2626] hover:bg-[#EF4444] border border-[#F87171]/60 text-[10px] font-display font-bold tracking-wider text-white uppercase transition-colors cursor-pointer"
                        >
                          Claim
                        </button>
                      ) : (
                        <span className="font-mono-num text-[10px] text-[#64748B]">{pct}%</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer: Jump to Full Mission Hub */}
          <div className="px-2.5 py-2 border-t border-white/10 flex items-center justify-between bg-[#0B0E14]/70">
            <span className="text-[10px] font-mono-num text-[#64748B]">
              DAILY OPS · {overallPct}%
            </span>
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick();
                onOpenAllMissions();
              }}
              className="inline-flex items-center gap-1 text-[11px] font-display font-semibold tracking-wider text-[#CBD5E1] hover:text-white uppercase transition-colors cursor-pointer"
            >
              <Award className="w-3 h-3 text-[#F59E0B]" />
              <span>All Missions</span>
              {otherUnclaimedCount > 0 && (
                <span className="px-1 bg-[#DC2626] text-white font-mono-num text-[9px]">
                  +{otherUnclaimedCount}
                </span>
              )}
              <ChevronRight className="w-3 h-3 text-[#94A3B8]" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
