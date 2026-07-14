import { writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

export async function saveUploadedFile(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const fileName = `${randomUUID()}-${file.name.replace(/\s+/g, "-")}`;
  const uploadDir = join(process.cwd(), "public", "uploads");
  await writeFile(join(uploadDir, fileName), bytes);
  return `/uploads/${fileName}`;
}
