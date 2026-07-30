const PROFILE_RANK_STYLE_ID = "profile-rank-surface-styles";
const PROFILE_RANK_CSS = String.raw`
/* Player constellation: Route Rank first, then roomy lifetime stats and tools. */
.simple-ui .modal.profile-modal {
  width: min(720px, calc(100% - 28px));
  max-height: min(860px, calc(100dvh - 28px));
  padding: 34px;
  border-color: rgba(105, 216, 204, .3);
  background:
    radial-gradient(circle at 12% 0, rgba(105, 216, 204, .1), transparent 34%),
    linear-gradient(155deg, rgba(17, 55, 65, .98), rgba(5, 27, 36, .99) 68%);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, .055),
    0 30px 90px rgba(0, 7, 12, .64);
}

.simple-ui .profile-heading {
  min-height: 58px;
  position: relative;
  padding: 0 54px 0 70px;
  display: block;
}

.simple-ui .profile-heading::before {
  position: absolute;
  top: 0;
  left: 0;
  float: none;
  width: 54px;
  height: 54px;
  margin: 0;
  border-color: rgba(105, 216, 204, .44);
  color: var(--atlas-teal);
  background:
    radial-gradient(circle, rgba(105, 216, 204, .16), transparent 62%),
    rgba(8, 34, 43, .86);
  box-shadow:
    0 0 0 7px rgba(105, 216, 204, .035),
    0 0 28px rgba(105, 216, 204, .1);
}

.simple-ui .profile-title-block .eyebrow {
  display: block;
  margin-bottom: 4px;
  color: var(--atlas-teal);
  font: 650 12px/1.2 Consolas, monospace;
  letter-spacing: .13em;
}

.simple-ui .profile-title-block h2 {
  margin: 0;
  color: var(--atlas-ivory);
  font-size: clamp(34px, 5vw, 43px);
  line-height: 1;
}

.simple-ui .profile-title-block p {
  margin: 8px 0 0;
  color: var(--atlas-muted);
  font-size: 16px;
  line-height: 1.45;
}

.simple-ui .profile-route-rank {
  --rank-accent: #c89770;
  --rank-accent-rgb: 200, 151, 112;
  --rank-sky: url("./art/ranks/tier-01-common-sm.webp");
  min-height: 188px;
  position: relative;
  isolation: isolate;
  margin-top: 26px;
  overflow: hidden;
  padding: 24px;
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) minmax(150px, 180px);
  align-items: center;
  gap: 22px;
  border: 1px solid rgba(var(--rank-accent-rgb), .46);
  border-radius: 18px;
  background: #0a2732;
  box-shadow:
    inset 0 1px rgba(255, 255, 255, .065),
    0 20px 52px rgba(0, 8, 13, .3);
}

.simple-ui .profile-route-rank[data-rank="silver"] {
  --rank-accent: #dbe7e8;
  --rank-accent-rgb: 219, 231, 232;
}

.simple-ui .profile-route-rank[data-tier="2"] {
  --rank-accent: #f1ca78;
  --rank-accent-rgb: 241, 202, 120;
  --rank-sky: url("./art/ranks/tier-02-dawn-sm.webp");
}

.simple-ui .profile-route-rank[data-rank="diamond"] {
  --rank-accent: #91e9ef;
  --rank-accent-rgb: 145, 233, 239;
}

.simple-ui .profile-route-rank[data-tier="3"] {
  --rank-accent: #84deb1;
  --rank-accent-rgb: 132, 222, 177;
  --rank-sky: url("./art/ranks/tier-03-nebula-sm.webp");
}

.simple-ui .profile-route-rank[data-tier="4"] {
  --rank-accent: #ee9a96;
  --rank-accent-rgb: 238, 154, 150;
  --rank-sky: url("./art/ranks/tier-04-aurora-sm.webp");
}

.simple-ui .profile-route-rank[data-rank="master"] {
  --rank-accent: #ead9aa;
  --rank-accent-rgb: 234, 217, 170;
}

.simple-ui .profile-route-rank[data-tier="5"] {
  --rank-accent: #bb9bec;
  --rank-accent-rgb: 187, 155, 236;
  --rank-sky: url("./art/ranks/tier-05-rift-sm.webp");
}

.simple-ui .profile-route-rank[data-tier="6"] {
  --rank-accent: #ffe0a1;
  --rank-accent-rgb: 255, 224, 161;
  --rank-sky: url("./art/ranks/tier-06-singularity-sm.webp");
}

.simple-ui .profile-route-rank::before,
.simple-ui .profile-route-rank::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.simple-ui .profile-route-rank::before {
  z-index: -2;
  background-image: var(--rank-sky);
  background-position: center;
  background-size: cover;
  opacity: .34;
  filter: saturate(.82) contrast(1.04);
}

.simple-ui .profile-route-rank::after {
  z-index: -1;
  background:
    linear-gradient(90deg, rgba(5, 29, 38, .9) 0%, rgba(5, 29, 38, .7) 52%, rgba(5, 29, 38, .86) 100%),
    radial-gradient(circle at 15% 48%, rgba(var(--rank-accent-rgb), .18), transparent 27%);
}

.simple-ui .profile-rank-crest {
  width: 96px;
  height: 96px;
  position: relative;
  display: grid;
  place-items: center;
  border: 1px solid rgba(var(--rank-accent-rgb), .68);
  border-radius: 50%;
  color: var(--rank-accent);
  background:
    radial-gradient(circle, rgba(var(--rank-accent-rgb), .17), transparent 55%),
    rgba(5, 27, 36, .74);
  box-shadow:
    0 0 0 8px rgba(var(--rank-accent-rgb), .045),
    0 0 34px rgba(var(--rank-accent-rgb), .12);
}

.simple-ui .profile-rank-crest::before,
.simple-ui .profile-rank-crest::after,
.simple-ui .profile-rank-crest i {
  content: "";
  position: absolute;
  border: 1px solid rgba(var(--rank-accent-rgb), .34);
  border-radius: 50%;
}

.simple-ui .profile-rank-crest::before {
  width: 72px;
  height: 72px;
}

.simple-ui .profile-rank-crest::after {
  width: 8px;
  height: 8px;
  top: 7px;
  right: 16px;
  border: 0;
  background: var(--rank-accent);
  box-shadow: 0 0 13px rgba(var(--rank-accent-rgb), .8);
}

.simple-ui .profile-rank-crest i {
  width: 112px;
  height: 34px;
  transform: rotate(-18deg);
  border-width: 1px 0 0;
}

.simple-ui .profile-rank-crest span {
  position: relative;
  z-index: 1;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 38px;
  line-height: 1;
}

.simple-ui .profile-rank-main {
  min-width: 0;
}

.simple-ui .profile-rank-kicker {
  display: block;
  color: var(--rank-accent);
  font: 650 12px/1.2 Consolas, monospace;
  letter-spacing: .14em;
}

.simple-ui .profile-rank-title {
  margin-top: 3px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.simple-ui .profile-rank-title h3 {
  margin: 0;
  color: var(--atlas-ivory);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 34px;
  line-height: 1;
}

.simple-ui .profile-rank-title small {
  color: rgba(var(--rank-accent-rgb), .86);
  font: 600 11px/1.2 Consolas, monospace;
  letter-spacing: .09em;
}

.simple-ui .profile-rank-main > p {
  margin: 9px 0 12px;
  color: #d7e3e0;
  font-size: 15px;
  line-height: 1.4;
}

.simple-ui .profile-rank-meter {
  width: 100%;
  height: 7px;
  overflow: hidden;
  border: 1px solid rgba(var(--rank-accent-rgb), .18);
  border-radius: 999px;
  background: rgba(1, 14, 20, .52);
}

.simple-ui .profile-rank-meter > i {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(var(--rank-accent-rgb), .64), var(--rank-accent));
  box-shadow: 0 0 16px rgba(var(--rank-accent-rgb), .38);
  transition: width .35s ease;
}

.simple-ui .profile-rank-meta {
  margin-top: 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--atlas-muted);
  font-size: 13px;
  line-height: 1.3;
}

.simple-ui .profile-rank-meta b {
  flex: 0 0 auto;
  color: var(--rank-accent);
  font: 650 12px/1 Consolas, monospace;
}

.simple-ui .profile-rank-unlock {
  min-width: 0;
  min-height: 104px;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-left: 1px solid rgba(var(--rank-accent-rgb), .24);
}

.simple-ui .profile-rank-unlock small {
  color: var(--rank-accent);
  font: 650 10px/1.2 Consolas, monospace;
  letter-spacing: .12em;
}

.simple-ui .profile-rank-unlock strong {
  margin-top: 7px;
  color: var(--atlas-ivory);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.42;
}

.simple-ui .profile-overview {
  margin: 18px 0 26px;
}

.simple-ui .profile-core-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.simple-ui .profile-core-grid div {
  min-width: 0;
  min-height: 112px;
  padding: 16px 12px;
  display: grid;
  grid-template-rows: 22px auto auto;
  place-items: center;
  gap: 4px;
  border: 1px solid rgba(169, 211, 206, .18);
  border-radius: 13px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .025), transparent),
    rgba(5, 26, 34, .52);
  box-shadow: inset 0 1px rgba(255, 255, 255, .025);
  text-align: center;
}

.simple-ui .profile-core-grid div:nth-child(n) {
  border-right: 1px solid rgba(169, 211, 206, .18);
  border-bottom: 1px solid rgba(169, 211, 206, .18);
}

.simple-ui .profile-core-grid i {
  color: var(--atlas-teal);
  font-style: normal;
  font-size: 17px;
}

.simple-ui .profile-core-grid strong {
  color: var(--atlas-gold-bright);
  font-family: inherit;
  font-size: 28px;
  line-height: 1;
}

.simple-ui .profile-core-grid span {
  color: var(--atlas-muted);
  font-size: 15px;
  line-height: 1.25;
}

.simple-ui .profile-more {
  padding-top: 22px;
  border: 0;
  border-top: 1px solid rgba(169, 211, 206, .16);
  border-radius: 0;
}

.simple-ui .profile-more-heading {
  margin-bottom: 15px;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 22px;
}

.simple-ui .profile-more-heading .eyebrow {
  display: block;
  margin-bottom: 3px;
  color: var(--atlas-teal);
  font: 650 11px/1.2 Consolas, monospace;
  letter-spacing: .12em;
}

.simple-ui .profile-more-heading h3 {
  margin: 0;
  color: var(--atlas-ivory);
  font-family: Georgia, "Times New Roman", serif;
  font-size: 22px;
}

.simple-ui .profile-more-heading p {
  max-width: 31ch;
  margin: 0;
  color: var(--atlas-muted);
  font-size: 14px;
  line-height: 1.4;
  text-align: right;
}

.simple-ui .profile-more-content {
  padding: 0;
}

.simple-ui .profile-disclosure-grid {
  gap: 12px;
}

.simple-ui .profile-disclosure {
  overflow: hidden;
  border: 1px solid rgba(169, 211, 206, .18);
  border-radius: 12px;
  background: rgba(5, 26, 34, .46);
}

.simple-ui .profile-disclosure > summary {
  min-height: 66px;
  padding: 10px 15px;
}

.simple-ui .profile-disclosure[open] {
  border-color: rgba(105, 216, 204, .34);
  background: rgba(8, 34, 43, .74);
}

@media (max-width: 700px) {
  .simple-ui .modal.profile-modal {
    inset: 0;
    width: 100%;
    max-width: none;
    height: 100dvh;
    max-height: 100dvh;
    margin: 0;
    padding: calc(58px + env(safe-area-inset-top)) 16px max(22px, env(safe-area-inset-bottom));
    border: 0;
    border-radius: 0;
  }

  .simple-ui .profile-heading {
    padding: 0 42px 0 62px;
  }

  .simple-ui .profile-heading::before {
    width: 46px;
    height: 46px;
  }

  .simple-ui .profile-title-block h2 {
    font-size: 32px;
  }

  .simple-ui .profile-title-block p {
    font-size: 15px;
  }

  .simple-ui .profile-route-rank {
    min-height: 0;
    margin-top: 22px;
    padding: 20px;
    grid-template-columns: 84px minmax(0, 1fr);
    gap: 18px;
  }

  .simple-ui .profile-rank-crest {
    width: 80px;
    height: 80px;
  }

  .simple-ui .profile-rank-crest::before {
    width: 60px;
    height: 60px;
  }

  .simple-ui .profile-rank-crest i {
    width: 94px;
  }

  .simple-ui .profile-rank-crest span {
    font-size: 32px;
  }

  .simple-ui .profile-rank-unlock {
    min-height: 0;
    padding: 14px 0 0;
    grid-column: 1 / -1;
    border-top: 1px solid rgba(var(--rank-accent-rgb), .22);
    border-left: 0;
  }

  .simple-ui .profile-more-heading {
    align-items: start;
    flex-direction: column;
    gap: 5px;
  }

  .simple-ui .profile-more-heading p {
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 420px) {
  .simple-ui .modal.profile-modal {
    padding-inline: 13px;
  }

  .simple-ui .profile-heading {
    min-height: 48px;
    padding-left: 52px;
  }

  .simple-ui .profile-title-block .eyebrow,
  .simple-ui .profile-title-block p {
    display: none;
  }

  .simple-ui .profile-route-rank {
    padding: 17px;
    grid-template-columns: 68px minmax(0, 1fr);
    gap: 14px;
    border-radius: 15px;
  }

  .simple-ui .profile-rank-crest {
    width: 64px;
    height: 64px;
  }

  .simple-ui .profile-rank-crest::before {
    width: 48px;
    height: 48px;
  }

  .simple-ui .profile-rank-crest i {
    width: 76px;
  }

  .simple-ui .profile-rank-title h3 {
    font-size: 28px;
  }

  .simple-ui .profile-rank-title small {
    display: none;
  }

  .simple-ui .profile-rank-main > p {
    margin-block: 7px 10px;
  }

  .simple-ui .profile-rank-meta {
    align-items: start;
    flex-direction: column;
    gap: 3px;
  }

  .simple-ui .profile-core-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .simple-ui .profile-core-grid div {
    min-height: 64px;
    padding: 10px 13px;
    grid-template-columns: 24px auto minmax(0, 1fr);
    grid-template-rows: 1fr;
    justify-items: start;
    text-align: left;
  }

  .simple-ui .profile-core-grid strong {
    font-size: 24px;
  }

  .simple-ui .profile-core-grid span {
    justify-self: end;
    text-align: right;
  }
}

@media (prefers-reduced-motion: reduce) {
  .simple-ui .profile-rank-meter > i {
    transition: none;
  }
}

@media (forced-colors: active) {
  .simple-ui :is(
    .modal.profile-modal,
    .profile-route-rank,
    .profile-rank-crest,
    .profile-core-grid div,
    .profile-disclosure
  ) {
    border: 1px solid CanvasText;
    color: CanvasText;
    background: Canvas;
    box-shadow: none;
    forced-color-adjust: auto;
  }

  .simple-ui .profile-route-rank::before,
  .simple-ui .profile-route-rank::after {
    display: none;
  }
}
`;

const byId = (documentRef, id) => documentRef.getElementById(id);

export function mountProfileRankSurface(documentRef = document) {
  let style = byId(documentRef, PROFILE_RANK_STYLE_ID);
  if (style) return style;
  style = documentRef.createElement("style");
  style.id = PROFILE_RANK_STYLE_ID;
  style.textContent = PROFILE_RANK_CSS;
  documentRef.head.append(style);
  return style;
}
