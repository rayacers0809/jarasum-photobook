"use client";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  Book, BookField, CAPTION_SIZES, CaptionSize, Member, Page, SECTION_PRESETS, createAlbum, deleteBook, deletePage, fetchBooks, fetchMembers, imgUrl, insertPage, pad,
  removeImage, rpcError, safeColor, touchBook, updateBook, updatePage, uploadImage,
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

type App = { id: string; user_id: string; member_id: string; member_name: string; streamer_name: string; soop_id: string; message: string; status: string; created_at: string; nickname: string | null; email: string | null };
type Editor = { user_id: string; member_id: string; member_name: string; nickname: string | null; email: string | null };

export default function Admin() {
  const { ready, me } = useAuth();
  const staff = !!me?.is_staff;
  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [tab, setTab] = useState<"albums" | "apps">("albums");
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState<{ msg: string; ok: () => void } | null>(null);
  const { toast, node } = useToast();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const canEdit = !!me && (me.is_staff || me.editor_members.length > 0);
  const reload = useCallback(async () => {
    const [bs, ms] = await Promise.all([fetchBooks(), fetchMembers()]);
    setBooks(bs); setMembers(ms);
  }, []);
  const reloadApps = useCallback(async () => {
    const [a, e] = await Promise.all([sb.rpc("jr_list_applications"), sb.rpc("jr_list_editors")]);
    setApps((a.data as App[]) || []); setEditors((e.data as Editor[]) || []);
  }, []);

  useEffect(() => { if (ready && !me) location.href = `${BASE}/login/?next=/admin/`; }, [ready, me]);
  useEffect(() => {
    if (!canEdit) return;
    reload().catch((e) => toast("불러오기 실패: " + e.message));
    if (staff) reloadApps();
  }, [canEdit, staff, reload, reloadApps, toast]);

  const run = async (label: string, fn: () => Promise<void>, done?: string) => {
    setBusy(label);
    try { await fn(); await reload(); if (done) toast(done); }
    catch (e) { toast("실패: " + ((e as Error).message || e)); }
    finally { setBusy(""); }
  };

  const mine = books.filter((x) => staff || (x.member_id && me?.editor_members.includes(x.member_id)));
  const b = mine.find((x) => x.id === sel) || mine[0];
  const myMembers = members.filter((m) => staff || me?.editor_members.includes(m.id));
  const pendingCount = apps.filter((a) => a.status === "pending").length;

  // optimistic text edits, debounced save
  const editBook = (f: BookField, v: string | boolean | number) => {
    if (!b) return;
    setBooks((bs) => bs.map((x) => (x.id === b.id ? { ...x, [f]: v } : x)));
    const key = `b:${b.id}:${f}`;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      updateBook(b.id, { [f]: v }).catch((e) => toast("저장 실패: " + e.message));
    }, f === "is_public" || f === "color" ? 0 : 600);
  };
  const editPage = (p: Page, f: "section" | "caption" | "caption_size", v: string) => {
    setBooks((bs) => bs.map((x) => (x.id === p.book_id ? { ...x, pages: x.pages.map((y) => (y.id === p.id ? { ...y, [f]: v } : y)) } : x)));
    const key = `p:${p.id}:${f}`;
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      updatePage(p.id, { [f]: v }).then(() => touchBook(p.book_id)).catch((e) => toast("저장 실패: " + e.message));
    }, f === "caption_size" ? 0 : 600);
  };

  if (!ready || !me) return <div className="wrap admin"><p>LOADING…</p></div>;

  if (!canEdit) {
    return (
      <div className="wrap admin">
        <div className="ahead"><h2>ALBUM STUDIO</h2><a className="abtn" href={`${BASE}/`}>← 홈페이지</a></div>
        <div className="anote">앨범 스튜디오는 승인된 자라섬 멤버만 쓸 수 있어.
          {me.application?.status === "pending" ? " 지금 신청을 심사하고 있어!" : " 멤버 본인이라면 마이페이지에서 권한을 신청해줘."}
          <div style={{ marginTop: 10 }}><a className="abtn pri" href={`${BASE}/me/`}>마이페이지 →</a></div>
        </div>
        {node}
      </div>
    );
  }

  return (
    <div className="wrap admin">
      <div className="ahead">
        <h2>{staff ? "ADMIN STUDIO" : "ALBUM STUDIO"}</h2>
        <div className="row">
          <a className="abtn" href={`${BASE}/`}>← 홈페이지</a>
          <a className="abtn" href={`${BASE}/me/`}>마이</a>
        </div>
      </div>
      <div className="anote">{staff ? "관리자 모드: 모든 앨범 + 스트리머 권한 신청을 관리해." : `${myMembers.map((m) => m.name).join(", ")} 앨범만 만들고 고칠 수 있어.`} 사진·문구는 <b>바로 저장</b>되고 사이트에 즉시 반영돼.{busy && <><br /><b style={{ color: "#cdb07a" }}>{busy}…</b></>}</div>
      {staff && (
        <div className="tabs2" style={{ maxWidth: 420 }}>
          <button className={tab === "albums" ? "on" : ""} onClick={() => setTab("albums")}>앨범</button>
          <button className={tab === "apps" ? "on" : ""} onClick={() => { setTab("apps"); reloadApps(); }}>권한 신청{pendingCount ? ` (${pendingCount})` : ""}</button>
        </div>
      )}

      {tab === "apps" && staff && (
        <>
          <div className="acard">
            <h3>스트리머 권한 신청</h3>
            {apps.length === 0 && <p style={{ fontSize: 13, color: "#857a70", margin: 0 }}>아직 신청이 없어.</p>}
            {apps.map((a) => (
              <div key={a.id} className="approw">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <b>{a.member_name} ← {a.streamer_name}</b><span className={`pill ${a.status}`}>{a.status === "pending" ? "대기" : a.status === "approved" ? "승인" : "반려"}</span>
                </div>
                <div className="meta">닉네임 {a.nickname || "-"} · {a.email} · SOOP {a.soop_id || "-"} · {new Date(a.created_at).toLocaleString("ko-KR")}</div>
                {a.message && <div style={{ color: "#cfc6bd" }}>“{a.message}”</div>}
                {a.status === "pending" && (
                  <div className="row">
                    <button className="abtn pri sm" disabled={!!busy} onClick={() => run("승인 중", async () => { const { error } = await sb.rpc("jr_review_application", { p_id: a.id, p_approve: true }); if (error) throw new Error(rpcError(error)); await reloadApps(); }, "승인 완료! 이제 본인 앨범을 만들 수 있어")}>승인</button>
                    <button className="abtn warn sm" disabled={!!busy} onClick={() => setConfirm({ msg: `${a.streamer_name} 신청을 반려할까?`, ok: () => run("반려 중", async () => { const { error } = await sb.rpc("jr_review_application", { p_id: a.id, p_approve: false }); if (error) throw new Error(rpcError(error)); await reloadApps(); }, "반려됨") })}>반려</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="acard">
            <h3>권한 있는 스트리머</h3>
            {editors.length === 0 && <p style={{ fontSize: 13, color: "#857a70", margin: 0 }}>아직 없어.</p>}
            {editors.map((e) => (
              <div key={e.user_id + e.member_id} className="approw" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <span><b>{e.member_name}</b> · {e.nickname || e.email}</span>
                <button className="abtn warn sm" onClick={() => setConfirm({ msg: `${e.nickname || e.email}의 ${e.member_name} 앨범 권한을 회수할까?`, ok: () => run("회수 중", async () => { const { error } = await sb.rpc("jr_revoke_editor", { p_user: e.user_id, p_member: e.member_id }); if (error) throw new Error(rpcError(error)); await reloadApps(); }, "권한 회수됨") })}>권한 회수</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "albums" && (
      <>
      <div className="chips">
        {mine.map((x) => (
          <button key={x.id} className={`chip${x.id === b?.id ? " on" : ""}${x.is_public ? "" : " priv"}`} style={{ "--ac": safeColor(x.color) } as CSSProperties} onClick={() => setSel(x.id)}>
            <i />{x.kind === "group" ? "단체 · " + x.en : x.is_official ? x.name : `${x.name} · ${x.title}`}
          </button>
        ))}
      </div>
      <div className="acard">
        <h3>새 앨범 만들기</h3>
        <div className="row">
          {myMembers.map((m) => (
            <button key={m.id} className="abtn" disabled={!!busy} onClick={() => run("앨범 만드는 중", async () => { const id = await createAlbum(m, me.user_id); setSel(id); }, `${m.name} 새 앨범을 만들었어 (비공개 상태)`)}>+ {m.name}</button>
          ))}
        </div>
      </div>

      {b && (
        <>
          <div className="acard">
            <h3>
              <span>{b.kind === "group" ? b.en : b.name} 포토북</span>
              <label className="sw"><input type="checkbox" checked={b.is_public} onChange={(e) => editBook("is_public", e.target.checked)} />{b.is_public ? "공개" : "비공개"}</label>
            </h3>
            <div className="row">
              <button className="abtn pri" onClick={() => setPreview(true)}>뷰어로 미리보기</button>
              {!b.is_official && <button className="abtn warn" disabled={!!busy} onClick={() => setConfirm({ msg: `이 앨범(${b.title})을 사진까지 통째로 삭제할까? 되돌릴 수 없어.`, ok: () => run("삭제 중", async () => { await deleteBook(b); setSel(""); }, "앨범 삭제됨") })}>앨범 삭제</button>}
            </div>
          </div>

          <div className="acard">
            <h3>잠금 · 티켓</h3>
            <div className="fgrid">
              <label className="f">사진 1장당 티켓 (0 = 전부 무료)<input type="number" min={0} max={20} value={b.ticket_cost} onChange={(e) => editBook("ticket_cost", Math.max(0, Math.min(20, +e.target.value || 0)))} /></label>
              <label className="f">무료 미리보기 사진 수<input type="number" min={0} max={20} value={b.free_photos} onChange={(e) => editBook("free_photos", Math.max(0, Math.min(20, +e.target.value || 0)))} /></label>
            </div>
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
                    <div className="top">
                      <input value={p.caption} placeholder="캡션 (선택)" onChange={(e) => editPage(p, "caption", e.target.value)} />
                      <select className="capsz" value={p.caption_size || "M"} onChange={(e) => editPage(p, "caption_size", e.target.value as CaptionSize)} aria-label="캡션 글자 크기">
                        {CAPTION_SIZES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                      </select>
                    </div>
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
