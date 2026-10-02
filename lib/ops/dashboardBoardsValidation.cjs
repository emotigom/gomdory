const MAX_TITLE_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 280;

function normalizePayload(input) {
  if (!input || typeof input !== "object") {
    return {};
  }
  return input;
}

function parseCreateBoardPayload(bodyText) {
  const text = typeof bodyText === "string" ? bodyText.trim() : "";
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: {
          code: "invalid_json",
          message: "잘못된 요청입니다.",
          status: 400,
        },
      };
    }
  }

  const resolvedPayload = normalizePayload(payload);
  const title = typeof resolvedPayload.title === "string" ? resolvedPayload.title.trim() : "";

  if (!title) {
    return {
      ok: false,
      error: {
        code: "invalid_title",
        message: "보드 제목을 입력해주세요",
        status: 400,
      },
    };
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return {
      ok: false,
      error: {
        code: "invalid_title",
        message: "보드 제목은 1~80자 이내로 입력해주세요.",
        status: 400,
      },
    };
  }

  const description =
    typeof resolvedPayload.description === "string" ? resolvedPayload.description.trim() : "";

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      error: {
        code: "invalid_description",
        message: "설명은 280자 이내로 입력해주세요.",
        status: 400,
      },
    };
  }

  const boardViewType =
    resolvedPayload.boardViewType === "wall" || resolvedPayload.boardViewType === "grid"
      ? resolvedPayload.boardViewType
      : "grid";
  const classId =
    typeof resolvedPayload.classId === "string" && resolvedPayload.classId.trim()
      ? resolvedPayload.classId.trim()
      : null;

  return {
    ok: true,
    value: {
      title,
      description: description.length ? description : null,
      boardViewType,
      classId,
    },
  };
}

module.exports = {
  parseCreateBoardPayload,
};
