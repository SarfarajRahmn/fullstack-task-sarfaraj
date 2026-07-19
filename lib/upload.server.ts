import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { createRequire } from "module";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

export async function saveUploadedFile(file: File) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid file type: ${file.type}. Only JPEG, PNG, WebP, and GIF images are allowed.`,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File is too large. Maximum allowed size is 5MB.`,
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error(
      `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }

  const token = process.env.UPLOADTHING_TOKEN;

  // Production / configured: upload to UploadThing's CDN.
  // The package is loaded lazily through `createRequire` via a `new Function`
  // body so the bundler never statically resolves (or bundles) the optional
  // `uploadthing` dependency — it is only required at runtime when used.
  if (token) {
    const require = createRequire(import.meta.url);
    const loadModule = new Function(
      "require",
      "pkg",
      "return require(pkg);",
    ) as (require: NodeRequire, pkg: string) => {
      UTApi: new (opts: { token: string }) => {
        uploadFiles: (
          file: File,
        ) => Promise<{
          data?: { url: string } | null;
          error?: { code?: string } | null;
        }>;
      };
    };
    const mod = loadModule(require, "upload" + "thing");
    const utapi = new mod.UTApi({ token });
    const result = await utapi.uploadFiles(file);

    if (result.error || !result.data?.url) {
      throw new Error(
        `Upload failed: ${result.error?.code ?? "unknown error"}`,
      );
    }

    return result.data.url;
  }

  // Local fallback (development / self-hosted with a persistent disk).
  const bytes = Buffer.from(await file.arrayBuffer());
  const fileName = `${randomUUID()}.${extension}`;
  const uploadDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, fileName), bytes);
  return `/uploads/${fileName}`;
}
