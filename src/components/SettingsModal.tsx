import React, { useRef, useState } from 'react';
import { Monitor, RotateCcw, Sliders, Smartphone, Volume2, X } from 'lucide-react';
import { DEFAULT_HUD_PRESETS, detectOptimalGraphics, GRAPHICS_PRESETS } from '../game/data';
import {
  AudioSettings,
  ControlSettings,
  GraphicsPresetId,
  GraphicsSettings,
  HudLayoutPreset,
  QualityLevel,
  TimeOfDay,
  WeatherType,
} from '../game/types';
import { audioEngine } from '../game/audio';

interface SettingsModalProps {
  graphics: GraphicsSettings;
  controls: ControlSettings;
  audio: AudioSettings;
  hudPresets: HudLayoutPreset[];
  activeHudPresetId: string;
  onChangeGraphics: (next: GraphicsSettings) => void;
  onChangeControls: (next: ControlSettings) => void;
  onChangeAudio: (next: AudioSettings) => void;
  onSaveHudPreset: (preset: HudLayoutPreset) => void;
  onSelectHudPreset: (presetId: string) => void;
  onResetHudPresets: () => void;
  onClose: () => void;
}

const QUALITIES: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];
const FPS_OPTIONS: Array<30 | 40 | 60 | 90 | 120> = [30, 40, 60, 90, 120];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  graphics,
  controls,
  audio,
  hudPresets,
  activeHudPresetId,
  onChangeGraphics,
  onChangeControls,
  onChangeAudio,
  onSaveHudPreset,
  onSelectHudPreset,
  onResetHudPresets,
  onClose,
}) => {
  const [tab, setTab] = useState<'graphics' | 'controls' | 'hud' | 'audio'>('graphics');
  const activePreset = hudPresets.find((p) => p.id === activeHudPresetId) || hudPresets[0];
  const [editingPreset, setEditingPreset] = useState<HudLayoutPreset>(activePreset);
  const [selectedHudBtn, setSelectedHudBtn] = useState<string>('fireRight');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragBtnRef = useRef<string | null>(null);

  const selectGraphicsPreset = (presetId: GraphicsPresetId) => {
    audioEngine.playUiClick();
    if (presetId === 'custom') {
      onChangeGraphics({ ...graphics, preset: 'custom' });
    } else {
      onChangeGraphics({
        ...GRAPHICS_PRESETS[presetId],
        weather: graphics.weather,
        timeOfDay: graphics.timeOfDay,
      });
    }
  };

  const patchGraphics = <K extends keyof GraphicsSettings>(key: K, val: GraphicsSettings[K]) => {
    const isPresetTrigger = key !== 'weather' && key !== 'timeOfDay';
    onChangeGraphics({
      ...graphics,
      [key]: val,
      preset: isPresetTrigger ? 'custom' : graphics.preset,
    });
  };

  const updateHudEl = (id: string, patch: Partial<{ x: number; y: number; scale: number; opacity: number }>) => {
    setEditingPreset((prev) => ({
      ...prev,
      elements: {
        ...prev.elements,
        [id]: { ...prev.elements[id], ...patch },
      },
    }));
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragBtnRef.current || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
    updateHudEl(dragBtnRef.current, { x: Math.round(x), y: Math.round(y) });
  };

  const selectedEl = editingPreset.elements[selectedHudBtn];

  return (
    <div className="fixed inset-0 z-50 bg-[#090A0D]/92 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#0F1218] border border-white/15 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'graphics', label: 'Graphics & Weather', icon: <Monitor className="w-4 h-4" /> },
                { id: 'controls', label: 'Controls & Sensitivity', icon: <Sliders className="w-4 h-4" /> },
                { id: 'hud', label: 'Custom HUD Editor', icon: <Smartphone className="w-4 h-4" /> },
                { id: 'audio', label: 'Audio', icon: <Volume2 className="w-4 h-4" /> },
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* GRAPHICS TAB */}
          {tab === 'graphics' && (
            <div className="space-y-5">
              {/* Presets Row */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-bold text-xs tracking-wider text-white uppercase">
                    Graphics Quality Preset
                  </span>
                  <button
                    onClick={() => {
                      audioEngine.playUiClick(true);
                      onChangeGraphics(detectOptimalGraphics());
                    }}
                    className="text-xs text-[#38BDF8] hover:underline cursor-pointer"
                  >
                    Auto-Detect Optimal for Device
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(['smooth', 'balanced', 'hd', 'ultra', 'extreme', 'custom'] as GraphicsPresetId[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => selectGraphicsPreset(p)}
                      className={`py-2.5 text-xs font-display font-bold uppercase border cursor-pointer ${
                        graphics.preset === p
                          ? 'bg-[#DC2626] border-[#EF4444] text-white'
                          : 'bg-[#141821] border-white/10 text-[#CBD5E1] hover:border-white/30'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Rate & Resolution Scaling */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#141821] border border-white/10 p-3.5">
                  <div className="text-xs font-semibold text-white mb-2">Target Frame Rate (FPS)</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FPS_OPTIONS.map((f) => (
                      <button
                        key={f}
                        onClick={() => patchGraphics('fpsCap', f)}
                        className={`py-1.5 text-xs font-mono-num font-bold border cursor-pointer ${
                          graphics.fpsCap === f
                            ? 'bg-[#38BDF8] text-black border-[#38BDF8]'
                            : 'bg-[#0D1016] border-white/10 text-[#CBD5E1]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#141821] border border-white/10 p-3.5">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-semibold text-white">Resolution Scaling</span>
                    <span className="font-mono-num text-[#38BDF8]">{Math.round(graphics.resolutionScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1.25}
                    step={0.05}
                    value={graphics.resolutionScale}
                    onChange={(e) => patchGraphics('resolutionScale', Number(e.target.value))}
                    className="w-full accent-[#DC2626]"
                  />
                </div>
              </div>

              {/* Granular Quality Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(
                  [
                    ['textureQuality', 'Texture Quality'],
                    ['shadowQuality', 'Shadow Quality'],
                    ['effectsQuality', 'Effects & Particles'],
                    ['viewDistance', 'View Distance'],
                    ['foliageQuality', 'Foliage & Trees'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="bg-[#141821] border border-white/10 p-3">
                    <div className="text-xs text-[#CBD5E1] mb-2">{label}</div>
                    <div className="grid grid-cols-4 gap-1">
                      {QUALITIES.map((q) => (
                        <button
                          key={q}
                          onClick={() => patchGraphics(key, q)}
                          className={`py-1 text-[11px] uppercase font-display font-semibold border cursor-pointer ${
                            graphics[key] === q
                              ? 'bg-[#7F1D1D] border-[#EF4444] text-white'
                              : 'bg-[#0D1016] border-white/10 text-[#94A3B8]'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Feature Toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {(
                  [
                    ['antiAliasing', 'Anti-Aliasing'],
                    ['dynamicShadows', 'Dynamic Shadows'],
                    ['hdr', 'HDR Color Grading'],
                    ['bloom', 'Bloom Lighting'],
                    ['ambientOcclusion', 'Ambient Occlusion'],
                    ['reflections', 'PBR Reflections'],
                    ['motionBlur', 'Motion Blur'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => patchGraphics(key, !graphics[key])}
                    className={`flex items-center justify-between px-3 py-2.5 border text-xs cursor-pointer ${
                      graphics[key]
                        ? 'bg-[#172330] border-[#38BDF8]/60 text-white'
                        : 'bg-[#141821] border-white/10 text-[#94A3B8]'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="font-mono-num font-bold text-[11px]">{graphics[key] ? 'ON' : 'OFF'}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic Weather & Time of Day */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#141821] border border-white/10 p-3.5">
                  <div className="text-xs font-semibold text-white mb-2">Dynamic Weather</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['clear', 'fog', 'rain', 'storm'] as WeatherType[]).map((w) => (
                      <button
                        key={w}
                        onClick={() => patchGraphics('weather', w)}
                        className={`py-1.5 text-xs uppercase font-display font-bold border cursor-pointer ${
                          graphics.weather === w
                            ? 'bg-[#38BDF8] text-black border-[#38BDF8]'
                            : 'bg-[#0D1016] border-white/10 text-[#CBD5E1]'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-[#141821] border border-white/10 p-3.5">
                  <div className="text-xs font-semibold text-white mb-2">Lighting / Time of Day</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['day', 'sunset', 'night'] as TimeOfDay[]).map((tod) => (
                      <button
                        key={tod}
                        onClick={() => patchGraphics('timeOfDay', tod)}
                        className={`py-1.5 text-xs uppercase font-display font-bold border cursor-pointer ${
                          graphics.timeOfDay === tod
                            ? 'bg-[#DC2626] text-white border-[#EF4444]'
                            : 'bg-[#0D1016] border-white/10 text-[#CBD5E1]'
                        }`}
                      >
                        {tod}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CONTROLS & SENSITIVITY TAB */}
          {tab === 'controls' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    ['cameraSensitivity', 'Camera Look Sensitivity'],
                    ['adsSensitivity', 'ADS Red-Dot Sensitivity'],
                    ['scope2xSensitivity', '2x Scope Sensitivity'],
                    ['scope4xSensitivity', '4x Scope Sensitivity'],
                    ['scope8xSensitivity', '8x Sniper Scope Sensitivity'],
                    ['gyroscopeSensitivity', 'Gyroscope Sensitivity'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="bg-[#141821] border border-white/10 p-3.5">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-white font-medium">{label}</span>
                      <span className="font-mono-num text-[#38BDF8]">{Math.round(controls[key] * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.15}
                      max={2.2}
                      step={0.05}
                      value={controls[key]}
                      onChange={(e) => onChangeControls({ ...controls, [key]: Number(e.target.value) })}
                      className="w-full accent-[#DC2626]"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {(
                  [
                    ['aimAssist', 'Tactical Aim Assist'],
                    ['autoPickup', 'Auto-Pickup Meds & Armor'],
                    ['showTouchControls', 'On-Screen Mobile HUD Controls'],
                    ['gyroscopeEnabled', 'Gyroscope Aiming'],
                    ['leftHanded', 'Left-Handed Layout'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => onChangeControls({ ...controls, [key]: !controls[key] })}
                    className={`flex items-center justify-between px-3 py-2.5 border text-xs cursor-pointer ${
                      controls[key]
                        ? 'bg-[#172330] border-[#38BDF8]/60 text-white'
                        : 'bg-[#141821] border-white/10 text-[#94A3B8]'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="font-mono-num font-bold">{controls[key] ? 'ON' : 'OFF'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* INTERACTIVE CUSTOM HUD EDITOR TAB */}
          {tab === 'hud' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {hudPresets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectHudPreset(p.id);
                        setEditingPreset(p);
                      }}
                      className={`px-3 py-1.5 text-xs font-display font-bold border cursor-pointer ${
                        editingPreset.id === p.id
                          ? 'bg-[#38BDF8] text-black border-[#38BDF8]'
                          : 'bg-[#141821] border-white/10 text-[#CBD5E1]'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onResetHudPresets();
                      setEditingPreset(DEFAULT_HUD_PRESETS[0]);
                    }}
                    className="px-3 py-1.5 bg-[#1A1F29] hover:bg-[#273040] border border-white/15 text-xs text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                  <button
                    onClick={() => {
                      audioEngine.playUiClick(true);
                      onSaveHudPreset(editingPreset);
                    }}
                    className="px-4 py-1.5 bg-[#DC2626] hover:bg-[#EF4444] text-xs font-display font-bold text-white cursor-pointer"
                  >
                    SAVE HUD LAYOUT
                  </button>
                </div>
              </div>

              {/* Drag-and-Drop HUD Canvas Preview */}
              <div
                ref={stageRef}
                onPointerMove={handleStagePointerMove}
                onPointerUp={() => {
                  dragBtnRef.current = null;
                }}
                onPointerLeave={() => {
                  dragBtnRef.current = null;
                }}
                className="relative w-full h-72 bg-[#070B11] border border-white/20 overflow-hidden select-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                }}
              >
                <div className="absolute top-2 left-3 text-[11px] text-[#64748B] pointer-events-none">
                  Drag buttons to reposition · Click a button to adjust size & opacity below
                </div>

                {Object.values(editingPreset.elements).map((el) => {
                  const sel = selectedHudBtn === el.id;
                  return (
                    <div
                      key={el.id}
                      onPointerDown={() => {
                        setSelectedHudBtn(el.id);
                        dragBtnRef.current = el.id;
                      }}
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        transform: `translate(-50%, -50%) scale(${el.scale})`,
                        opacity: el.opacity,
                      }}
                      className={`absolute px-3 py-2 rounded-full text-[11px] font-display font-bold cursor-grab active:cursor-grabbing border ${
                        sel
                          ? 'bg-[#DC2626] border-white text-white z-10'
                          : 'bg-[#1C222D] border-white/30 text-[#CBD5E1]'
                      }`}
                    >
                      {el.label}
                    </div>
                  );
                })}
              </div>

              {/* Selected HUD Button Size & Opacity Sliders */}
              {selectedEl && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#141821] border border-white/10 p-3.5 text-xs">
                  <div>
                    <div className="text-[#94A3B8]">Selected Control</div>
                    <div className="font-display font-bold text-base text-white mt-0.5">{selectedEl.label}</div>
                    <div className="font-mono-num text-[11px] text-[#64748B]">
                      Pos: {selectedEl.x}%, {selectedEl.y}%
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#CBD5E1]">Button Size</span>
                      <span className="font-mono-num text-[#38BDF8]">{Math.round(selectedEl.scale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.7}
                      max={1.5}
                      step={0.05}
                      value={selectedEl.scale}
                      onChange={(e) => updateHudEl(selectedEl.id, { scale: Number(e.target.value) })}
                      className="w-full accent-[#DC2626]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#CBD5E1]">Opacity</span>
                      <span className="font-mono-num text-[#38BDF8]">{Math.round(selectedEl.opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.25}
                      max={1}
                      step={0.05}
                      value={selectedEl.opacity}
                      onChange={(e) => updateHudEl(selectedEl.id, { opacity: Number(e.target.value) })}
                      className="w-full accent-[#DC2626]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUDIO TAB */}
          {tab === 'audio' && (
            <div className="space-y-4 max-w-xl">
              <button
                onClick={() => onChangeAudio({ ...audio, muted: !audio.muted })}
                className={`px-4 py-2 text-xs font-display font-bold border cursor-pointer ${
                  audio.muted
                    ? 'bg-[#7F1D1D] border-[#EF4444] text-white'
                    : 'bg-[#172330] border-[#38BDF8] text-[#38BDF8]'
                }`}
              >
                {audio.muted ? 'ALL AUDIO MUTED — CLICK TO UNMUTE' : 'AUDIO ACTIVE — CLICK TO MUTE ALL'}
              </button>

              {(
                [
                  ['master', 'Master Volume'],
                  ['sfx', 'Weapon & Combat SFX'],
                  ['ambient', 'Environment & Weather Ambience'],
                  ['music', 'Menu & Victory Audio'],
                  ['voice', 'Squad Voice Channel'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="bg-[#141821] border border-white/10 p-3.5">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-white font-medium">{label}</span>
                    <span className="font-mono-num text-[#38BDF8]">{Math.round(audio[key] * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audio[key]}
                    onChange={(e) => onChangeAudio({ ...audio, [key]: Number(e.target.value) })}
                    className="w-full accent-[#DC2626]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
