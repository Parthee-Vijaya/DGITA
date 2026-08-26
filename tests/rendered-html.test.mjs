import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/login") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
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

test("server-renderer D-GITA-login og beskytter portalen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="da">/i);
  assert.match(html, /<title>D-GITA · Den Gode IT-Anskaffelse<\/title>/i);
  assert.match(html, /D-GITA/);
  assert.match(html, /Kalundborg Kommune/);
  assert.match(html, /Log ind på D-GITA/);
  assert.match(html, /Microsoft Entra ID/);
  assert.match(html, /Fælleskommunal Adgangsstyring/);
  assert.match(html, /og:image[^>]+http:\/\/localhost:3000\/og-editorial\.png/i);

  const protectedResponse = await render("/");
  assert.equal(protectedResponse.status, 307);
  assert.equal(
    new URL(protectedResponse.headers.get("location"), "http://localhost").pathname,
    "/login",
  );
});

test("indeholder roller, workflows og ingen starter-preview", async () => {
  const [page, portal, form, applicationRepository, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PortalClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/application/ApplicationFormView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/application/server-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /redirect\("\/login"\)/);
  assert.match(portal, /D-GITA-konsulent/);
  assert.match(portal, /Administration/);
  assert.match(portal, /Outlook/);
  assert.match(form, /Gem og indsend/);
  assert.match(portal, /availableRows\.filter/);
  assert.doesNotMatch(portal, /detail="WSUS klient"/);
  assert.match(portal, /ITA-001284/);
  assert.match(applicationRepository, /application\.submitted/);
  assert.match(layout, /openGraph/);
  assert.match(css, /@media \(max-width: 540px\)/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(portal, /SkeletonPreview/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
