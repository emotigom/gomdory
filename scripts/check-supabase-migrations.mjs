import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASELINE_PATH = path.resolve("scripts/check-supabase-migrations.baseline.json");
export const MIGRATION_FILENAME_PATTERN = /^\d{14}_[a-z0-9_]+\.sql$/;
const MIGRATION_FILENAME_RULE = "14-digit lowercase snake_case SQL filename";

export const resolveMigrationsDir = (env = process.env) => {
	const override = env.SUPABASE_MIGRATIONS_DIR?.trim();

	return path.resolve(
		override && override.length > 0 ? override : "supabase/migrations",
	);
};

const hasFlag = (flag) => process.argv.includes(flag);

const UPDATE_BASELINE = hasFlag("--update-baseline");
const FAIL_ON_NEW_DUPLICATE = hasFlag("--fail-on-new-duplicate");

const normalizeIdentifier = (value) =>
	value.replace(/"/g, "").replace(/;+$/, "").trim().toLowerCase();

const splitQualifiedName = (value) => {
	const parts = [];
	let current = "";
	let inQuotes = false;

	for (const char of value) {
		if (char === '"') {
			inQuotes = !inQuotes;
			current += char;
			continue;
		}
		if (char === "." && !inQuotes) {
			parts.push(current);
			current = "";
			continue;
		}
		current += char;
	}
	parts.push(current);
	return parts;
};

const normalizeTableName = (value) => {
	const cleaned = value.replace(/;+$/, "").trim();
	if (!cleaned) {
		return "";
	}
	const parts = splitQualifiedName(cleaned).filter(Boolean);
	if (parts.length === 0) {
		return "";
	}
	const schema = parts.length === 1 ? "public" : parts[0];
	const table = parts.length === 1 ? parts[0] : parts[1];
	const normalizedSchema = normalizeIdentifier(schema);
	const normalizedTable = normalizeIdentifier(table);
	if (!normalizedSchema || !normalizedTable) {
		return "";
	}
	return `${normalizedSchema}.${normalizedTable}`;
};

const findGuardBlocks = (content) => {
	const guardBlocks = [];
	const regex = /do\s+\$\$[\s\S]*?\$\$/gi;
	for (const match of content.matchAll(regex)) {
		if (match.index === undefined) {
			continue;
		}
		if (/to_regclass\s*\(/i.test(match[0])) {
			guardBlocks.push({
				start: match.index,
				end: match.index + match[0].length,
			});
		}
	}
	return guardBlocks;
};

const isGuarded = (index, guardBlocks) =>
	guardBlocks.some((block) => index >= block.start && index <= block.end);

const findPgPolicyGuards = (content) => {
	const guardedPolicies = new Set();
	const blockRegex = /do\s+\$\$[\s\S]*?\$\$/gi;
	for (const match of content.matchAll(blockRegex)) {
		const block = match[0];
		if (!/pg_policies/i.test(block)) {
			continue;
		}
		const policyRegex = /policyname\s*=\s*'([^']+)'/gi;
		for (const policyMatch of block.matchAll(policyRegex)) {
			const policyName = normalizeIdentifier(policyMatch[1] ?? "");
			if (policyName) {
				guardedPolicies.add(policyName);
			}
		}
	}
	return guardedPolicies;
};

const toPolicyKey = (table, policy) => `${table}::${policy}`;

export const validateMigrationFilenames = (
	files,
	migrationsDir = resolveMigrationsDir(),
) => {
	const errors = [];
	const versions = new Map();

	for (const file of files) {
		if (!MIGRATION_FILENAME_PATTERN.test(file)) {
			errors.push(
				`Invalid Supabase migration filename:\n${path.join(
					migrationsDir,
					file,
				)}\nExpected:\n^[0-9]{14}_[a-z0-9_]+\\.sql$ (${MIGRATION_FILENAME_RULE})`,
			);
			continue;
		}

		const version = file.slice(0, 14);
		const versionFiles = versions.get(version) ?? [];
		versionFiles.push(file);
		versions.set(version, versionFiles);
	}

	for (const [version, versionFiles] of versions) {
		if (versionFiles.length > 1) {
			errors.push(
				`Duplicate Supabase migration version: ${version}\n${versionFiles
					.map((file) => `- ${path.join(migrationsDir, file)}`)
					.join("\n")}`,
			);
		}
	}

	return errors;
};

