"use client";
import { useAuth } from "@/lib/auth";
import { rpcError } from "@/lib/data";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Header widget: login link, or wallet + daily check-in. */
export default function AccountBar({ toast }: { toast: (m: string) => void }) {
  const { ready, me, checkIn } = useAuth();
  if (!ready) return <div className="acct" />;
  if (!me)
    return (
      <div className="acct">
        <a className="acct-btn solid" href={`${BASE}/login/`}>로그인</a>
      </div>
    );
  const onCheck = async () => {
    try {
      const r = await checkIn();
      if (!r.ok) toast("오늘은 이미 출석했어 · 연속 " + r.streak + "일");
      else toast(`출석 완료! 🎟 +${r.got_tickets}  🍪 +${r.got_cookies}${r.bonus ? " · 7일 연속 보너스!" : ""}`);
    } catch (e) { toast(rpcError(e)); }
  };
  return (
    <div className="acct">
      <a className="wallet" href={`${BASE}/me/`} title="내 지갑">
        <span>🎟 {me.tickets}</span><span>🍪 {me.cookies}</span>
      </a>
      <button className={`acct-btn${me.checked_today ? "" : " solid pulse"}`} onClick={onCheck}>
        {me.checked_today ? `✓ ${me.streak}일` : "출석"}
      </button>
    </div>
  );
}
