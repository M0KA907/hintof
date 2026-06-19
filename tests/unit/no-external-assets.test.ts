import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const EXTERNAL_URL =
  /(?:https?:)?\/\/(?!(?:localhost|127\.0\.0\.1)\b)|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com/i;

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walk(path));
      continue;
    }
    files.push(path);
  }

  return files;
}

function assertNoExternalUrls(paths: string[]): void {
  for (const path of paths) {
    if (/\.(woff2|png|jpg|jpeg|gif|webp|ico|svg)$/i.test(path)) {
      continue;
    }

    const content = readFileSync(path, "utf8");
    expect(content, relative(ROOT, path)).not.toMatch(EXTERNAL_URL);
  }
}

test("source HTML/CSS reference only self-hosted assets", () => {
  const paths = [
    join(ROOT, "index.html"),
    ...walk(join(ROOT, "src/styles")),
    ...walk(join(ROOT, "public/fonts")).filter((path) => path.endsWith(".css"))
  ];

  assertNoExternalUrls(paths);
});

test("built assets reference only self-hosted URLs", () => {
  execSync("npm run build", { cwd: ROOT, stdio: "pipe" });

  const distDir = join(ROOT, "dist");
  const builtPaths = walk(distDir).filter(
    (path) => /\.(html|css|js)$/i.test(path) && !path.endsWith(".map")
  );

  assertNoExternalUrls(builtPaths);
});
