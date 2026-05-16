"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Download,
  FileCheck2,
  GraduationCap,
  Image as ImageIcon,
  KeyRound,
  Landmark,
  QrCode,
  RotateCcw,
  SearchCheck,
  Share2,
  ShieldCheck,
  Upload,
  WalletCards,
  XCircle,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

const publicNavItems = [
  { id: "home", label: "Home" },
  { id: "signin", label: "Sign In" },
];

const userNavItems = [
  { id: "opportunities", label: "Apply" },
  { id: "credentials", label: "My QR Wallet" },
  { id: "verify", label: "Verify" },
  { id: "ndi", label: "Bhutan NDI" },
];

const issuerNavItems = [
  { id: "issuer", label: "Issuer Dashboard" },
  { id: "verify", label: "Verify" },
  { id: "ndi", label: "Bhutan NDI" },
  { id: "sdk", label: "SDK" },
];

const verifierNavItems = [
  { id: "verifier", label: "Grade Converter" },
  { id: "verify", label: "Credential Check" },
  { id: "ndi", label: "Bhutan NDI" },
  { id: "sdk", label: "SDK" },
];

const bgImages = {
  college: "https://images.unsplash.com/flagged/photo-1554473675-d0904f3cbf38?q=80&w=2000&auto=format&fit=crop",
  himalaya: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=2000&auto=format&fit=crop",
  snowyMountain: "https://images.unsplash.com/photo-1648723906701-260f1be9bd68?q=80&w=2000&auto=format&fit=crop",
  flowers: "https://images.unsplash.com/photo-1777059269563-51fdb397358c?q=80&w=2000&auto=format&fit=crop",
  prism: "https://images.unsplash.com/photo-1597589827317-4c6d6e0a90bd?q=80&w=2000&auto=format&fit=crop",
  northernLights: "https://images.unsplash.com/photo-1680666032153-46856cdcb21f?q=80&w=2000&auto=format&fit=crop",
};

type BgKey = keyof typeof bgImages;
type Role = "user" | "issuer" | "verifier";

type NDIUser = {
  role: Role;
  fullName: string;
  cid: string;
  phone: string;
  email: string;
  walletId: string;
  verifiedCredentialId: string;
  highestQualification: string;
  organisationName?: string;
  issuerDid?: string;
};

type Credential = {
  id: string;
  name: string;
  cid: string;
  issuer: string;
  qualification: string;
  country: string;
  grade: string;
  converted: string;
  equivalent: string;
  status: "Verified" | "Failed";
  risk: "Low" | "High";
  revoked: boolean;
  method: string;
};

type IssuerRecord = {
  id: string;
  name: string;
  cid: string;
  qualification: string;
  programme: string;
  category: string;
  grade: string;
  status: "Active" | "Revoked";
  issuedDate: string;
  hash: string;
};

const pageBackground: Record<string, BgKey> = {
  home: "himalaya",
  signin: "northernLights",
  issuer: "college",
  verifier: "prism",
  opportunities: "college",
  credentials: "flowers",
  verify: "snowyMountain",
  ndi: "northernLights",
  sdk: "prism",
};

const credentials: Credential[] = [
  {
    id: "SORA-BT-2026-001",
    name: "Karma Dorji",
    cid: "11508001234",
    issuer: "Royal University of Bhutan",
    qualification: "Bachelor of Civil Engineering",
    country: "Bhutan",
    grade: "72%",
    converted: "First Division",
    equivalent: "Bachelor's Degree in Engineering",
    status: "Verified",
    risk: "Low",
    revoked: false,
    method: "Bhutan NDI + Credential Registry",
  },
  {
    id: "SORA-IN-2026-018",
    name: "Pema Wangmo",
    cid: "10906004567",
    issuer: "ABC Institute of Technology",
    qualification: "B.Tech Civil Engineering",
    country: "India",
    grade: "CGPA 8.2 / 10",
    converted: "First Division",
    equivalent: "Bachelor's Degree in Engineering",
    status: "Verified",
    risk: "Low",
    revoked: false,
    method: "PDF Hash + Blockchain Proof",
  },
  {
    id: "SORA-NP-2026-044",
    name: "Tashi Namgyel",
    cid: "10203005678",
    issuer: "Unknown Training College",
    qualification: "Diploma in IT",
    country: "Nepal",
    grade: "61%",
    converted: "Second Division",
    equivalent: "Diploma",
    status: "Failed",
    risk: "High",
    revoked: true,
    method: "Registry Check",
  },
];

const demoUser: NDIUser = {
  role: "user",
  fullName: "Karma Dorji",
  cid: "11508001234",
  phone: "+975 17 123 456",
  email: "karma.dorji@example.bt",
  walletId: "did:bt:holder:karma-dorji-001",
  verifiedCredentialId: "SORA-BT-2026-001",
  highestQualification: "Bachelor of Civil Engineering",
};

const demoIssuer: NDIUser = {
  role: "issuer",
  fullName: "Registrar Officer",
  cid: "ORG-RUB-001",
  phone: "+975 02 123 456",
  email: "registrar@rub.edu.bt",
  walletId: "did:bt:org:rub-issuer-wallet",
  verifiedCredentialId: "ISSUER-RUB-TRUST-001",
  highestQualification: "Authorised Credential Issuer",
  organisationName: "Royal University of Bhutan",
  issuerDid: "did:bt:rub:issuer-001",
};

const demoVerifier: NDIUser = {
  role: "verifier",
  fullName: "HR Interviewer",
  cid: "ORG-HR-001",
  phone: "+975 17 888 999",
  email: "interviewer@opportunities.bt",
  walletId: "did:bt:verifier:opportunity-provider-001",
  verifiedCredentialId: "VERIFIER-ACCESS-001",
  highestQualification: "Authorised Opportunity Provider",
  organisationName: "Opportunity Provider / Interview Panel",
};

function cn(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return <main className="relative min-h-screen overflow-x-hidden bg-slate-950 text-white">{children}</main>;
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</section>;
}

function Pill({ children, tone = "white" }: { children: React.ReactNode; tone?: "white" | "amber" | "green" | "blue" | "red" }) {
  const tones = {
    white: "border-white/15 bg-white/10 text-white",
    amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    green: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    blue: "border-sky-300/30 bg-sky-300/10 text-sky-100",
    red: "border-red-300/30 bg-red-300/10 text-red-100",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl", className)}>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "Verified" || status === "Active") return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  if (status === "Revoked" || status === "Failed") return <XCircle className="h-5 w-5 text-red-400" />;
  return <AlertTriangle className="h-5 w-5 text-amber-400" />;
}

function CheckLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
      <span className="text-sm font-medium text-slate-200">{text}</span>
    </div>
  );
}

