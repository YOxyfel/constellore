const EXPECTED_SCHEMA_VERSION = 2;
const EXPECTED_CONTRACT_VERSION = "1.2.0";
const EXPECTED_CONTRACT_SHA256 = "0459b858503d99cc30d04139b5aa6144d03fb81e4b2e95fb9be4973f149b1416";
const MEDIA_MANIFEST_URL = new URL("./voyage-projection-media.json", import.meta.url);

function cleanPath(value) {
  const path = String(value || "").trim();
  if (!path || /^(?:data|javascript|blob):/iu.test(path)) return null;
  return path;
}

function validHash(value) {
  return /^[a-f0-9]{64}$/u.test(String(value || ""));
}

function validApprovalDate(value) {
  const approvedAt = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(approvedAt)
    && Number.isFinite(Date.parse(approvedAt));
}

/**
 * Approval is deliberately an auditable object, never a truthy shorthand.
 * This normalizes the runtime shape while retaining the reviewer and evidence
 * fields expected by the production release boundary.
 */
function resolveHumanApproval(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.approved !== true) return null;
  const humanApproved = value.humanApproved;
  if (!humanApproved || typeof humanApproved !== "object" || Array.isArray(humanApproved)) return null;
  const reviewer = String(humanApproved.reviewer || "").trim();
  const approvedAt = String(humanApproved.approvedAt || "").trim();
  const evidencePath = cleanPath(humanApproved.evidencePath);
  if (!reviewer || !validApprovalDate(approvedAt) || !evidencePath) return null;
  return Object.freeze({ reviewer, approvedAt, evidencePath });
}

/**
 * Resolve only media that has crossed every production and human-approval
 * boundary. A half-filled manifest can never turn a work-in-progress encode
 * into the player's authoritative cinematic.
 */
export function resolveApprovedVoyageMedia(manifest, { variant = "promise" } = {}) {
  if (!manifest || manifest.schemaVersion !== EXPECTED_SCHEMA_VERSION) return null;
  if (manifest.contractVersion !== EXPECTED_CONTRACT_VERSION) return null;
  if (manifest.contractSha256 !== EXPECTED_CONTRACT_SHA256) return null;
  const manifestApproval = resolveHumanApproval(manifest.approval);
  if (!manifestApproval) return null;
  const key = String(variant || "promise").toLocaleLowerCase("en") === "completion"
    ? "completion"
    : "promise";
  const record = manifest.variants?.[key];
  if (!record) return null;
  const variantApproval = resolveHumanApproval(record.approval);
  if (!variantApproval) return null;
  const mp4 = cleanPath(record.mp4);
  const webm = cleanPath(record.webm);
  const captions = cleanPath(record.captions);
  const poster = cleanPath(record.poster);
  if (!mp4 || !webm || !captions || !poster) return null;
  if (new Set([mp4, webm, captions, poster]).size !== 4) return null;
  const hashes = [
    record.masterSha256,
    record.mp4Sha256,
    record.webmSha256,
    record.posterSha256,
    record.captionsSha256
  ];
  if (!hashes.every(validHash) || new Set(hashes).size !== hashes.length) return null;
  if (Number(record.durationSeconds) !== 57 || Number(record.frameCount) !== 1368 || Number(record.fps) !== 24) return null;
  return Object.freeze({
    variant: key,
    mp4,
    webm,
    captions,
    poster,
    masterSha256: record.masterSha256,
    mp4Sha256: record.mp4Sha256,
    webmSha256: record.webmSha256,
    posterSha256: record.posterSha256,
    captionsSha256: record.captionsSha256,
    approval: Object.freeze({
      manifest: manifestApproval,
      variant: variantApproval
    }),
    durationSeconds: 57,
    frameCount: 1368,
    fps: 24
  });
}

export async function loadApprovedVoyageMedia({
  variant = "promise",
  fetchImpl = globalThis.fetch,
  manifestUrl = MEDIA_MANIFEST_URL
} = {}) {
  if (typeof fetchImpl !== "function") return null;
  try {
    const response = await fetchImpl(manifestUrl, { cache: "no-store", credentials: "same-origin" });
    if (!response?.ok) return null;
    return resolveApprovedVoyageMedia(await response.json(), { variant });
  } catch {
    return null;
  }
}

export function configureVoyageMasterVideo(video, media, documentRef = video?.ownerDocument) {
  if (!video || !media || !documentRef?.createElement) return false;
  video.replaceChildren?.();
  if (media.webm) {
    const source = documentRef.createElement("source");
    source.src = media.webm;
    source.type = "video/webm";
    video.append(source);
  }
  if (media.mp4) {
    const source = documentRef.createElement("source");
    source.src = media.mp4;
    source.type = "video/mp4";
    video.append(source);
  }
  const track = documentRef.createElement("track");
  track.kind = "captions";
  track.label = "English";
  track.srclang = "en";
  track.src = media.captions;
  track.default = true;
  video.append(track);
  video.poster = media.poster;
  video.preload = "auto";
  video.playsInline = true;
  video.controls = false;
  video.dataset.variant = media.variant;
  video.dataset.approvedMaster = "true";
  video.load?.();
  return true;
}

export const VOYAGE_MEDIA_CONTRACT_SHA256 = EXPECTED_CONTRACT_SHA256;
export const VOYAGE_MEDIA_CONTRACT_VERSION = EXPECTED_CONTRACT_VERSION;
export const VOYAGE_MEDIA_SCHEMA_VERSION = EXPECTED_SCHEMA_VERSION;
