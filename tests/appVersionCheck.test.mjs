import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/appVersionCheck.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/, "")
  .replaceAll("import.meta.env.DEV", "IS_DEV")
  .replace("export const checkForNewAppVersion", "globalThis.checkForNewAppVersion");

function createPage({
  buildId = "old-build",
  latestBuildId = "new-build",
  href = "https://portal.example/timekeeping?filter=today#camera",
  storage = new Map(),
  storageBlocked = false,
  dev = false,
  responseOk = true,
} = {}) {
  const redirects = [];
  let requests = 0;
  const context = vm.createContext({
    APP_BUILD_ID: buildId,
    IS_DEV: dev,
    URL,
    console: { warn() {} },
    fetch: async () => {
      requests++;
      return { ok: responseOk, json: async () => ({ buildId: latestBuildId }) };
    },
    window: {
      location: { href, replace: (url) => redirects.push(url) },
      sessionStorage: {
        getItem(key) {
          if (storageBlocked) throw new Error("Storage blocked");
          return storage.get(key) ?? null;
        },
        setItem(key, value) {
          if (storageBlocked) throw new Error("Storage blocked");
          storage.set(key, value);
        },
      },
    },
  });
  vm.runInContext(source, context);
  return { check: context.checkForNewAppVersion, redirects, storage, requests: () => requests };
}

test("matching build stays on the page", async () => {
  const page = createPage({ latestBuildId: "old-build" });
  await page.check();
  assert.equal(page.redirects.length, 0);
});

test("older live manifest does not reload a newer timestamp build", async () => {
  const page = createPage({ buildId: "20261105024313888", latestBuildId: "20260921063853344" });
  await page.check();
  assert.equal(page.redirects.length, 0);
});

test("a newer timestamp build still triggers an update", async () => {
  const page = createPage({ buildId: "20260921063853344", latestBuildId: "20261105024313888" });
  await page.check();
  assert.equal(page.redirects.length, 1);
});

test("new version reloads once and preserves the current route", async () => {
  const page = createPage();
  await page.check();
  assert.deepEqual(page.redirects, ["https://portal.example/timekeeping?filter=today&v=new-build#camera"]);
  assert.equal(page.storage.get("app-version-reload:old-build"), "new-build");
});

test("stale bundle after reload stops even without the previous session marker", async () => {
  const page = createPage({ href: "https://portal.example/timekeeping?v=new-build" });
  await page.check();
  assert.equal(page.redirects.length, 0);
});

test("session marker stops a stale build even when the URL or manifest changes", async () => {
  const first = createPage();
  await first.check();
  const stale = createPage({ storage: first.storage, latestBuildId: "another-build" });
  await stale.check();
  assert.equal(stale.redirects.length, 0);
});

test("a successfully updated build can reload for a later deployment", async () => {
  const first = createPage();
  await first.check();
  const updated = createPage({ storage: first.storage, buildId: "new-build", latestBuildId: "later-build" });
  await updated.check();
  assert.equal(updated.redirects.length, 1);
});

test("overlapping checks trigger only one navigation", async () => {
  const page = createPage();
  await Promise.all([page.check(), page.check(), page.check()]);
  assert.equal(page.redirects.length, 1);
});

test("malformed version metadata never triggers navigation", async () => {
  for (const latestBuildId of [null, "", " ", 123, {}]) {
    const page = createPage({ latestBuildId });
    await page.check();
    assert.equal(page.redirects.length, 0);
  }
});

test("blocked session storage leaves the page usable", async () => {
  const page = createPage({ storageBlocked: true });
  await page.check();
  assert.equal(page.redirects.length, 0);
});

test("unavailable version metadata leaves the page usable", async () => {
  const page = createPage({ responseOk: false });
  await page.check();
  assert.equal(page.redirects.length, 0);
});

test("development and missing build IDs skip the check", async () => {
  for (const options of [{ dev: true }, { buildId: null }, { buildId: "" }]) {
    const page = createPage(options);
    await page.check();
    assert.equal(page.requests(), 0);
  }
});
