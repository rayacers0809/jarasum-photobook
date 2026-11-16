"use client";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function LoginPage() {
  const { me, refresh } = useAuth();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { toast, node } = useToast();

  const next = () => {
    const n = new URLSearchParams(location.search).get("next");
    location.href = n && n.startsWith("/") ? `${BASE}${n}` : `${BASE}/`;
  };
  useEffect(() => { if (me) next(); }, [me]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      if (tab === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        await refresh();
      } else {
        const n = nick.trim();
        if (n.length < 2 || n.length > 16) throw new Error("닉네임은 2~16자로 해줘");
        if (pw.length < 6) throw new Error("비밀번호는 6자 이상");
        const { data, error } = await sb.auth.signUp({
          email, password: pw,
          options: { data: { nickname: n }, emailRedirectTo: `${location.origin}${BASE}/login/` },
        });
        if (error) throw error;
        if (data.session) { await sb.rpc("jr_me", { p_nickname: n }); await refresh(); toast("가입 완료! 🎟 3장 · 🍪 10개 웰컴 선물"); }
        else setMsg("인증 메일을 보냈어. 메일의 링크를 누른 다음 로그인해줘.");
      }
    } catch (err) {
      const m = (err as Error).message || String(err);
      setMsg(/Invalid login/i.test(m) ? "이메일 또는 비밀번호가 맞지 않아" : /registered/i.test(m) ? "이미 가입된 이메일이야" : /confirm/i.test(m) ? "메일 인증을 먼저 해줘" : m);
    } finally { setBusy(false); }
  };

  return (
    <div className="wrap">
      <header className="site"><a className="logo" href={`${BASE}/`}>JARASUM<small>THE OFFICIAL PHOTOBOOK</small></a></header>
      <div className="authwrap">
        <div className="kicker">JARASUM MEMBERSHIP</div>
        <h1>{tab === "in" ? <>Welcome <i>back.</i></> : <>Join the <i>island.</i></>}</h1>
        <p className="sub">자라섬 웹툰 · 포토북 공용 계정이야. 매일 출석하면 앨범 티켓 🎟 이랑 웹툰 쿠키 🍪 를 받아.</p>
        <div className="tabs2">
          <button className={tab === "in" ? "on" : ""} onClick={() => { setTab("in"); setMsg(""); }}>로그인</button>
          <button className={tab === "up" ? "on" : ""} onClick={() => { setTab("up"); setMsg(""); }}>회원가입</button>
        </div>
        <form className="acard" onSubmit={submit}>
          <div className="fgrid" style={{ gridTemplateColumns: "1fr" }}>
            {tab === "up" && <label className="f">닉네임 (2~16자)<input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={16} required /></label>}
            <label className="f">이메일<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label className="f">비밀번호{tab === "up" && " (6자 이상)"}<input type="password" autoComplete={tab === "in" ? "current-password" : "new-password"} value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
            <button className="abtn pri" type="submit" disabled={busy}>{busy ? "잠깐만…" : tab === "in" ? "로그인" : "가입하고 선물 받기"}</button>
            {msg && <div style={{ fontSize: 13, color: "#f0d28a", lineHeight: 1.7 }}>{msg}</div>}
          </div>
        </form>
        <a className="btn" href={`${BASE}/`} style={{ marginTop: 8 }}>← 포토북으로</a>
      </div>
      {node}
    </div>
  );
}
