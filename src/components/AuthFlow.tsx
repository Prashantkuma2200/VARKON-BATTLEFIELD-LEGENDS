import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Shield,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { audioEngine } from '../game/audio';

export interface AuthenticatedAccount {
  name: string;
  playerId: string;
  authProvider: 'guest' | 'email' | 'google' | 'apple';
  email?: string;
  linkedProviders: Array<'guest' | 'email' | 'google' | 'apple'>;
  createdAt: string;
}

interface AuthFlowProps {
  mode: 'splash' | 'login';
  existingName: string;
  existingPlayerId: string;
  onSplashComplete: () => void;
  onAuthenticated: (account: AuthenticatedAccount) => void;
}

type AuthSubView = 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'success';

const STORAGE_KEY_ACCOUNTS = 'varkon_accounts_v1';

interface StoredLocalAccount {
  username: string;
  email: string;
  passwordHash: string;
  dob: string;
  playerId: string;
  createdAt: string;
}

function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `vk_${(h >>> 0).toString(16)}`;
}

function loadAccounts(): StoredLocalAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAccounts(list: StoredLocalAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(list));
  } catch {
    // ignore storage quota
  }
}

const RESERVED_NAMES = ['ADMIN', 'MODERATOR', 'VARKON_HQ', 'SYSTEM'];

