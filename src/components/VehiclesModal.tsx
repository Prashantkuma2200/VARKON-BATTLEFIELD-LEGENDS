import React from 'react';
import { Check, Gauge, Shield, Truck, Users, X } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { VEHICLES } from '../game/data';
import { PlayerProfile } from '../game/types';

interface VehiclesModalProps {
  profile: PlayerProfile;
  onSelectVehicle: (vehicleId: string) => void;
  onCustomizeVehicleCamo: (vehicleId: string, hex: string) => void;
  onClose: () => void;
}

const VEHICLE_CAMOS = [
  { label: 'Olive Tactical', hex: '#465239' },
  { label: 'Matte Carbon', hex: '#1B2028' },
  { label: 'Desert Sand', hex: '#7A684C' },
  { label: 'Varkon Gold Trim', hex: '#9E7C36' },
  { label: 'Arctic Slate', hex: '#586878' },
  { label: 'Crimson Recon', hex: '#6E2226' },
];

export const VehiclesModal: React.FC<VehiclesModalProps> = ({
  profile,
  onSelectVehicle,
  onCustomizeVehicleCamo,
  onClose,
}) => {
  const selectedId = profile.selectedVehicleId || VEHICLES[0].id;
  const activeVehicle = VEHICLES.find((v) => v.id === selectedId) || VEHICLES[0];
  const activeCamo = profile.selectedVehicleCamo?.[activeVehicle.id] || activeVehicle.defaultCamo;

  return (
    <div className="fixed inset-0 z-40 bg-[#0A0D0A]/94 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#121712] border border-[#C6A65A]/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#C6A65A]/20 bg-[#161D15]">
          <div className="flex items-center gap-2.5">
            <Truck className="w-5 h-5 text-[#C6A65A]" />
            <div>
              <h2 className="font-display font-bold text-base tracking-wider text-[#F2F2ED] uppercase">
                VARKON Tactical Motor Pool & Vehicle Selection
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Select default deployment vehicle skin & inspect fleet specifications (saved locally)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick();
              onClose();
            }}
            className="p-2 bg-[#1D251B] hover:bg-[#B83232] text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Concept Showcase Strip using uploaded VARKON vehicle art */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative bg-[#0E130E] border border-[#C6A65A]/25 overflow-hidden">
              <img
                src="/assets/aistudio/05_Vehicles_Collection_256398b7.png"
                alt="VARKON Tactical Vehicles Showcase"
                referrerPolicy="no-referrer"
                className="w-full h-40 object-cover object-center"
              />
              <div className="px-3 py-2 bg-[#101410]/90 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="font-display font-bold text-[#C6A65A] uppercase">
                  Fleet Concept Art · Land & Air
                </span>
                <span className="font-mono-num text-[#94A3B8]">Reference Visual</span>
              </div>
            </div>
            <div className="relative bg-[#0E130E] border border-[#C6A65A]/25 overflow-hidden">
              <img
                src="/assets/aistudio/06_vehicles_e6866200.png"
                alt="VARKON Military Fleet Lineup"
                referrerPolicy="no-referrer"
                className="w-full h-40 object-cover object-center"
              />
              <div className="px-3 py-2 bg-[#101410]/90 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="font-display font-bold text-[#F2F2ED] uppercase">
                  Active Prototype Vehicles: Press E near jeeps in match
                </span>
                <span className="font-mono-num text-[#22C55E]">3 Drivable</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Vehicle List */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {VEHICLES.map((v) => {
                const selected = v.id === activeVehicle.id;
                const isDrivable = v.status === 'Drivable in 3D Prototype';
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick();
                      onSelectVehicle(v.id);
                    }}
                    className={`p-3.5 text-left border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                      selected
                        ? 'bg-[#252A1B] border-[#C6A65A] text-white'
                        : 'bg-[#182017] border-white/10 text-[#CBD5E1] hover:border-[#C6A65A]/45'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono-num uppercase text-[#C6A65A]">
                          {v.category}
                        </span>
                        {selected && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#C6A65A] text-[#101410] font-display font-bold text-[10px] uppercase">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        )}
                      </div>
                      <div className="font-display font-bold text-sm text-[#F2F2ED] mt-1">{v.name}</div>
                      <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">{v.description}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] font-mono-num">
                      <span className={isDrivable ? 'text-[#22C55E]' : 'text-[#F59E0B]'}>
                        {v.status}
                      </span>
                      <span className="text-[#CBD5E1]">{v.seats} Seats</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: Selected Vehicle Telemetry & Camo Customization */}
            <div className="lg:col-span-5 bg-[#182017] border border-[#C6A65A]/30 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-mono-num uppercase text-[#C6A65A]">
                    {activeVehicle.category} · {activeVehicle.status}
                  </div>
                  <h3 className="font-display font-bold text-xl text-[#F2F2ED] mt-0.5">
                    {activeVehicle.name}
                  </h3>
                </div>
                <div
                  className="w-10 h-10 border border-white/25 shrink-0"
                  style={{ backgroundColor: activeCamo }}
                  title="Equipped Tactical Coating"
                />
              </div>

              {/* Stats */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#94A3B8] inline-flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-[#C6A65A]" /> Top Speed
                    </span>
                    <span className="font-mono-num text-white">{activeVehicle.maxSpeedKmh} km/h</span>
                  </div>
                  <div className="h-1.5 bg-[#0A0D0A]">
                    <div
                      className="h-full bg-[#C6A65A]"
                      style={{ width: `${Math.min(100, (activeVehicle.maxSpeedKmh / 170) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#94A3B8] inline-flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-[#38BDF8]" /> Chassis Armor
                    </span>
                    <span className="font-mono-num text-white">{activeVehicle.armorHp} HP</span>
                  </div>
                  <div className="h-1.5 bg-[#0A0D0A]">
                    <div
                      className="h-full bg-[#38BDF8]"
                      style={{ width: `${Math.min(100, (activeVehicle.armorHp / 4000) * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#94A3B8] inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#22C55E]" /> Handling & Agility
                    </span>
                    <span className="font-mono-num text-white">{activeVehicle.handling}/100</span>
                  </div>
                  <div className="h-1.5 bg-[#0A0D0A]">
                    <div
                      className="h-full bg-[#22C55E]"
                      style={{ width: `${activeVehicle.handling}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tactical Camo Coating */}
              <div className="pt-2 border-t border-white/10">
                <div className="text-xs font-display font-bold text-[#CBD5E1] uppercase mb-2">
                  Tactical Chassis Finish (Cosmetic Only)
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {VEHICLE_CAMOS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick();
                        onCustomizeVehicleCamo(activeVehicle.id, c.hex);
                      }}
                      className={`p-2 border text-left cursor-pointer ${
                        activeCamo === c.hex
                          ? 'border-[#C6A65A] bg-[#262B1C]'
                          : 'border-white/10 bg-[#121712] hover:border-white/30'
                      }`}
                    >
                      <div className="h-3.5 w-full mb-1 border border-white/15" style={{ backgroundColor: c.hex }} />
                      <div className="text-[10px] text-[#CBD5E1] truncate">{c.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 bg-[#101410] border border-white/10 text-[11px] text-[#94A3B8] leading-relaxed">
                <strong className="text-[#C6A65A]">Prototype Note:</strong> Cosmetic finishes never add
                pay-to-win stats. Full networked vehicle physics & helicopter flight are scheduled for
                Unity Phase 8.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
