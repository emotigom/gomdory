import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HARD_CODED_API_V1 = "/api/v1/";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const BASELINE_PATH = path.resolve(SCRIPT_DIR, "no-hardcoded-api-v1.baseline.json");

const baseline = fs.existsSync(BASELINE_PATH)
	? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"))
	: {};

const normalizePath = (filename) => filename.split(path.sep).join("/");

const normalizeRelativePath = (filename) =>
	normalizePath(path.relative(REPO_ROOT, filename));

const isExcludedPath = (filename) =>
	filename.includes("/lib/standards/") ||
	filename.includes("/scripts/") ||
	filename.includes("/docs/");

const isInScope = (filename) =>
	(filename.includes("/app/") || filename.includes("/lib/")) && !isExcludedPath(filename);

const containsHardcodedApiV1 = (value) => value.includes(HARD_CODED_API_V1);
const countOccurrences = (value) => {
	let count = 0;
	let index = value.indexOf(HARD_CODED_API_V1);
	while (index !== -1) {
		count += 1;
		index = value.indexOf(HARD_CODED_API_V1, index + HARD_CODED_API_V1.length);
	}
	return count;
};

const noHardcodedApiV1 = {
	meta: {
		type: "problem",
		messages: {
			hardcodedApiV1:
				"Hardcoded '/api/v1/' is not allowed in app/lib code. Use routes.ts builder or unsafeApiPath. Found {{count}}, allowed {{allowed}}.",
		},
	},
	create(context) {
		const filename = context.getFilename();
		if (!filename || filename === "<input>") {
			return {};
		}

		const normalizedFilename = normalizePath(filename);
		if (!isInScope(normalizedFilename)) {
			return {};
		}

		const relativePath = normalizeRelativePath(filename);
		const strictMode = process.env.STRICT_API_PATH_LINT === "1";
		let count = 0;

		return {
			Literal(node) {
				if (typeof node.value !== "string") {
					return;
				}
				if (containsHardcodedApiV1(node.value)) {
					count += countOccurrences(node.value);
				}
			},
			TemplateLiteral(node) {
				for (const quasi of node.quasis) {
					const value = quasi.value.cooked ?? quasi.value.raw ?? "";
					if (containsHardcodedApiV1(value)) {
						count += countOccurrences(value);
					}
				}
			},
			"Program:exit"(node) {
				const allowed = strictMode ? 0 : (baseline[relativePath] ?? 0);
				if (count > allowed) {
					context.report({
						node,
						messageId: "hardcodedApiV1",
						data: { count, allowed },
					});
				}
			},
		};
	},
};

const localRules = {
	rules: {
		"no-hardcoded-api-v1": noHardcodedApiV1,
	},
};

export default localRules;
