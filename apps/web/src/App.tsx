"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  IssueCredentialResult,
  ManualGradeInput,
  NormalizedProofResult,
  ScreeningReport,
  SignInRole,
  SignInStartResult,
  SignInStatusResponse,
  SoraMode,
  SupportedCredentialSchema,
  VerificationScope,
  VerificationStartResult,
} from "sora-sdk";
import { listCountries, listInstitutionsByCountry } from "sora-sdk";
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3030";
const DEFAULT_SORA_MODE: SoraMode = import.meta.env.VITE_SORA_MODE === "mock" ? "mock" : "ndi";

interface VerificationStatusResponse {
  threadId: string;
  status: "pending" | "completed" | "failed" | "issued" | "accepted" | "revoked";
  start?: VerificationStartResult;
  normalizedResult?: NormalizedProofResult;
  report?: ScreeningReport;
  issueResult?: IssueCredentialResult;
  lastTransportPayload?: unknown;
  error?: string;
}

interface IssuanceHistoryItem {
  threadId: string;
  scope: SupportedCredentialSchema;
  status: "pending" | "completed" | "failed" | "issued" | "accepted" | "revoked";
  transport: "mock" | "webhook" | "nats";
  deepLinkURL: string;
  credInviteURL: string;
  relationshipDid?: string | null;
  revocationId?: string | null;
  acceptanceStatus?: string;
  revoked?: boolean;
  revokedAt?: string;
  credentialData?: Record<string, string | number>;
}

const verificationActions: Array<{ label: string; scope: VerificationScope }> = [
  { label: "Verify Student ID", scope: "studentId" },
  { label: "Verify Academic Certificate", scope: "academicCertificate" },
  { label: "Verify Both Credentials", scope: "combined" },
];

const initialGrades: ManualGradeInput = {
  gradingScale: "cgpa10",
  institutionName: "University of Delhi",
  country: "India",
};

const publicNavItems = [
  { id: "home", label: "Home" },
];

const signedInNavItems = [
  { id: "verifier", label: "Converter" },
  { id: "issuer", label: "Issuer" },
  { id: "verify", label: "Verify" },
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
type Role = SignInRole;
type AcademicGradeScale = "Percentage" | "10 Point CGPA" | "4 Point GPA";
type ParsedAcademicMetadata = {
  country: string;
  institution: string;
  rawGradeScale: AcademicGradeScale;
  gradingScale: ManualGradeInput["gradingScale"] | null;
  gradeValue: number;
  formattedGrade: string;
};

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

const academicGradeScaleOptions: AcademicGradeScale[] = ["Percentage", "10 Point CGPA", "4 Point GPA"];

function academicGradeScaleMax(scale: AcademicGradeScale) {
  if (scale === "4 Point GPA") return 4;
  if (scale === "10 Point CGPA") return 10;
  return 100;
}

function formatAcademicGrade(scale: AcademicGradeScale, value: number) {
  if (scale === "4 Point GPA") return `${value}/4`;
  if (scale === "10 Point CGPA") return `${value}/10`;
  return `${value}%`;
}

function parseAcademicCredentialMetadata(title: string | undefined): ParsedAcademicMetadata | null {
  if (!title) {
    return null;
  }

  const match = title.match(/\[SORA_META:([^\]]+)]/);
  if (!match) {
    return null;
  }

  const parts = Object.fromEntries(
    match[1]
      .split(";")
      .map((entry) => entry.split("="))
      .filter((entry) => entry.length === 2)
      .map(([key, value]) => [key.trim(), value.trim()]),
  );

  const rawGradeScale = parts.gradeScale as AcademicGradeScale | undefined;
  const country = parts.country;
  const institution = parts.institution;
  const formattedGrade = parts.grade;

  if (!rawGradeScale || !country || !institution || !formattedGrade) {
    return null;
  }

  const numericMatch = formattedGrade.match(/^\s*([0-9]+(?:\.[0-9]+)?)/);
  const gradeValue = numericMatch ? Number(numericMatch[1]) : Number.NaN;

  let gradingScale: ManualGradeInput["gradingScale"] | null = null;
  if (rawGradeScale === "4 Point GPA") gradingScale = "gpa4";
  if (rawGradeScale === "10 Point CGPA") gradingScale = "cgpa10";

  if (Number.isNaN(gradeValue)) {
    return null;
  }

  return {
    country,
    institution,
    rawGradeScale,
    gradingScale,
    gradeValue,
    formattedGrade,
  };
}

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

