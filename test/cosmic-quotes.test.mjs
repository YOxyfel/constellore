import assert from "node:assert/strict";
import test from "node:test";
import {
  COSMIC_QUOTES,
  selectCosmicQuote
} from "../public/cosmic-quotes.mjs";

test("the gate catalog contains exactly 50 concise, unique quotes", () => {
  assert.equal(COSMIC_QUOTES.length, 50);
  assert.equal(new Set(COSMIC_QUOTES.map(({ id }) => id)).size, 50);
  assert.equal(new Set(COSMIC_QUOTES.map(({ text }) => text)).size, 50);
  assert.equal(Object.isFrozen(COSMIC_QUOTES), true);

  for (const quote of COSMIC_QUOTES) {
    assert.equal(Object.isFrozen(quote), true);
    assert.match(quote.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(quote.text, quote.text.trim());
    assert.ok(quote.text.length >= 20, `${quote.id} is too short to feel intentional`);
    assert.ok(quote.text.length <= 120, `${quote.id} is too long for a gate`);
    assert.ok(
      quote.text.split(/\s+/).length <= 22,
      `${quote.id} cannot be read comfortably during a short gate`
    );
  }
});

test("original lines and attributed public-domain lines have explicit metadata", () => {
  const originalQuotes = COSMIC_QUOTES.filter(({ kind }) => kind === "original");
  const attributedQuotes = COSMIC_QUOTES.filter(({ kind }) => kind === "attributed");

  assert.equal(originalQuotes.length, 42);
  assert.equal(attributedQuotes.length, 8);
  assert.ok(originalQuotes.every(({ author }) => author === undefined));

  for (const quote of attributedQuotes) {
    assert.ok(quote.author);
    assert.ok(quote.sourceTitle);
    assert.match(quote.sourceUrl, /^https:\/\/[^\s]+$/);
  }

  assert.deepEqual(
    attributedQuotes.map(({ author }) => author),
    [
      "William Shakespeare",
      "William Blake",
      "Oscar Wilde",
      "Isaac Newton",
      "Walt Whitman",
      "John Muir",
      "Ralph Waldo Emerson",
      "Marcus Aurelius"
    ]
  );
});

test("selection supports deterministic randomness across the full catalog", () => {
  assert.equal(selectCosmicQuote({ random: () => 0 }), COSMIC_QUOTES[0]);
  assert.equal(selectCosmicQuote({ random: () => 0.999999 }), COSMIC_QUOTES.at(-1));
  assert.equal(selectCosmicQuote({ random: () => -4 }), COSMIC_QUOTES[0]);
  assert.equal(selectCosmicQuote({ random: () => 4 }), COSMIC_QUOTES.at(-1));
  assert.equal(selectCosmicQuote({ random: () => Number.NaN }), COSMIC_QUOTES[0]);
  assert.equal(
    selectCosmicQuote({ previousId: "not-in-the-catalog", random: () => 0 }),
    COSMIC_QUOTES[0]
  );
});

test("selection never immediately repeats a known previous quote", () => {
  for (const previous of COSMIC_QUOTES) {
    for (const sample of [0, 0.1, 0.25, 0.5, 0.75, 0.999999]) {
      const selected = selectCosmicQuote({
        previousId: previous.id,
        random: () => sample
      });
      assert.notEqual(selected.id, previous.id);
      assert.ok(COSMIC_QUOTES.includes(selected));
    }
  }

  assert.equal(
    selectCosmicQuote({ previousId: COSMIC_QUOTES[0].id, random: () => 0 }),
    COSMIC_QUOTES[1]
  );
  assert.equal(
    selectCosmicQuote({ previousId: COSMIC_QUOTES.at(-1).id, random: () => 0.999999 }),
    COSMIC_QUOTES.at(-2)
  );
});