function FixedCanvasBackground({ imageKey }: { imageKey: BgKey }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointer = useRef({ x: 1000, y: 1000, tx: 1000, ty: 1000, strength: 1.5 });
  const imageKeyRef = useRef<BgKey>(imageKey);

  useEffect(() => {
    imageKeyRef.current = imageKey;
  }, [imageKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 2000;
    const box = 123;
    const twoPi = Math.PI * 2;
    let raf = 0;
    let rect = canvas.getBoundingClientRect();
    const boxes: Array<{ x: number; y: number; s: number }> = [];
    const cache = new Map<BgKey, HTMLImageElement>();

    canvas.width = size;
    canvas.height = size;

    for (let x = 0; x <= size; x += box) {
      for (let y = 0; y <= size; y += box) boxes.push({ x, y, s: 0 });
    }

    (Object.keys(bgImages) as BgKey[]).forEach((key) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = bgImages[key];
      cache.set(key, img);
    });

    function getImage() {
      return cache.get(imageKeyRef.current) || cache.get("himalaya")!;
    }

    function drawCover(img: HTMLImageElement) {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;
      const scale = Math.max(size / iw, size / ih);
      const nw = iw * scale;
      const nh = ih * scale;
      ctx.drawImage(img, (size - nw) / 2, (size - nh) / 2, nw, nh);
    }

    function drawTile(img: HTMLImageElement, b: { x: number; y: number; s: number }) {
      const shrink = box * b.s;
      const sx = b.x + shrink / 2;
      const sy = b.y + shrink / 2;
      const sw = Math.max(1, box - shrink);
      const sh = Math.max(1, box - shrink);
      ctx.drawImage(img, sx, sy, sw, sh, b.x, b.y, box, box);
    }

    function render() {
      const p = pointer.current;
      const img = getImage();
      p.x += (p.tx - p.x) * 0.08;
      p.y += (p.ty - p.y) * 0.08;
      const distance = Math.hypot(p.x - p.tx, p.y - p.ty);
      p.strength += (Math.min(0.5, Math.max(1.2, (distance / size) * 2 + 1.05)) - p.strength) * 0.08;

      ctx.clearRect(0, 0, size, size);
      drawCover(img);

      const vignette = ctx.createRadialGradient(p.x, p.y, 100, p.x, p.y, 1450);
      vignette.addColorStop(0, "rgba(0,0,0,0.03)");
      vignette.addColorStop(0.55, "rgba(0,0,0,0.32)");
      vignette.addColorStop(1, "rgba(0,0,0,0.82)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, size, size);

      boxes.forEach((b) => {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        b.s = 1 - Math.min(1, Math.max(0, d / size / p.strength));
        if (b.s < 0.003) return;
        ctx.save();
        ctx.globalAlpha = 0.1 + b.s * 0.45;
        drawTile(img, b);
        ctx.restore();
      });

      boxes.forEach((b) => {
        if (b.s < 0.02) return;
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,0.84)";
        ctx.arc(b.x, b.y, box * 0.06 * b.s, 0, twoPi);
        ctx.fill();
      });

      ctx.fillStyle = "rgba(2, 6, 23, 0.42)";
      ctx.fillRect(0, 0, size, size);
      raf = requestAnimationFrame(render);
    }

    function onPointerMove(e: PointerEvent) {
      rect = canvas.getBoundingClientRect();
      const sx = size / Math.max(rect.width, 1);
      const sy = size / Math.max(rect.height, 1);
      pointer.current.tx = (e.clientX - rect.left) * sx;
      pointer.current.ty = (e.clientY - rect.top) * sy;
    }

    window.addEventListener("pointermove", onPointerMove);
    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-slate-950 bg-cover bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(2,6,23,0.35), rgba(2,6,23,0.82)), url(${bgImages[imageKey]})` }}
    >
      <canvas ref={canvasRef} className="absolute left-1/2 top-1/2 aspect-square h-full w-auto -translate-x-1/2 -translate-y-1/2 lg:h-auto lg:w-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/5 via-slate-950/35 to-slate-950/85" />
    </div>
  );
}

function BackgroundPicker({ selected, onSelect }: { selected: BgKey; onSelect: (key: BgKey) => void }) {
  const [open, setOpen] = useState(false);
  const options: Array<{ key: BgKey; label: string }> = [
    { key: "himalaya", label: "Bhutan" },
    { key: "college", label: "College" },
    { key: "snowyMountain", label: "Mountain" },
    { key: "flowers", label: "Culture" },
    { key: "northernLights", label: "NDI" },
    { key: "prism", label: "SDK" },
  ];

  return (
    <div className="fixed bottom-28 right-4 z-50">
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} className="absolute bottom-16 right-0 w-48 rounded-3xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl">
            <div className="mb-2 px-2 text-xs font-bold text-slate-300">Choose background</div>
            <div className="grid gap-2">
              {options.map((item) => (
                <button key={item.key} onClick={() => { onSelect(item.key); setOpen(false); }} className={cn("flex items-center justify-between rounded-2xl px-3 py-2 text-left text-xs font-semibold transition", selected === item.key ? "bg-amber-300 text-slate-950" : "bg-white/10 text-white hover:bg-white/15")}>
                  <span>{item.label}</span>
                  {selected === item.key && <CheckCircle2 className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="group relative">
        <button aria-label="Change background" onClick={() => setOpen((v) => !v)} className={cn("grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-slate-950/85 text-amber-200 shadow-2xl backdrop-blur-xl transition hover:scale-105 hover:bg-white/10", open && "bg-amber-300 text-slate-950")}>
          <ImageIcon className="h-5 w-5" />
        </button>
        <div className="pointer-events-none absolute bottom-1/2 right-14 translate-y-1/2 whitespace-nowrap rounded-full border border-white/10 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl backdrop-blur-xl transition group-hover:opacity-100">
          Change background
        </div>
      </div>
    </div>
  );
}

function Navbar({ active, setActive, items, signedInUser, onSignOut }: { active: string; setActive: (id: string) => void; items: Array<{ id: string; label: string }>; signedInUser: NDIUser | null; onSignOut: () => void }) {
  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
      <Section className="flex h-16 items-center justify-between">
        <button onClick={() => setActive("home")} className="flex items-center gap-3 text-left">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-black tracking-wide text-white">Sora</div>
            <div className="text-xs text-slate-400">NDI-ready credential platform</div>
          </div>
        </button>

        <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 lg:flex">
          {items.map((item) => (
            <button key={item.id} onClick={() => setActive(item.id)} className={cn("rounded-full px-4 py-2 text-sm transition", active === item.id ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white")}>
              {item.label}
            </button>
          ))}
        </div>

        {signedInUser ? (
          <button onClick={onSignOut} className="hidden rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15 md:inline-flex">Sign Out</button>
        ) : (
          <button onClick={() => setActive("signin")} className="hidden rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:scale-[1.02] md:inline-flex">Sign In</button>
        )}
      </Section>
    </div>
  );
}

function MobileNav({ active, setActive, items }: { active: string; setActive: (id: string) => void; items: Array<{ id: string; label: string }> }) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-3xl border border-white/10 bg-slate-950/85 p-2 shadow-2xl backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
        {items.map((item) => (
          <button key={item.id} onClick={() => setActive(item.id)} className={cn("rounded-2xl px-2 py-2 text-xs transition", active === item.id ? "bg-white text-slate-950" : "text-slate-300")}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StandardPage({ eyebrow, title, description, icon: Icon, children }: { eyebrow: string; title: string; description: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen overflow-hidden pt-16">
      <Section className="py-16 sm:py-20">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-10 max-w-3xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300/15 text-amber-200"><Icon className="h-6 w-6" /></div>
            <Pill tone="amber">{eyebrow}</Pill>
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 text-lg leading-8 text-slate-300">{description}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}>{children}</motion.div>
      </Section>
    </div>
  );
}

function HomePage({ setActive }: { setActive: (id: string) => void }) {
  const cards = [
    { icon: WalletCards, title: "User / Holder Portal", body: "Students sign in with Bhutan NDI, scan their Student ID QR, select academic credential QR, and apply for opportunities." },
    { icon: Building2, title: "Issuer Portal", body: "Institutions use their DID to generate and issue Student IDs and academic credentials to students." },
    { icon: SearchCheck, title: "Verifier / Interviewer Portal", body: "Opportunity providers convert grades into their own required marking system and check credential proofs." },
  ];

  return (
    <div className="relative z-10 min-h-screen overflow-hidden pt-16">
      <Section className="grid min-h-[calc(100vh-4rem)] items-center gap-10 py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div className="mb-6 flex flex-wrap gap-2"><Pill tone="amber">Bhutan context</Pill><Pill tone="green">NDI sign in</Pill><Pill tone="blue">Three role portals</Pill></div>
          <h1 className="max-w-4xl text-5xl font-black leading-tight tracking-tight sm:text-6xl lg:text-7xl">Sora connects students, issuers, and opportunity providers.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">After Bhutan NDI sign in, each role sees only the correct workspace: users apply with Student ID and academic credential QR codes, issuers issue credentials using DID, and verifiers convert grades for screening.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => setActive("signin")} className="group inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3 font-bold text-slate-950 transition hover:scale-[1.02] hover:bg-amber-200">Sign in with Bhutan NDI <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></button>
            <button onClick={() => setActive("signin")} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-6 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/15">Choose user, issuer, or verifier</button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }}>
          <GlassCard>
            <div className="mb-5 flex items-center justify-between">
              <div><p className="text-sm text-slate-300">Role-based access</p><h3 className="mt-1 text-2xl font-black">NDI Login Gateway</h3></div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><ShieldCheck className="h-7 w-7" /></div>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <InfoLine label="Before sign in" value="Home + Sign In only" />
              <InfoLine label="User login" value="Student ID QR + academic credential QR + applications" />
              <InfoLine label="Issuer login" value="Issue Student ID and academic credentials with DID" />
              <InfoLine label="Verifier login" value="Grade conversion + credential checking" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {cards.map((card) => <SmallCard key={card.title} {...card} />)}
            </div>
          </GlassCard>
        </motion.div>
      </Section>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-6 border-b border-white/5 pb-3 last:border-0 last:pb-0"><span className="text-sm text-slate-400">{label}</span><span className="text-right text-sm font-semibold text-white">{value}</span></div>;
}

function SmallCard({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><Icon className="mb-3 h-5 w-5 text-amber-200" /><h4 className="font-bold">{title}</h4><p className="mt-2 text-xs leading-5 text-slate-300">{body}</p></div>;
}

function SignInPage({ signedInUser, onSignIn, onSignOut, setActive }: { signedInUser: NDIUser | null; onSignIn: (user: NDIUser) => void; onSignOut: () => void; setActive: (id: string) => void }) {
  const [role, setRole] = useState<Role>("user");
  const [state, setState] = useState<"idle" | "scanning" | "consent" | "verified">(signedInUser ? "verified" : "idle");
  const account = role === "issuer" ? demoIssuer : role === "verifier" ? demoVerifier : demoUser;
  const requestedFields = role === "issuer" ? ["Organisation", "Issuer DID", "Officer"] : role === "verifier" ? ["Organisation", "Verifier DID", "Officer"] : ["Name", "CID", "Phone", "Email", "Student ID", "Credential"];
  const qrPayload = JSON.stringify({ type: role === "issuer" ? "SoraIssuerLogin" : role === "verifier" ? "SoraVerifierLogin" : "SoraUserLogin", role, requestedFields });

  function roleHome(nextRole: Role) {
    if (nextRole === "issuer") return "issuer";
    if (nextRole === "verifier") return "verifier";
    return "opportunities";
  }

  function roleLabel(nextRole: Role) {
    if (nextRole === "issuer") return "Issuer / Institution";
    if (nextRole === "verifier") return "Verifier / Interviewer";
    return "User / Applicant";
  }

  function startScan() {
    setState("scanning");
    window.setTimeout(() => setState("consent"), 700);
  }

  function approve() {
    onSignIn(account);
    setState("verified");
    setActive(roleHome(role));
  }

  return (
    <StandardPage eyebrow="Bhutan NDI sign in" title="Sign in first, then access the correct portal." description="Users, issuers, and opportunity providers enter different workspaces after the NDI proof confirms their role." icon={ShieldCheck}>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <RoleButton active={role === "user"} icon={WalletCards} title="User / Applicant" body="Scan Student ID QR, select academic credential QR, and apply for jobs or scholarships." onClick={() => { setRole("user"); setState("idle"); }} />
        <RoleButton active={role === "issuer"} icon={Building2} title="Issuer / Institution" body="Generate and issue Student IDs and academic credentials using institutional DID." onClick={() => { setRole("issuer"); setState("idle"); }} />
        <RoleButton active={role === "verifier"} icon={SearchCheck} title="Verifier / Interviewer" body="Convert candidate marks into your own marking system and verify proofs." onClick={() => { setRole("verifier"); setState("idle"); }} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard>
          <div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl font-black">Scan to Sign In</h3><p className="mt-2 text-sm leading-6 text-slate-300">Scan with Bhutan NDI Wallet and approve only the required fields.</p></div><Pill tone={signedInUser ? "green" : role === "issuer" ? "amber" : role === "verifier" ? "blue" : "green"}>{signedInUser ? "Signed In" : roleLabel(role)}</Pill></div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-3xl bg-white p-5 text-slate-950 shadow-2xl"><QRCodeCanvas value={qrPayload} size={250} level="M" includeMargin className="h-full w-full" /><p className="mt-3 text-center text-xs font-bold text-slate-700">Scan with Bhutan NDI Wallet</p></div>
            <div className="space-y-3"><PipelineStep active={state !== "idle"} label="1. QR request generated" detail="Sora creates a role-specific sign-in proof request." /><PipelineStep active={state === "scanning" || state === "consent" || state === "verified"} label="2. Scan with phone" detail="The user scans the QR code using the NDI app." /><PipelineStep active={state === "consent" || state === "verified"} label="3. Consent requested" detail="The wallet asks for permission to share only the requested fields." /><PipelineStep active={state === "verified"} label="4. Correct portal unlocked" detail={`${roleLabel(role)} workspace is opened.`} /></div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {!signedInUser ? <button onClick={startScan} className="rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-200">Simulate QR Scan</button> : <button onClick={() => setActive(roleHome(signedInUser.role))} className="rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-200">Continue to portal</button>}
            <button onClick={() => { onSignOut(); setState("idle"); }} className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/15">Clear Session</button>
          </div>
        </GlassCard>

        <GlassCard>
          <AnimatePresence mode="wait">
            {!signedInUser && state !== "consent" && <motion.div key="intro" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><h3 className="text-2xl font-black">What happens after login?</h3><p className="mt-3 text-sm leading-7 text-slate-300">Sora uses the NDI proof to decide which workspace to open.</p><div className="mt-6 space-y-3"><CheckLine text="User login: Student ID QR, academic credential QR, and opportunity applications" /><CheckLine text="Issuer login: Student ID and academic credential issuing dashboard" /><CheckLine text="Verifier login: grade conversion and credential verification workspace" /></div></motion.div>}
            {!signedInUser && state === "consent" && <motion.div key="consent" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><Pill tone="amber">Wallet Consent</Pill><h3 className="mt-4 text-2xl font-black">Approve information sharing</h3><div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label={role === "user" ? "Full Name" : "Officer"} value={account.fullName} /><Info label={role === "user" ? "CID" : "Organisation ID"} value={account.cid} /><Info label="Email" value={account.email} /><Info label={role === "issuer" ? "Issuer DID" : role === "verifier" ? "Verifier DID" : "Student / Credential ID"} value={account.issuerDid || account.verifiedCredentialId} /></div><button onClick={approve} className="mt-6 w-full rounded-2xl bg-emerald-300 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-200">Approve and Enter Portal</button></motion.div>}
            {signedInUser && <motion.div key="profile" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><Pill tone="green">Verified {signedInUser.role === "issuer" ? "Issuer" : signedInUser.role === "verifier" ? "Verifier" : "User"}</Pill><h3 className="mt-4 text-3xl font-black">{signedInUser.organisationName || signedInUser.fullName}</h3><div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label="Role" value={roleLabel(signedInUser.role)} /><Info label="Phone" value={signedInUser.phone} /><Info label="Email" value={signedInUser.email} /><Info label="Wallet DID" value={signedInUser.walletId} /></div></motion.div>}
          </AnimatePresence>
        </GlassCard>
      </div>
    </StandardPage>
  );
}

function RoleButton({ active, icon: Icon, title, body, onClick }: { active: boolean; icon: React.ElementType; title: string; body: string; onClick: () => void }) {
  return <button onClick={onClick} className={cn("rounded-3xl border p-5 text-left transition", active ? "border-amber-300/40 bg-amber-300/10" : "border-white/10 bg-white/5 hover:bg-white/10")}><Icon className="mb-3 h-6 w-6 text-amber-200" /><h3 className="text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{body}</p></button>;
}

function PipelineStep({ active, label, detail, warning = false }: { active: boolean; label: string; detail: string; warning?: boolean }) {
  return <div className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"><div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", warning ? "bg-red-300/15 text-red-300" : active ? "bg-emerald-300/15 text-emerald-300" : "bg-white/10 text-slate-400")}>{warning ? <Ban className="h-5 w-5" /> : active ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</div><div><p className="font-bold text-white">{label}</p><p className="mt-1 break-all text-sm leading-6 text-slate-300">{detail}</p></div></div>;
}

function Metric({ icon: Icon, label, value, warning = false }: { icon: React.ElementType; label: string; value: string; warning?: boolean }) {
  return <div className={cn("rounded-3xl border p-4 backdrop-blur-xl", warning ? "border-red-300/20 bg-red-400/10" : "border-amber-300/15 bg-amber-300/10")}><Icon className={cn("mb-3 h-5 w-5", warning ? "text-red-300" : "text-amber-200")} /><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>;
}

function IssuerPage() {
  const initialRecords: IssuerRecord[] = [
    { id: "SORA-BT-2026-001", name: "Karma Dorji", cid: "11508001234", qualification: "Bachelor of Civil Engineering", programme: "Civil Engineering", category: "Bachelor Degree", grade: "72%", status: "Active", issuedDate: "2026-05-12", hash: "0xa9f103bbc301f9aa9f103bbc" },
    { id: "SORA-BT-2026-002", name: "Sonam Choden", cid: "11204009876", qualification: "Bachelor of Commerce", programme: "Accounting and Finance", category: "Bachelor Degree", grade: "68%", status: "Active", issuedDate: "2026-05-10", hash: "0xbb18fc99c91fc81bbb18fc99" },
    { id: "SORA-BT-2026-003", name: "Tashi Namgyel", cid: "10203005678", qualification: "Diploma in Information Technology", programme: "Information Technology", category: "Diploma", grade: "61%", status: "Revoked", issuedDate: "2026-05-08", hash: "0xc92f88111188f29cc92f8811" },
    { id: "SID-BT-2026-004", name: "Pema Wangmo", cid: "10906004567", qualification: "Student ID", programme: "Student Identity", category: "Student ID", grade: "Active", status: "Active", issuedDate: "2026-05-06", hash: "0xdab943222349baddab943222" },
  ];

  const [tab, setTab] = useState<"registry" | "issue">("registry");
  const [records, setRecords] = useState<IssuerRecord[]>(initialRecords);
  const [selectedId, setSelectedId] = useState(initialRecords[0].id);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [studentName, setStudentName] = useState("Karma Dorji");
  const [studentId, setStudentId] = useState("11508001234");
  const [qualification, setQualification] = useState("Bachelor of Civil Engineering");
  const [programme, setProgramme] = useState("Civil Engineering");
  const [credentialKind, setCredentialKind] = useState("Academic Credential");
  const [scale, setScale] = useState("percentage");
  const [marks, setMarks] = useState(72);

  const conversion = convertMarks(scale, marks);
  const newId = credentialKind === "Student ID" ? `SID-BT-2026-${String(records.length + 1).padStart(3, "0")}` : `SORA-BT-2026-${String(records.length + 1).padStart(3, "0")}`;
  const hash = mockHash(`${studentName}-${studentId}-${qualification}-${marks}`);
  const filtered = records.filter((r) => `${r.id} ${r.name} ${r.cid} ${r.qualification} ${r.programme}`.toLowerCase().includes(search.toLowerCase()) && (category === "All" || r.category === category) && (status === "All" || r.status === status));
  const selected = records.find((r) => r.id === selectedId) || filtered[0] || records[0];

  function issueCredential() {
    const isStudentId = credentialKind === "Student ID";
    const newRecord: IssuerRecord = { id: newId, name: studentName, cid: studentId, qualification: isStudentId ? "Student ID" : qualification, programme: isStudentId ? "Student Identity" : programme, category: isStudentId ? "Student ID" : qualification.toLowerCase().includes("diploma") ? "Diploma" : qualification.toLowerCase().includes("certificate") ? "Training Certificate" : "Bachelor Degree", grade: isStudentId ? "Active" : scale === "percentage" ? `${marks}%` : scale === "gpa4" ? `GPA ${marks} / 4` : `CGPA ${marks} / 10`, status: "Active", issuedDate: new Date().toISOString().slice(0, 10), hash };
    setRecords((list) => [newRecord, ...list]);
    setSelectedId(newRecord.id);
    setTab("registry");
  }

  function setRecordStatus(id: string, nextStatus: "Active" | "Revoked") {
    setRecords((list) => list.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
  }

  return (
    <StandardPage eyebrow="Issuer dashboard" title="Institution portal for Student IDs and academic credentials." description="Authorised issuers use their DID to generate Student ID credentials and academic credentials, then manage revocation and reinstatement." icon={Building2}>
      <div className="mb-6 grid gap-4 md:grid-cols-4"><Metric icon={Building2} label="Total Issued" value={String(records.length)} /><Metric icon={FileCheck2} label="Active" value={String(records.filter((r) => r.status === "Active").length)} /><Metric icon={Ban} label="Revoked" value={String(records.filter((r) => r.status === "Revoked").length)} warning /><Metric icon={KeyRound} label="Student IDs" value={String(records.filter((r) => r.category === "Student ID").length)} /></div>
      <GlassCard className="mb-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-2xl font-black">Royal University of Bhutan</h3><p className="mt-2 text-sm text-slate-300">Trusted issuer account: <span className="font-mono text-amber-200">did:bt:rub:issuer-001</span></p></div><div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/10 bg-white/5 p-2"><button onClick={() => setTab("registry")} className={cn("rounded-2xl px-4 py-3 text-sm font-black transition", tab === "registry" ? "bg-amber-300 text-slate-950" : "text-white hover:bg-white/10")}>Registry Management</button><button onClick={() => setTab("issue")} className={cn("rounded-2xl px-4 py-3 text-sm font-black transition", tab === "issue" ? "bg-amber-300 text-slate-950" : "text-white hover:bg-white/10")}>Issue Student ID / Academic</button></div></div></GlassCard>

      {tab === "registry" ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <GlassCard><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h3 className="text-2xl font-black">Credential Registry</h3><p className="mt-2 text-sm text-slate-300">Search and manage all credentials issued by this institution.</p></div><button onClick={() => setTab("issue")} className="rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950">+ Issue Credential</button></div><div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]"><SearchBox value={search} onChange={setSearch} /><SelectBox label="Category" value={category} onChange={setCategory} options={["All", "Student ID", "Bachelor Degree", "Diploma", "Training Certificate"]} /><SelectBox label="Status" value={status} onChange={setStatus} options={["All", "Active", "Revoked"]} /></div><div className="mt-6 space-y-3">{filtered.map((record) => <button key={record.id} onClick={() => setSelectedId(record.id)} className={cn("w-full rounded-2xl border p-4 text-left transition hover:bg-white/10", selected.id === record.id ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/5")}><div className="flex items-start justify-between gap-4"><div><p className="font-bold text-white">{record.name}</p><p className="mt-1 font-mono text-xs text-slate-400">{record.id}</p><p className="mt-2 text-sm text-slate-300">{record.qualification}</p></div><Pill tone={record.status === "Active" ? "green" : "red"}>{record.status}</Pill></div></button>)}</div></GlassCard>
          <GlassCard><div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl font-black">Credential Details</h3><p className="mt-2 text-sm text-slate-300">Review proof details and revocation status.</p></div><Pill tone={selected.status === "Active" ? "green" : "red"}>{selected.status}</Pill></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label="Student" value={selected.name} /><Info label="CID" value={selected.cid} /><Info label="Credential ID" value={selected.id} /><Info label="Issued Date" value={selected.issuedDate} /><Info label="Programme" value={selected.programme} /><Info label="Grade" value={selected.grade} /></div><pre className="mt-5 overflow-x-auto rounded-3xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-slate-200">{JSON.stringify({ credentialId: selected.id, issuerDid: "did:bt:rub:issuer-001", documentHash: selected.hash, status: selected.status }, null, 2)}</pre><div className="mt-6 grid gap-3 sm:grid-cols-2"><button disabled={selected.status === "Revoked"} onClick={() => setRecordStatus(selected.id, "Revoked")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-400 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Ban className="h-4 w-4" />Revoke</button><button disabled={selected.status === "Active"} onClick={() => setRecordStatus(selected.id, "Active")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"><RotateCcw className="h-4 w-4" />Reinstate</button></div></GlassCard>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <GlassCard><h3 className="text-2xl font-black">Issue Student ID or Academic Credential</h3><p className="mt-2 text-sm leading-6 text-slate-300">The issuer DID signs the credential proof. Students receive a QR they can present when applying for jobs or scholarships.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><SelectBox label="Credential Type" value={credentialKind} onChange={setCredentialKind} options={["Student ID", "Academic Credential"]} /><InputField label="Student Name" value={studentName} onChange={setStudentName} /><InputField label="CID / Student ID" value={studentId} onChange={setStudentId} /><InputField label="Qualification" value={credentialKind === "Student ID" ? "Student ID" : qualification} onChange={setQualification} /><InputField label="Programme" value={credentialKind === "Student ID" ? "Student Identity" : programme} onChange={setProgramme} /></div><div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5"><h4 className="font-black">Marks / Grade Conversion</h4><div className="mt-4 grid gap-4 sm:grid-cols-2"><SelectBox label="Original Scale" value={scale} onChange={setScale} options={["percentage", "gpa4", "cgpa10"]} /><label><span className="mb-2 block text-sm font-semibold text-slate-300">Original Value</span><input type="number" value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none" /></label></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><Info label="Percentage" value={conversion.percentage} /><Info label="GPA 4.0" value={conversion.gpa4} /><Info label="CGPA 10.0" value={conversion.gpa10} /><Info label="Division" value={conversion.division} /></div></div><div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-white/5 p-5"><div className="flex items-center gap-3"><Upload className="h-5 w-5 text-amber-200" /><div><p className="font-bold">Upload Certificate / Transcript</p><p className="text-sm text-slate-400">Demo mode: hash is generated from entered credential data.</p></div></div></div><button onClick={issueCredential} className="mt-6 w-full rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950">Issue Credential and Register Proof</button></GlassCard>
          <GlassCard><h3 className="text-2xl font-black">Proof Preview</h3><pre className="mt-6 overflow-x-auto rounded-3xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-slate-200">{JSON.stringify({ credentialId: newId, credentialType: credentialKind, issuerDid: "did:bt:rub:issuer-001", documentHash: hash, status: "Active", convertedGrade: credentialKind === "Student ID" ? "Not required" : conversion.division }, null, 2)}</pre><div className="mt-6 space-y-3"><PipelineStep active label="1. Validate trusted issuer" detail="Issuer DID is checked against trusted issuer registry." /><PipelineStep active label="2. Prepare credential data" detail={credentialKind === "Student ID" ? "Student ID proof is generated without academic marks." : `${marks} converted to ${conversion.percentage}, GPA ${conversion.gpa4}, ${conversion.division}.`} /><PipelineStep active label="3. Generate credential ID" detail={newId} /><PipelineStep active label="4. Register proof" detail="Proof will be registered in the credential registry mock." /></div></GlassCard>
        </div>
      )}
    </StandardPage>
  );
}

function convertMarks(scale: string, value: number) {
  let percentage = value;
  if (scale === "gpa4") percentage = (value / 4) * 100;
  if (scale === "cgpa10") percentage = value * 10;
  const gpa4 = Math.min(4, Math.max(0, (percentage / 100) * 4));
  const gpa10 = Math.min(10, Math.max(0, percentage / 10));
  const division = percentage >= 70 ? "First Division" : percentage >= 60 ? "Upper Second Division" : percentage >= 50 ? "Second Division" : percentage >= 40 ? "Pass" : "Review Required";
  return { percentage: `${percentage.toFixed(1)}%`, percentageValue: percentage, gpa4: gpa4.toFixed(2), gpa10: gpa10.toFixed(2), division };
}

function mockHash(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash << 5) - hash + seed.charCodeAt(i);
  const clean = Math.abs(hash).toString(16).padStart(8, "0");
  return `0x${clean}${clean.split("").reverse().join("")}${clean}`;
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-2 block text-sm font-semibold text-slate-300">Search</span><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><SearchCheck className="h-4 w-4 text-amber-200" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search name, CID, credential ID" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" /></div></label>;
}

function SelectBox({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label><span className="mb-2 block text-sm font-semibold text-slate-300">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-2 block text-sm font-semibold text-slate-300">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-amber-300/50" /></label>;
}

function OpportunitiesPage({ signedInUser, setActive }: { signedInUser: NDIUser | null; setActive: (id: string) => void }) {
  const opportunities = [
    { id: "OPP-SCH-001", type: "Scholarship", title: "National Engineering Scholarship", provider: "Department of Higher Education", location: "Bhutan / India", deadline: "30 June 2026", level: "Bachelor / Master", eligibility: "Verified Class XII or Bachelor credential with First Division or equivalent.", description: "For Bhutanese students pursuing engineering, infrastructure, technology, or planning-related degrees.", requiredCredential: "Academic transcript or degree certificate", requiredCredentialType: "Engineering Degree" },
    { id: "OPP-JOB-002", type: "Job", title: "Graduate Civil Engineer", provider: "Bhutan Infrastructure Consultancy", location: "Thimphu / Project Sites", deadline: "15 July 2026", level: "Entry Level", eligibility: "Bachelor's Degree in Civil Engineering or equivalent.", description: "A graduate opportunity for civil engineering candidates interested in roads, drainage, water, and construction supervision.", requiredCredential: "Degree certificate and transcript", requiredCredentialType: "Civil Engineering Degree" },
    { id: "OPP-INT-003", type: "Internship", title: "Digital Public Infrastructure Internship", provider: "GovTech / Innovation Partner", location: "Thimphu / Hybrid", deadline: "05 August 2026", level: "Student / Graduate", eligibility: "Verified student credential or recent graduate certificate.", description: "For students interested in digital identity, verifiable credentials, blockchain, and public service innovation.", requiredCredential: "Student ID or academic credential", requiredCredentialType: "Student or Graduate Academic Credential" },
    { id: "OPP-TRN-004", type: "Training", title: "Construction Safety and Project Management Training", provider: "Accredited Training Institute", location: "Phuentsholing / Online", deadline: "Rolling Intake", level: "Professional Certificate", eligibility: "Open to students, technicians, site supervisors, and junior engineers.", description: "Short training for project site readiness.", requiredCredential: "CID or student/professional ID", requiredCredentialType: "Identity or Training Credential" },
  ];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(opportunities[0].id);
  const [mode, setMode] = useState<"info" | "form" | "qr">("info");
  const [submitted, setSubmitted] = useState(false);
  const selected = opportunities.find((o) => o.id === selectedId) || opportunities[0];
  const [studentIdConfirmed, setStudentIdConfirmed] = useState(false);
  const studentIdQrPayload = JSON.stringify({ type: "SoraStudentIDRequest", holderDid: signedInUser?.walletId || "guest", requestedFor: selected.id, message: "Present Student ID QR before selecting academic credentials" });
  const academicQrPayload = JSON.stringify({ type: "SoraAcademicCredentialRequest", holderDid: signedInUser?.walletId || "guest", opportunityId: selected.id, requiredCredentialType: selected.requiredCredentialType });
  const filtered = opportunities.filter((o) => `${o.type} ${o.title} ${o.provider} ${o.location}`.toLowerCase().includes(search.toLowerCase()) && (filter === "All" || o.type === filter));
  const matches = credentials.filter((c) => c.status === "Verified" && !c.revoked && credentialMatches(c, selected.requiredCredentialType));
  const blocked = credentials.filter((c) => !matches.some((m) => m.id === c.id));
  const qrPayload = JSON.stringify({ type: "SoraOpportunityApplication", opportunityId: selected.id, title: selected.title, requiredCredentialType: selected.requiredCredentialType });

  return (
    <StandardPage eyebrow="Opportunities portal" title="Explore opportunities before applying." description="Browse scholarships, jobs, internships, and training, then apply on the website or scan a QR code to continue on phone." icon={Landmark}>
      <div className="mb-6 grid gap-4 md:grid-cols-4"><Metric icon={GraduationCap} label="Scholarships" value="1" /><Metric icon={BriefcaseBusiness} label="Jobs" value="1" /><Metric icon={ClipboardCheck} label="Internships" value="1" /><Metric icon={FileCheck2} label="Training" value="1" /></div>
      {signedInUser && <GlassCard className="mb-6"><div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><div><Pill tone={studentIdConfirmed ? "green" : "amber"}>{studentIdConfirmed ? "Student ID Confirmed" : "Step 1 Required"}</Pill><h3 className="mt-4 text-2xl font-black">Application QR flow</h3><p className="mt-2 text-sm leading-7 text-slate-300">Before applying, Sora first asks the applicant to present a Student ID QR generated by the website. After that, Sora requests only the academic credential QR needed for the selected opportunity.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => setStudentIdConfirmed(true)} className="rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950">Simulate Student ID Scan</button><button onClick={() => setStudentIdConfirmed(false)} className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-black text-white">Reset QR Flow</button></div></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-3xl bg-white p-4 text-slate-950"><QRCodeCanvas value={studentIdQrPayload} size={180} level="M" includeMargin className="h-full w-full" /><p className="mt-2 text-center text-xs font-bold text-slate-700">Student ID QR</p></div><div className={cn("rounded-3xl p-4 text-slate-950", studentIdConfirmed ? "bg-white" : "bg-white/40 opacity-60")}><QRCodeCanvas value={academicQrPayload} size={180} level="M" includeMargin className="h-full w-full" /><p className="mt-2 text-center text-xs font-bold text-slate-700">Academic Credential QR</p></div></div></div></GlassCard>}
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard><h3 className="text-2xl font-black">Find an Opportunity</h3><div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]"><SearchBox value={search} onChange={setSearch} /><SelectBox label="Category" value={filter} onChange={setFilter} options={["All", "Scholarship", "Job", "Internship", "Training"]} /></div><div className="mt-6 space-y-3">{filtered.map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); setMode("info"); setSubmitted(false); }} className={cn("w-full rounded-3xl border p-4 text-left transition hover:bg-white/10", selected.id === item.id ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/5")}><div className="flex justify-between gap-4"><div><Pill tone={item.type === "Job" ? "green" : item.type === "Scholarship" ? "amber" : "blue"}>{item.type}</Pill><h4 className="mt-3 text-lg font-black">{item.title}</h4><p className="mt-1 text-sm text-slate-300">{item.provider}</p></div><div className="text-right text-xs text-slate-300"><p>{item.location}</p><p className="mt-1 text-amber-100">{item.deadline}</p></div></div></button>)}</div></GlassCard>
        <GlassCard>
          <AnimatePresence mode="wait">
            {mode === "info" && <motion.div key="info" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Pill tone="amber">{selected.type}</Pill><h3 className="mt-4 text-3xl font-black">{selected.title}</h3><p className="mt-2 text-slate-300">{selected.provider}</p><p className="mt-6 text-base leading-8 text-slate-200">{selected.description}</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label="Location" value={selected.location} /><Info label="Level" value={selected.level} /><Info label="Eligibility" value={selected.eligibility} /><Info label="Required Credential" value={selected.requiredCredential} /></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={() => setMode("form")} className="rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950">Apply on this website</button><button onClick={() => setMode("qr")} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-black text-white"><QrCode className="h-4 w-4 text-amber-200" />Scan QR to apply</button></div></motion.div>}
            {mode === "form" && <motion.div key="form" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><button onClick={() => setMode("info")} className="mb-4 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white">Back</button><h3 className="text-2xl font-black">Apply for {selected.title}</h3>{signedInUser ? <VerifiedProfile user={signedInUser} matches={matches} blocked={blocked} required={selected.requiredCredentialType} /> : <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5"><h4 className="font-black text-amber-50">Sign in with NDI for faster application</h4><p className="mt-2 text-sm text-amber-100">Avoid manually entering CID, name, and contact details.</p><button onClick={() => setActive("signin")} className="mt-4 rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950">Sign in with Bhutan NDI</button></div>}<div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5"><div className="flex items-center gap-3"><Upload className="h-5 w-5 text-amber-200" /><div><p className="font-bold">Attach certificate or credential package</p><p className="text-sm text-slate-400">Sora will check authenticity, revocation, grade conversion, and equivalency.</p></div></div></div><button onClick={() => setSubmitted(true)} className="mt-6 w-full rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950">Submit Application</button>{submitted && <div className="mt-6 space-y-3"><CheckLine text="Application received" /><CheckLine text="Credential match checked" /><CheckLine text="Issuer trust and status verified" /></div>}</motion.div>}
            {mode === "qr" && <motion.div key="qr" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><button onClick={() => setMode("info")} className="mb-4 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white">Back</button><h3 className="text-2xl font-black">Scan to apply on your phone</h3><div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="rounded-3xl bg-white p-5 text-slate-950"><QRCodeCanvas value={qrPayload} size={240} level="M" includeMargin className="h-full w-full" /><p className="mt-3 text-center text-xs font-bold text-slate-700">Scan to apply</p></div><div className="space-y-3"><Info label="Opportunity" value={selected.title} /><Info label="Provider" value={selected.provider} /><Info label="Required Credential" value={selected.requiredCredential} /></div></div></motion.div>}
          </AnimatePresence>
        </GlassCard>
      </div>
    </StandardPage>
  );
}

function credentialMatches(credential: Credential, required: string) {
  const text = `${credential.qualification} ${credential.equivalent} ${credential.method}`.toLowerCase();
  const req = required.toLowerCase();
  if (req.includes("civil engineering")) return text.includes("civil") && text.includes("engineering");
  if (req.includes("engineering")) return text.includes("engineering") || text.includes("bachelor");
  if (req.includes("training")) return text.includes("certificate") || text.includes("training") || text.includes("bachelor");
  return text.includes("bachelor") || text.includes("diploma") || text.includes("credential");
}

function VerifiedProfile({ user, matches, blocked, required }: { user: NDIUser; matches: Credential[]; blocked: Credential[]; required: string }) {
  return <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-300" /><div><p className="font-black text-emerald-50">Verified NDI profile attached</p><p className="text-sm text-emerald-100">Name, CID, Student ID, contact details, and selected credential ID are pre-filled.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Full Name" value={user.fullName} /><Info label="CID" value={user.cid} /><Info label="Email / Phone" value={`${user.email} / ${user.phone}`} /><Info label="Student ID" value={`SID-${user.cid}`} /><Info label="Credential ID" value={user.verifiedCredentialId} /></div><div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/40 p-4"><p className="font-black text-white">Required credential match</p><p className="mt-1 text-sm text-slate-300">This opportunity requires: {required}. Only matching credentials will be attached.</p><div className="mt-4 space-y-3">{matches.length > 0 ? matches.map((credential) => <div key={credential.id} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4"><p className="font-bold text-emerald-50">{credential.qualification}</p><p className="mt-1 text-xs text-emerald-100">{credential.id} · {credential.issuer}</p></div>) : <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">No suitable verified credential found.</div>}</div>{blocked.length > 0 && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Not attached</p><div className="mt-3 space-y-2">{blocked.map((credential) => <div key={credential.id} className="flex items-center justify-between gap-3 text-xs text-slate-300"><span>{credential.qualification}</span><span className="rounded-full bg-white/10 px-2 py-1">Not required</span></div>)}</div></div>}</div></div>;
}

function CredentialsPage() {
  const [selected, setSelected] = useState(credentials[0]);
  const [origin, setOrigin] = useState("https://sora.bt");
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const studentQrRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const studentIdPayload = JSON.stringify({ type: "SoraStudentIDShare", studentId: `SID-${selected.cid}`, holder: selected.name, verificationLink: `${origin}/verify?studentId=SID-${selected.cid}` });
  const qrPayload = JSON.stringify({ type: "SoraCredentialShare", credentialId: selected.id, holder: selected.name, issuer: selected.issuer, qualification: selected.qualification, verificationLink: `${origin}/verify?credentialId=${selected.id}` });

  async function downloadQR() {
    const canvas = qrRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selected.id}-qr-code.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  async function shareQR() {
    const canvas = qrRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `${selected.id}-qr-code.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: selected.qualification, files: [file] });
      else await downloadQR();
    });
  }

  return (
    <StandardPage eyebrow="Student wallet" title="Hold Student ID and academic credentials as QR codes." description="The holder cannot create or revoke credentials. They can only present Student ID and academic credential QR codes with consent." icon={WalletCards}>
      <GlassCard className="mb-6"><div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]"><div><Pill tone="green">Student ID QR</Pill><h3 className="mt-4 text-2xl font-black">Website-generated Student ID request</h3><p className="mt-2 text-sm leading-7 text-slate-300">This QR represents the Student ID proof the user presents first before sharing academic credentials for an opportunity.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Student" value={selected.name} /><Info label="Student ID" value={`SID-${selected.cid}`} /></div></div><div className="rounded-3xl border border-white/10 bg-white p-5 text-slate-950 shadow-2xl"><QRCodeCanvas ref={studentQrRef} value={studentIdPayload} size={220} level="M" includeMargin className="h-full w-full" /><p className="mt-3 text-center text-xs font-bold text-slate-700">Scan Student ID QR</p></div></div></GlassCard>
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <GlassCard><h3 className="text-xl font-black">My Credentials</h3><div className="mt-5 space-y-3">{credentials.map((c) => <button key={c.id} onClick={() => setSelected(c)} className={cn("w-full rounded-2xl border p-4 text-left transition", selected.id === c.id ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/5 hover:bg-white/10")}><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{c.name}</p><p className="mt-1 text-xs text-slate-400">{c.id}</p><p className="mt-2 text-xs text-slate-300">{c.qualification}</p></div><StatusIcon status={c.status} /></div></button>)}</div></GlassCard>
        <GlassCard><div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]"><div><Pill tone={selected.status === "Verified" ? "green" : "red"}>{selected.status}</Pill><h3 className="mt-4 text-3xl font-black">{selected.qualification}</h3><p className="mt-2 text-slate-300">Issued to {selected.name}</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label="Credential ID" value={selected.id} /><Info label="Issuer" value={selected.issuer} /><Info label="Original Grade" value={selected.grade} /><Info label="Bhutan Equivalent" value={selected.equivalent} /></div></div><div className="rounded-3xl border border-white/10 bg-white p-5 text-slate-950 shadow-2xl"><QRCodeCanvas ref={qrRef} value={qrPayload} size={220} level="M" includeMargin className="h-full w-full" /><p className="mt-3 text-center text-xs font-bold text-slate-700">Scan to verify credential</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><ActionButton icon={Share2} label="Share QR Image" onClick={shareQR} /><ActionButton icon={Download} label="Download QR PNG" onClick={downloadQR} /><ActionButton icon={Download} label="Download Package" onClick={() => {}} /></div></GlassCard>
      </div>
    </StandardPage>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15"><Icon className="h-4 w-4 text-amber-200" />{label}</button>;
}

function getTargetEquivalent(conversion: ReturnType<typeof convertMarks>, target: string, minimum: number) {
  const percentage = conversion.percentageValue;
  if (target === "percentage") return conversion.percentage;
  if (target === "gpa4") return `GPA ${conversion.gpa4} / 4.0`;
  if (target === "cgpa10") return `CGPA ${conversion.gpa10} / 10`;
  if (target === "division") return conversion.division;
  if (target === "passfail") return percentage >= minimum ? "Meets Requirement" : "Below Requirement";
  return `${conversion.percentage} · GPA ${conversion.gpa4} · ${conversion.division}`;
}

function VerifierPortalPage() {
  const [candidateName, setCandidateName] = useState("Karma Dorji");
  const [sourceScale, setSourceScale] = useState("percentage");
  const [sourceMarks, setSourceMarks] = useState(72);
  const [targetScale, setTargetScale] = useState("gpa4");
  const [minimum, setMinimum] = useState(60);
  const conversion = convertMarks(sourceScale, sourceMarks);
  const targetEquivalent = getTargetEquivalent(conversion, targetScale, minimum);
  const meetsMinimum = conversion.percentageValue >= minimum;

  return (
    <StandardPage eyebrow="Verifier / interviewer workspace" title="Convert applicant marks into your own marking system." description="Opportunity providers can take a candidate's percentage, GPA, CGPA, division, or other score and convert it into the format they use for shortlisting." icon={SearchCheck}>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <GlassCard>
          <div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl font-black">Applicant Mark Conversion</h3><p className="mt-2 text-sm leading-6 text-slate-300">Use this first during screening or interview review. It gives a common reference before the credential proof is checked.</p></div><Pill tone={meetsMinimum ? "green" : "red"}>{meetsMinimum ? "Meets threshold" : "Review required"}</Pill></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><InputField label="Candidate Name" value={candidateName} onChange={setCandidateName} /><SelectBox label="Provided Marking System" value={sourceScale} onChange={setSourceScale} options={["percentage", "gpa4", "cgpa10"]} /><label><span className="mb-2 block text-sm font-semibold text-slate-300">Provided Value</span><input type="number" value={sourceMarks} onChange={(e) => setSourceMarks(Number(e.target.value))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none" /></label><SelectBox label="Convert Into" value={targetScale} onChange={setTargetScale} options={["percentage", "gpa4", "cgpa10", "division", "passfail", "summary"]} /></div>
          <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5"><p className="text-xs font-bold uppercase tracking-wide text-amber-100">Converted result for {candidateName}</p><h3 className="mt-2 text-4xl font-black text-white">{targetEquivalent}</h3><p className="mt-2 text-sm leading-6 text-slate-300">Minimum requirement set by this opportunity provider: {minimum}% equivalent.</p><label className="mt-4 block"><span className="mb-2 block text-sm font-semibold text-slate-300">Minimum Requirement (%)</span><input type="number" value={minimum} onChange={(e) => setMinimum(Number(e.target.value))} className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none" /></label></div>
        </GlassCard>
        <GlassCard>
          <h3 className="text-2xl font-black">Reference Table</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">This gives the interviewer a quick equivalent view from the same submitted mark.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label="Percentage" value={conversion.percentage} /><Info label="GPA 4.0" value={conversion.gpa4} /><Info label="CGPA 10.0" value={conversion.gpa10} /><Info label="Division / Band" value={conversion.division} /></div>
          <div className="mt-6 space-y-3"><PipelineStep active label="1. Read submitted mark" detail={`${sourceMarks} from ${sourceScale}`} /><PipelineStep active label="2. Convert to common base" detail={`${conversion.percentage} equivalent`} /><PipelineStep active={meetsMinimum} warning={!meetsMinimum} label="3. Compare with requirement" detail={meetsMinimum ? "Candidate meets the provider's minimum academic mark." : "Candidate is below the provider's selected threshold."} /><PipelineStep active label="4. Verify proof" detail="Open Credential Check to confirm issuer, holder, status, revocation, and QR proof." /></div>
        </GlassCard>
      </div>
    </StandardPage>
  );
}

function VerifyPage() {
  const [method, setMethod] = useState("ndi");
  const [result, setResult] = useState<Credential | null>(null);
  return <StandardPage eyebrow="Credential check" title="Verify Student ID and academic credential QR proofs." description="Interviewers and opportunity providers can confirm issuer trust, holder match, revocation status, and converted grade before using the result." icon={SearchCheck}><div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><GlassCard><h3 className="text-2xl font-black">Verification Method</h3><div className="mt-5 grid grid-cols-3 gap-2"><button onClick={() => setMethod("ndi")} className={cn("rounded-2xl px-4 py-3 text-sm font-bold", method === "ndi" ? "bg-amber-300 text-slate-950" : "bg-white/10 text-white")}>Bhutan NDI</button><button onClick={() => setMethod("studentid")} className={cn("rounded-2xl px-4 py-3 text-sm font-bold", method === "studentid" ? "bg-amber-300 text-slate-950" : "bg-white/10 text-white")}>Student ID QR</button><button onClick={() => setMethod("pdf")} className={cn("rounded-2xl px-4 py-3 text-sm font-bold", method === "pdf" ? "bg-amber-300 text-slate-950" : "bg-white/10 text-white")}>PDF Upload</button></div><button onClick={() => setResult(credentials[0])} className="mt-6 w-full rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950">Run Verification</button></GlassCard><GlassCard><h3 className="text-2xl font-black">{method === "studentid" ? "Student ID QR Check" : method === "ndi" ? "NDI Verification" : "PDF Verification"}</h3><div className="mt-6 space-y-3"><CheckLine text="Holder identity checked" /><CheckLine text="Issuer trust checked" /><CheckLine text="Credential status and revocation checked" /><CheckLine text="Grade and equivalency converted for the opportunity provider" /></div>{result && <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5"><div className="flex items-center gap-3"><BadgeCheck className="h-6 w-6 text-emerald-300" /><div><p className="font-black">{result.status} Credential</p><p className="text-sm text-emerald-100">{result.equivalent} · {result.converted}</p></div></div></div>}</GlassCard></div></StandardPage>;
}

function NDIPage() {
  return <StandardPage eyebrow="Bhutan NDI-ready flow" title="Wallet-based academic verification with consent." description="This simulated flow shows how Sora can support NDI-style proof requests and wallet-based sharing." icon={ShieldCheck}><div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]"><GlassCard><h3 className="text-2xl font-black">NDI Proof Request</h3><div className="mt-6 grid gap-4 sm:grid-cols-[0.85fr_1.15fr]"><div className="grid place-items-center rounded-3xl bg-white p-5 text-slate-950"><QrCode className="h-32 w-32" /><p className="mt-2 text-center text-xs font-bold">Scan with NDI Wallet</p></div><div className="space-y-3"><Info label="Requested" value="Academic Credential" /><Info label="Fields" value="Name, CID, Qualification, Grade, Issuer" /><Info label="Verifier" value="Sora Demo Portal" /></div></div></GlassCard><GlassCard><h3 className="text-2xl font-black">Flow Status</h3><div className="mt-5 space-y-4"><PipelineStep active label="Verifier requests proof" detail="A portal requests academic proof." /><PipelineStep active label="Student consents" detail="The student approves sharing in the wallet." /><PipelineStep active label="Proof verified" detail="Sora checks issuer, holder, signature, and revocation." /></div></GlassCard></div></StandardPage>;
}

function SDKPage() {
  const code = `import { sora } from "sora-sdk";

const converted = sora.convertGrade({
  sourceScale: "cgpa10",
  value: 8.2,
  targetScale: "gpa4"
});

const result = await sora.verifyCredential({
  method: "bhutan-ndi",
  requiredCredentialType: "AcademicCredential"
});`;
  return <StandardPage eyebrow="Developer SDK" title="One verification engine, many Bhutanese use cases." description="The actual product is the SDK that can be integrated into portals and HR systems." icon={Code2}><div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><GlassCard className="overflow-hidden p-0"><div className="border-b border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-300">sora-demo.ts</div><pre className="overflow-x-auto p-5 text-sm leading-7 text-slate-200"><code>{code}</code></pre></GlassCard><GlassCard><h3 className="text-2xl font-black">SDK Functions</h3><div className="mt-5 space-y-3"><Info label="verifyCredential()" value="Runs the full verification pipeline." /><Info label="verifyNDICredential()" value="Handles NDI-style proof verification." /><Info label="checkRevocationStatus()" value="Checks whether a credential is revoked." /><Info label="convertGrade()" value="Converts grades into common bands." /></div></GlassCard></div></StandardPage>;
}

export default function SoraWebsite() {
  const [active, setActive] = useState("home");
  const [manualBg, setManualBg] = useState<BgKey | null>(null);
  const [signedInUser, setSignedInUser] = useState<NDIUser | null>(null);
  const visibleNavItems = signedInUser ? (signedInUser.role === "issuer" ? issuerNavItems : signedInUser.role === "verifier" ? verifierNavItems : userNavItems) : publicNavItems;
  const activeBg = manualBg || pageBackground[active] || "himalaya";

  function handleSignOut() {
    setSignedInUser(null);
    setActive("home");
  }

  const page = useMemo(() => {
    if (!signedInUser && !["home", "signin"].includes(active)) return <SignInPage signedInUser={signedInUser} onSignIn={setSignedInUser} onSignOut={handleSignOut} setActive={setActive} />;
    if (active === "signin") return <SignInPage signedInUser={signedInUser} onSignIn={setSignedInUser} onSignOut={handleSignOut} setActive={setActive} />;
    if (active === "issuer") return signedInUser?.role === "issuer" ? <IssuerPage /> : <SignInPage signedInUser={signedInUser} onSignIn={setSignedInUser} onSignOut={handleSignOut} setActive={setActive} />;
    if (active === "verifier") return signedInUser?.role === "verifier" ? <VerifierPortalPage /> : <SignInPage signedInUser={signedInUser} onSignIn={setSignedInUser} onSignOut={handleSignOut} setActive={setActive} />;
    if (active === "opportunities") return signedInUser?.role === "user" ? <OpportunitiesPage signedInUser={signedInUser} setActive={setActive} /> : <SignInPage signedInUser={signedInUser} onSignIn={setSignedInUser} onSignOut={handleSignOut} setActive={setActive} />;
    if (active === "credentials") return signedInUser?.role === "user" ? <CredentialsPage /> : <SignInPage signedInUser={signedInUser} onSignIn={setSignedInUser} onSignOut={handleSignOut} setActive={setActive} />;
    if (active === "verify") return <VerifyPage />;
    if (active === "ndi") return <NDIPage />;
    if (active === "sdk") return signedInUser?.role === "issuer" || signedInUser?.role === "verifier" ? <SDKPage /> : <SignInPage signedInUser={signedInUser} onSignIn={setSignedInUser} onSignOut={handleSignOut} setActive={setActive} />;
    return <HomePage setActive={setActive} />;
  }, [active, signedInUser]);

  return (
    <PageWrap>
      <FixedCanvasBackground imageKey={activeBg} />
      <Navbar active={active} setActive={setActive} items={visibleNavItems} signedInUser={signedInUser} onSignOut={handleSignOut} />
      <AnimatePresence mode="wait">
        <motion.div key={active} className="relative z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>{page}</motion.div>
      </AnimatePresence>
      <BackgroundPicker selected={activeBg} onSelect={setManualBg} />
      <MobileNav active={active} setActive={setActive} items={visibleNavItems} />
    </PageWrap>
  );
}
