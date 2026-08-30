import assert from "node:assert/strict";
import test from "node:test";

import { assertDemoLoginAccess } from "./demo-access.ts";
import { AuthHttpError } from "./http.ts";

const publicUrl = "https://portal.example.dk/login";
const validEnvironment = {
  DGITA_ENABLE_DEV_LOGIN: "true",
  DGITA_DEMO_ACCESS_SECRET: "demo-access-secret-with-32-characters",
};

test("offentligt testlogin fejler lukket uden en stærk server-secret", async () => {
  await assert.rejects(
    assertDemoLoginAccess(
      publicUrl,
      { DGITA_ENABLE_DEV_LOGIN: "true" },
      "uanset-kode",
      null,
    ),
    (error) =>
      error instanceof AuthHttpError &&
      error.status === 503 &&
      error.code === "DEV_LOGIN_CONFIGURATION_ERROR",
  );
  await assert.rejects(
    assertDemoLoginAccess(
      publicUrl,
      {
        DGITA_ENABLE_DEV_LOGIN: "true",
        DGITA_DEMO_ACCESS_SECRET: "for-kort",
      },
      "for-kort",
      null,
    ),
    (error) =>
      error instanceof AuthHttpError &&
      error.code === "DEV_LOGIN_CONFIGURATION_ERROR",
  );
});

test("første offentlige testlogin kræver den eksakte adgangskode", async () => {
  await assert.rejects(
    assertDemoLoginAccess(publicUrl, validEnvironment, undefined, null),
    (error) =>
      error instanceof AuthHttpError &&
      error.status === 403 &&
      error.code === "INVALID_DEMO_ACCESS_CODE",
  );
  await assert.rejects(
    assertDemoLoginAccess(publicUrl, validEnvironment, "forkert", null),
    (error) =>
      error instanceof AuthHttpError &&
      error.code === "INVALID_DEMO_ACCESS_CODE",
  );
  await assert.doesNotReject(
    assertDemoLoginAccess(
      publicUrl,
      validEnvironment,
      validEnvironment.DGITA_DEMO_ACCESS_SECRET,
      null,
    ),
  );
});

test("en eksisterende dev-session kan skifte rolle uden ny adgangskode", async () => {
  await assert.doesNotReject(
    assertDemoLoginAccess(publicUrl, validEnvironment, undefined, "dev"),
  );
  await assert.rejects(
    assertDemoLoginAccess(publicUrl, validEnvironment, undefined, "entra"),
    (error) =>
      error instanceof AuthHttpError &&
      error.code === "INVALID_DEMO_ACCESS_CODE",
  );
});

test("localhost bevarer testlogin uden adgangskode", async () => {
  await assert.doesNotReject(
    assertDemoLoginAccess("http://localhost:3000/login", {}, undefined, null),
  );
});
