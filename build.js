#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");

// Files/folders shared by every browser build.
const SHARED_ASSETS = [
  "background.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "icons",
];

const base = JSON.parse(
  fs.readFileSync(path.join(ROOT, "manifest.base.json"), "utf8")
);

const TARGETS = {
  chrome: (manifest) => {
    // Chrome MV3 uses a service worker and rejects `background.scripts`.
    manifest.background = { service_worker: "background.js" };
    // `browser_specific_settings` is Firefox-only; drop it to avoid a Chrome warning.
    delete manifest.browser_specific_settings;
    return manifest;
  },
  firefox: (manifest) => {
    // Firefox MV3 does not support service workers; it uses background scripts.
    manifest.background = { scripts: ["background.js"] };
    return manifest;
  },
};

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function buildTarget(name) {
  const transform = TARGETS[name];
  if (!transform) {
    throw new Error(`Unknown target "${name}". Valid targets: ${Object.keys(TARGETS).join(", ")}`);
  }

  const outDir = path.join(DIST, name);
  rmrf(outDir);
  fs.mkdirSync(outDir, { recursive: true });

  for (const asset of SHARED_ASSETS) {
    const src = path.join(ROOT, asset);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing asset: ${asset}`);
    }
    copyRecursive(src, path.join(outDir, asset));
  }

  const manifest = transform(JSON.parse(JSON.stringify(base)));
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );

  console.log(`Built ${name} -> ${path.relative(ROOT, outDir)}`);
}

const requested = process.argv.slice(2);
const targets = requested.length ? requested : Object.keys(TARGETS);

fs.mkdirSync(DIST, { recursive: true });
for (const target of targets) {
  buildTarget(target);
}
