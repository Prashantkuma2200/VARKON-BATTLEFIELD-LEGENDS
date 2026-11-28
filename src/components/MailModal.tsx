import React from 'react';
import { Check, Mail, X } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { MailMessage } from '../game/types';

interface MailModalProps {
  messages: MailMessage[];
  onClaimMail: (mailId: string) => void;
  onClaimAll: () => void;
  onClose: () => void;
}

export const MailModal: React.FC<MailModalProps> = ({
  messages,
  onClaimMail,
  onClaimAll,
  onClose,
}) => {
  const claimableCount = messages.filter((m) => !m.claimed && (m.rewardGold || m.rewardVex)).length;

  return (
    <div className="fixed inset-0 z-40 bg-[#0A0D0A]/92 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#121712] border border-[#C6A65A]/30 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#C6A65A]/20 bg-[#161D15]">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-[#C6A65A]" />
            <h2 className="font-display font-bold text-base tracking-wider text-[#F2F2ED] uppercase">
              Command HQ Inbox
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {claimableCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(true);
                  onClaimAll();
                }}
                className="px-3 py-1.5 bg-[#C6A65A] hover:bg-[#D9B86C] text-[#101410] font-display font-bold text-xs uppercase cursor-pointer"
              >
                Claim All ({claimableCount})
              </button>
            )}
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
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="bg-[#182017] border border-white/12 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="text-[11px] font-mono-num text-[#C6A65A] uppercase">
                  {msg.sender} · {msg.date}
                </div>
                <div className="font-display font-bold text-sm text-[#F2F2ED]">{msg.title}</div>
                <p className="text-xs text-[#94A3B8] leading-relaxed">{msg.body}</p>
                {(msg.rewardGold || msg.rewardVex) && (
                  <div className="pt-1 text-xs font-mono-num flex items-center gap-3">
                    {msg.rewardGold ? (
                      <span className="text-[#C6A65A]">+{msg.rewardGold.toLocaleString()} V-Coins</span>
                    ) : null}
                    {msg.rewardVex ? (
                      <span className="text-[#38BDF8]">+{msg.rewardVex.toLocaleString()} V-Credits</span>
                    ) : null}
                  </div>
                )}
              </div>

              {(msg.rewardGold || msg.rewardVex) && (
                <button
                  type="button"
                  disabled={msg.claimed}
                  onClick={() => {
                    audioEngine.playUiClick(true);
                    onClaimMail(msg.id);
                  }}
                  className={`px-4 py-2 text-xs font-display font-bold uppercase border shrink-0 cursor-pointer ${
                    msg.claimed
                      ? 'border-[#22C55E]/40 text-[#22C55E] cursor-default'
                      : 'bg-[#C6A65A] hover:bg-[#D9B86C] text-[#101410] border-[#F2F2ED]/30'
                  }`}
                >
                  {msg.claimed ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Claimed
                    </span>
                  ) : (
                    'Claim Supply'
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
