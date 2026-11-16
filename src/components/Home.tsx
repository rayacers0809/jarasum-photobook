"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Book, fetchBooks, imgUrl, pad } from "@/lib/data";
import { BookObject } from "./Cover";
import Viewer from "./Viewer";
import { useToast } from "./Toast";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Home() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<{ id: string; page: number } | null>(null);
  const { toast, node } = useToast();

  useEffect(() => {
    fetchBooks()
      .then((bs) => {
        setBooks(bs);
        const q = new URLSearchParams(location.search).get("book");
        const b = q && bs.find((x) => x.id === q && x.is_public);
        if (b) setOpen({ id: b.id, page: 0 });
      })
      .catch((e) => setErr(String(e?.message || e)));
  }, []);

  const members = useMemo(() => (books || []).filter((b) => b.kind === "member"), [books]);
  const group = useMemo(() => (books || []).find((b) => b.kind === "group"), [books]);

  const openBook = useCallback((id: string, page = 0) => {
    const b = books?.find((x) => x.id === id);
    if (!b) return;
    if (!b.is_public) { toast("곧 공개될 포토북이야"); return; }
    setOpen({ id, page });
    try { history.replaceState(null, "", `${BASE}/?book=${id}`); } catch {}
  }, [books, toast]);

  const closeBook = useCallback(() => {
    setOpen(null);
    try { history.replaceState(null, "", `${BASE}/#individual`); } catch {}
  }, []);

  const updates = useMemo(
    () => [...(books || [])].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 5),
    [books],
  );
  const fmt = (t: string) => { const d = new Date(t); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
  const fan = members.filter((b) => b.is_public);
  const fanBooks = [fan[1] || members[1], fan[0] || members[0], fan[2] || members[2]].filter(Boolean) as Book[];
  const openBookData = open && books?.find((b) => b.id === open.id);

  return (
    <>
      <div className="ribbon">JARASUM OFFICIAL DIGITAL PHOTOBOOK · SPECIAL EDITION · VOL.01</div>
      <header className="site wrap">
        <a className="logo" href="#top" id="top">JARASUM<small>THE OFFICIAL PHOTOBOOK</small></a>
        <nav className="main">
          <a href="#individual">INDIVIDUAL</a><a href="#group">GROUP</a><a href="#updates" className="hide-m">UPDATES</a><a href="#about">ABOUT</a>
        </nav>
      </header>

      <section className="hero wrap">
        <div>
          <div className="hero-meta"><span>VOL.01 — 2026</span><span>NINE ICONS · ONE MOMENT</span></div>
          <h1>Special<br /><i>Edition.</i></h1>
          <p>멤버 한 명 한 명이 하나의 브랜드가 되는 곳.<br />손끝으로 넘겨보는 자라섬 공식 디지털 포토북.</p>
          <div className="cta">
            <a className="btn solid" href="#individual">COLLECTION ↓</a>
            {group && <button className="btn" onClick={() => openBook(group.id)}>GROUP ISSUE ↗</button>}
          </div>
        </div>
        <div className="fan">{fanBooks.map((b) => <BookObject key={b.id} b={b} members={members} cap={false} onOpen={openBook} />)}</div>
      </section>
      <div className="marquee"><span>NINE INDIVIDUAL PHOTOBOOKS　✦　ONE GROUP PHOTOBOOK　✦　JARASUM SPECIAL EDITION　✦　THE OFFICIAL DIGITAL MAGAZINE　✦　NINE INDIVIDUAL PHOTOBOOKS　✦　ONE GROUP PHOTOBOOK　✦</span></div>

      <section className="collection wrap" id="individual">
        <div className="panel">
          <div className="phead">
            <div><div className="kick">01 / SPECIAL EDITION</div><h2>INDIVIDUAL COLLECTION</h2></div>
            <div className="iss">NINE BOOKS<br />VOL.01</div>
          </div>
          {err && <p style={{ color: "#ff9a9a", fontSize: 13 }}>불러오기 실패: {err}</p>}
          {!books && !err && <p style={{ color: "#9b928a", fontSize: 12, letterSpacing: ".2em" }}>LOADING…</p>}
          <div className="grid">{members.map((b) => <BookObject key={b.id} b={b} members={members} onOpen={openBook} />)}</div>
          <div className="sep">THE GROUP ISSUE</div>
          {group && <BookObject b={group} members={members} wide label="JARASUM GROUP PHOTOBOOK" onOpen={openBook} />}
          <button className="down" aria-label="아래로" onClick={() => document.getElementById("group")?.scrollIntoView()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v15M5 12l7 7 7-7" /></svg>
          </button>
        </div>
      </section>

      {group && (
        <section className="sec wrap" id="group">
          <div className="sec-head">
            <div><div className="kicker">02 / GROUP COLLECTION</div><h3 className="big">One frame.<br /><i>All of us.</i></h3></div>
            <div className="note">9 MEMBERS<br />1 OFFICIAL GROUP ISSUE</div>
          </div>
          <div className="group-wrap">
            <BookObject b={group} members={members} label="GROUP ISSUE" onOpen={openBook} />
            <div className="gcopy">
              <div className="kicker">{group.en} · {group.title}</div>
              <p>{group.description}</p>
              <div className="thumbs">
                {group.pages.slice(0, 4).map((p, i) => (
                  <button key={p.id} className="thumb" onClick={() => openBook(group.id, 3 + i)}>
                    {p.image_path ? <img src={imgUrl(p.image_path)} alt="" loading="lazy" /> : p.section}
                  </button>
                ))}
              </div>
              <div className="row"><button className="btn solid" onClick={() => openBook(group.id)}>포토북 펼쳐보기 ↗</button></div>
            </div>
          </div>
        </section>
      )}

      <section className="sec wrap" id="updates">
        <div className="sec-head"><div><div className="kicker">03 / LATEST</div><h3 className="big"><i>Updates.</i></h3></div></div>
        <div className="updates">
          {updates.map((b) => (
            <div key={b.id} className="upd" onClick={() => openBook(b.id)}>
              <time>{fmt(b.updated_at)}</time>
              <div><b>{b.kind === "group" ? b.en : b.name}</b> — {b.title} {b.is_public ? "업데이트" : "준비 중"}</div>
              <small>{b.kind === "group" ? "GROUP" : "INDIVIDUAL"} ↗</small>
            </div>
          ))}
        </div>
      </section>

      <section className="about wrap" id="about">
        <div className="kicker">JARASUM — THE OFFICIAL PHOTOBOOK</div>
        <p>“A face, a style, a moment.<br />Make it unforgettable.”</p>
        <div className="ko">자라섬 공식 디지털 포토북은 단순한 갤러리가 아닌, 멤버 개개인을 하나의 브랜드로 담아내는 프리미엄 디지털 매거진입니다. 9권의 개인 포토북과 1권의 단체 포토북으로 구성됩니다.</div>
      </section>

      <footer className="site wrap">
        <div><b>JARASUM</b><br />THE OFFICIAL DIGITAL PHOTOBOOK<br />SPECIAL EDITION · VOL.01</div>
        <div style={{ textAlign: "right" }}>© 2026 JARASUM<br /><a href={`${BASE}/admin/`}>ADMIN STUDIO</a></div>
      </footer>

      {openBookData && books && (
        <Viewer key={openBookData.id} book={openBookData} books={books} startPage={open!.page} onClose={closeBook} onOpenBook={(id) => openBook(id)} toast={toast} />
      )}
      {node}
    </>
  );
}
