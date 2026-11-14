// Encrypts the attendee-only slide links into src/data/slides.json.
//
// The repo and the site are public, so attendee-only Drive links must never be committed in
// plain text. They live in .slides-attendee.local.json (gitignored), shaped like:
//   { "password": "...", "talks": { "<talk id>": "<Drive file id>", ... } }
// This script encrypts the "talks" map with AES-GCM, using a key derived from the password
// (PBKDF2-SHA256), and writes only the ciphertext to slides.json. The page decrypts it in the
// browser once an attendee types the password (see src/components/SlideLink.astro).
//
// Run after changing the password or the attendee-only list:
//   node scripts/encrypt-slides.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const LOCAL = new URL("../.slides-attendee.local.json", import.meta.url);
const OUT = new URL("../src/data/slides.json", import.meta.url);
const ITERATIONS = 200_000;

const { password, talks } = JSON.parse(readFileSync(LOCAL, "utf8"));
if (!password || !talks) throw new Error("Need password and talks in .slides-attendee.local.json");

const b64 = (buf) => Buffer.from(buf).toString("base64");
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
// The page lower-cases and trims what attendees type, so do the same here.
const pwKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.trim().toLowerCase()), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  pwKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"],
);
const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(talks)));

const data = JSON.parse(readFileSync(OUT, "utf8"));
data.attendee = {
  talks: Object.keys(talks).sort(), // which talks show the "Attendees only" button (not secret)
  iterations: ITERATIONS,
  salt: b64(salt),
  iv: b64(iv),
  ciphertext: b64(ct),
};
writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
console.log(`Encrypted ${Object.keys(talks).length} attendee-only links into src/data/slides.json`);
