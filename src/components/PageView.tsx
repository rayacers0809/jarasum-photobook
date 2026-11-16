"use client";
import type { CSSProperties, ReactNode } from "react";
import { Book, PageDesc, imgUrl, pad, safeColor } from "@/lib/data";
import { Barcode, CoverInner } from "./Cover";

const BLEED = new Set(["MAIN CONCEPT", "ALL TOGETHER"]);

export type LockInfo = { loggedIn: boolean; tickets: number; busy: string | null; onUnlock: (pageId: string) => void };

export default function PageView({
  b, P, i, members, nextBook, onClose, onNext, lock,
}: {
  b: Book; P: PageDesc[]; i: number; members: Book[]; nextBook: Book | null;
  onClose: () => void; onNext: (id: string) => void; lock?: LockInfo;
}) {
  const pg = P[i];
  const G = b.kind === "group";
  const ac = { "--ac": safeColor(b.color) } as CSSProperties;
  const run = (
    <div className="run">
      <span>JARASUM · {b.en}</span>
      <span>{b.title}</span>
    </div>
  );
  const fol = <span className="folio">{pad(i + 1)}</span>;
  const paper = (h: ReactNode) => (
    <div className="pg paper" style={ac}>
      {h}
    </div>
  );

  switch (pg.k) {
    case "cover":
      return (
        <div className="pg" style={ac}>
          <div className="hard">
            <CoverInner b={b} />
          </div>
        </div>
      );
    case "title": {
      const seen: [string, number][] = [];
      P.forEach((x, j) => {
        if (x.k === "photo" && x.p && !seen.find((s) => s[0] === x.p!.section)) seen.push([x.p.section, j]);
      });
      return paper(
        <>
          {run}
          <div className="pp">
            <small className="k">{G ? "THE GROUP PHOTOBOOK" : "THE INDIVIDUAL PHOTOBOOK"}</small>
            {G ? (
              <>
                <h4 className="en">{b.en}</h4>
                <em>자라섬 단체 포토북</em>
              </>
            ) : (
              <>
                <h4>{b.name}</h4>
                <em>{b.en}</em>
              </>
            )}
            <div className="slg">“{b.slogan}”</div>
            <ol className="toc">
              {seen.map((s) => (
                <li key={s[0]}>
                  {s[0]}
                  <span>{pad(s[1] + 1)}</span>
                </li>
              ))}
              <li>
                CREDITS<span>{pad(P.length - 1)}</span>
              </li>
            </ol>
          </div>
          {fol}
        </>,
      );
    }
    case "profile": {
      const rows = String(b.profile || "")
        .split("\n").map((l) => l.trim()).filter(Boolean)
        .map((l) => {
          const k = l.indexOf(":");
          return k > 0 ? [l.slice(0, k).trim(), l.slice(k + 1).trim()] : ["", l];
        });
      return paper(
        <>
          {run}
          <div className="pp prof">
            <small className="k">PROFILE</small>
            <h4>{b.name}</h4>
            <em>{b.en}</em>
            <dl>
              {rows.map((r, j) => (
                <div key={j}>
                  <dt>{r[0]}</dt>
                  <dd>{r[1]}</dd>
                </div>
              ))}
            </dl>
            <div className="swatch">
              <i />
              SIGNATURE COLOR · {safeColor(b.color).toUpperCase()}
            </div>
            {b.description && <p>{b.description}</p>}
          </div>
          {fol}
        </>,
      );
    }
    case "roster":
      return paper(
        <>
          {run}
          <div className="pp">
            <small className="k">THE MEMBERS</small>
            <h4 className="en">
              Nine
              <br />
              <i>of us.</i>
            </h4>
            <div className="roster">
              {members.map((m) => (
                <div key={m.id} style={{ "--ac": safeColor(m.color) } as CSSProperties}>
                  <div className="hard">
                    {m.cover_path ? (
                      <img src={imgUrl(m.cover_path)} alt="" />
                    ) : (
                      <div className="rn">
                        {m.name}
                        <span>{m.en}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {fol}
        </>,
      );
    case "photo": {
      const p = pg.p!;
      if (p.locked) {
        const busy = lock?.busy === p.id;
        return paper(
          <>
            {run}
            <div className="fr">
              <div className="lockp">
                <div className="lk">🔒</div>
                <div className="tk">{p.section} · PHOTO {pad(pg.n || 0)}</div>
                <h4>Members only.</h4>
                <p>티켓 {b.ticket_cost}장으로 이 사진을 열면<br />영구 소장 + 저장 가능!</p>
                {lock?.loggedIn ? (
                  <>
                    <button disabled={busy} onClick={(e) => { e.stopPropagation(); lock.onUnlock(p.id); }}>
                      {busy ? "여는 중…" : `🎟 ${b.ticket_cost}장으로 보기`}
                    </button>
                    <small>보유 티켓 {lock.tickets}장</small>
                  </>
                ) : (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); lock?.onUnlock(p.id); }}>로그인하고 보기</button>
                    <small>가입하면 티켓 3장 선물</small>
                  </>
                )}
              </div>
            </div>
            <div className="fcap"><b>{p.section}</b>{p.caption && <span>{p.caption}</span>}</div>
            {fol}
          </>,
        );
      }
      const u = imgUrl(p.image_path);
      const full = BLEED.has(String(p.section).toUpperCase());
      const ph = (
        <div className="phx">
          <b>{pad(pg.n || 0)}</b>
          <span>{p.section}</span>
          <span>PHOTO COMING SOON</span>
        </div>
      );
      const cap = (
        <div className="fcap">
          <b>{p.section}</b>
          {p.caption && <span>{p.caption}</span>}
        </div>
      );
      if (full)
        return paper(
          <>
            <div className="bleed">
              {u ? (
                <>
                  <img src={u} alt={p.section} />
                  <div className="shd" />
                  {cap}
                </>
              ) : ph}
            </div>
            {!u && fol}
          </>,
        );
      return paper(
        <>
          {run}
          <div className="fr">{u ? <img src={u} alt={p.section} /> : ph}</div>
          {cap}
          {fol}
        </>,
      );
    }
    case "credits":
      return paper(
        <>
          {run}
          <div className="pp cred">
            <small className="k">{G ? "MESSAGE & CREDITS" : "CREDITS"}</small>
            <h4 className="en">
              Thank
              <br />
              <i>you.</i>
            </h4>
            {G && b.description && <p>{b.description}</p>}
            <pre>{b.credits}</pre>
          </div>
          {fol}
        </>,
      );
    case "end":
      return (
        <div className="pg" style={ac}>
          <div className="hard back">
            <div className="backc">
              <div className="cm">JARASUM</div>
              <small>THE OFFICIAL PHOTOBOOK · VOL.01</small>
              <div className="end">The End.</div>
              <button className="solid" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                CLOSE PHOTOBOOK
              </button>
              {nextBook && (
                <button onClick={(e) => { e.stopPropagation(); onNext(nextBook.id); }}>
                  NEXT · {nextBook.kind === "group" ? nextBook.en : nextBook.name} →
                </button>
              )}
              <Barcode />
            </div>
          </div>
        </div>
      );
  }
}