function buildDemoAccountForRole(role: Role): NDIUser {
  if (role === "issuer") return demoIssuer;
  if (role === "verifier") return demoVerifier;
  return demoUser;
}

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
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;
    const context = ctx;
    const activeCanvas = canvas;

    const size = 2000;
    const box = 123;
    const twoPi = Math.PI * 2;
    let raf = 0;
    let rect = activeCanvas.getBoundingClientRect();
    const boxes: Array<{ x: number; y: number; s: number }> = [];
    const cache = new Map<BgKey, HTMLImageElement>();

    activeCanvas.width = size;
    activeCanvas.height = size;

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
      context.drawImage(img, (size - nw) / 2, (size - nh) / 2, nw, nh);
    }

    function drawTile(img: HTMLImageElement, b: { x: number; y: number; s: number }) {
      const shrink = box * b.s;
      const sx = b.x + shrink / 2;
      const sy = b.y + shrink / 2;
      const sw = Math.max(1, box - shrink);
      const sh = Math.max(1, box - shrink);
      context.drawImage(img, sx, sy, sw, sh, b.x, b.y, box, box);
    }

    function render() {
      const p = pointer.current;
      const img = getImage();
      p.x += (p.tx - p.x) * 0.08;
      p.y += (p.ty - p.y) * 0.08;
      const distance = Math.hypot(p.x - p.tx, p.y - p.ty);
      p.strength += (Math.min(0.5, Math.max(1.2, (distance / size) * 2 + 1.05)) - p.strength) * 0.08;

      context.clearRect(0, 0, size, size);
      drawCover(img);

      const vignette = context.createRadialGradient(p.x, p.y, 100, p.x, p.y, 1450);
      vignette.addColorStop(0, "rgba(0,0,0,0.03)");
      vignette.addColorStop(0.55, "rgba(0,0,0,0.32)");
      vignette.addColorStop(1, "rgba(0,0,0,0.82)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, size, size);

      boxes.forEach((b) => {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        b.s = 1 - Math.min(1, Math.max(0, d / size / p.strength));
        if (b.s < 0.003) return;
        context.save();
        context.globalAlpha = 0.1 + b.s * 0.45;
        drawTile(img, b);
        context.restore();
      });

      boxes.forEach((b) => {
        if (b.s < 0.02) return;
        context.beginPath();
        context.fillStyle = "rgba(255,255,255,0.84)";
        context.arc(b.x, b.y, box * 0.06 * b.s, 0, twoPi);
        context.fill();
      });

      context.fillStyle = "rgba(2, 6, 23, 0.42)";
      context.fillRect(0, 0, size, size);
      raf = requestAnimationFrame(render);
    }

    function onPointerMove(e: PointerEvent) {
      rect = activeCanvas.getBoundingClientRect();
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
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-white/95 p-1.5 shadow-lg shadow-amber-500/20">
            <img src="/platform-logo.png" alt="Sora logo" className="h-full w-full object-contain" />
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
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-10 w-full">
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

function HomePage({ setActive, signedInUser }: { setActive: (id: string) => void; signedInUser: NDIUser | null }) {
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
            {!signedInUser ? (
              <button onClick={() => setActive("signin")} className="group inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3 font-bold text-slate-950 transition hover:scale-[1.02] hover:bg-amber-200">Sign in with Bhutan NDI <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></button>
            ) : null}
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

function SignInPage({
  signedInUser,
  active,
  signInStart,
  signInStatus,
  onStartSignIn,
}: {
  signedInUser: NDIUser | null;
  active: boolean;
  signInStart: SignInStartResult | null;
  signInStatus: SignInStatusResponse | null;
  onStartSignIn: () => Promise<void>;
}) {
  const state: "idle" | "scanning" | "consent" | "verified" = signedInUser
    ? "verified"
    : signInStart
      ? signInStatus?.status === "completed"
        ? "verified"
        : "scanning"
      : "idle";

  useEffect(() => {
    if (!active || signedInUser || signInStart) {
      return;
    }
    void onStartSignIn();
  }, [active, onStartSignIn, signInStart, signedInUser]);

  return (
    <StandardPage eyebrow="Bhutan NDI sign in" title="Sign in with your Bhutan NDI wallet." description="Generate a live NDI QR, scan it with the wallet app, and save the verified holder DID in this session." icon={ShieldCheck}>
      <div className="grid gap-6">
        <GlassCard>
          <div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl font-black">Scan to Sign In</h3><p className="mt-2 text-sm leading-6 text-slate-300">This uses a live Bhutan NDI proof request generated by the backend.</p></div><Pill tone={signedInUser ? "green" : "amber"}>{signedInUser ? "Signed In" : "Awaiting NDI Proof"}</Pill></div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-3xl bg-white p-5 text-slate-950 shadow-2xl">
              {signInStart ? (
                <div dangerouslySetInnerHTML={{ __html: signInStart.qrSvg }} />
              ) : (
                <div className="grid min-h-[250px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 px-6 text-center">
                  <div>
                    <p className="text-sm font-bold text-slate-700">No live NDI QR yet</p>
                    <p className="mt-2 text-xs text-slate-500">Press Start NDI Sign In to generate a real Bhutan NDI proof request.</p>
                  </div>
                </div>
              )}
              <p className="mt-3 text-center text-xs font-bold text-slate-700">Scan with Bhutan NDI Wallet</p>
            </div>
            <div className="space-y-3">
              <PipelineStep active={state !== "idle"} label="1. QR request generated" detail={signInStart ? `Thread ${signInStart.threadId}` : "Generating a live Bhutan NDI proof request..."} />
              <PipelineStep active={state === "scanning" || state === "verified"} label="2. Scan with phone" detail="The holder scans the QR code using the NDI app." />
              <PipelineStep active={Boolean(signInStatus)} label="3. Consent requested" detail={signInStatus?.status === "completed" ? "Consent granted and proof returned." : "The wallet requests permission to share identity."} />
              <PipelineStep active={state === "verified"} label="4. Signed in session created" detail={signedInUser ? `Holder DID saved: ${signedInUser.walletId}` : "Verified holder DID is saved into the app session."} />
            </div>
          </div>
          {signedInUser ? (
            <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm font-bold text-emerald-50">Signed in successfully. Use the navigation bar to open tools.</div>
          ) : null}
          {signedInUser ? (
            <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
              <Pill tone="green">Signed In</Pill>
              <h3 className="mt-4 text-3xl font-black">{signedInUser.fullName}</h3>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Info label="Holder DID" value={signedInUser.walletId} />
                <Info label="Role" value={signedInUser.role} />
                <Info label="Credential ID" value={signedInUser.verifiedCredentialId} />
                <Info label="Email" value={signedInUser.email} />
              </div>
            </div>
          ) : null}
        </GlassCard>
      </div>
    </StandardPage>
  );
}

function PipelineStep({ active, label, detail, warning = false }: { active: boolean; label: string; detail: string; warning?: boolean }) {
  return <div className={cn("flex gap-4 rounded-2xl border bg-white/5 p-4", warning ? "border-red-300/20" : "border-white/10")}><div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", warning ? "bg-red-300/15 text-red-300" : active ? "bg-emerald-300/15 text-emerald-300" : "bg-white/10 text-slate-400")}>{warning ? <XCircle className="h-5 w-5" /> : active ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</div><div><p className="font-bold text-white">{label}</p><p className={cn("mt-1 break-all text-sm leading-6", warning ? "text-red-100" : "text-slate-300")}>{detail}</p></div></div>;
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

function OpportunitiesPage({
  signedInUser,
  setActive,
  verificationStatus,
  report,
}: {
  signedInUser: NDIUser | null;
  setActive: (id: string) => void;
  verificationStatus: VerificationStatusResponse | null;
  report: ScreeningReport | null;
}) {
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
  const liveCredentials = buildCredentialCards(verificationStatus);
  const matches = liveCredentials.filter((c) => c.status === "Verified" && !c.revoked && credentialMatches(c, selected.requiredCredentialType));
  const blocked = liveCredentials.filter((c) => !matches.some((m) => m.id === c.id));
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
            {mode === "form" && <motion.div key="form" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><button onClick={() => setMode("info")} className="mb-4 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white">Back</button><h3 className="text-2xl font-black">Apply for {selected.title}</h3>{signedInUser ? <VerifiedProfile user={signedInUser} matches={matches} blocked={blocked} required={selected.requiredCredentialType} /> : <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5"><h4 className="font-black text-amber-50">Sign in with NDI for faster application</h4><p className="mt-2 text-sm text-amber-100">Avoid manually entering holder details manually.</p><button onClick={() => setActive("signin")} className="mt-4 rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950">Sign in with Bhutan NDI</button></div>}<div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/5 p-5"><div className="flex items-center gap-3"><Upload className="h-5 w-5 text-amber-200" /><div><p className="font-bold">Verified academic package</p><p className="text-sm text-slate-400">This view uses the currently verified credential metadata already available in the app.</p></div></div></div>{report ? <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">Latest converted percentage: {report.conversion.convertedScore}%</div> : null}<button onClick={() => setSubmitted(true)} className="mt-6 w-full rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950">Submit Application</button>{submitted && <div className="mt-6 space-y-3"><CheckLine text="Application received" /><CheckLine text="Credential match checked" /><CheckLine text={report ? `Converted score attached: ${report.conversion.convertedScore}%` : "No converted score attached yet."} /></div>}</motion.div>}
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

function buildCredentialCards(verificationStatus: VerificationStatusResponse | null): Credential[] {
  const result = verificationStatus?.normalizedResult;
  if (!result) {
    return [];
  }

  const cards: Credential[] = [];
  const studentId = result.credentials.studentId;
  const academic = result.credentials.academicCertificate;

  if (studentId) {
    cards.push({
      id: `${result.threadId}-student-id`,
      name: studentId.studentName,
      cid: studentId.studentId,
      issuer: studentId.collegeName,
      qualification: "Student ID",
      country: "Bhutan",
      grade: "Active",
      converted: "Identity credential",
      equivalent: studentId.programmeName,
      status: result.verified ? "Verified" : "Failed",
      risk: result.verified ? "Low" : "High",
      revoked: false,
      method: `${result.transport.toUpperCase()} proof`,
    });
  }

  if (academic) {
    cards.push({
      id: `${result.threadId}-academic-certificate`,
      name: academic.studentName,
      cid: academic.studentId,
      issuer: academic.issuerName,
      qualification: academic.titleOfAward,
      country: "Bhutan",
      grade: "Verified academic credential",
      converted: "Contextual conversion available",
      equivalent: academic.collegeName,
      status: result.verified ? "Verified" : "Failed",
      risk: result.verified ? "Low" : "High",
      revoked: false,
      method: `${result.transport.toUpperCase()} proof`,
    });
  }

  return cards;
}

function VerifiedProfile({ user, matches, blocked, required }: { user: NDIUser; matches: Credential[]; blocked: Credential[]; required: string }) {
  return <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-300" /><div><p className="font-black text-emerald-50">Verified NDI profile attached</p><p className="text-sm text-emerald-100">Name, CID, Student ID, contact details, and selected credential ID are pre-filled.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Full Name" value={user.fullName} /><Info label="CID" value={user.cid} /><Info label="Email / Phone" value={`${user.email} / ${user.phone}`} /><Info label="Student ID" value={`SID-${user.cid}`} /><Info label="Credential ID" value={user.verifiedCredentialId} /></div><div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/40 p-4"><p className="font-black text-white">Required credential match</p><p className="mt-1 text-sm text-slate-300">This opportunity requires: {required}. Only matching credentials will be attached.</p><div className="mt-4 space-y-3">{matches.length > 0 ? matches.map((credential) => <div key={credential.id} className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4"><p className="font-bold text-emerald-50">{credential.qualification}</p><p className="mt-1 text-xs text-emerald-100">{credential.id} · {credential.issuer}</p></div>) : <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">No suitable verified credential found.</div>}</div>{blocked.length > 0 && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Not attached</p><div className="mt-3 space-y-2">{blocked.map((credential) => <div key={credential.id} className="flex items-center justify-between gap-3 text-xs text-slate-300"><span>{credential.qualification}</span><span className="rounded-full bg-white/10 px-2 py-1">Not required</span></div>)}</div></div>}</div></div>;
}

function CredentialsPage({
  verificationStatus,
  issuanceHistory,
}: {
  verificationStatus: VerificationStatusResponse | null;
  issuanceHistory: IssuanceHistoryItem[];
}) {
  const liveCredentials = buildCredentialCards(verificationStatus);
  const [selected, setSelected] = useState(liveCredentials[0] ?? credentials[0]);
  const [origin, setOrigin] = useState("https://sora.bt");
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const studentQrRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (liveCredentials[0]) {
      setSelected(liveCredentials[0]);
    }
  }, [verificationStatus?.threadId]);

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
        <GlassCard><h3 className="text-xl font-black">My Credentials</h3><div className="mt-5 space-y-3">{liveCredentials.map((c) => <button key={c.id} onClick={() => setSelected(c)} className={cn("w-full rounded-2xl border p-4 text-left transition", selected.id === c.id ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-white/5 hover:bg-white/10")}><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{c.name}</p><p className="mt-1 text-xs text-slate-400">{c.id}</p><p className="mt-2 text-xs text-slate-300">{c.qualification}</p></div><StatusIcon status={c.status} /></div></button>)}{liveCredentials.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">No verified credential is loaded yet. Run a verification or issue a credential first.</div> : null}</div></GlassCard>
        <GlassCard><div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]"><div><Pill tone={selected.status === "Verified" ? "green" : "red"}>{selected.status}</Pill><h3 className="mt-4 text-3xl font-black">{selected.qualification}</h3><p className="mt-2 text-slate-300">Issued to {selected.name}</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><Info label="Credential ID" value={selected.id} /><Info label="Issuer" value={selected.issuer} /><Info label="Original Grade" value={selected.grade} /><Info label="Bhutan Equivalent" value={selected.equivalent} /></div></div><div className="rounded-3xl border border-white/10 bg-white p-5 text-slate-950 shadow-2xl"><QRCodeCanvas ref={qrRef} value={qrPayload} size={220} level="M" includeMargin className="h-full w-full" /><p className="mt-3 text-center text-xs font-bold text-slate-700">Scan to verify credential</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><ActionButton icon={Share2} label="Share QR Image" onClick={shareQR} /><ActionButton icon={Download} label="Download QR PNG" onClick={downloadQR} /><ActionButton icon={Download} label="Download Package" onClick={() => {}} /></div>{issuanceHistory.length > 0 ? <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-sm font-bold text-white">Issued Credential History</p><div className="mt-3 space-y-2">{issuanceHistory.map((item) => <div key={item.threadId} className="flex items-center justify-between gap-3 text-xs text-slate-300"><span>{item.scope} · {item.threadId}</span><span className="rounded-full bg-white/10 px-2 py-1">{item.acceptanceStatus ?? item.status}</span></div>)}</div></div> : null}</GlassCard>
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

function ConnectedVerifierPage({
  grades,
  setGrades,
  report,
  activeStart,
  verificationStatus,
  busy,
  onGenerate,
  onStartAcademicScan,
  onUseVerifiedAcademic,
}: {
  grades: ManualGradeInput;
  setGrades: React.Dispatch<React.SetStateAction<ManualGradeInput>>;
  report: ScreeningReport | null;
  activeStart: VerificationStartResult | null;
  verificationStatus: VerificationStatusResponse | null;
  busy: string | null;
  onGenerate: () => Promise<void>;
  onStartAcademicScan: () => Promise<void>;
  onUseVerifiedAcademic: () => Promise<void>;
}) {
  const countryOptions = listCountries();
  const institutionOptions = listInstitutionsByCountry(grades.country);
  const gradeValueLimit = grades.gradingScale === "gpa4" ? 4 : 10;
  const academicScanStart = activeStart?.scope === "academicCertificate" ? activeStart : null;
  const academicScanStatus = academicScanStart ? verificationStatus : null;
  const verifiedAcademic = academicScanStatus?.normalizedResult?.credentials.academicCertificate;
  const academicMetadata = parseAcademicCredentialMetadata(verifiedAcademic?.titleOfAward);
  const lastAutoConvertedThreadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!academicScanStart?.threadId || !academicMetadata || academicScanStatus?.status !== "completed") {
      return;
    }
    if (lastAutoConvertedThreadRef.current === academicScanStart.threadId) {
      return;
    }
    lastAutoConvertedThreadRef.current = academicScanStart.threadId;
    void onUseVerifiedAcademic();
  }, [academicMetadata, academicScanStart?.threadId, academicScanStatus?.status, onUseVerifiedAcademic]);

  return (
    <StandardPage
      eyebrow="Verifier / interviewer workspace"
      title="Convert applicant grades into a contextual percentage."
      description="This page now uses the real screening API. The verifier enters the grade scale, country, institution, and grade value, and Sora returns the converted percentage."
      icon={SearchCheck}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Pill tone="blue">Backend connected</Pill>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <GlassCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black">Contextual Grade Conversion</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">Only 4.0 GPA and 10.0 CGPA are accepted. The range is enforced before submission.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SelectBox label="Grading Scale" value={grades.gradingScale} onChange={(value) => setGrades((current) => ({ ...current, gradingScale: value as ManualGradeInput["gradingScale"], gradeValue: undefined }))} options={["gpa4", "cgpa10"]} />
            <SelectBox label="Country" value={grades.country ?? ""} onChange={(value) => setGrades((current) => ({ ...current, country: value || undefined, institutionName: listInstitutionsByCountry(value)[0] ?? current.institutionName }))} options={countryOptions} />
            <SelectBox label="Institution" value={grades.institutionName} onChange={(value) => setGrades((current) => ({ ...current, institutionName: value }))} options={institutionOptions} />
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-300">Grade Value</span>
              <input
                type="number"
                min={0}
                max={gradeValueLimit}
                step="0.01"
                value={grades.gradeValue ?? ""}
                onChange={(e) => setGrades((current) => ({ ...current, gradeValue: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              />
            </label>
          </div>
          <button onClick={() => void onGenerate()} className="mt-6 w-full rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-200">
            {busy === "report" ? "Generating..." : "Generate Converted Percentage"}
          </button>
        </GlassCard>
        <GlassCard>
          <h3 className="text-2xl font-black">Result</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">The API returns the converted percentage and its context factors.</p>
          {report ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-100">Converted Percentage</p>
                <h3 className="mt-2 text-5xl font-black text-white">{report.conversion.convertedScore}%</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Original Grade" value={academicMetadata?.formattedGrade ?? (grades.gradeValue !== undefined ? String(grades.gradeValue) : "N/A")} />
                <Info label="Normalized Base Score" value={`${report.conversion.normalizedScore}%`} />
                <Info label="Context Factor" value={report.conversion.contextFactor.toFixed(3)} />
                <Info label="Institution" value={report.conversion.institution.institutionName} />
                <Info label="Country" value={report.conversion.institution.country} />
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <PipelineStep active label="1. Enter academic input" detail="Choose grading scale, country, institution, and the reported value." />
              <PipelineStep active label="2. Submit to screening API" detail="The frontend calls POST /api/screening/report." />
              <PipelineStep active label="3. Read converted percentage" detail="The API returns the contextual percentage you use for evaluation." />
            </div>
          )}
        </GlassCard>
      </div>
      <GlassCard className="mt-6">
        <h3 className="text-2xl font-black">Convert From Verified Academic Credential</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">Scan the academic credential QR, extract the country, institution, and grade metadata embedded in the credential, then run the same contextual conversion rules automatically.</p>
        <button onClick={() => void onStartAcademicScan()} className="mt-6 rounded-2xl bg-emerald-300 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-200">
          {busy === "academicCertificate" ? "Generating QR..." : "Scan Academic Credential QR"}
        </button>
        {academicScanStart ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-3xl border border-white/10 bg-white p-5 text-slate-950 shadow-2xl" dangerouslySetInnerHTML={{ __html: academicScanStart.qrSvg }} />
            <div className="space-y-3">
              <Info label="Thread ID" value={academicScanStart.threadId} />
              <Info label="Status" value={academicScanStatus?.status ?? "pending"} />
              <Info label="Verification" value={academicScanStatus?.normalizedResult?.verificationResult ?? "Waiting for approval"} />
            </div>
          </div>
        ) : null}
        {academicMetadata ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Info label="Country" value={academicMetadata.country} />
              <Info label="Institution" value={academicMetadata.institution} />
              <Info label="Grade Scale" value={academicMetadata.rawGradeScale} />
              <Info label="Grade Value" value={academicMetadata.formattedGrade} />
            </div>
            <p className="text-sm text-slate-300">Once the credential is verified, Sora applies the normal conversion rules automatically using the scanned metadata.</p>
          </div>
        ) : verifiedAcademic ? (
          <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
            Verified academic credential found, but no supported `SORA_META` conversion metadata was detected in `Title of Award`.
          </div>
        ) : null}
      </GlassCard>
    </StandardPage>
  );
}

function ConnectedVerifyPage({
  activeStart,
  verificationStatus,
  busy,
  onStartVerification,
}: {
  activeStart: VerificationStartResult | null;
  verificationStatus: VerificationStatusResponse | null;
  busy: string | null;
  onStartVerification: (scope: VerificationScope) => Promise<void>;
}) {
  const verifiedResult = verificationStatus?.normalizedResult;
  const isRevokedVerification = verificationStatus?.status === "revoked" || verificationStatus?.status === "failed" && verifiedResult?.verificationResult === "RevokedByIssuer";

  return (
    <StandardPage eyebrow="Credential check" title="Verify Student ID and academic credential proofs." description="This page is connected to the real verification API. Start a proof request, display the wallet QR, and poll for the normalized result." icon={SearchCheck}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Pill tone="green">Live verification flow</Pill>
      </div>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <GlassCard>
          <h3 className="text-2xl font-black">Start Verification</h3>
          <div className="mt-5 grid gap-3">
            {verificationActions.map((action) => (
              <button
                key={action.scope}
                type="button"
                onClick={() => void onStartVerification(action.scope)}
                className="rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-200"
              >
                {busy === action.scope ? "Starting..." : action.label}
              </button>
            ))}
          </div>
          {activeStart ? (
            <div className="mt-6 space-y-3">
              <Info label="Thread ID" value={activeStart.threadId} />
              <Info label="Transport" value={activeStart.transport} />
              <Info label="Scope" value={activeStart.scope} />
              <a href={activeStart.deepLinkURL} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15">
                Open Wallet Deep Link <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ) : null}
        </GlassCard>
        <GlassCard>
          <h3 className="text-2xl font-black">Verification Result</h3>
          {activeStart ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-3xl border border-white/10 bg-white p-5 text-slate-950 shadow-2xl" dangerouslySetInnerHTML={{ __html: activeStart.qrSvg }} />
              <div className="space-y-3">
                <PipelineStep active warning={isRevokedVerification} label="Status" detail={isRevokedVerification ? "revoked / invalid" : verificationStatus?.status ?? "pending"} />
                <PipelineStep active label="Holder DID" detail={verifiedResult?.holder.holderDid ?? "Waiting for wallet approval"} />
                <PipelineStep active warning={isRevokedVerification} label="Verification Result" detail={isRevokedVerification ? "RevokedByIssuer" : verifiedResult?.verificationResult ?? "Waiting for callback"} />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-300">Start a proof request to render the live wallet QR and result state.</p>
          )}
          {verifiedResult ? (
            <pre className="mt-6 overflow-x-auto rounded-3xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-slate-200">
              {JSON.stringify(verifiedResult.rawRevealedAttributes ?? {}, null, 2)}
            </pre>
          ) : null}
        </GlassCard>
      </div>
    </StandardPage>
  );
}

function ConnectedNDIPage({
  activeStart,
  verificationStatus,
}: {
  activeStart: VerificationStartResult | null;
  verificationStatus: VerificationStatusResponse | null;
}) {
  return (
    <StandardPage eyebrow="Bhutan NDI-ready flow" title="Wallet-based academic verification with consent." description="This section now reflects the actual proof state from the backend instead of a simulated journey." icon={ShieldCheck}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Pill tone="blue">Live integration view</Pill>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <GlassCard>
          <h3 className="text-2xl font-black">Proof Request</h3>
          {activeStart ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-3xl bg-white p-5 text-slate-950 shadow-2xl" dangerouslySetInnerHTML={{ __html: activeStart.qrSvg }} />
              <div className="space-y-3">
                <Info label="Scope" value={activeStart.scope} />
                <Info label="Transport" value={activeStart.transport} />
                <Info label="Deep Link" value={activeStart.deepLinkURL} />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-300">Start a verification request from Credential Check to populate this screen.</p>
          )}
        </GlassCard>
        <GlassCard>
          <h3 className="text-2xl font-black">Flow Status</h3>
          <div className="mt-5 space-y-4">
            <PipelineStep active={Boolean(activeStart)} label="Verifier requests proof" detail={activeStart ? `Thread ${activeStart.threadId}` : "No proof request started yet."} />
            <PipelineStep active={verificationStatus?.status === "completed"} label="Student consents" detail={verificationStatus?.status === "completed" ? "The wallet approved the proof request." : "Waiting for wallet approval."} />
            <PipelineStep active={verificationStatus?.normalizedResult?.verificationResult === "ProofValidated"} label="Proof verified" detail={verificationStatus?.normalizedResult?.verificationResult ?? "No verified proof yet."} />
          </div>
        </GlassCard>
      </div>
    </StandardPage>
  );
}

function IssueDraftFields({
  draft,
  setDraft,
}: {
  draft: Record<string, string | number>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
}) {
  return (
    <div className="mt-6 grid gap-4">
      {Object.entries(draft).map(([key, value]) => (
        <label key={key}>
          <span className="mb-2 block text-sm font-semibold text-slate-300">{key}</span>
          <input
            type={typeof value === "number" ? "number" : "text"}
            value={String(value)}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                [key]: typeof value === "number" ? Number(e.target.value) : e.target.value,
              }))
            }
            className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
          />
        </label>
      ))}
    </div>
  );
}

