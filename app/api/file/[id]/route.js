import { sql } from "@/lib/db";

// Database e rakha chobi/voice — id kokhono bodlay na, tai browser/CDN e ek bochhor cache
export async function GET(req, { params }) {
  const { id } = await params;
  if (!/^[a-z]+-[0-9a-f]+\.[a-z0-9]+$/.test(id)) return new Response("Not found", { status: 404 });
  const [f] = await sql`SELECT type, data FROM files WHERE id = ${id}`.catch(() => []);
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(f.data, "base64"), {
    headers: {
      "Content-Type": f.type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
