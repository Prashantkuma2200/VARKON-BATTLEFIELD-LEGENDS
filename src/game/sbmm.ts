import { GameModeId, MatchResultSummary, PlayerProfile, ProgressionMilestone, SbmmAssessment } from './types';

export const XP_FOR_LEVEL = (level: number) => Math.round(1200 + (level - 1) * 260);

export const PROGRESSION_MILESTONES: ProgressionMilestone[] = [
  {
    id: 'ms_lvl_10',
    title: 'Field Operative · Level 10',
    description: 'Reach Career Level 10 across any Battle Royale or Arena mode.',
    category: 'level',
    metric: 'level',
    target: 10,
    rewardLabel: '1,200 Gold + Arctic Ghost Skin',
    rewardGold: 1200,
    rewardSkinId: 'skin_arctic_ghost',
    rewardTitle: 'FIELD OPERATIVE',
  },
  {
    id: 'ms_lvl_25',
    title: 'Vanguard Commander · Level 25',
    description: 'Reach Career Level 25 to unlock gold-trimmed military armor.',
    category: 'level',
    metric: 'level',
    target: 25,
    rewardLabel: '2,000 Gold + Olive Gold Armor Finish',
    rewardGold: 2000,
    rewardOutfitColor: '#3B4730',
    rewardTitle: 'VANGUARD COMMANDER',
  },
  {
    id: 'ms_lvl_35',
    title: 'Battlefield Legend · Level 35',
    description: 'Reach Career Level 35 and earn mythic Varkon credits.',
    category: 'level',
    metric: 'level',
    target: 35,
    rewardLabel: '350 Varkon Credits + Legend Title',
    rewardVex: 350,
    rewardTitle: 'BATTLEFIELD LEGEND',
  },
  {
    id: 'ms_kills_75',
    title: 'Sharpshooter Protocol · 75 Kills',
    description: 'Accumulate 75 total combat eliminations.',
    category: 'combat',
    metric: 'kills',
    target: 75,
    rewardLabel: '1,500 Gold + Cobalt Protocol Skin',
    rewardGold: 1500,
    rewardSkinId: 'skin_cobalt_protocol',
    rewardTitle: 'SHARPSHOOTER',
  },
  {
    id: 'ms_hs_25',
    title: 'Deadeye Precision · 25 Headshots',
    description: 'Land 25 lethal headshots across matches.',
    category: 'combat',
    metric: 'headshots',
    target: 25,
    rewardLabel: '1,800 Gold + 150 Credits',
    rewardGold: 1800,
    rewardVex: 150,
    rewardTitle: 'DEADEYE',
  },
  {
    id: 'ms_wins_5',
    title: 'Apex Survivor · 5 Victories',
    description: 'Secure #1 Last Survivor victory 5 times.',
    category: 'combat',
    metric: 'wins',
    target: 5,
    rewardLabel: 'Obsidian Sovereign Mythic Skin',
    rewardSkinId: 'skin_obsidian_gold',
    rewardTitle: 'LAST SURVIVOR',
  },
  {
    id: 'ms_dmg_20k',
    title: 'Heavy Ordnance · 20,000 Damage',
    description: 'Deal 20,000 cumulative ballistic and explosive damage.',
    category: 'combat',
    metric: 'damage',
    target: 20000,
    rewardLabel: '2,200 Gold + Crimson Spec Finish',
    rewardGold: 2200,
    rewardOutfitColor: '#63171B',
  },
  {
    id: 'ms_rank_diamond',
    title: 'Diamond Division · 3,300 RP',
    description: 'Climb Ranked Battle Royale to Diamond tier.',
    category: 'rank',
    metric: 'rankPoints',
    target: 3300,
    rewardLabel: '400 Credits + Diamond Commander Title',
    rewardVex: 400,
    rewardTitle: 'DIAMOND COMMANDER',
  },
];

export function getMilestoneCurrentValue(profile: PlayerProfile, m: ProgressionMilestone): number {
  switch (m.metric) {
    case 'level':
      return profile.level;
    case 'kills':
      return profile.stats.kills;
    case 'wins':
      return profile.stats.wins;
    case 'headshots':
      return profile.stats.headshots;
    case 'damage':
      return profile.stats.damage;
    case 'rankPoints':
      return profile.rankPoints;
  }
}

