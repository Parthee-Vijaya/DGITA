import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renderer den færdige D-GITA-portal", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="da">/i);
  assert.match(html, /<title>D-GITA · Den Gode IT-Anskaffelse<\/title>/i);
  assert.match(html, /D-GITA/);
  assert.match(html, /Kalundborg Kommune/);
  assert.match(html, /Opret ansøgning/);
  assert.match(html, /Skift testrolle/);
  assert.match(html, /D-GITA konsulent/);
  assert.match(html, />Admin</);
  assert.match(html, /Partheepan Vijayamohan/);
  assert.match(html, /Casper Kjeldsen Ravn/);
  assert.match(html, /og:image[^>]+http:\/\/localhost:3000\/og-editorial\.png/i);
});

test("indeholder roller, workflows og ingen starter-preview", async () => {
  const [page, form, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/application/ApplicationFormView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /D-GITA-konsulent/);
  assert.match(page, /Administration/);
  assert.match(page, /Outlook/);
  assert.match(form, /Gem og indsend/);
  assert.match(page, /WSUS klient/);
  assert.match(page, /ITA-001284/);
  assert.match(page, /application\.submitted/);
  assert.match(layout, /openGraph/);
  assert.match(css, /@media \(max-width: 540px\)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
