export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  const flushValue = () => {
    currentRow.push(currentValue);
    currentValue = "";
  };

  const flushRow = () => {
    if (currentRow.length === 1 && currentRow[0] === "" && rows.length === 0) {
      currentRow = [];
      return;
    }
    rows.push(currentRow);
    currentRow = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";

    if (inQuotes) {
      if (char === '"') {
        const next = text[index + 1];
        if (next === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      flushValue();
      continue;
    }

    if (char === "\n") {
      flushValue();
      flushRow();
      continue;
    }

    if (char === "\r") {
      flushValue();
      flushRow();
      if (text[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    currentValue += char;
  }

  flushValue();
  if (currentRow.length > 0) {
    flushRow();
  }

  while (rows.length > 0 && rows[rows.length - 1]?.every((cell) => cell === "")) {
    rows.pop();
  }

  return rows;
}

export function stripCsvBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}
