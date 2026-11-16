"use client";
import { useEffect, useMemo, useState } from "react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Book, Member, fetchBooks, fetchMembers, rpcError } from "@/lib/data";
import { BookObject } from "@/components/Cover";
import AccountBar from "@/components/AccountBar";
import { useToast } from "@/components/Toast";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function MePage() {
  const { ready, me, refresh, checkIn, signOut } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState({ member: "", name: "", soop: "", msg: "" });
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();

  useEffect(() => { if (ready && !me) location.href = `${BASE}/login/?next=/me/`; }, [ready, me]);
  useEffect(() => { fetchBooks().then(setBooks).catch(() => {}); fetchMembers().then(setMembers).catch(() => {}); }, []);

  const owned = useMemo(() => books.filter((b) => me?.album_unlocks.includes(b.id)), [books, me]);
  const memberBooks = useMemo(() => books.filter((b) => b.kind === "member"), [books]);
  if (!me) return <div className="wrap" style={{ padding: 60 }}>LOADING…</div>;

  const isEditor = me.is_staff || me.editor_members.length > 0;
  const streakDay = me.checked_today ? ((me.streak - 1) % 7) + 1 : me.streak % 7;

  const apply = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const { error } = await sb.rpc("jr_apply_streamer", { p_member: form.member, p_streamer_name: form.name, p_soop_id: form.soop, p_message: form.msg });
      if (error) throw error;
      toast("신청 완료! 승인되면 앨범 스튜디오가 열려"); await refresh();
    } catch (err) { toast(rpcError(err)); } finally { setBusy(false); }
  };

  return (
    <div className="wrap">
      <header className="site">
        <a className="logo" href={`${BASE}/`}>JARASUM<small>THE OFFICIAL PHOTOBOOK</small></a>
        <AccountBar toast={toast} />
      </header>
      <div className="mewrap">
        <div className="kicker">MY ISLAND</div>
        <h3 className="big" style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 48, margin: "8px 0 24px", letterSpacing: "-.03em" }}>{me.nickname}<i style={{ fontWeight: 400 }}> 님</i></h3>

        <div className="mecard">
          <h3>WALLET · 웹툰·포토북 공용</h3>
          <div className="bal">
            <div><b>{me.tickets}</b><span>🎟 앨범 티켓</span></div>
            <div><b>{me.cookies}</b><span>🍪 웹툰 쿠키</span></div>
          </div>
        </div>

        <div className="mecard">
          <h3>ATTENDANCE · 연속 {me.streak}일</h3>
          <div className="streak">
            {Array.from({ length: 7 }, (_, i) => <i key={i} className={`${i < streakDay ? "on" : ""}${i === 6 ? " bonus" : ""}`}>{i === 6 ? "🎁" : i + 1}</i>)}
          </div>
          <button className={`abtn ${me.checked_today ? "" : "pri"}`} style={{ width: "100%" }} disabled={me.checked_today}
            onClick={async () => { try { const r = await checkIn(); toast(r.ok ? `출석 완료! 🎟 +${r.got_tickets} 🍪 +${r.got_cookies}${r.bonus ? " · 보너스!" : ""}` : "오늘은 이미 출석했어"); } catch (e) { toast(rpcError(e)); } }}>
            {me.checked_today ? "오늘 출석 완료 ✓" : "오늘 출석하기"}
          </button>
          <ul className="rules" style={{ marginTop: 14 }}>
            <li>매일 출석: 🎟 티켓 1장 + 🍪 쿠키 3개 (자정 기준, 한국 시간)</li>
            <li>7일 연속 출석: 🎟 2장 + 🍪 5개 추가 보너스</li>
            <li>티켓으로 포토북 앨범을, 쿠키로 웹툰 잠금 회차를 열 수 있어. 한 번 열면 영구 소장!</li>
          </ul>
        </div>

        <div className="mecard">
          <h3>MY ALBUMS · {owned.length}</h3>
          {owned.length ? (
            <div className="ownlist">{owned.map((b) => <BookObject key={b.id} b={b} members={memberBooks} label="OWNED" onOpen={(id) => (location.href = `${BASE}/?book=${id}`)} />)}</div>
          ) : <p style={{ color: "#857a70", fontSize: 13, margin: 0 }}>아직 연 앨범이 없어. 티켓으로 첫 앨범을 열어봐!</p>}
        </div>

        <div className="mecard">
          <h3>STREAMER STUDIO</h3>
          {isEditor ? (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#cfc6bd" }}>{me.is_staff ? "관리자 계정이야." : `${members.filter((m) => me.editor_members.includes(m.id)).map((m) => m.name).join(", ")} 앨범 권한이 있어.`}</span>
              <a className="abtn pri" href={`${BASE}/admin/`}>앨범 스튜디오 열기 →</a>
            </div>
          ) : me.application?.status === "pending" ? (
            <p style={{ fontSize: 13, margin: 0 }}><span className="pill pending">심사 중</span>　{members.find((m) => m.id === me.application!.member_id)?.name} 앨범 권한 신청을 확인하고 있어.</p>
          ) : (
            <form onSubmit={apply}>
              {me.application?.status === "rejected" && <p style={{ fontSize: 12, color: "#f0a0a0", marginTop: 0 }}>지난 신청이 반려됐어. 정보를 확인해서 다시 신청해줘.</p>}
              <p style={{ fontSize: 13, color: "#a69c92", lineHeight: 1.8, marginTop: 0 }}>자라섬 멤버 본인이라면 권한을 신청해줘. 승인되면 <b>본인 앨범만</b> 직접 만들고 사진을 올릴 수 있어.</p>
              <div className="fgrid">
                <label className="f">멤버<select value={form.member} onChange={(e) => setForm({ ...form, member: e.target.value })} required>
                  <option value="">선택</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select></label>
                <label className="f">방송 닉네임<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} required /></label>
                <label className="f full">SOOP 아이디<input value={form.soop} onChange={(e) => setForm({ ...form, soop: e.target.value })} maxLength={60} placeholder="본인 확인용" /></label>
                <label className="f full">한마디 (선택)<textarea value={form.msg} onChange={(e) => setForm({ ...form, msg: e.target.value })} maxLength={500} /></label>
                <button className="abtn pri full" style={{ gridColumn: "1/-1" }} disabled={busy}>권한 신청하기</button>
              </div>
            </form>
          )}
        </div>

        <div className="row"><a className="btn" href={`${BASE}/`}>← 포토북</a><button className="btn" onClick={async () => { await signOut(); location.href = `${BASE}/`; }}>로그아웃</button></div>
      </div>
      {node}
    </div>
  );
}