/**
 * Evaluates player combat telemetry (K/D, Win Rate, Avg Damage, Headshot %, Rank Points)
 * to calculate an authoritative SBMM Rating (MMR) and mode-specific matchmaking bracket.
 */
export function evaluateSbmm(profile: PlayerProfile, mode: GameModeId): SbmmAssessment {
  const matches = Math.max(1, profile.stats.matches);
  const deaths = Math.max(1, matches - profile.stats.wins);
  const kdRatio = Number((profile.stats.kills / deaths).toFixed(2));
  const winRatePct = Math.round((profile.stats.wins / matches) * 100);
  const avgDamage = Math.round(profile.stats.damage / matches);
  const headshotPct = profile.stats.kills > 0 ? Math.round((profile.stats.headshots / profile.stats.kills) * 100) : 0;

  // Composite performance MMR (baseline 1000 .. 3400)
  const performanceScore =
    950 +
    Math.min(750, kdRatio * 145) +
    Math.min(480, winRatePct * 11) +
    Math.min(460, avgDamage * 0.42) +
    Math.min(180, headshotPct * 4) +
    Math.min(580, profile.rankPoints * 0.14);

  const mmr = Math.round(profile.mmr * 0.45 + performanceScore * 0.55);

  let tierName: SbmmAssessment['tierName'] = 'Recruit';
  let tierColor = '#94A3B8';
  if (mmr >= 2750) {
    tierName = 'Apex Legend';
    tierColor = '#C5A45C';
  } else if (mmr >= 2300) {
    tierName = 'Elite';
    tierColor = '#B52B2B';
  } else if (mmr >= 1850) {
    tierName = 'Veteran';
    tierColor = '#EAB308';
  } else if (mmr >= 1400) {
    tierName = 'Tactical';
    tierColor = '#74A362';
  }

  // Mode-specific SBMM strictness
  let bracketRatio = 0.18;
  let strictnessLabel = 'Balanced SBMM (Casual)';
  let botSkillBase = 0.46 + ((mmr - 1000) / 2400) * 0.36;
  let botSkillSpread = 0.22;
  let estimatedQueueSec = 2;

  if (mode === 'ranked') {
    bracketRatio = 0.07;
    strictnessLabel = 'Strict SBMM (Competitive Ranked)';
    botSkillBase = Math.min(0.92, 0.56 + ((mmr - 1000) / 2200) * 0.36);
    botSkillSpread = 0.08;
    estimatedQueueSec = 3;
  } else if (mode === 'arena4v4' || mode === 'tdm' || mode === 'sniper') {
    bracketRatio = 0.12;
    strictnessLabel = 'Moderate SBMM (Tactical Arena)';
    botSkillBase = Math.min(0.86, 0.52 + ((mmr - 1000) / 2300) * 0.32);
    botSkillSpread = 0.14;
    estimatedQueueSec = 2;
  } else if (mode === 'training' || mode === 'custom') {
    bracketRatio = 0.45;
    strictnessLabel = 'Unranked / Custom Lobby (SBMM Off)';
    botSkillBase = 0.42;
    botSkillSpread = 0.25;
    estimatedQueueSec = 1;
  }

  const delta = Math.round(mmr * bracketRatio);
  return {
    mmr,
    tierName,
    tierColor,
    kdRatio,
    winRatePct,
    avgDamage,
    headshotPct,
    strictnessLabel,
    bracketMin: Math.max(600, mmr - delta),
    bracketMax: mmr + delta,
    botSkillMean: Math.max(0.32, Math.min(0.92, botSkillBase)),
    botSkillSpread,
    estimatedQueueSec,
  };
}

export function computePostMatchMmrDelta(result: Omit<MatchResultSummary, 'mmrDelta' | 'sbmmTierLabel'>, mode: GameModeId): number {
  if (mode === 'training' || mode === 'custom') return 0;
  const placementBonus = result.victory ? 36 : result.placement <= 5 ? 16 : result.placement <= 12 ? 4 : -14;
  const combatBonus = result.kills * 7 + Math.round(result.damageDealt / 180) + result.headshots * 3;
  const mult = mode === 'ranked' ? 1.25 : 0.75;
  return Math.round((placementBonus + combatBonus) * mult);
}