export const AuthFlow: React.FC<AuthFlowProps> = ({
  mode,
  existingName,
  existingPlayerId,
  onSplashComplete,
  onAuthenticated,
}) => {
  const [splashPct, setSplashPct] = useState(0);
  const [view, setView] = useState<AuthSubView>('login');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Registration form state
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regDob, setRegDob] = useState('2002-01-15');
  const [acceptTerms, setAcceptTerms] = useState(true);

  // Verification & Recovery state
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [expectedCode, setExpectedCode] = useState('482910');
  const [pendingAccount, setPendingAccount] = useState<StoredLocalAccount | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [guestWarningOpen, setGuestWarningOpen] = useState(false);
  const [signedInAccount, setSignedInAccount] = useState<AuthenticatedAccount | null>(null);

  useEffect(() => {
    if (mode !== 'splash') return;
    const t = window.setInterval(() => {
      setSplashPct((prev) => {
        if (prev >= 100) {
          clearInterval(t);
          return 100;
        }
        return Math.min(100, prev + 12);
      });
    }, 90);
    return () => clearInterval(t);
  }, [mode]);

  const finishAuth = (account: AuthenticatedAccount) => {
    setSignedInAccount(account);
    setView('success');
    audioEngine.playUiClick(true);
    window.setTimeout(() => {
      onAuthenticated(account);
    }, 850);
  };

  // Password strength score 0..4
  const getPasswordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (failedAttempts >= 5) {
      setErrorMsg('Too many failed attempts. Use Forgot Password or wait before trying again.');
      return;
    }
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setErrorMsg('Enter both your Gamer Tag / Email and password.');
      return;
    }
    const accounts = loadAccounts();
    const match = accounts.find(
      (a) =>
        a.email.toLowerCase() === cleanId.toLowerCase() ||
        a.username.toLowerCase() === cleanId.toLowerCase()
    );
    if (!match) {
      setFailedAttempts((n) => n + 1);
      setErrorMsg('Account not found. Create an account or continue as Guest.');
      return;
    }
    if (match.passwordHash !== simpleHash(password)) {
      setFailedAttempts((n) => n + 1);
      setErrorMsg('Incorrect password. Please verify your credentials.');
      return;
    }
    finishAuth({
      name: match.username,
      playerId: match.playerId,
      authProvider: 'email',
      email: match.email,
      linkedProviders: ['email'],
      createdAt: match.createdAt,
    });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const uname = regUsername.trim();
    const email = regEmail.trim().toLowerCase();

    if (uname.length < 3 || uname.length > 18 || !/^[a-zA-Z0-9_]+$/.test(uname)) {
      setErrorMsg('Gamer Tag must be 3–18 characters using letters, numbers, or underscores.');
      return;
    }
    if (RESERVED_NAMES.includes(uname.toUpperCase())) {
      setErrorMsg('That Gamer Tag is reserved. Choose another callsign.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Enter a valid email address.');
      return;
    }
    if (regPassword.length < 8 || getPasswordStrength(regPassword) < 3) {
      setErrorMsg('Password must be 8+ characters with uppercase, number, or symbol.');
      return;
    }
    if (regPassword !== regConfirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!regDob) {
      setErrorMsg('Enter your date of birth.');
      return;
    }
    if (!acceptTerms) {
      setErrorMsg('You must accept the VARKON Terms of Service and Privacy Policy.');
      return;
    }

    const accounts = loadAccounts();
    if (accounts.some((a) => a.email.toLowerCase() === email)) {
      setErrorMsg('An account with this email already exists.');
      return;
    }
    if (accounts.some((a) => a.username.toLowerCase() === uname.toLowerCase())) {
      setErrorMsg('That Gamer Tag is already taken.');
      return;
    }

    const code = String(100000 + Math.floor(Math.random() * 899999));
    setExpectedCode(code);
    setPendingAccount({
      username: uname,
      email,
      passwordHash: simpleHash(regPassword),
      dob: regDob,
      playerId: `VK-${Math.floor(1000000 + Math.random() * 8999999)}`,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setVerifyCodeInput(code);
    setInfoMsg(`Local verification code generated for ${email}: ${code}`);
    setView('verify');
  };

  const handleVerifyEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!pendingAccount) return;
    if (verifyCodeInput.trim() !== expectedCode) {
      setErrorMsg('Verification code does not match. Check the generated code above.');
      return;
    }
    const accounts = loadAccounts();
    saveAccounts([...accounts, pendingAccount]);
    finishAuth({
      name: pendingAccount.username,
      playerId: pendingAccount.playerId,
      authProvider: 'email',
      email: pendingAccount.email,
      linkedProviders: ['email'],
      createdAt: pendingAccount.createdAt,
    });
  };

  const handleGuestContinue = () => {
    const guestId = existingPlayerId || `VK-G${Math.floor(100000 + Math.random() * 899999)}`;
    finishAuth({
      name: existingName || 'VARKON_GAMER',
      playerId: guestId,
      authProvider: 'guest',
      linkedProviders: ['guest'],
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  const handleQuickProvider = (provider: 'google' | 'apple') => {
    const label = provider === 'google' ? 'VARKON_GOOGLE' : 'VARKON_APPLE';
    finishAuth({
      name: existingName || label,
      playerId: existingPlayerId || `VK-${Math.floor(1000000 + Math.random() * 8999999)}`,
      authProvider: provider,
      email: `${provider}.operative@varkon.local`,
      linkedProviders: [provider],
      createdAt: new Date().toISOString().slice(0, 10),
    });
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const clean = forgotEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setErrorMsg('Enter a valid account email address.');
      return;
    }
    const accounts = loadAccounts();
    const exists = accounts.some((a) => a.email.toLowerCase() === clean);
    if (!exists) {
      setErrorMsg('No local account matches that email address.');
      return;
    }
    setInfoMsg(`Recovery verified for ${clean}. Set a new password below.`);
    setView('reset');
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (resetNewPass.length < 8) {
      setErrorMsg('New password must be at least 8 characters.');
      return;
    }
    const accounts = loadAccounts();
    const updated = accounts.map((a) =>
      a.email.toLowerCase() === forgotEmail.trim().toLowerCase()
        ? { ...a, passwordHash: simpleHash(resetNewPass) }
        : a
    );
    saveAccounts(updated);
    setInfoMsg('Password updated. Sign in with your new credentials.');
    setIdentifier(forgotEmail.trim());
    setPassword('');
    setView('login');
  };

  if (mode === 'splash') {
    return (
      <div className="fixed inset-0 z-50 bg-[#101410] flex flex-col justify-between overflow-hidden">
        {/* Key Art Backdrop */}
        <div className="absolute inset-0">
          <img
            src="/assets/aistudio/Varkon__Deploy._Dominate._Survive_94aefe5e.png"
            alt="VARKON: Battlefield Legends Key Art"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-70"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101410] via-[#101410]/45 to-[#101410]/85" />
        </div>

        {/* Top Strip */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4 text-xs text-[#C6A65A]">
          <span className="font-mono-num tracking-widest">VARKON STUDIOS · WEB PROTOTYPE (PHASE 1)</span>
          <span className="font-mono-num text-[#F2F2ED]/75">SIMULATED ONLINE BACKEND · LOCAL SAVE</span>
        </div>

        {/* Center Hero Lockup */}
        <div className="relative z-10 flex flex-col items-center text-center px-6">
          <svg width="72" height="54" viewBox="0 0 72 54" fill="none" aria-hidden="true" className="mb-3">
            <path d="M6 10L36 48L66 10H52L36 31L20 10H6Z" fill="#C6A65A" />
            <path d="M36 4L41 15H31L36 4Z" fill="#B83232" />
            <path d="M22 10L36 27L50 10" stroke="#F2F2ED" strokeWidth="1.5" strokeOpacity="0.65" />
          </svg>
          <h1 className="font-display font-bold text-4xl sm:text-6xl tracking-[0.18em] text-[#F2F2ED] uppercase">
            VARKON
          </h1>
          <div className="font-display font-bold text-sm sm:text-lg tracking-[0.36em] text-[#C6A65A] mt-1 uppercase">
            BATTLEFIELD LEGENDS
          </div>
          <p className="text-xs sm:text-sm tracking-[0.25em] text-[#F2F2ED]/80 mt-3 uppercase">
            DEPLOY. DOMINATE. SURVIVE.
          </p>
        </div>

        {/* Bottom Progress & Enter Action */}
        <div className="relative z-10 w-full max-w-xl mx-auto px-6 pb-8 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono-num text-[#F2F2ED]/80">
            <span>
              {splashPct < 100
                ? 'Initializing 3D PBR Materials, Ballistics & Tactical Maps...'
                : 'Battlefield Systems Ready'}
            </span>
            <span className="text-[#C6A65A] font-bold">{splashPct}%</span>
          </div>
          <div className="h-2 bg-[#1A2018] border border-[#C6A65A]/30 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#596747] via-[#C6A65A] to-[#F2F2ED] transition-all duration-150"
              style={{ width: `${splashPct}%` }}
            />
          </div>

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick(true);
                onSplashComplete();
              }}
              className="px-10 py-3.5 bg-gradient-to-r from-[#A5843E] via-[#C6A65A] to-[#8F6F2E] hover:from-[#D5B56A] hover:to-[#C6A65A] text-[#101410] font-display font-bold text-base tracking-[0.2em] uppercase transition-all active:scale-[0.98] cursor-pointer clip-tactical shadow-[0_0_24px_rgba(198,166,90,0.35)]"
            >
              {splashPct < 100 ? 'SKIP TO LOGIN' : 'ENTER GAME'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LOGIN / REGISTRATION / VERIFY / FORGOT / RESET / SUCCESS
  const strength = getPasswordStrength(regPassword);
  const strengthLabels = ['Weak', 'Fair', 'Moderate', 'Strong', 'Military Grade'];

  return (
    <div className="fixed inset-0 z-50 bg-[#101410] flex items-center justify-center p-4 overflow-y-auto">
      {/* Background Key Art with dark military scrim */}
      <div className="fixed inset-0 pointer-events-none">
        <img
          src="/assets/aistudio/02_Login_and_Registration_Concept_8a9d3af4.png"
          alt="VARKON Battlefield Login Backdrop"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-35"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#101410]/95 via-[#182016]/80 to-[#101410]/95" />
      </div>

      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-[#141A13]/95 border border-[#C6A65A]/30 shadow-2xl overflow-hidden my-auto">
        {/* Left Brand Showcase Column */}
        <div className="lg:col-span-5 relative p-6 flex flex-col justify-between bg-[#101410] border-b lg:border-b-0 lg:border-r border-[#C6A65A]/20">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <svg width="34" height="26" viewBox="0 0 72 54" fill="none" aria-hidden="true">
                <path d="M6 10L36 48L66 10H52L36 31L20 10H6Z" fill="#C6A65A" />
                <path d="M36 4L41 15H31L36 4Z" fill="#B83232" />
              </svg>
              <div>
                <div className="font-display font-bold text-lg tracking-[0.18em] text-[#F2F2ED] leading-none">
                  VARKON
                </div>
                <div className="font-mono-num text-[10px] tracking-[0.22em] text-[#C6A65A] mt-0.5">
                  BATTLEFIELD LEGENDS
                </div>
              </div>
            </div>

            <div className="relative h-36 lg:h-48 overflow-hidden border border-[#596747]/40 bg-[#182016]">
              <img
                src="/assets/aistudio/01_game_key_art_33ef2a48.png"
                alt="VARKON Tactical Squad"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101410] via-transparent to-transparent" />
              <div className="absolute bottom-2.5 left-3 right-3">
                <div className="text-[11px] font-mono-num text-[#C6A65A] uppercase">Season 1 · Operation Legacy</div>
                <div className="font-display font-bold text-sm text-[#F2F2ED]">Deploy. Dominate. Survive.</div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-[#F2F2ED]/75">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C6A65A] shrink-0" />
                <span>Unified Operative Profile · Mobile, Tablet & PC HUD</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[#C6A65A] shrink-0" />
                <span>Guest progress upgradable to linked account anytime</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono-num text-[#94A3B8]">
            <span>BROWSER PROFILE AUTH</span>
            <span className="text-[#C6A65A]">LOCAL SYNC ACTIVE</span>
          </div>
        </div>

        {/* Right Interactive Form Column */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
          {view === 'success' && signedInAccount ? (
            <div className="py-10 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#C6A65A] mx-auto" />
              <h2 className="font-display font-bold text-2xl text-[#F2F2ED] uppercase tracking-wider">
                Authentication Confirmed
              </h2>
              <p className="text-xs text-[#F2F2ED]/75">
                Welcome back, <span className="text-[#C6A65A] font-bold">{signedInAccount.name}</span> ({signedInAccount.playerId}). Loading 3D Command Lobby...
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-display font-bold text-xl text-[#F2F2ED] uppercase tracking-wider">
                    {view === 'login' && 'Operative Sign In'}
                    {view === 'register' && 'Create VARKON Account'}
                    {view === 'verify' && 'Email Verification'}
                    {view === 'forgot' && 'Account Recovery'}
                    {view === 'reset' && 'Reset Password'}
                  </h2>
                  <p className="text-xs text-[#F2F2ED]/65 mt-0.5">
                    {view === 'login' && 'Access your cross-device loadout, rank progression, and Battle Pass.'}
                    {view === 'register' && 'Register a permanent callsign and protect your battlefield progress.'}
                    {view === 'verify' && 'Enter the 6-digit verification code to activate your operative account.'}
                    {view === 'forgot' && 'Enter your registered email to verify recovery.'}
                    {view === 'reset' && 'Choose a strong new password for your VARKON account.'}
                  </p>
                </div>
                {view !== 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setView('login');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#20281D] hover:bg-[#333F2B] border border-[#C6A65A]/30 text-xs text-[#F2F2ED] cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                )}
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 bg-[#B83232]/20 border border-[#B83232]/70 text-xs text-[#FCA5A5] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444]" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div className="mb-4 p-3 bg-[#333F2B]/55 border border-[#C6A65A]/50 text-xs text-[#F2F2ED]">
                  {infoMsg}
                </div>
              )}

              {/* LOGIN FORM */}
              {view === 'login' && (
                <div className="space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-display font-semibold tracking-wider text-[#C6A65A] uppercase mb-1">
                        Email or Gamer Tag
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          placeholder="operative@varkon.gg or VARKON_GAMER"
                          className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] pl-9 pr-3 py-2.5 text-xs text-[#F2F2ED] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-display font-semibold tracking-wider text-[#C6A65A] uppercase mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] pl-9 pr-10 py-2.5 text-xs text-[#F2F2ED] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#F2F2ED] cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <label className="flex items-center gap-2 text-[#F2F2ED]/80 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="accent-[#C6A65A]"
                        />
                        <span>Remember Me</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          setInfoMsg(null);
                          setView('forgot');
                        }}
                        className="text-[#C6A65A] hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-gradient-to-r from-[#A5843E] via-[#C6A65A] to-[#8F6F2E] hover:from-[#D5B56A] hover:to-[#C6A65A] text-[#101410] font-display font-bold text-sm tracking-[0.18em] uppercase cursor-pointer clip-tactical-sm"
                    >
                      SIGN IN
                    </button>
                  </form>

                  {/* Instant Guest & Provider Options */}
                  <div className="pt-2 border-t border-white/10 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setGuestWarningOpen((o) => !o)}
                      className="w-full py-2.5 bg-[#333F2B] hover:bg-[#425238] border border-[#C6A65A]/45 text-[#F2F2ED] font-display font-bold text-xs tracking-[0.16em] uppercase cursor-pointer"
                    >
                      CONTINUE AS GUEST (INSTANT DEPLOY)
                    </button>

                    {guestWarningOpen && (
                      <div className="p-3 bg-[#1B1F16] border border-[#C6A65A]/40 text-xs space-y-2">
                        <div className="flex items-start gap-2 text-[#E5C97E]">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>
                            Unlinked guest progress is stored locally in this browser. You can link Email, Google, or Apple anytime from your Profile to keep your unlocks.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleGuestContinue}
                          className="w-full py-2 bg-[#B83232] hover:bg-[#DC2626] text-white font-display font-bold text-xs tracking-wider uppercase cursor-pointer"
                        >
                          CONFIRM & ENTER AS GUEST
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickProvider('google')}
                        className="py-2 bg-[#1A2019] hover:bg-[#262E24] border border-white/15 text-xs font-medium text-[#F2F2ED] cursor-pointer"
                      >
                        Google Sign-In
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickProvider('apple')}
                        className="py-2 bg-[#1A2019] hover:bg-[#262E24] border border-white/15 text-xs font-medium text-[#F2F2ED] cursor-pointer"
                      >
                        Apple Sign-In
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs text-[#F2F2ED]/70">
                      <span>New to VARKON?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          setInfoMsg(null);
                          setView('register');
                        }}
                        className="inline-flex items-center gap-1 font-display font-bold text-[#C6A65A] hover:underline uppercase cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Create Account</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* REGISTRATION FORM */}
              {view === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-display font-semibold text-[#C6A65A] uppercase mb-1">
                        Gamer Tag / Username
                      </label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="VARKON_STRIKER"
                        className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] px-3 py-2 text-xs text-[#F2F2ED] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-display font-semibold text-[#C6A65A] uppercase mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={regDob}
                        onChange={(e) => setRegDob(e.target.value)}
                        className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] px-3 py-2 text-xs text-[#F2F2ED] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-display font-semibold text-[#C6A65A] uppercase mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="soldier@example.com"
                      className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] px-3 py-2 text-xs text-[#F2F2ED] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-display font-semibold text-[#C6A65A] uppercase mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="8+ chars, uppercase & number"
                        className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] px-3 py-2 text-xs text-[#F2F2ED] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-display font-semibold text-[#C6A65A] uppercase mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] px-3 py-2 text-xs text-[#F2F2ED] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#94A3B8]">Password Strength:</span>
                    <span className="font-mono-num text-[#C6A65A]">{strengthLabels[strength]}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 h-1.5">
                    {[1, 2, 3, 4].map((lvl) => (
                      <div
                        key={lvl}
                        className={strength >= lvl ? 'bg-[#C6A65A]' : 'bg-[#20281D]'}
                      />
                    ))}
                  </div>

                  <label className="flex items-start gap-2 text-[11px] text-[#F2F2ED]/75 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 accent-[#C6A65A]"
                    />
                    <span>I accept the VARKON Terms of Service, Fair-Play Policy, and Privacy Policy.</span>
                  </label>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-[#A5843E] via-[#C6A65A] to-[#8F6F2E] text-[#101410] font-display font-bold text-sm tracking-[0.16em] uppercase cursor-pointer clip-tactical-sm"
                  >
                    CONTINUE TO EMAIL VERIFICATION
                  </button>
                </form>
              )}

              {/* EMAIL VERIFICATION */}
              {view === 'verify' && (
                <form onSubmit={handleVerifyEmail} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-display font-semibold text-[#C6A65A] uppercase mb-1">
                      6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={verifyCodeInput}
                        onChange={(e) => setVerifyCodeInput(e.target.value)}
                        maxLength={6}
                        className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] pl-9 pr-3 py-2.5 text-sm font-mono-num tracking-[0.3em] text-[#F2F2ED] focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#333F2B] hover:bg-[#46563B] border border-[#C6A65A] text-[#F2F2ED] font-display font-bold text-sm tracking-[0.16em] uppercase cursor-pointer"
                  >
                    VERIFY & DEPLOY TO LOBBY
                  </button>
                </form>
              )}

              {/* FORGOT PASSWORD */}
              {view === 'forgot' && (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-display font-semibold text-[#C6A65A] uppercase mb-1">
                      Registered Email Address
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="soldier@example.com"
                      className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] px-3 py-2.5 text-xs text-[#F2F2ED] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#333F2B] hover:bg-[#46563B] border border-[#C6A65A] text-[#F2F2ED] font-display font-bold text-sm tracking-wider uppercase cursor-pointer"
                  >
                    VERIFY RECOVERY ACCOUNT
                  </button>
                </form>
              )}

              {/* PASSWORD RESET */}
              {view === 'reset' && (
                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-display font-semibold text-[#C6A65A] uppercase mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={resetNewPass}
                      onChange={(e) => setResetNewPass(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full bg-[#0E120E] border border-[#596747]/50 focus:border-[#C6A65A] px-3 py-2.5 text-xs text-[#F2F2ED] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-[#A5843E] to-[#C6A65A] text-[#101410] font-display font-bold text-sm tracking-wider uppercase cursor-pointer"
                  >
                    UPDATE PASSWORD
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
