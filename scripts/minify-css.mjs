const removablePunctuation = new Set(["{", "}", ";", ",", ">"]);

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
    if (!removablePunctuation.has(previous) && !removablePunctuation.has(next) && previous !== ":") output += " ";
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

  return `${output.trim()}\n`;
}
