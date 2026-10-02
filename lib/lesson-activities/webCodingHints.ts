export type WebCodingHintLevel = 1 | 2 | 3;

export type WebCodingHintCategory = "html" | "css" | "js" | "runtime" | "concept" | "next_step";

export type WebCodingHintInput = {
  html: string;
  css: string;
  js: string;
  runtimeError?: string | null;
  activityTemplateId?: string;
  hintLevel?: WebCodingHintLevel;
};

export type WebCodingHint = {
  title: string;
  message: string;
  level: WebCodingHintLevel;
  category: WebCodingHintCategory;
  canShowNextHint: boolean;
};

type HintRule = {
  title: string;
  category: WebCodingHintCategory;
  messages: Record<WebCodingHintLevel, string>;
};

const GENERAL_NEXT_STEP: HintRule = {
  title: "다음에 살펴볼 곳 정하기",
  category: "next_step",
  messages: {
    1: "미리보기에서 바꾸고 싶은 부분을 하나 정하고, 그 부분과 연결된 HTML 또는 JavaScript를 찾아보세요.",
    2: "화면에 보이는 글자는 HTML에, 움직임과 결과 변경은 JavaScript에 있는 경우가 많아요.",
    3: "작게 하나만 바꾼 뒤 미리보기를 새로고침해서 어떤 코드가 어떤 결과를 만드는지 확인해 보세요.",
  },
};

