import { sb, SUPABASE_URL, BUCKET } from "./supabase";

export type CaptionSize = "S" | "M" | "L" | "XL";
export const CAPTION_SIZES: { v: CaptionSize; label: string }[] = [
  { v: "S", label: "작게" }, { v: "M", label: "보통" }, { v: "L", label: "크게" }, { v: "XL", label: "아주 크게" },
];

export type Page = {
  id: string;
  book_id: string;
  position: number;
  section: string;
  caption: string;
  caption_size: CaptionSize;
  image_path: string | null;
  /** locked for this viewer: metadata only, no image */
  locked?: boolean;
};

export type Book = {
  id: string;
  kind: "member" | "group";
  sort: number;
  name: string;
  en: string;
  title: string;
  slogan: string;
  description: string;
  profile: string;
  credits: string;
  color: string;
  is_public: boolean;
  cover_path: string | null;
  updated_at: string;
  member_id: string | null;
  ticket_cost: number;
  free_photos: number;
  is_official: boolean;
  /** total photo pages incl. locked ones (pages[] only holds what the viewer may see) */
  total_pages: number;
  pages: Page[];
};

export type Member = { id: string; name: string; en: string; sort: number };

export type Me = {
  user_id: string; nickname: string; cookies: number; tickets: number; streak: number;
  checked_today: boolean; is_staff: boolean; editor_members: string[];
  application: { status: "pending" | "approved" | "rejected"; member_id: string; created_at: string } | null;
  album_unlocks: string[]; episode_unlocks: string[];
  /** book_id → number of photos this user unlocked */
  photo_books: Record<string, number>;
};

export type BookField = "name" | "en" | "title" | "slogan" | "description" | "profile" | "credits" | "color" | "is_public" | "ticket_cost" | "free_photos";

export const pad = (n: number) => String(n).padStart(2, "0");
export const safeColor = (c?: string | null) => (/^#[0-9a-f]{6}$/i.test(c || "") ? (c as string) : "#d8b875");

export function imgUrl(path?: string | null): string {
  if (!path) return "";
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function fetchBooks(): Promise<Book[]> {
  const [{ data, error }, lockedRes] = await Promise.all([
    sb.from("photobook_books").select("*, pages:photobook_pages(*)")
      .order("sort", { ascending: true }).order("created_at", { ascending: false }),
    sb.rpc("photobook_locked_pages"),
  ]);
  if (error) throw error;
  const locked = new Map<string, Page[]>();
  for (const r of (lockedRes.data || []) as Omit<Page, "image_path" | "locked">[]) {
    const arr = locked.get(r.book_id) || [];
    arr.push({ ...r, image_path: null, locked: true });
    locked.set(r.book_id, arr);
  }
  return (data as Book[]).map((b) => {
    const pages = [...(b.pages || []), ...(locked.get(b.id) || [])]
      .sort((a, c) => a.position - c.position || a.id.localeCompare(c.id));
    return { ...b, pages, total_pages: pages.length };
  });
}

export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await sb.from("photobook_members").select("*").order("sort");
  if (error) throw error;
  return data as Member[];
}

export const lockedCount = (b: Book) => b.pages.filter((p) => p.locked).length;
export const isLocked = (b: Book) => lockedCount(b) > 0;

/** Map RPC error codes to friendly Korean messages. */
export function rpcError(e: unknown): string {
  const m = String((e as { message?: string })?.message || e);
  if (m.includes("NOT_ENOUGH_TICKETS")) return "티켓이 부족해. 출석하면 티켓을 받을 수 있어!";
  if (m.includes("NOT_ENOUGH_COOKIES")) return "쿠키가 부족해. 출석하면 쿠키를 받을 수 있어!";
  if (m.includes("LOGIN_REQUIRED")) return "로그인이 필요해";
  if (m.includes("ALREADY_PENDING")) return "이미 심사 중인 신청이 있어";
  if (m.includes("ALREADY_EDITOR")) return "이미 이 멤버의 앨범 권한이 있어";
  if (m.includes("FORBIDDEN")) return "권한이 없어";
  return m;
}

export async function unlockPhoto(pageId: string) {
  const { data, error } = await sb.rpc("jr_unlock_photo", { p_page: pageId });
  if (error) throw new Error(rpcError(error));
  return data as { ok: boolean; tickets?: number };
}

/** Filename for downloads: jarasum-<book>-<nn>.jpg */
export function downloadUrl(path: string, name: string) {
  return `${imgUrl(path)}?download=${encodeURIComponent(name)}`;
}

/** Resize on the client before upload (max 2000px, JPEG) — keeps storage small and pages fast. */
export async function downscale(file: File, max = 2000): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    return await new Promise<Blob>((r) => c.toBlob((b) => r(b || file), "image/jpeg", 0.88));
  } catch {
    return file;
  }
}

