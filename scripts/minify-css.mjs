const removablePunctuation = new Set(["{", "}", ";", ",", ">"]);
const zeroLengthUnit = /(^|[^\w.#%-])(-?0)(?:px|em|rem|ex|ch|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|cm|mm|in|pt|pc|q)(?![\w-])/gi;

function compactTokensOutsideStrings(source, transform) {
  let output = "";
  let chunk = "";
  let quote = "";
  let escaped = false;
  const flush = () => {
    output += quote ? chunk : transform(chunk);
    chunk = "";
  };

  for (const character of source) {
    if (quote) {
      chunk += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) {
        flush();
        quote = "";
      }
      continue;
    }
    if (character === "'" || character === '"') {
      flush();
      quote = character;
      chunk = character;
      continue;
    }
    chunk += character;
  }
  flush();
  return output;
}

function unquoteSafeAttributeValues(source) {
  let output = "";
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\\") {
      output += character;
      if (source[index + 1]) output += source[index += 1];
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      output += character;
      continue;
    }
    if (character === "[") {
      const match = source.slice(index).match(
        /^\[([a-zA-Z_][\w-]*)([~|^$*]?=)(["'])([a-zA-Z_][\w-]*)\3\]/
      );
      if (match) {
        output += `[${match[1]}${match[2]}${match[4]}]`;
        index += match[0].length - 1;
        continue;
      }
    }
    output += character;
  }
  return output;
}

export function minifyCss(source) {
  const input = String(source || "");
  let output = "";
  let quote = "";
  let escaped = false;
  let pendingSpace = false;

  const appendPendingSpace = (next) => {
    if (!pendingSpace) return;
    if (!output) {
      pendingSpace = false;
      return;
    }
    const previous = output.at(-1);
    if (!removablePunctuation.has(previous) && !removablePunctuation.has(next) && previous !== ":" && previous !== "(" && next !== ")") output += " ";
    pendingSpace = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }

    if (character === "\\") {
      appendPendingSpace(character);
      output += character;
      if (next) output += input[index += 1];
      continue;
    }

    if (character === "/" && next === "*") {
      index += 2;
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }

    if (character === "'" || character === '"') {
      appendPendingSpace(character);
      quote = character;
      output += character;
      continue;
    }

    if (/\s/.test(character)) {
      pendingSpace = true;
      continue;
    }

    if (removablePunctuation.has(character)) {
      if (output.endsWith(" ")) output = output.slice(0, -1);
      if (character === "}" && output.endsWith(";")) output = output.slice(0, -1);
      output += character;
      pendingSpace = false;
      continue;
    }

    appendPendingSpace(character);
    output += character;
  }

  const compacted = compactTokensOutsideStrings(
    output.trim(),
    (chunk) => chunk.replace(zeroLengthUnit, "$1$2")
  );
  const minified = unquoteSafeAttributeValues(compacted);
  return `${minified}\n`;
}