function ConnectedIssuerPage({
  holderDid,
  studentIdDraft,
  setStudentIdDraft,
  academicCertificateDraft,
  setAcademicCertificateDraft,
  academicCertificateCountry,
  setAcademicCertificateCountry,
  academicCertificateInstitution,
  setAcademicCertificateInstitution,
  academicCertificateGradeScale,
  setAcademicCertificateGradeScale,
  academicCertificateGradeValue,
  setAcademicCertificateGradeValue,
  studentIdIssueResult,
  studentIdIssueStatus,
  academicCertificateIssueResult,
  academicCertificateIssueStatus,
  issuanceHistory,
  busy,
  onIssue,
  onRevoke,
}: {
  holderDid: string;
  studentIdDraft: Record<string, string | number>;
  setStudentIdDraft: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
  academicCertificateDraft: Record<string, string | number>;
  setAcademicCertificateDraft: React.Dispatch<React.SetStateAction<Record<string, string | number>>>;
  academicCertificateCountry: string;
  setAcademicCertificateCountry: React.Dispatch<React.SetStateAction<string>>;
  academicCertificateInstitution: string;
  setAcademicCertificateInstitution: React.Dispatch<React.SetStateAction<string>>;
  academicCertificateGradeScale: AcademicGradeScale;
  setAcademicCertificateGradeScale: React.Dispatch<React.SetStateAction<AcademicGradeScale>>;
  academicCertificateGradeValue: number | undefined;
  setAcademicCertificateGradeValue: React.Dispatch<React.SetStateAction<number | undefined>>;
  studentIdIssueResult: IssueCredentialResult | null;
  studentIdIssueStatus: VerificationStatusResponse | null;
  academicCertificateIssueResult: IssueCredentialResult | null;
  academicCertificateIssueStatus: VerificationStatusResponse | null;
  issuanceHistory: IssuanceHistoryItem[];
  busy: string | null;
  onIssue: (schema: SupportedCredentialSchema) => Promise<void>;
  onRevoke: (threadId: string) => Promise<void>;
}) {
  const academicGradeMax = academicGradeScaleMax(academicCertificateGradeScale);
  const countryOptions = listCountries();
  const institutionOptions = listInstitutionsByCountry(academicCertificateCountry);

  return (
    <StandardPage eyebrow="Issuer dashboard" title="Issue Student IDs and academic credentials through the backend API." description="This page now uses the DID saved at sign-in. Use the Student ID or Academic Certificate form below to issue credentials directly to the signed-in wallet." icon={Building2}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Pill tone="amber">Issuer flow connected</Pill>
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-1"><Metric icon={KeyRound} label="Holder DID" value={holderDid || "Pending"} /></div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <GlassCard>
          <h3 className="text-2xl font-black">1. Issue Student ID Credential</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">The signed-in holder DID is used automatically. Fill the Student ID fields and issue the credential directly to this wallet.</p>
          <IssueDraftFields draft={studentIdDraft} setDraft={setStudentIdDraft} />
          <button onClick={() => void onIssue("studentId")} className="mt-6 w-full rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-200">
            {busy === "issuance-studentId" ? "Issuing Student ID..." : "Issue Student ID"}
          </button>
          {studentIdIssueResult ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Issue Thread" value={studentIdIssueResult.issueCredThreadId} />
                <Info label="Acceptance Status" value={studentIdIssueStatus?.status ?? studentIdIssueResult.acceptanceStatus ?? "issued"} />
              </div>
              <div className="rounded-3xl bg-white p-5 text-slate-950 shadow-2xl" dangerouslySetInnerHTML={{ __html: studentIdIssueResult.qrSvg ?? "<p>QR unavailable</p>" }} />
            </div>
          ) : null}
        </GlassCard>
        <GlassCard>
          <h3 className="text-2xl font-black">2. Issue Academic Certificate</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">Use the same signed-in DID to issue the academic certificate after filling the schema fields below.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SelectBox
              label="Country"
              value={academicCertificateCountry}
              onChange={(value) => {
                setAcademicCertificateCountry(value);
                setAcademicCertificateInstitution(listInstitutionsByCountry(value)[0] ?? "");
              }}
              options={countryOptions}
            />
            <SelectBox
              label="Institution"
              value={academicCertificateInstitution}
              onChange={setAcademicCertificateInstitution}
              options={institutionOptions}
            />
            <SelectBox label="Grade Scale" value={academicCertificateGradeScale} onChange={(value) => {
              setAcademicCertificateGradeScale(value as AcademicGradeScale);
              setAcademicCertificateGradeValue(undefined);
            }} options={academicGradeScaleOptions} />
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-300">Grade Value</span>
              <input
                type="number"
                min={0}
                max={academicGradeMax}
                step="0.01"
                value={academicCertificateGradeValue ?? ""}
                onChange={(e) => setAcademicCertificateGradeValue(e.target.value ? Number(e.target.value) : undefined)}
                placeholder={`0 - ${academicGradeMax}`}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              />
            </label>
          </div>
          <IssueDraftFields draft={academicCertificateDraft} setDraft={setAcademicCertificateDraft} />
          <button onClick={() => void onIssue("academicCertificate")} className="mt-6 w-full rounded-2xl bg-emerald-300 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-200">
            {busy === "issuance-academicCertificate" ? "Issuing Academic Certificate..." : "Issue Academic Certificate"}
          </button>
          {academicCertificateIssueResult ? (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Issue Thread" value={academicCertificateIssueResult.issueCredThreadId} />
                <Info label="Acceptance Status" value={academicCertificateIssueStatus?.status ?? academicCertificateIssueResult.acceptanceStatus ?? "issued"} />
              </div>
              <div className="rounded-3xl bg-white p-5 text-slate-950 shadow-2xl" dangerouslySetInnerHTML={{ __html: academicCertificateIssueResult.qrSvg ?? "<p>QR unavailable</p>" }} />
            </div>
          ) : null}
        </GlassCard>
      </div>
      <GlassCard className="mt-6">
        <h3 className="text-2xl font-black">Issued Credential History</h3>
        {issuanceHistory.length > 0 ? (
          <div className="mt-5 space-y-3">
            {issuanceHistory.map((item) => (
              <div key={item.threadId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-bold text-white">{item.scope}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.threadId}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={item.revoked || item.status === "revoked" ? "red" : item.acceptanceStatus === "accepted" || item.status === "accepted" ? "green" : "amber"}>{item.revoked ? "revoked" : item.acceptanceStatus ?? item.status}</Pill>
                    <button disabled={item.revoked} onClick={() => void onRevoke(item.threadId)} className="inline-flex items-center gap-2 rounded-2xl bg-red-400 px-3 py-2 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"><Ban className="h-4 w-4" />Revoke</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-300">No issuance history yet.</p>
        )}
      </GlassCard>
    </StandardPage>
  );
}

const legacyDemoPages = [IssuerPage, VerifierPortalPage, VerifyPage, NDIPage];
void legacyDemoPages;

export default function SoraWebsite() {
  const [active, setActive] = useState("home");
  const [manualBg, setManualBg] = useState<BgKey | null>(null);
  const [signedInUser, setSignedInUser] = useState<NDIUser | null>(null);
  const [signInStart, setSignInStart] = useState<SignInStartResult | null>(null);
  const [signInStatus, setSignInStatus] = useState<SignInStatusResponse | null>(null);
  const [activeStart, setActiveStart] = useState<VerificationStartResult | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatusResponse | null>(null);
  const [grades, setGrades] = useState<ManualGradeInput>(initialGrades);
  const [report, setReport] = useState<ScreeningReport | null>(null);
  const [studentIdDraft, setStudentIdDraft] = useState<Record<string, string | number>>({});
  const [academicCertificateDraft, setAcademicCertificateDraft] = useState<Record<string, string | number>>({});
  const [academicCertificateCountry, setAcademicCertificateCountry] = useState("India");
  const [academicCertificateInstitution, setAcademicCertificateInstitution] = useState("University of Delhi");
  const [academicCertificateGradeScale, setAcademicCertificateGradeScale] = useState<AcademicGradeScale>("Percentage");
  const [academicCertificateGradeValue, setAcademicCertificateGradeValue] = useState<number | undefined>();
  const [studentIdIssueResult, setStudentIdIssueResult] = useState<IssueCredentialResult | null>(null);
  const [studentIdIssueStatus, setStudentIdIssueStatus] = useState<VerificationStatusResponse | null>(null);
  const [academicCertificateIssueResult, setAcademicCertificateIssueResult] = useState<IssueCredentialResult | null>(null);
  const [academicCertificateIssueStatus, setAcademicCertificateIssueStatus] = useState<VerificationStatusResponse | null>(null);
  const [issuanceHistory, setIssuanceHistory] = useState<IssuanceHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const visibleNavItems = signedInUser ? signedInNavItems : publicNavItems;
  const activeBg = manualBg || pageBackground[active] || "himalaya";
  const holderDid = signedInUser?.walletId ?? verificationStatus?.normalizedResult?.holder.holderDid ?? "";

  async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-sora-mode": DEFAULT_SORA_MODE,
        ...(init?.headers ?? {}),
      },
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error ?? "Request failed");
    }
    return json as T;
  }

  async function startSignIn() {
    setBusy("signIn");
    setError(null);
    try {
      const start = await callApi<SignInStartResult>("/api/auth/sign-in/start", {
        method: "POST",
        body: JSON.stringify({ role: "user" }),
      });
      setSignInStart(start);
      setSignInStatus(null);
      setActive("signin");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to start sign-in.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshSignIn(threadId: string) {
    try {
      const status = await callApi<SignInStatusResponse>(`/api/auth/sign-in/${threadId}`);
      setSignInStatus(status);
      if (status.status === "completed") {
        const baseProfile = buildDemoAccountForRole("user");
        const nextUser: NDIUser = {
          ...baseProfile,
          role: "user",
          fullName: status.profile?.fullName ?? baseProfile.fullName,
          walletId: status.profile?.holderDid ?? baseProfile.walletId,
        };
        setSignedInUser(nextUser);
        setSignInStart(null);
        setSignInStatus(null);
        setActive("home");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load sign-in status.");
    }
  }

  async function startVerification(scope: VerificationScope, nextTab: "verify" | "stay" = "verify") {
    setBusy(scope);
    setError(null);
    setReport(null);
    setStudentIdIssueResult(null);
    setStudentIdIssueStatus(null);
    setAcademicCertificateIssueResult(null);
    setAcademicCertificateIssueStatus(null);
    try {
      const start = await callApi<VerificationStartResult>("/api/verification/start", {
        method: "POST",
        body: JSON.stringify({ scope }),
      });
      setActiveStart(start);
      setVerificationStatus(null);
      if (nextTab === "verify") {
        setActive("verify");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to start verification.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshVerification(threadId: string) {
    try {
      const status = await callApi<VerificationStatusResponse>(`/api/verification/${threadId}`);
      setVerificationStatus(status);
      if (status.report) setReport(status.report);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load verification status.");
    }
  }

  async function refreshIssue(threadId: string, schema: SupportedCredentialSchema) {
    try {
      const status = await callApi<VerificationStatusResponse>(`/api/verification/${threadId}`);
      if (schema === "studentId") {
        setStudentIdIssueStatus(status);
        if (status.issueResult) setStudentIdIssueResult(status.issueResult);
        return;
      }
      setAcademicCertificateIssueStatus(status);
      if (status.issueResult) setAcademicCertificateIssueResult(status.issueResult);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load issuance status.");
    }
  }

  async function submitReport() {
    await submitReportForGrades(grades);
  }

  async function submitReportForGrades(nextGrades: ManualGradeInput) {
    setBusy("report");
    setError(null);
    try {
      const nextReport = await callApi<ScreeningReport>("/api/screening/report", {
        method: "POST",
        body: JSON.stringify({
          threadId: activeStart?.threadId,
          grades: nextGrades,
        }),
      });
      setReport(nextReport);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to generate screening report.");
    } finally {
      setBusy(null);
    }
  }

  async function applyVerifiedAcademicConversion() {
    const verifiedAcademic = verificationStatus?.normalizedResult?.credentials.academicCertificate;
    const metadata = parseAcademicCredentialMetadata(verifiedAcademic?.titleOfAward);

    if (!metadata) {
      setError("No supported academic conversion metadata was found in the verified credential.");
      return;
    }

    if (!metadata.gradingScale) {
      setError("This verified credential already carries a percentage grade. The scan-to-convert flow currently supports GPA and CGPA metadata.");
      return;
    }

    const nextGrades: ManualGradeInput = {
      gradingScale: metadata.gradingScale,
      gradeValue: metadata.gradeValue,
      country: metadata.country,
      institutionName: metadata.institution,
    };

    setGrades(nextGrades);
    await submitReportForGrades(nextGrades);
  }

  async function loadIssueTemplate(schema: SupportedCredentialSchema) {
    try {
      const template = await callApi<{ credentialData: Record<string, string | number> }>(`/api/issuance/template/${schema}`);
      if (schema === "studentId") {
        setStudentIdDraft(template.credentialData);
        return;
      }
      setAcademicCertificateDraft(template.credentialData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load issuance template.");
    }
  }

  async function submitIssuance(schema: SupportedCredentialSchema) {
    setBusy(`issuance-${schema}`);
    setError(null);
    if (!holderDid) {
      setBusy(null);
      setError("Sign in with NDI first so the holder DID is available for issuance.");
      return;
    }
    if (schema === "academicCertificate" && (!academicCertificateCountry || !academicCertificateInstitution)) {
      setBusy(null);
      setError("Select both country and institution before issuing the academic certificate.");
      return;
    }
    if (
      schema === "academicCertificate" &&
      (
        academicCertificateGradeValue === undefined ||
        Number.isNaN(academicCertificateGradeValue) ||
        academicCertificateGradeValue < 0 ||
        academicCertificateGradeValue > academicGradeScaleMax(academicCertificateGradeScale)
      )
    ) {
      setBusy(null);
      setError(`Enter a valid grade value between 0 and ${academicGradeScaleMax(academicCertificateGradeScale)} before issuing the academic certificate.`);
      return;
    }
    try {
      const credentialData =
        schema === "studentId"
          ? studentIdDraft
          : (() => {
              const payload = { ...academicCertificateDraft };
              const rawTitle = typeof payload["Title of Award"] === "string" ? payload["Title of Award"] : "";
              const normalizedTitle = rawTitle.replace(/\s*\[(SORA_GRADE|SORA_META):[^\]]*]$/, "").trim();
              const formattedGrade = formatAcademicGrade(academicCertificateGradeScale, academicCertificateGradeValue!);
              payload["Title of Award"] = `${normalizedTitle} [SORA_META:country=${academicCertificateCountry};institution=${academicCertificateInstitution};gradeScale=${academicCertificateGradeScale};grade=${formattedGrade}]`;
              return payload;
            })();
      const result = await callApi<IssueCredentialResult>("/api/issuance/issue", {
        method: "POST",
        body: JSON.stringify({
          schema,
          holderDID: holderDid,
          credentialData,
        }),
      });
      if (schema === "studentId") {
        setStudentIdIssueResult(result);
        setStudentIdIssueStatus(null);
      } else {
        setAcademicCertificateIssueResult(result);
        setAcademicCertificateIssueStatus(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to issue credential.");
    } finally {
      setBusy(null);
    }
  }

  async function refreshIssuanceHistory() {
    try {
      const history = await callApi<{ items: IssuanceHistoryItem[] }>("/api/issuance/history");
      setIssuanceHistory(history.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load issuance history.");
    }
  }

  async function revokeIssuedCredential(threadId: string) {
    setBusy(`revoke-${threadId}`);
    setError(null);
    try {
      await callApi<{ ok: boolean; status: string }>("/api/issuance/revoke", {
        method: "POST",
        body: JSON.stringify({ threadId }),
      });
      await refreshIssuanceHistory();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to revoke credential.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void loadIssueTemplate("studentId");
    void loadIssueTemplate("academicCertificate");
  }, []);

  useEffect(() => {
    const rawSession = window.sessionStorage.getItem("sora-session");
    if (!rawSession) {
      return;
    }
    try {
      setSignedInUser(JSON.parse(rawSession) as NDIUser);
    } catch {
      window.sessionStorage.removeItem("sora-session");
    }
  }, []);

  useEffect(() => {
    if (!signedInUser) {
      window.sessionStorage.removeItem("sora-session");
      return;
    }
    window.sessionStorage.setItem("sora-session", JSON.stringify(signedInUser));
  }, [signedInUser]);

  useEffect(() => {
    if (!signInStart?.threadId) return;
    void refreshSignIn(signInStart.threadId);
    const interval = window.setInterval(() => {
      void refreshSignIn(signInStart.threadId);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [signInStart?.threadId]);

  useEffect(() => {
    if (!activeStart?.threadId) return;
    void refreshVerification(activeStart.threadId);
    const interval = window.setInterval(() => {
      void refreshVerification(activeStart.threadId);
    }, 2500);
    return () => window.clearInterval(interval);
  }, [activeStart?.threadId]);

  useEffect(() => {
    if (!studentIdIssueResult?.issueCredThreadId) return;
    void refreshIssue(studentIdIssueResult.issueCredThreadId, "studentId");
    const interval = window.setInterval(() => {
      void refreshIssue(studentIdIssueResult.issueCredThreadId, "studentId");
    }, 2500);
    return () => window.clearInterval(interval);
  }, [studentIdIssueResult?.issueCredThreadId]);

  useEffect(() => {
    if (!academicCertificateIssueResult?.issueCredThreadId) return;
    void refreshIssue(academicCertificateIssueResult.issueCredThreadId, "academicCertificate");
    const interval = window.setInterval(() => {
      void refreshIssue(academicCertificateIssueResult.issueCredThreadId, "academicCertificate");
    }, 2500);
    return () => window.clearInterval(interval);
  }, [academicCertificateIssueResult?.issueCredThreadId]);

  useEffect(() => {
    if (signedInUser?.role === "issuer" || signedInUser?.role === "user") {
      void refreshIssuanceHistory();
    }
  }, [academicCertificateIssueResult?.issueCredThreadId, signedInUser?.role, studentIdIssueResult?.issueCredThreadId]);

  useEffect(() => {
    if (signedInUser && active === "signin") {
      setActive("home");
    }
  }, [active, signedInUser]);

  function handleSignOut() {
    setSignedInUser(null);
    setSignInStart(null);
    setSignInStatus(null);
    setActive("home");
  }

  const page = useMemo(() => {
    if (!signedInUser && !["home", "signin"].includes(active)) return <SignInPage active={false} signedInUser={signedInUser} signInStart={signInStart} signInStatus={signInStatus} onStartSignIn={startSignIn} />;
    if (active === "signin") return <SignInPage active={true} signedInUser={signedInUser} signInStart={signInStart} signInStatus={signInStatus} onStartSignIn={startSignIn} />;
    if (active === "issuer") return signedInUser ? <ConnectedIssuerPage holderDid={holderDid} studentIdDraft={studentIdDraft} setStudentIdDraft={setStudentIdDraft} academicCertificateDraft={academicCertificateDraft} setAcademicCertificateDraft={setAcademicCertificateDraft} academicCertificateCountry={academicCertificateCountry} setAcademicCertificateCountry={setAcademicCertificateCountry} academicCertificateInstitution={academicCertificateInstitution} setAcademicCertificateInstitution={setAcademicCertificateInstitution} academicCertificateGradeScale={academicCertificateGradeScale} setAcademicCertificateGradeScale={setAcademicCertificateGradeScale} academicCertificateGradeValue={academicCertificateGradeValue} setAcademicCertificateGradeValue={setAcademicCertificateGradeValue} studentIdIssueResult={studentIdIssueResult} studentIdIssueStatus={studentIdIssueStatus} academicCertificateIssueResult={academicCertificateIssueResult} academicCertificateIssueStatus={academicCertificateIssueStatus} issuanceHistory={issuanceHistory} busy={busy} onIssue={submitIssuance} onRevoke={revokeIssuedCredential} /> : <SignInPage active={false} signedInUser={signedInUser} signInStart={signInStart} signInStatus={signInStatus} onStartSignIn={startSignIn} />;
    if (active === "verifier") return signedInUser ? <ConnectedVerifierPage grades={grades} setGrades={setGrades} report={report} activeStart={activeStart} verificationStatus={verificationStatus} busy={busy} onGenerate={submitReport} onStartAcademicScan={() => startVerification("academicCertificate", "stay")} onUseVerifiedAcademic={applyVerifiedAcademicConversion} /> : <SignInPage active={false} signedInUser={signedInUser} signInStart={signInStart} signInStatus={signInStatus} onStartSignIn={startSignIn} />;
    if (active === "opportunities") return signedInUser ? <OpportunitiesPage signedInUser={signedInUser} setActive={setActive} verificationStatus={verificationStatus} report={report} /> : <SignInPage active={false} signedInUser={signedInUser} signInStart={signInStart} signInStatus={signInStatus} onStartSignIn={startSignIn} />;
    if (active === "credentials") return signedInUser ? <CredentialsPage verificationStatus={verificationStatus} issuanceHistory={issuanceHistory} /> : <SignInPage active={false} signedInUser={signedInUser} signInStart={signInStart} signInStatus={signInStatus} onStartSignIn={startSignIn} />;
    if (active === "verify") return <ConnectedVerifyPage activeStart={activeStart} verificationStatus={verificationStatus} busy={busy} onStartVerification={startVerification} />;
    if (active === "ndi") return <ConnectedNDIPage activeStart={activeStart} verificationStatus={verificationStatus} />;
    if (active === "sdk") return signedInUser ? <SDKPage /> : <SignInPage active={false} signedInUser={signedInUser} signInStart={signInStart} signInStatus={signInStatus} onStartSignIn={startSignIn} />;
    return <HomePage setActive={setActive} signedInUser={signedInUser} />;
  }, [academicCertificateCountry, academicCertificateDraft, academicCertificateGradeScale, academicCertificateGradeValue, academicCertificateInstitution, academicCertificateIssueResult, academicCertificateIssueStatus, active, activeStart, busy, grades, holderDid, issuanceHistory, report, signInStart, signInStatus, signedInUser, studentIdDraft, studentIdIssueResult, studentIdIssueStatus, verificationStatus]);

  return (
    <PageWrap>
      <FixedCanvasBackground imageKey={activeBg} />
      <Navbar active={active} setActive={setActive} items={visibleNavItems} signedInUser={signedInUser} onSignOut={handleSignOut} />
      {error ? <div className="relative z-20 mx-auto mt-20 w-full max-w-5xl px-4 sm:px-6 lg:px-8"><div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div></div> : null}
      <AnimatePresence mode="wait">
        <motion.div key={active} className="relative z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>{page}</motion.div>
      </AnimatePresence>
      <BackgroundPicker selected={activeBg} onSelect={setManualBg} />
      <MobileNav active={active} setActive={setActive} items={visibleNavItems} />
    </PageWrap>
  );
}
