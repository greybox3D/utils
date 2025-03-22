import { type GetColumnData, type SQL, sql } from "drizzle-orm";
import {
	type AnyPgTable,
	type PgColumn,
	PgDialect,
	type PgUpdateSetSource,
	type TableConfig,
} from "drizzle-orm/pg-core";
import type { PgDatabase } from "drizzle-orm/pg-core";

const pgDialect = new PgDialect();

// Helper to group updates by their keys
const groupUpdatesByKeys = <T extends { update: Record<string, unknown> }>(
	tasks: T[],
): Map<string, T[]> => {
	const groups = new Map<string, T[]>();

	for (const task of tasks) {
		const sortedKeys = Object.keys(task.update).sort();
		if (sortedKeys.length === 0) {
			// ignore empty updates, might be a bug?
			continue;
		}

		const keys = sortedKeys.join(",");
		const group = groups.get(keys) || [];
		group.push(task);
		groups.set(keys, group);
	}

	return groups;
};

const validateIdType = (sqlType: string, id: unknown) => {
	if (sqlType === "integer" && typeof id !== "number") {
		throw new Error(`Expected integer id but got ${typeof id}`);
	}

	if (sqlType === "text" && typeof id !== "string") {
		throw new Error(`Expected text id but got ${typeof id}`);
	}

	if (
		sqlType === "uuid" &&
		(typeof id !== "string" ||
			!id.match(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
			))
	) {
		throw new Error(`Expected UUID id but got ${id}`);
	}
};

export const batchUpdate = async <
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	TDatabase extends PgDatabase<any, any, any>,
	TColumn extends PgColumn,
	T extends AnyPgTable<TableConfig> & { id: TColumn },
>(
	db: TDatabase,
	table: T,
	tasks: {
		id: GetColumnData<T["id"], "raw">;
		update: PgUpdateSetSource<T>;
	}[],
	debug = false,
) => {
	if (tasks.length === 0) return;

	// Validate all IDs before proceeding
	const idSqlType = table.id.getSQLType();
	tasks.forEach((task, index) => {
		try {
			validateIdType(idSqlType, task.id);
		} catch (e) {
			throw new Error(
				`Invalid ID type at index ${index}: ${(e as Error).message}`,
			);
		}
	});

	// Group tasks by their update keys
	const groups = groupUpdatesByKeys(tasks);

	// If only one group, use the original logic
	if (groups.size === 1) {
		const sql = generateBatchUpdate(table, tasks);
		if (sql) {
			await db.execute(sql).catch((e) => {
				if (debug) {
					console.error(
						`Error executing batch update: ${e}, sql: ${
							pgDialect.sqlToQuery(sql).sql
						}`,
					);
				}
				throw e;
			});
		}
		return;
	}

	// Multiple groups - use transaction
	await db.transaction(async (tx) => {
		for (const groupTasks of groups.values()) {
			const sql = generateBatchUpdate(table, groupTasks);
			if (sql) {
				await tx.execute(sql).catch((e) => {
					if (debug) {
						console.error(
							`Error executing batch update: ${e}, sql: ${
								pgDialect.sqlToQuery(sql).sql
							}`,
						);
					}
					throw e;
				});
			}
		}
	});
};

const safe = <T extends unknown | undefined>(value: T) => {
	return value as Exclude<T, undefined>;
};

// Original batch update logic moved to a separate function
const generateBatchUpdate = <
	TColumn extends PgColumn,
	T extends AnyPgTable<TableConfig> & { id: TColumn },
>(
	table: T,
	tasks: {
		id: GetColumnData<T["id"], "raw">;
		update: PgUpdateSetSource<T>;
	}[],
) => {
	if (tasks.length === 0) return;
	const firstTask = safe(tasks[0]);
	const updateKeys = Object.keys(
		firstTask.update,
	).sort() as (keyof PgUpdateSetSource<T>)[];

	const sqlChunks: SQL[] = [];

	sqlChunks.push(sql`UPDATE ${table} as t`);
	sqlChunks.push(sql`SET`);
	sqlChunks.push(
		sql.join(
			updateKeys.map((key) => {
				const column = table[key] as PgColumn;
				return sql`${sql.identifier(column.name)} = c.${sql.identifier(column.name)}`;
			}),
			sql`, `,
		),
	);

	sqlChunks.push(sql`FROM`);
	sqlChunks.push(sql`(`);
	sqlChunks.push(sql`VALUES`);
	const idSqlType = table.id.getSQLType();
	sqlChunks.push(
		sql.join(
			tasks.map((task, index) => {
				// Validate keys match first task
				const currentKeys = Object.keys(task.update).sort();
				if (
					updateKeys.length !== currentKeys.length ||
					!updateKeys.every((key, i) => key === currentKeys[i])
				) {
					throw new Error(
						`All tasks must have the same update keys. Task ${index} with id ${task.id} has different keys than the first task.`,
					);
				}

				const idSql = sql`${task.id}`;
				idSql.append(sql`::${sql.raw(idSqlType)}`);

				return sql`(${sql.join(
					[
						idSql,
						...updateKeys.map((key) => {
							const value = task.update[key];
							const column = table[key] as PgColumn;

							const sqlType = column.getSQLType();
							if (sqlType.startsWith("vector")) {
								return sql`ARRAY[${sql.join(
									(value as number[]).map((item) => sql.raw(`${item}`)),
									sql`, `,
								)}]::${sql.raw(sqlType)}`;
							}

							if (sqlType === "timestamp") {
								return sql`${(value as Date).toISOString()}::${sql.raw(sqlType)}`;
							}

							if (sqlType === "jsonb") {
								return sql`${JSON.stringify(value)}::${sql.raw(sqlType)}`;
							}

							return sql`${value}::${sql.raw(sqlType)}`;
						}),
					],
					sql`, `,
				)})`;
			}),
			sql`, `,
		),
	);
	sqlChunks.push(sql`)`);
	sqlChunks.push(
		sql`AS c(${sql.identifier(table.id.name)}, ${sql.join(
			updateKeys.map((key) => {
				const column = table[key] as PgColumn;

				return sql.identifier(column.name);
			}),
			sql`, `,
		)})`,
	);
	sqlChunks.push(sql`WHERE`);
	sqlChunks.push(
		sql`c.${sql.identifier(table.id.name)} = t.${sql.identifier(table.id.name)}`,
	);

	return sql.join(sqlChunks, sql` `);
};
