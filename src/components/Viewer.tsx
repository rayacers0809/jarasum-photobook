"use client";
import { CSSProperties, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Book, bookPages, downloadUrl, imgUrl, pad, safeColor, spreads, unlockPhoto } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import PageView from "./PageView";

type Anim = { to: number; dir: 1 | -1 };

export default function Viewer({
  book, books, startPage = 0, onClose, onOpenBook, toast, onUnlocked,
}: {
  book: Book; books: Book[]; startPage?: number; onClose: () => void;
  onOpenBook: (id: string) => void; toast: (t: string) => void; onUnlocked?: () => Promise<unknown> | void;
}) {
  const { me, refresh } = useAuth();
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const doUnlock = async (pageId: string) => {
    if (!me) { location.href = `${BASE}/login/?next=${encodeURIComponent(`/?book=${book.id}`)}`; return; }
    setUnlocking(pageId);
    try {
      await unlockPhoto(pageId);
      await refresh();
      await onUnlocked?.();
      toast("사진을 열었어! 영구 소장 ✨");
    } catch (e) { toast((e as Error).message); }
    finally { setUnlocking(null); }
  };
  const P = useMemo(() => bookPages(book), [book]);
  const members = useMemo(() => books.filter((x) => x.kind === "member" && x.is_official), [books]);
  const nextBook = useMemo(() => {
    const pub = books.filter((x) => x.is_public);
    const i = pub.findIndex((x) => x.id === book.id);
    return pub.length > 1 ? pub[(i + 1) % pub.length] : null;
  }, [books, book.id]);

  const [two, setTwo] = useState(false);
  const [dim, setDim] = useState({ pw: 300, ph: 400 });
  const [si, setSi] = useState(0);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [hint, setHint] = useState(true);
  const [zoom, setZoom] = useState<string | null>(null);
  const [z2, setZ2] = useState(false);

  const S = useMemo(() => spreads(P.length, two), [P.length, two]);
  const pageRef = useRef(Math.min(startPage, P.length - 1));
  const viewerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const swiped = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // re-map current page whenever the spread layout changes
  useEffect(() => { setSi(Math.max(0, S.findIndex((s) => s.includes(pageRef.current)))); }, [S]);
  useEffect(() => { const s = S[si]; if (s) pageRef.current = s.find((x) => x != null) ?? 0; }, [si, S]);

  const fit = useCallback(() => {
    const st = stageRef.current; if (!st) return;
    const t = innerWidth >= 900 && innerWidth > innerHeight * 1.1;
    const W = st.clientWidth - (t ? 70 : 40), H = st.clientHeight - (t ? 40 : 24);
    const ph = Math.max(200, Math.min(H, W / (t ? 2 : 1) / 0.75));
    setDim({ pw: ph * 0.75, ph });
    setTwo(t);
  }, []);

  useEffect(() => {
    fit();
    let tm: ReturnType<typeof setTimeout>;
    const r = () => { clearTimeout(tm); tm = setTimeout(fit, 80); };
    addEventListener("resize", r);
    const fs = () => setTimeout(fit, 60);
    document.addEventListener("fullscreenchange", fs);
    document.body.classList.add("lock");
    const h = setTimeout(() => setHint(false), 2600);
    return () => { removeEventListener("resize", r); document.removeEventListener("fullscreenchange", fs); document.body.classList.remove("lock"); clearTimeout(h); };
  }, [fit]);

  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  }, [onClose]);

  const go = useCallback((d: 1 | -1) => {
    if (anim) return;
    const t = si + d;
    if (t < 0) return;
    if (t >= S.length) { close(); return; }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setSi(t); return; }
    setAnim({ to: t, dir: d });
  }, [anim, si, S.length, close]);

  // run the page-turn animation on the freshly rendered leaf
  useLayoutEffect(() => {
    const leaf = leafRef.current;
    if (!anim || !leaf) return;
    let frames: Keyframe[], shade: Keyframe[], dur: number;
    if (!two) {
      dur = 620;
      if (anim.dir > 0) { frames = [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-96deg)", opacity: 0.55, offset: 0.85 }, { transform: "rotateY(-100deg)", opacity: 0 }]; shade = [{ opacity: 0 }, { opacity: 1 }]; }
      else { frames = [{ transform: "rotateY(-100deg)", opacity: 0 }, { transform: "rotateY(-96deg)", opacity: 0.55, offset: 0.15 }, { transform: "rotateY(0deg)", opacity: 1 }]; shade = [{ opacity: 1 }, { opacity: 0 }]; }
    } else {
      dur = 900;
      frames = [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${anim.dir > 0 ? -180 : 180}deg)` }];
      shade = [{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }];
    }
    const shades = [...leaf.querySelectorAll<HTMLElement>(".fs")].map((f) => f.animate(shade, { duration: dur, easing: "ease-in-out", fill: "forwards" }));
    const a = leaf.animate(frames, { duration: dur, easing: "cubic-bezier(.45,.05,.3,1)", fill: "forwards" });
    let live = true;
    a.onfinish = () => { if (!live) return; setSi(anim.to); setAnim(null); };
    return () => { live = false; a.cancel(); shades.forEach((x) => x.cancel()); };
  }, [anim, two]);

  // keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (zoom) { if (e.key === "Escape") setZoom(null); return; }
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") {
        if (document.fullscreenElement) return;
        if (immersive) { setImmersive(false); return; }
        close();
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [go, close, zoom, immersive]);

  const toggleFs = async () => {
    const el = viewerRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el?.requestFullscreen) await el.requestFullscreen();
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else throw 0;
    } catch {
      setImmersive((v) => { toast(!v ? "몰입 모드 · 가운데를 탭하면 메뉴 표시" : "몰입 모드 해제"); return !v; });
    }
  };

  const view = anim ? S[anim.to] : S[si];
  const cur = S[si];
  if (!cur || !view) return null;

  const currentImg = () => {
    for (const i of [...view].reverse()) {
      if (i == null) continue;
      const pg = P[i];
      const k = pg.k === "photo" ? pg.p?.image_path : pg.k === "cover" ? book.cover_path : null;
      if (k) return imgUrl(k);
    }
    return "";
  };
  const saveTarget = (() => {
    for (const i of [...view].reverse()) {
      if (i == null) continue;
      const pg = P[i];
      if (pg.k === "photo" && pg.p?.image_path) return downloadUrl(pg.p.image_path, `jarasum-${book.en}-${pad(pg.n || 0)}.jpg`.replace(/\s+/g, "_"));
      if (pg.k === "cover" && book.cover_path) return downloadUrl(book.cover_path, `jarasum-${book.en}-cover.jpg`.replace(/\s+/g, "_"));
    }
    return null;
  })();
  const openZoom = () => { const u = currentImg(); if (!u) { toast("이 페이지엔 확대할 사진이 없어"); return; } setZ2(false); setZoom(u); };

  const page = (i: number | null) =>
    i == null ? <div className="pg blank" /> : (
      <PageView b={book} P={P} i={i} members={members} nextBook={nextBook} onClose={close} onNext={(id) => onOpenBook(id)}
        lock={{ loggedIn: !!me, tickets: me?.tickets ?? 0, busy: unlocking, onUnlock: doUnlock }} />
    );
  const slot = (i: number | null, side: "L" | "R") => (
    <div key={`s-${side}-${i}`} className={`slot ${side}${i == null ? "" : " has"}`}>{i != null && page(i)}</div>
  );
  const face = (i: number | null, side: "L" | "R", back = false) => (
    <div className={`face ${side}${back ? " bf" : ""}`}>{page(i)}<i className="fs" /></div>
  );
  const leaf = (cls: string, children: ReactNode) => <div key="leaf" ref={leafRef} className={`leaf ${cls}`}>{children}</div>;

  let content: ReactNode;
  if (!anim) content = two ? <>{slot(cur[0], "L")}{slot(cur[1], "R")}</> : slot(cur[0], "R");
  else {
    const nx = S[anim.to];
    if (!two) content = anim.dir > 0 ? <>{slot(nx[0], "R")}{leaf("l", face(cur[0], "R"))}</> : <>{slot(cur[0], "R")}{leaf("l", face(nx[0], "R"))}</>;
    else content = anim.dir > 0
      ? <>{slot(cur[0], "L")}{slot(nx[1], "R")}{leaf("r", <>{face(cur[1], "R")}{face(nx[0], "L", true)}</>)}</>
      : <>{slot(nx[0], "L")}{slot(cur[1], "R")}{leaf("l2", <>{face(cur[0], "L")}{face(nx[1], "R", true)}</>)}</>;
  }

  const cls = two ? (view[0] == null ? "cf" : view[1] == null ? "cb" : "open") : "one";
  const target = anim ? anim.to : si;
  const prog = S.length > 1 ? target / (S.length - 1) : 0;
  const maxStack = Math.min(14, Math.max(4, P.length * 0.7));
  const solo = !two && (P[view[0]!]?.k === "cover" || P[view[0]!]?.k === "end");
  const real = cur.filter((x): x is number => x != null);

  const onStageClick = (e: React.MouseEvent) => {
    if (swiped.current || (e.target as HTMLElement).closest("button")) return;
    const r = stageRef.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.38) go(-1); else if (x > 0.62) go(1); else setImmersive((v) => !v);
  };

  return (
    <div ref={viewerRef} className={`viewer${immersive ? " immersive" : ""}`} style={{ "--ac": safeColor(book.color) } as CSSProperties}>
      <div className="vbar">
        <div className="vt">
          <b>{book.kind === "group" ? book.en : `${book.name} · ${book.en}`}</b>
          <span>{book.title} · {book.kind === "group" ? "GROUP" : "INDIVIDUAL"} PHOTOBOOK</span>
        </div>
        <div className="vbtns">
          {saveTarget && (
            <a className="ib" href={saveTarget} download aria-label="사진 저장" title="사진 저장" onClick={() => toast("사진 저장 중…")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
            </a>
          )}
          <button className="ib" onClick={openZoom} aria-label="확대">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5M11 8v6M8 11h6" /></svg>
          </button>
          <button className="ib" onClick={toggleFs} aria-label="전체 화면">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          </button>
          <button className="ib" onClick={close} aria-label="닫기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="vstage"
        onClick={onStageClick}
        onDoubleClick={(e) => { e.preventDefault(); openZoom(); }}
        onTouchStart={(e) => { touch.current = e.touches.length > 1 ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const s = touch.current; touch.current = null; if (!s) return;
          const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            swiped.current = true; go(dx < 0 ? 1 : -1); setTimeout(() => (swiped.current = false), 450);
          }
        }}
      >
        <div
          className={`book ${cls}`}
          style={{
            "--pw": `${dim.pw}px`, "--ph": `${dim.ph}px`,
            "--sl": `${(2 + maxStack * prog).toFixed(1)}px`, "--sr": `${(2 + maxStack * (1 - prog)).toFixed(1)}px`,
          } as CSSProperties}
        >
          <div className="board" />
          {two && <div className="stk l" />}
          {content}
          {!solo && <div className="stk r" />}
        </div>
        <div className="hint" style={{ opacity: hint ? 1 : 0 }}>SWIPE · TAP EDGES TO TURN</div>
      </div>

      <div className="vfoot">
        <button className="nav" onClick={() => go(-1)} style={{ visibility: si > 0 ? "visible" : "hidden" }}>‹ PREV</button>
        <div className="vcount">
          <span>{(real.length > 1 ? `${pad(real[0] + 1)}–${pad(real[1] + 1)}` : pad((real[0] ?? 0) + 1)) + ` / ${pad(P.length)}`}</span>
          <div className="vprog"><i style={{ width: `${((si + 1) / S.length) * 100}%` }} /></div>
        </div>
        <button className="nav" onClick={() => go(1)}>{si >= S.length - 1 ? "CLOSE ✕" : si === 0 ? "OPEN ›" : "NEXT ›"}</button>
      </div>

      {zoom && (
        <div ref={zoomRef} className={`zoom${z2 ? " z2" : ""}`}>
          <img
            src={zoom} alt=""
            onClick={(e) => {
              const el = e.currentTarget, z = zoomRef.current!;
              const rx = e.nativeEvent.offsetX / el.clientWidth, ry = e.nativeEvent.offsetY / el.clientHeight;
              setZ2((v) => {
                if (!v) requestAnimationFrame(() => { z.scrollLeft = rx * z.scrollWidth - z.clientWidth / 2; z.scrollTop = ry * z.scrollHeight - z.clientHeight / 2; });
                return !v;
              });
            }}
          />
          <button className="ib" onClick={() => setZoom(null)} aria-label="확대 닫기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
