import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import localRules from "./scripts/eslint/local-rules.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	...compat.extends("next/core-web-vitals", "next/typescript"),
	{
		ignores: [".open-next/**", "worker/**"],
	},
	{
		plugins: {
			gom: localRules,
		},
		rules: {
			"gom/no-hardcoded-api-v1": "error",
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "error",
		},
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "@/lib/edu/lesson/internal/decorateGenerateJson",
							message: "Use runDecorateFlow instead of calling decorate generateJson internals directly.",
						},
					],
				},
			],
		},
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["app/s/**", "app/api/v1/share/**", "tests/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "@/lib/share/public/access",
							message:
								"lib/share/public/access is the server-only public-entry/share boundary. Reuse it from app/s/** and app/api/v1/share/** instead of pulling it into unrelated layers.",
						},
					],
				},
			],
		},
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["app/api/v1/e2e/login/**", "tests/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "@/lib/e2e/smokeAuth",
							message:
								"smokeAuth is the e2e login route boundary. Keep imports in app/api/v1/e2e/login/** (or tests) so smoke-secret handling does not drift into generic helpers.",
						},
					],
				},
			],
		},
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["app/api/v1/system/diag/**", "tests/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						{
							name: "@/lib/system/diag/runtimeSummary",
							message:
								"runtimeSummary is the /api/v1/system/diag assembly seam. Keep payload composition in that route boundary instead of reusing it as a generic helper.",
						},
					],
				},
			],
		},
	},
	{
		files: ["lib/edu/lesson/runDecorateFlow.ts"],
		rules: {
			"no-restricted-imports": "off",
		},
	},

	{
		files: ["**/*.ts", "**/*.tsx"],
		ignores: ["app/world-hub/**", "lib/world-hub/**", "tests/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@/lib/world-hub", "@/lib/world-hub/*", "@/lib/world-hub/**"],
							message:
								"Keep world-hub runtime imports inside app/world-hub/** and lib/world-hub/** so the metaverse slice stays route-isolated.",
						},
					],
				},
			],
		},
	},

	{
		files: ["app/world-hub/**/*.ts", "app/world-hub/**/*.tsx", "lib/world-hub/**/*.ts", "lib/world-hub/**/*.tsx"],
		ignores: ["lib/world-hub/config/**", "lib/world-hub/manifest/**", "lib/world-hub/mission/config/**", "lib/world-hub/mission/manifest/**", "tests/**"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["@/lib/world-hub/config/defaultManifest"],
							message:
								"Route world-hub manifest access through lib/world-hub/manifest/** so the local default source stays behind the loader boundary.",
						},
						{
							group: ["@/lib/world-hub/mission/config/defaultMissionScenes"],
							message:
								"Route mission scene defaults through lib/world-hub/mission/manifest/** so local mission config stays behind the loader boundary.",
						},
					],
				},
			],
		},
	},

	{
		files: ["lib/server/**/*.ts", "app/api/**/*.ts", "custom-worker.ts"],
		rules: {
			"no-restricted-properties": [
				"error",
				{
					object: "process",
					property: "env",
					message: "Use readEnvString/getRuntimeEnv from lib/server/runtimeEnv instead of process.env.",
				},
			],
		},
	},
];

export default eslintConfig;
