const warningHeadingPattern = /표현\s*주의(?:\s*사항)?/;
const forbiddenWordingPattern = /검증\s*전\s*금지\s*표현/;
const explicitDenialPattern = /(?:아닙니다|아님(?:[\s.,)]|$)|제공하지\s*않습니다|보장하지\s*않습니다|완료되지\s*않았습니다|검증되지\s*않았습니다)/;

function matchesPattern(value, pattern) {
  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    return pattern.test(value);
  }
  return value.includes(pattern);
}

export function extractMarkdownSection(source, headingPattern) {
  const lines = source.split(/\r?\n/);
  let start = -1;
  let level = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[index]);
    if (!heading) continue;

    if (start === -1 && matchesPattern(heading[2], headingPattern)) {
      start = index;
      level = heading[1].length;
      continue;
    }

    if (start !== -1 && heading[1].length <= level) {
      return lines.slice(start, index).join("\n");
    }
  }

  return start === -1 ? null : lines.slice(start).join("\n");
}

export function findUnverifiedCompletionClaims(source, phrases, warningSectionHeadingPattern = warningHeadingPattern) {
  const findings = [];
  const headingStack = [];
  const lines = source.split(/\r?\n/);
  let warningDepth = null;
  let wordingWarningDepth = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);

    if (heading) {
      const level = heading[1].length;
      while (headingStack.length && headingStack.at(-1).level >= level) headingStack.pop();
      headingStack.push({ level, text: heading[2] });

      if (warningDepth !== null && level <= warningDepth) {
        warningDepth = null;
      }
      if (wordingWarningDepth !== null && level <= wordingWarningDepth) {
        wordingWarningDepth = null;
      }
      if (matchesPattern(heading[2], warningSectionHeadingPattern)) {
        warningDepth = level;
      }
    } else if (forbiddenWordingPattern.test(line)) {
      wordingWarningDepth = headingStack.at(-1)?.level ?? 0;
    }

    const inWarningContext = warningDepth !== null || wordingWarningDepth !== null;
    const hasExplicitDenial = explicitDenialPattern.test(line);
    if (inWarningContext || hasExplicitDenial) continue;

    for (const phrase of phrases) {
      if (line.includes(phrase)) {
        findings.push({
          phrase,
          lineNumber: index + 1,
          line,
          heading: headingStack.at(-1)?.text ?? null,
        });
      }
    }
  }

  return findings;
}
