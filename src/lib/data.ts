import { sb, SUPABASE_URL, BUCKET } from "./supabase";

export type Page = {
  id: string;
  book_id: string;
  position: number;
  section: string;
  caption: string;
  image_path: string | null;
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
  pages: Page[];
};

export type BookField = "name" | "en" | "title" | "slogan" | "description" | "profile" | "credits" | "color" | "is_public";

export const pad = (n: number) => String(n).padStart(2, "0");
export const safeColor = (c?: string | null) => (/^#[0-9a-f]{6}$/i.test(c || "") ? (c as string) : "#d8b875");

export function imgUrl(path?: string | null): string {
  if (!path) return "";
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function fetchBooks(): Promise<Book[]> {
  const { data, error } = await sb
    .from("photobook_books")
    .select("*, pages:photobook_pages(*)")
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data as Book[]).map((b) => ({ ...b, pages: [...(b.pages || [])].sort((a, c) => a.position - c.position) }));
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

export async function updatePage(id: string, patch: Partial<Pick<Page, "section" | "caption" | "image_path" | "position">>) {
  const { error } = await sb.from("photobook_pages").update({ ...patch, updated_at: now() }).eq("id", id);
  if (error) throw error;
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