function normalizeLevel(value: WebCodingHintInput["hintLevel"]): WebCodingHintLevel {
  if (value === 2 || value === 3) return value;
  return 1;
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function visibleHtmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasMismatchedCssSelector(html: string, css: string): boolean {
  const selectors = Array.from(css.matchAll(/(^|}|,)\s*([.#][A-Za-z0-9_-]+)\s*[{,]/g)).map((match) => match[2]).slice(0, 12);
  if (selectors.length === 0) return false;
  const htmlClasses = new Set(Array.from(html.matchAll(/class=["']([^"']+)["']/gi)).flatMap((match) => match[1].split(/\s+/).filter(Boolean)));
  const htmlIds = new Set(Array.from(html.matchAll(/id=["']([^"']+)["']/gi)).map((match) => match[1]));
  return selectors.some((selector) => {
    const name = selector.slice(1);
    return selector.startsWith(".") ? !htmlClasses.has(name) : !htmlIds.has(name);
  });
}

function hasLikelyUnbalancedPairs(js: string): boolean {
  const pairs: Array<[string, string]> = [["(", ")"], ["{", "}"], ["[", "]"]];
  return pairs.some(([open, close]) => js.split(open).length !== js.split(close).length);
}

function isLesson2Template(activityTemplateId?: string): boolean {
  return /lesson[-_ ]?2|ai[-_ ]?judg|판단|if\/?else|if_else/i.test(activityTemplateId ?? "");
}

function detectRule(input: WebCodingHintInput): HintRule {
  const html = input.html ?? "";
  const css = input.css ?? "";
  const js = input.js ?? "";
  const htmlText = visibleHtmlText(html);
  const runtimeError = compact(input.runtimeError ?? "");
  const htmlHasButton = /<button\b/i.test(html);
  const jsMentionsResult = /(?:getElementById\(["']result["']\)|querySelector\(["']#result["']\)|\bresult\b)/.test(js);
  const jsUpdatesText = /\.(?:textContent|innerText)\s*=/.test(js);
  const hasIfElse = /\bif\s*\(/.test(js) && /\belse\b/.test(js);

  if (runtimeError) {
    if (/Cannot read (?:properties|property) of null/i.test(runtimeError)) {
      return {
        title: "HTML 요소 연결 확인",
        category: "runtime",
        messages: {
          1: "JavaScript가 찾으려는 HTML 요소가 아직 없거나 id 이름이 다를 수 있어요.",
          2: "HTML의 id와 document.getElementById(...) 또는 querySelector(...) 안의 이름이 같은지 확인해 보세요.",
          3: "결과를 바꾸는 줄 바로 위에서 result/output 요소를 제대로 찾았는지 먼저 점검해 보세요.",
        },
      };
    }
    if (/\bis not defined\b/i.test(runtimeError)) {
      return {
        title: "이름 선언과 철자 확인",
        category: "runtime",
        messages: {
          1: "사용한 이름이 선언되어 있는지 확인해 보세요.",
          2: "변수나 함수 이름의 철자가 HTML의 onclick 이름과 JavaScript 함수 이름에서 서로 같은지 살펴보세요.",
          3: "처음 만든 이름을 한 가지로 정하고, 호출하는 곳과 선언하는 곳에 같은 이름을 쓰는지 비교해 보세요.",
        },
      };
    }
    if (/Unexpected token|Unexpected end|missing|unterminated/i.test(runtimeError) || hasLikelyUnbalancedPairs(js)) {
      return {
        title: "괄호와 문장 끝 확인",
        category: "runtime",
        messages: {
          1: "JavaScript 문법에서 괄호나 따옴표가 하나 빠졌을 수 있어요.",
          2: "최근에 고친 줄 주변의 (), {}, [], 따옴표가 짝을 이루는지 확인해 보세요.",
          3: "오류가 난 줄보다 바로 위 줄에서 닫는 괄호나 세미콜론이 빠졌는지도 살펴보세요.",
        },
      };
    }
    return {
      title: "실행 오류부터 해결하기",
      category: "runtime",
      messages: {
        1: "미리보기 오류가 있으면 화면 동작이 멈출 수 있어요. 오류 메시지의 이름과 줄 주변을 먼저 확인해 보세요.",
        2: "오류에 나온 단어가 HTML id, 함수 이름, 변수 이름 중 어디에서 쓰였는지 찾아보세요.",
        3: "가장 최근에 바꾼 JavaScript 줄을 잠깐 되돌리거나 작게 나누어 실행해 보세요.",
      },
    };
  }

  if (!compact(html) || htmlText.length < 2) {
    return {
      title: "HTML 내용부터 만들기",
      category: "html",
      messages: {
        1: "미리보기에 보일 제목이나 설명을 HTML에 먼저 넣어 보세요.",
        2: "h1, p, button처럼 화면에 보이는 태그가 있는지 확인해 보세요.",
        3: "큰 틀은 main 안에 제목, 설명, 버튼, 결과 영역 순서로 생각해 보세요.",
      },
    };
  }

  if (compact(js).length === 0) {
    return {
      title: "JavaScript 동작 추가하기",
      category: "js",
      messages: {
        1: "버튼을 눌렀을 때 결과가 바뀌려면 JavaScript가 필요해요.",
        2: "HTML 버튼의 onclick 이름과 같은 JavaScript 함수가 있는지 확인해 보세요.",
        3: "함수 안에서 결과 영역의 textContent 또는 innerText를 바꾸는 흐름을 만들어 보세요.",
      },
    };
  }

  if (htmlHasButton && !/onclick\s*=|addEventListener\s*\(\s*["']click["']/i.test(`${html}\n${js}`)) {
    return {
      title: "버튼과 함수 연결하기",
      category: "js",
      messages: {
        1: "버튼을 눌러도 반응이 없다면 버튼과 JavaScript 함수가 연결되어 있는지 확인해 보세요.",
        2: "HTML의 onclick 또는 JavaScript의 click 이벤트 연결을 찾아보세요.",
        3: "버튼이 부를 함수 이름과 JavaScript에서 만든 함수 이름이 같은지 비교해 보세요.",
      },
    };
  }

  if (/onclick\s*=|addEventListener\s*\(/i.test(`${html}\n${js}`) && !jsMentionsResult) {
    return {
      title: "결과 영역 찾기",
      category: "js",
      messages: {
        1: "결과를 바꾸려면 JavaScript가 결과를 보여줄 HTML 요소를 찾아야 해요.",
        2: "HTML에 result 또는 output 역할의 id가 있는지 확인해 보세요.",
        3: "document.getElementById(...) 또는 querySelector(...) 안의 이름이 HTML id와 같은지 살펴보세요.",
      },
    };
  }

  if (isLesson2Template(input.activityTemplateId) && !hasIfElse) {
    return {
      title: "조건에 따라 다르게 판단하기",
      category: "concept",
      messages: {
        1: "AI 판단 도우미는 선택한 상황에 따라 다른 안내가 나와야 해요.",
        2: "if 문으로 type 값이 어떤 선택인지 나누고 있는지 확인해 보세요.",
        3: "if, else if, else 흐름이 true/false에 따라 다른 문장을 보여주는지 점검해 보세요.",
      },
    };
  }

  if (compact(css).length > 0 && hasMismatchedCssSelector(html, css)) {
    return {
      title: "CSS 선택자 연결 확인",
      category: "css",
      messages: {
        1: "CSS를 썼는데 화면이 안 바뀐다면 선택자가 HTML과 맞는지 확인해 보세요.",
        2: "CSS의 .이름은 HTML class, #이름은 HTML id와 연결돼요.",
        3: "HTML에 class 또는 id가 실제로 들어 있는지, 철자와 하이픈까지 같은지 비교해 보세요.",
      },
    };
  }

  if (jsMentionsResult && !jsUpdatesText) {
    return {
      title: "결과 문장 바꾸기",
      category: "js",
      messages: {
        1: "결과 영역을 찾은 다음에는 화면의 문장을 바꾸는 코드가 필요해요.",
        2: "result.textContent 또는 innerText를 바꾸는 부분이 있는지 찾아보세요.",
        3: "버튼을 누른 뒤 실행되는 함수 안에서 결과 문장이 바뀌는지 확인해 보세요.",
      },
    };
  }

  if (isLesson2Template(input.activityTemplateId) && compact(html).length > 0 && compact(js).length < 80) {
    return {
      title: "HTML 다음은 판단 로직",
      category: "js",
      messages: {
        1: "화면 글자만 바꾸면 AI 판단 도우미의 결과 동작은 아직 그대로일 수 있어요.",
        2: "버튼을 눌렀을 때 실행되는 JavaScript 함수도 함께 바꿔 보세요.",
        3: "선택값에 따라 결과 문장이 달라지는 조건문이 있는지 확인해 보세요.",
      },
    };
  }

  if (isLesson2Template(input.activityTemplateId) && compact(html).includes("AI와 사람이 함께 판단하기") && compact(js).includes("AI와 사람이 함께하면 좋아요")) {
    return {
      title: "나만의 변화 만들기",
      category: "next_step",
      messages: {
        1: "아직 시작 코드와 많이 비슷해 보여요. 먼저 바꾸고 싶은 문장 하나를 정해 보세요.",
        2: "HTML의 질문이나 버튼 문장을 바꿨다면 JavaScript 결과 문장도 함께 맞춰 보세요.",
        3: "미리보기에서 버튼을 하나씩 눌러 내가 만든 주제와 결과가 잘 연결되는지 확인해 보세요.",
      },
    };
  }

  return GENERAL_NEXT_STEP;
}

export function generateWebCodingHint(input: WebCodingHintInput): WebCodingHint {
  const level = normalizeLevel(input.hintLevel);
  const rule = detectRule(input);
  return {
    title: rule.title,
    message: rule.messages[level],
    level,
    category: rule.category,
    canShowNextHint: level < 3,
  };
}
