import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  VOYAGE_MEDIA_CONTRACT_SHA256,
  VOYAGE_MEDIA_CONTRACT_VERSION,
  VOYAGE_MEDIA_SCHEMA_VERSION,
  configureVoyageMasterVideo,
  loadApprovedVoyageMedia,
  resolveApprovedVoyageMedia
} from "../public/cinematic/voyage-projection-media.mjs";

const HASHES = Object.freeze({
  masterSha256: "a".repeat(64),
  mp4Sha256: "b".repeat(64),
  webmSha256: "c".repeat(64),
  posterSha256: "d".repeat(64),
  captionsSha256: "e".repeat(64)
});

function approval(scope) {
  return {
    approved: true,
    humanApproved: {
      reviewer: `${scope} Reviewer`,
      approvedAt: "2026-08-06T12:00:00Z",
      evidencePath: `production/voyage-projection/approvals/${scope}.json`
    }
  };
}

function approvedManifest(overrides = {}) {
  return {
    schemaVersion: VOYAGE_MEDIA_SCHEMA_VERSION,
    contractVersion: VOYAGE_MEDIA_CONTRACT_VERSION,
    contractSha256: VOYAGE_MEDIA_CONTRACT_SHA256,
    approval: approval("release"),
    variants: {
      promise: {
        approval: approval("promise"),
        mp4: "./voyage-projection-opening.mp4",
        webm: "./voyage-projection-opening.webm",
        captions: "./voyage-projection-opening.en.vtt",
        poster: "./voyage-projection-opening.webp",
        ...HASHES,
        durationSeconds: 57,
        frameCount: 1368,
        fps: 24
      }
    },
    ...overrides
  };
}

test("shipped Voyage media manifest remains schema-current and disabled by default", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../public/cinematic/voyage-projection-media.json", import.meta.url),
    "utf8"
  ));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.contractVersion, "1.2.0");
  assert.equal(manifest.contractSha256, VOYAGE_MEDIA_CONTRACT_SHA256);
  assert.equal(manifest.approval.approved, false);
  assert.equal(manifest.approval.humanApproved.reviewer, null);
  assert.deepEqual(manifest.variants, {});
  assert.equal(resolveApprovedVoyageMedia(manifest), null);
});

test("approved Voyage media fails closed until both auditable approval records exist", () => {
  assert.equal(resolveApprovedVoyageMedia(null), null);
  const disabled = approvedManifest({ approval: { ...approval("release"), approved: false } });
  assert.equal(resolveApprovedVoyageMedia(disabled), null);
  const booleanShortcut = approvedManifest({ approval: true });
  assert.equal(resolveApprovedVoyageMedia(booleanShortcut), null);
  const variantBooleanShortcut = approvedManifest();
  variantBooleanShortcut.variants.promise.approval = true;
  assert.equal(resolveApprovedVoyageMedia(variantBooleanShortcut), null);
  const missingReviewer = approvedManifest();
  missingReviewer.variants.promise.approval.humanApproved.reviewer = "";
  assert.equal(resolveApprovedVoyageMedia(missingReviewer), null);
  const missingEvidence = approvedManifest();
  missingEvidence.approval.humanApproved.evidencePath = null;
  assert.equal(resolveApprovedVoyageMedia(missingEvidence), null);
  const invalidDate = approvedManifest();
  invalidDate.variants.promise.approval.humanApproved.approvedAt = "sometime";
  assert.equal(resolveApprovedVoyageMedia(invalidDate), null);
});

test("approved Voyage media fails closed on contract drift or incomplete media", () => {
  assert.equal(resolveApprovedVoyageMedia(approvedManifest({ schemaVersion: 1 })), null);
  assert.equal(resolveApprovedVoyageMedia(approvedManifest({ contractVersion: "1.1.0" })), null);
  assert.equal(
    resolveApprovedVoyageMedia(approvedManifest({ contractSha256: "f".repeat(64) })),
    null
  );
  for (const field of ["mp4", "webm", "poster", "captions", ...Object.keys(HASHES)]) {
    const incomplete = approvedManifest();
    delete incomplete.variants.promise[field];
    assert.equal(resolveApprovedVoyageMedia(incomplete), null, `${field} must be required.`);
  }
});

test("every master and delivery artifact requires its own distinct SHA-256", () => {
  for (const field of Object.keys(HASHES)) {
    const malformed = approvedManifest();
    malformed.variants.promise[field] = "not-a-sha256";
    assert.equal(resolveApprovedVoyageMedia(malformed), null, `${field} must be validated.`);
  }
  const reused = approvedManifest();
  reused.variants.promise.webmSha256 = reused.variants.promise.mp4Sha256;
  assert.equal(resolveApprovedVoyageMedia(reused), null);
});

test("approved Voyage media normalizes exact timing, hashes, and approval evidence", () => {
  const media = resolveApprovedVoyageMedia(approvedManifest(), { variant: "progress" });
  assert.equal(media.variant, "promise");
  assert.equal(media.durationSeconds, 57);
  assert.equal(media.frameCount, 1368);
  assert.equal(media.captions, "./voyage-projection-opening.en.vtt");
  assert.deepEqual(
    Object.fromEntries(Object.keys(HASHES).map((key) => [key, media[key]])),
    HASHES
  );
  assert.deepEqual(media.approval.manifest, {
    reviewer: "release Reviewer",
    approvedAt: "2026-08-06T12:00:00Z",
    evidencePath: "production/voyage-projection/approvals/release.json"
  });
  assert.equal(media.approval.variant.reviewer, "promise Reviewer");
  assert.ok(Object.isFrozen(media));
  assert.ok(Object.isFrozen(media.approval));
  assert.ok(Object.isFrozen(media.approval.manifest));
});

test("manifest loading returns null on network, parse, or approval failure", async () => {
  assert.equal(await loadApprovedVoyageMedia({ fetchImpl: async () => ({ ok: false }) }), null);
  assert.equal(await loadApprovedVoyageMedia({ fetchImpl: async () => { throw new Error("offline"); } }), null);
  const loaded = await loadApprovedVoyageMedia({
    fetchImpl: async () => ({ ok: true, json: async () => approvedManifest() })
  });
  assert.equal(loaded?.variant, "promise");
});

test("master video configuration keeps captions and both format alternatives attached", () => {
  const children = [];
  const documentRef = {
    createElement(tag) {
      return { tagName: tag.toUpperCase(), default: false };
    }
  };
  const video = {
    dataset: {},
    ownerDocument: documentRef,
    append(child) { children.push(child); },
    replaceChildren() { children.length = 0; },
    loadCalls: 0,
    load() { this.loadCalls += 1; }
  };
  const media = resolveApprovedVoyageMedia(approvedManifest());
  assert.equal(configureVoyageMasterVideo(video, media, documentRef), true);
  assert.deepEqual(children.map((child) => child.tagName), ["SOURCE", "SOURCE", "TRACK"]);
  assert.equal(children[0].type, "video/webm");
  assert.equal(children[1].type, "video/mp4");
  assert.equal(children[2].kind, "captions");
  assert.equal(children[2].default, true);
  assert.equal(video.dataset.approvedMaster, "true");
  assert.equal(video.loadCalls, 1);
});

