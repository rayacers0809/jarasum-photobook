"use client";
import type { CSSProperties } from "react";
import { Book, imgUrl, safeColor } from "@/lib/data";

export function Barcode() {
  return (
    <div className="bcode">
      <i />
      <b>9 791126 2026</b>
    </div>
  );
}

function enSize(t: string, max: number, k: number) {
  const w = Math.max(4, ...String(t).split(/\s+/).map((s) => s.length));
  return Math.min(max, k / w);
}

/** Typographic magazine cover (or the uploaded cover image). Sized with container units. */
export function CoverInner({ b }: { b: Book }) {
  if (b.cover_path) return <img src={imgUrl(b.cover_path)} alt={`${b.name} 표지`} loading="lazy" />;
  const G = b.kind === "group";
  return (
    <div className="cvr">
      <div className="cm">JARASUM</div>
      <div className="cbar">
        <span>{b.title}</span>
        <span>VOL.01 · 2026</span>
      </div>
      <div className="cmid">
        <small>{G ? "THE OFFICIAL GROUP ISSUE" : "THE OFFICIAL PHOTOBOOK"}</small>
        <div className="cen" style={{ fontSize: `${enSize(b.en, G ? 17 : 22, G ? 100 : 112)}cqw` }}>{b.en}</div>
        {!G && <div className="cko">{b.name}</div>}
      </div>
      <div className="cfoot">
        <div className="sl">{b.slogan}</div>
        <Barcode />
      </div>
    </div>
  );
}

export function WideInner({ b, members }: { b: Book; members: Book[] }) {
  if (b.cover_path) return <img src={imgUrl(b.cover_path)} alt="단체 포토북 표지" loading="lazy" />;
  return (
    <div className="wcv">
      <div className="cm">JARASUM</div>
      <div className="wk">
        {b.title}
        <br />
        GROUP ISSUE · VOL.01
      </div>
      <div className="wt">
        <b>{b.en}.</b>
        {b.slogan}
      </div>
      <div className="wn">{members.map((m) => m.name).join(" · ")}</div>
      <Barcode />
    </div>
  );
}

/** A physical hardcover: fore-edge pages, spine crease, gloss. */
export function BookObject({
  b, members, wide = false, cap = true, label, onOpen,
}: {
  b: Book; members: Book[]; wide?: boolean; cap?: boolean; label?: string; onOpen?: (id: string, page?: number) => void;
}) {
  const off = !b.is_public;
  return (
    <button
      className={`bk${wide ? " wide" : ""}${off ? " off" : ""}`}
      style={{ "--ac": safeColor(b.color) } as CSSProperties}
      onClick={() => onOpen?.(b.id)}
      aria-label={`${b.name} 포토북 열기`}
    >
      <span className="bko">
        <span className="fore" />
        <span className="hc">
          <span className="hard">{wide ? <WideInner b={b} members={members} /> : <CoverInner b={b} />}</span>
        </span>
      </span>
      {cap && (
        <span className="cap">
          <b>{wide ? b.en : b.name}</b>
          <small>{off ? "COMING SOON" : label || "SPECIAL"}</small>
        </span>
      )}
    </button>
  );
}
