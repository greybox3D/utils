import { PGlite } from "@electric-sql/pglite";
import { Suite } from "benchmark";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { type PgliteDatabase, drizzle } from "drizzle-orm/pglite";
import { batchUpdate } from "../src/batchUpdate";
import { transactionUpdate } from "../src/transactionUpdate";

const users = pgTable("users", {
	id: integer("id").primaryKey(),
	name: text("name"),
	email: text("email"),
});

type TestCase = {
	name: string;
	size: number;
	updateFields: 1 | 2 | "mixed";
};

const testCases: TestCase[] = [
	{ name: "small-single", size: 10, updateFields: 1 },
	{ name: "small-double", size: 10, updateFields: 2 },
	{ name: "small-mixed", size: 10, updateFields: "mixed" },
	{ name: "medium-single", size: 100, updateFields: 1 },
	{ name: "medium-double", size: 100, updateFields: 2 },
	{ name: "medium-mixed", size: 100, updateFields: "mixed" },
	{ name: "large-single", size: 1000, updateFields: 1 },
	{ name: "large-double", size: 1000, updateFields: 2 },
	{ name: "large-mixed", size: 1000, updateFields: "mixed" },
];

async function setupDatabase() {
	const client = new PGlite();
	const db = drizzle<{ users: typeof users }>({
		client,
		schema: { users },
	});

	await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id integer PRIMARY KEY,
      name text,
      email text
    )
  `);

	return { client, db };
}

function generateTestData(
	size: number,
	updateFields: TestCase["updateFields"],
) {
	return Array.from({ length: size }, (_, i) => {
		const id = i + 1;
		if (updateFields === 1) {
			return {
				id,
				update: { name: `name${id}` },
			};
		}
		if (updateFields === 2) {
			return {
				id,
				update: { name: `name${id}`, email: `email${id}@test.com` },
			};
		}
		// Mixed updates
		return {
			id,
			update:
				i % 3 === 0
					? { name: `name${id}` }
					: i % 3 === 1
						? { email: `email${id}@test.com` }
						: { name: `name${id}`, email: `email${id}@test.com` },
		};
	});
}

export async function runBenchmark() {
	const { client, db } = await setupDatabase();

	const suite = new Suite("batchUpdate vs transactionUpdate");

	for (const testCase of testCases) {
		const { name, size, updateFields } = testCase;

		// Setup data for each test
		const setupData = Array.from({ length: size }, (_, i) => ({
			id: i + 1,
			name: `original${i}`,
			email: `original${i}@test.com`,
		}));

		const updates = generateTestData(size, updateFields);

		suite.add(`batchUpdate-${name}`, {
			defer: true,
			fn: async (deferred: { resolve: () => void }) => {
				await db.delete(users);
				await db.insert(users).values(setupData);
				await batchUpdate(db, users, updates);
				deferred.resolve();
			},
		});

		suite.add(`transactionUpdate-sequential-${name}`, {
			defer: true,
			fn: async (deferred: { resolve: () => void }) => {
				await db.delete(users);
				await db.insert(users).values(setupData);
				await transactionUpdate({
					db,
					table: users,
					tasks: updates,
					parallel: false,
				});
				deferred.resolve();
			},
		});

		suite.add(`transactionUpdate-parallel-${name}`, {
			defer: true,
			fn: async (deferred: { resolve: () => void }) => {
				await db.delete(users);
				await db.insert(users).values(setupData);
				await transactionUpdate({
					db,
					table: users,
					tasks: updates,
					parallel: true,
				});
				deferred.resolve();
			},
		});
	}

	return new Promise<void>((resolve) => {
		suite
			.on("cycle", (event: { target: unknown }) => {
				console.log(String(event.target));
			})
			.on("complete", function (this: Suite) {
				console.log(`Fastest is ${this.filter("fastest").map("name")}`);
				client.close().then(resolve);
			})
			.run({ async: true });
	});
}
