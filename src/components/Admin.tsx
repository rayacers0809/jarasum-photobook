"use client";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import {
  Book, BookField, Page, SECTION_PRESETS, deletePage, fetchBooks, imgUrl, insertPage, pad,
  removeImage, safeColor, touchBook, updateBook, updatePage, uploadImage,
} from "@/lib/data";
import Viewer from "./Viewer";
import { useToast } from "./Toast";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function pickFiles(multiple: boolean): Promise<File[]> {
  return new Promise((res) => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "image/*"; i.multiple = multiple; i.style.display = "none";
    i.onchange = () => { res([...(i.files || [])]); i.remove(); };
    document.body.appendChild(i); i.click();
  });
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState<boolean | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [sel, setSel] = useState("rumung");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState<{ msg: string; ok: () => void } | null>(null);
  const { toast, node } = useToast();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => { setBooks(await fetchBooks()); }, []);

  useEffect(() => {
    if (!session) { setStaff(null); return; }
    sb.rpc("is_staff").then(({ data, error }) => {
      const ok = !error && data === true;
      setStaff(ok);
      if (ok) reload().catch((e) => toast("불러오기 실패: " + e.message));
    });
  }, [session, reload, toast]);

  const run = async (label: string, fn: () => Promise<void>, done?: string) => {
    setBusy(label);
    try { await fn(); await reload(); if (done) toast(done); }
    catch (e) { toast("실패: " + ((e as Error).message || e)); }
    finally { setBusy(""); }
  };

  const b = books.find((x) => x.id === sel);

  // optimistic text edits, debounced save
  const editBook = (f: BookField, v: string | boolean) => {
    if (!b) return;
    setBooks((bs) => bs.map((x) => (x.id === b.id ? { ...x, [f]: v } : x)));
    const key = `b:${b.id}:${f}`;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      updateBook(b.id, { [f]: v }).catch((e) => toast("저장 실패: " + e.message));
    }, f === "is_public" || f === "color" ? 0 : 600);
  };
  const editPage = (p: Page, f: "section" | "caption", v: string) => {
    setBooks((bs) => bs.map((x) => (x.id === p.book_id ? { ...x, pages: x.pages.map((y) => (y.id === p.id ? { ...y, [f]: v } : y)) } : x)));
    const key = `p:${p.id}:${f}`;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      updatePage(p.id, { [f]: v }).then(() => touchBook(p.book_id)).catch((e) => toast("저장 실패: " + e.message));
    }, 600);
  };

  if (!ready) return <div className="wrap admin"><p>LOADING…</p></div>;

  if (!session || staff === false) {
    return (
      <div className="wrap admin">
        <div className="ahead"><h2>ADMIN STUDIO</h2><a className="abtn" href={`${BASE}/`}>← 홈페이지</a></div>
        {staff === false && (
          <div className="anote">이 계정은 관리자 권한이 없어. 웹툰 관리자 계정으로 로그인해줘.
            <div style={{ marginTop: 10 }}><button className="abtn" onClick={() => sb.auth.signOut()}>로그아웃</button></div>
          </div>
        )}
        {!session && <Login onError={toast} />}
        {node}
      </div>
    );
  }

  return (
    <div className="wrap admin">
      <div className="ahead">
        <h2>ADMIN STUDIO</h2>
        <div className="row">
          <a className="abtn" href={`${BASE}/`}>← 홈페이지</a>
          <button className="abtn" onClick={() => sb.auth.signOut()}>로그아웃</button>
        </div>
      </div>
      <div className="anote">사진을 올리거나 문구를 고치면 <b>바로 저장</b>되고 홈페이지에 즉시 반영돼. 사진은 자동으로 최적화(최대 2000px)돼서 올라가.{busy && <><br /><b style={{ color: "#cdb07a" }}>{busy}…</b></>}</div>
      <div className="chips">
        {books.map((x) => (
          <button key={x.id} className={`chip${x.id === sel ? " on" : ""}${x.is_public ? "" : " priv"}`} style={{ "--ac": safeColor(x.color) } as CSSProperties} onClick={() => setSel(x.id)}>
            <i />{x.kind === "group" ? "단체 · " + x.en : x.name}
          </button>
        ))}
      </div>

      {b && (
        <>
          <div className="acard">
            <h3>
              <span>{b.kind === "group" ? b.en : b.name} 포토북</span>
              <label className="sw"><input type="checkbox" checked={b.is_public} onChange={(e) => editBook("is_public", e.target.checked)} />{b.is_public ? "공개" : "비공개"}</label>
            </h3>
            <div className="row"><button className="abtn pri" onClick={() => setPreview(true)}>뷰어로 미리보기</button></div>
          </div>

          <div className="acard">
            <h3>타이틀 · 설명</h3>
            <div className="fgrid">
              <label className="f">{b.kind === "group" ? "단체 포토북 이름" : "멤버 이름"}<input value={b.name} onChange={(e) => editBook("name", e.target.value)} /></label>
              <label className="f">영문 표기 (표지 타이포)<input value={b.en} onChange={(e) => editBook("en", e.target.value)} /></label>
              <label className="f">에디션 타이틀<input value={b.title} onChange={(e) => editBook("title", e.target.value)} /></label>
              <label className="f">대표 컬러<input type="color" value={safeColor(b.color)} onChange={(e) => editBook("color", e.target.value)} /></label>
              <label className="f full">슬로건<input value={b.slogan} onChange={(e) => editBook("slogan", e.target.value)} /></label>
              {b.kind === "member" && <label className="f full">프로필 (한 줄에 &quot;항목: 내용&quot;)<textarea value={b.profile} onChange={(e) => editBook("profile", e.target.value)} /></label>}
              <label className="f full">{b.kind === "group" ? "단체 메시지 (엔딩·소개)" : "소개 문구"}<textarea value={b.description} onChange={(e) => editBook("description", e.target.value)} /></label>
              <label className="f full">크레딧<textarea value={b.credits} onChange={(e) => editBook("credits", e.target.value)} /></label>
            </div>
          </div>

          <div className="acard">
            <h3>공식 표지</h3>
            <div className="coverbox">
              <div className="cthumb">{b.cover_path ? <img src={imgUrl(b.cover_path)} alt="" /> : <>표지 없음<br />(타이포 표지)</>}</div>
              <div className="row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <button className="abtn pri" disabled={!!busy} onClick={async () => {
                  const [f] = await pickFiles(false); if (!f) return;
                  run("표지 업로드 중", async () => { const old = b.cover_path; const path = await uploadImage(b.id, f); await updateBook(b.id, { cover_path: path }); await removeImage(old); }, "표지 업로드 완료");
                }}>{b.cover_path ? "표지 교체" : "표지 업로드"}</button>
                {b.cover_path && <button className="abtn warn" disabled={!!busy} onClick={() => setConfirm({ msg: "표지 이미지를 삭제할까?", ok: () => run("삭제 중", async () => { await updateBook(b.id, { cover_path: null }); await removeImage(b.cover_path); }, "표지 삭제됨") })}>표지 삭제</button>}
                <span style={{ fontSize: 11, color: "#857a70", lineHeight: 1.6 }}>3:4 비율 권장</span>
              </div>
            </div>
          </div>

          <div className="acard">
            <h3><span>내지 페이지 ({b.pages.length})</span></h3>
            <div className="row" style={{ marginBottom: 12 }}>
              <button className="abtn pri" disabled={!!busy} onClick={async () => {
                const fs = await pickFiles(true); if (!fs.length) return;
                run(`${fs.length}장 업로드 중`, async () => {
                  let pos = Math.max(0, ...b.pages.map((p) => p.position));
                  const sec = b.pages.length ? b.pages[b.pages.length - 1].section : "GALLERY";
                  for (const f of fs) { const path = await uploadImage(b.id, f); await insertPage(b.id, ++pos, sec, path); }
                  await touchBook(b.id);
                }, `${fs.length}장 추가 완료`);
              }}>사진 여러 장 추가</button>
              <button className="abtn" disabled={!!busy} onClick={() => run("추가 중", async () => { await insertPage(b.id, Math.max(0, ...b.pages.map((p) => p.position)) + 1, "GALLERY", null); await touchBook(b.id); })}>빈 페이지 추가</button>
            </div>
            <div className="plist">
              {b.pages.map((p, i) => (
                <div key={p.id} className="pitem">
                  <div className="pt">{p.image_path ? <img src={imgUrl(p.image_path)} alt="" /> : "EMPTY"}</div>
                  <div className="pf">
                    <div className="top"><span className="pn">{pad(i + 1)}</span><input value={p.section} placeholder="섹션 (예: CLOSE-UP)" list="secList" onChange={(e) => editPage(p, "section", e.target.value)} /></div>
                    <input value={p.caption} placeholder="캡션 (선택)" onChange={(e) => editPage(p, "caption", e.target.value)} />
                    <div className="row">
                      <button className="abtn sm" disabled={!i || !!busy} onClick={() => run("순서 변경", async () => { const q = b.pages[i - 1]; await updatePage(p.id, { position: q.position }); await updatePage(q.id, { position: p.position }); await touchBook(b.id); })}>↑</button>
                      <button className="abtn sm" disabled={i >= b.pages.length - 1 || !!busy} onClick={() => run("순서 변경", async () => { const q = b.pages[i + 1]; await updatePage(p.id, { position: q.position }); await updatePage(q.id, { position: p.position }); await touchBook(b.id); })}>↓</button>
                      <button className="abtn sm" disabled={!!busy} onClick={async () => {
                        const [f] = await pickFiles(false); if (!f) return;
                        run("업로드 중", async () => { const old = p.image_path; const path = await uploadImage(b.id, f); await updatePage(p.id, { image_path: path }); await removeImage(old); await touchBook(b.id); }, "사진 반영 완료");
                      }}>{p.image_path ? "교체" : "업로드"}</button>
                      {p.image_path && <button className="abtn sm" disabled={!!busy} onClick={() => setConfirm({ msg: `${pad(i + 1)}번 페이지 사진을 삭제할까?`, ok: () => run("삭제 중", async () => { await updatePage(p.id, { image_path: null }); await removeImage(p.image_path); await touchBook(b.id); }, "사진 삭제됨") })}>사진 삭제</button>}
                      <button className="abtn sm warn" disabled={!!busy} onClick={() => setConfirm({ msg: `${pad(i + 1)}번 페이지를 통째로 삭제할까?`, ok: () => run("삭제 중", async () => { await deletePage(p.id); await removeImage(p.image_path); await touchBook(b.id); }, "페이지 삭제됨") })}>페이지 삭제</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <datalist id="secList">{SECTION_PRESETS.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        </>
      )}

      {preview && b && <Viewer key={b.id} book={b} books={books} onClose={() => setPreview(false)} onOpenBook={(id) => setSel(id)} toast={toast} />}
      {confirm && (
        <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div>
            <p>{confirm.msg}</p>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="abtn" onClick={() => setConfirm(null)}>취소</button>
              <button className="abtn warn" onClick={() => { const c = confirm; setConfirm(null); c.ok(); }}>삭제</button>
            </div>
          </div>
        </div>
      )}
      {node}
    </div>
  );
}

function Login({ onError }: { onError: (m: string) => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="acard"
      style={{ maxWidth: 420 }}
      onSubmit={async (e) => {
        e.preventDefault(); setLoading(true);
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        setLoading(false);
        if (error) onError("로그인 실패: " + error.message);
      }}
    >
      <h3>관리자 로그인</h3>
      <div className="fgrid" style={{ gridTemplateColumns: "1fr" }}>
        <label className="f">이메일<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="f">비밀번호<input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
        <button className="abtn pri" type="submit" disabled={loading}>{loading ? "로그인 중…" : "로그인"}</button>
        <span style={{ fontSize: 11, color: "#857a70" }}>자라섬 웹툰 관리자 계정과 같은 계정이야.</span>
      </div>
    </form>
  );
}