const listMigrationFiles = async (migrationsDir) => {
	const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
		.map((entry) => entry.name)
		.sort();
};

const analyzeMigrations = (migrations) => {
	const createdTables = new Set();
	const createTableRegex =
		/create\s+table\s+(if\s+not\s+exists\s+)?([^\s(]+)/gi;

	for (const { content } of migrations.values()) {
		for (const match of content.matchAll(createTableRegex)) {
			const table = normalizeTableName(match[2] ?? "");
			if (table) {
				createdTables.add(table);
			}
		}
	}

	const errors = [];
	const duplicates = [];
	const policyOccurrences = new Map();

	const dropPolicyRegex =
		/drop\s+policy\s+if\s+exists\s+("[^"]+"|[^\s]+)\s+on\s+([^\s;]+)/gi;
	const createPolicyRegex =
		/create\s+policy\s+("[^"]+"|[^\s]+)\s+on\s+([^\s;]+)/gi;
	const alterTableEnableRlsRegex =
		/alter\s+table\s+([^\s;]+)\s+enable\s+(row\s+level\s+security|rls)/gi;

	for (const [file, { content }] of migrations.entries()) {
		const guardBlocks = findGuardBlocks(content);
		const dropPolicies = new Set();
		const guardedPolicies = findPgPolicyGuards(content);

		for (const match of content.matchAll(dropPolicyRegex)) {
			const policy = normalizeIdentifier(match[1] ?? "");
			const table = normalizeTableName(match[2] ?? "");
			if (policy && table) {
				dropPolicies.add(toPolicyKey(table, policy));
			}
		}

		for (const match of content.matchAll(createPolicyRegex)) {
			const policy = normalizeIdentifier(match[1] ?? "");
			const table = normalizeTableName(match[2] ?? "");
			const isStatementGuarded =
				match.index !== undefined && isGuarded(match.index, guardBlocks);

			if (!policy || !table) {
				continue;
			}

			const policyKey = toPolicyKey(table, policy);
			const hasDropGuard = dropPolicies.has(policyKey);
			const hasPgPolicyGuard = guardedPolicies.has(policy);

			if (!hasDropGuard && !hasPgPolicyGuard) {
				errors.push(
					`${file}: create policy "${policy}" on ${table} without matching drop policy if exists or pg_policies guard`
				);
			}

			if (!createdTables.has(table) && !isStatementGuarded) {
				errors.push(
					`${file}: policy "${policy}" targets missing table ${table} (no create table found)`
				);
			}

			const existing = policyOccurrences.get(policyKey);
			if (existing && existing !== file) {
				const guardSuffix = hasDropGuard
					? " (drop-before-create)"
					: hasPgPolicyGuard
						? " (guarded)"
						: "";
				duplicates.push({
					file,
					firstSeenFile: existing,
					message: `${file}: duplicate create policy "${policy}" on ${table}${guardSuffix} (already in ${existing})`,
					policy,
					table,
				});
			} else {
				policyOccurrences.set(policyKey, file);
			}
		}

		for (const match of content.matchAll(alterTableEnableRlsRegex)) {
			const table = normalizeTableName(match[1] ?? "");
			const isStatementGuarded =
				match.index !== undefined && isGuarded(match.index, guardBlocks);

			if (!table) {
				continue;
			}

			if (!createdTables.has(table) && !isStatementGuarded) {
				errors.push(
					`${file}: alter table enable RLS targets missing table ${table} (no create table found)`
				);
			}
		}
	}

	return { duplicates, errors };
};

const runSelfTest = () => {
	const filenameErrors = validateMigrationFilenames([
		"20241006120000_create_boards.sql",
		"20241006120000_create_walls.sql",
		"20240101_malformed.sql",
	]);
	if (
		filenameErrors.length !== 2 ||
		!filenameErrors.some((error) => error.includes("malformed")) ||
		!filenameErrors.some((error) =>
			error.includes("Duplicate Supabase migration version"),
		)
	) {
		throw new Error(
			`Self-test failed. Expected malformed filename and duplicate version errors, got:\n${filenameErrors.join("\n")}`
		);
	}

	const testMigrations = new Map([
		[
			"20241006120000_create_boards.sql",
			{
				content: `
				create table if not exists boards (id uuid);
				do $$
				begin
				  if not exists (
				    select 1 from pg_policies where policyname = 'Board policy'
				  ) then
				    create policy "Board policy" on boards for select using (true);
				  end if;
				end $$;
				`,
			},
		],
		[
			"20250213090000_add_session_report_shares.sql",
			{
				content: `
				create table if not exists session_report_shares (id uuid);
				alter table session_report_shares enable rls;
				`,
			},
		],
		[
			"20250214090000_add_class_session_bookmarks.sql",
			{
				content: `
				create table if not exists "class_session_bookmarks" (id uuid);
				alter table "class_session_bookmarks" enable rls;
				`,
			},
		],
		[
			"20250301000000_bad_policy.sql",
			{
				content: `
				create table public.bad (id uuid);
				create policy "Bad policy" on public.bad for select using (true);
				`,
			},
		],
	]);

	const { errors } = analyzeMigrations(testMigrations);
	const hasBadPolicyError = errors.some((error) =>
		error.includes("bad_policy")
	);
	if (errors.length !== 1 || !hasBadPolicyError) {
		throw new Error(
			`Self-test failed. Expected 1 error for bad policy only, got:\n${errors.join("\n")}`
		);
	}

	console.log("[check-supabase-migrations] self-test ok");
};

const main = async () => {
	if (process.argv.includes("--self-test")) {
		runSelfTest();
		return;
	}

	const migrationsDir = resolveMigrationsDir();
	let files;
	try {
		files = await listMigrationFiles(migrationsDir);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(
			`[check-supabase-migrations] unable to read migration directory:\n${migrationsDir}\n${message}`,
		);
		process.exitCode = 1;
		return;
	}

	const filenameErrors = validateMigrationFilenames(files, migrationsDir);
	if (filenameErrors.length > 0) {
		console.error(
			"[check-supabase-migrations] filename/version errors:\n" +
				filenameErrors.join("\n")
		);
		process.exitCode = 1;
		return;
	}

	const migrations = new Map();

	for (const file of files) {
		const filePath = path.join(migrationsDir, file);
		const content = await fs.readFile(filePath, "utf8");
		migrations.set(file, { filePath, content });
	}

	const { duplicates, errors } = analyzeMigrations(migrations);
	const baselineRaw = await fs
		.readFile(BASELINE_PATH, "utf8")
		.then((data) => JSON.parse(data))
		.catch(() => ({ duplicates: [] }));
	const baselineEntries = new Set(
		(baselineRaw.duplicates ?? []).map(
			(entry) => `${entry.table}::${entry.policy}::${entry.firstSeenFile}`
		)
	);
	const newDuplicates = duplicates.filter(
		(entry) =>
			!baselineEntries.has(
				`${entry.table}::${entry.policy}::${entry.firstSeenFile}`
			)
	);

	if (UPDATE_BASELINE) {
		const uniqueDuplicates = new Map();
		for (const entry of duplicates) {
			const key = `${entry.table}::${entry.policy}::${entry.firstSeenFile}`;
			if (!uniqueDuplicates.has(key)) {
				uniqueDuplicates.set(key, {
					table: entry.table,
					policy: entry.policy,
					firstSeenFile: entry.firstSeenFile,
				});
			}
		}
		const updated = {
			duplicates: Array.from(uniqueDuplicates.values()).sort((a, b) =>
				`${a.table}::${a.policy}::${a.firstSeenFile}`.localeCompare(
					`${b.table}::${b.policy}::${b.firstSeenFile}`
				)
			),
		};
		await fs.writeFile(BASELINE_PATH, JSON.stringify(updated, null, 2) + "\n");
		console.log("[check-supabase-migrations] baseline updated");
	}

	if (newDuplicates.length > 0) {
		const messages = newDuplicates.map((entry) => entry.message).join("\n");
		if (FAIL_ON_NEW_DUPLICATE) {
			errors.push(messages);
		} else {
			console.warn("[check-supabase-migrations] warnings:\n" + messages);
		}
	}

	if (errors.length > 0) {
		console.error("[check-supabase-migrations] errors:\n" + errors.join("\n"));
		process.exitCode = 1;
		return;
	}

	console.log("[check-supabase-migrations] ok");
};

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
	await main();
}