export async function uploadImage(bookId: string, file: File): Promise<string> {
  const blob = await downscale(file);
  const path = `${bookId}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return path;
}

export async function removeImage(path?: string | null) {
  if (path) await sb.storage.from(BUCKET).remove([path]);
}

const now = () => new Date().toISOString();

export async function updateBook(id: string, patch: Partial<Record<BookField | "cover_path", unknown>>) {
  const { error } = await sb.from("photobook_books").update({ ...patch, updated_at: now() }).eq("id", id);
  if (error) throw error;
}

export async function touchBook(id: string) {
  await sb.from("photobook_books").update({ updated_at: now() }).eq("id", id);
}

export async function updatePage(id: string, patch: Partial<Pick<Page, "section" | "caption" | "caption_size" | "image_path" | "position">>) {
  const { error } = await sb.from("photobook_pages").update({ ...patch, updated_at: now() }).eq("id", id);
  if (error) throw error;
}

export async function createAlbum(m: Member, uid: string) {
  const id = `${m.id}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await sb.from("photobook_books").insert({
    id, kind: "member", member_id: m.id, name: m.name, en: m.en, sort: 100,
    title: "NEW ALBUM", slogan: "Every frame, a signature.", is_public: false, is_official: false, created_by: uid,
    profile: `NAME: ${m.name}\nENGLISH: ${m.en}\nGROUP: JARASUM`,
    credits: "PHOTOGRAPHY — JARASUM OFFICIAL", color: "#d8b875",
  });
  if (error) throw error;
  return id;
}

export async function deleteBook(b: Book) {
  const paths = [b.cover_path, ...b.pages.map((p) => p.image_path)].filter(Boolean) as string[];
  const { error } = await sb.from("photobook_books").delete().eq("id", b.id);
  if (error) throw error;
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
}

export async function insertPage(bookId: string, position: number, section: string, image_path: string | null) {
  const { error } = await sb.from("photobook_pages").insert({ book_id: bookId, position, section, image_path });
  if (error) throw error;
}

export async function deletePage(id: string) {
  const { error } = await sb.from("photobook_pages").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- photobook page model ---------- */
export type PageKind = "cover" | "title" | "profile" | "roster" | "photo" | "credits" | "end";
export type PageDesc = { k: PageKind; p?: Page; n?: number };

export function bookPages(b: Book): PageDesc[] {
  const P: PageDesc[] = [{ k: "cover" }, { k: "title" }, { k: b.kind === "group" ? "roster" : "profile" }];
  b.pages.forEach((p, i) => P.push({ k: "photo", p, n: i + 1 }));
  P.push({ k: "credits" }, { k: "end" });
  return P;
}

export function spreads(n: number, two: boolean): (number | null)[][] {
  if (!two) return [...Array(n).keys()].map((i) => [i]);
  const S: (number | null)[][] = [[null, 0]];
  for (let i = 1; i < n; i += 2) S.push([i, i + 1 < n ? i + 1 : null]);
  return S;
}

export const SECTION_PRESETS = [
  "MAIN CONCEPT", "LOOKBOOK", "CLOSE-UP", "DAILY MOOD", "BEHIND THE SCENES",
  "ALL TOGETHER", "UNIT CUTS", "GROUP POSES", "CONCEPT", "GALLERY",
];
