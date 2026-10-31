import { sql } from "./db";

// Shudhu amader upload kora chobi muche (/api/file/...) — /images/... (project er nijer chobi) ke hat dey na
const fileId = (url) => /^\/api\/file\/([^/?#]+)$/.exec(url || "")?.[1];

export async function deleteImages(urls) {
  const ids = urls.map(fileId).filter(Boolean);
  if (!ids.length) return;
  try {
    await sql`DELETE FROM files WHERE id = ANY(${ids})`;
  } catch (err) {
    console.error("Image delete failed", err);
  }
}
