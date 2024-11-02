import { type GetColumnData, eq } from "drizzle-orm";
import type {
	AnyPgTable,
	PgColumn,
	PgDatabase,
	PgUpdateSetSource,
	TableConfig,
} from "drizzle-orm/pg-core";

export const transactionUpdate = async <
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	TDatabase extends PgDatabase<any, any, any>,
	TColumn extends PgColumn,
	T extends AnyPgTable<TableConfig> & { id: TColumn },
>({
	db,
	table,
	tasks,
	parallel = false,
}: {
	db: TDatabase;
	table: T;
	tasks: {
		id: GetColumnData<T["id"], "raw">;
		update: PgUpdateSetSource<T>;
	}[];
	parallel?: boolean;
}) => {
	if (tasks.length === 0) return;
	await db.transaction(async (tx) => {
		if (parallel) {
			await Promise.all(
				tasks.map((task) =>
					tx.update(table).set(task.update).where(eq(table.id, task.id)),
				),
			);
		} else {
			for (const task of tasks) {
				await tx.update(table).set(task.update).where(eq(table.id, task.id));
			}
		}
	});
};
