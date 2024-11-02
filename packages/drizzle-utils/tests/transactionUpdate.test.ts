import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
	afterEach,
	vi,
	type MockInstance,
} from "vitest";
import { transactionUpdate } from "src/transactionUpdate";
import { pgTable, text, integer, uuid } from "drizzle-orm/pg-core";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { v7 } from "uuid";
import { eq } from "drizzle-orm";

describe("transactionUpdate", () => {
	let client: PGlite;

	describe("basic transaction updates", () => {
		const users = pgTable("users", {
			id: integer("id").primaryKey(),
			name: text("name"),
			email: text("email"),
		});

		let db: PgliteDatabase<{ users: typeof users }>;
		let transactionSpy: MockInstance;
		let updateSpy: MockInstance;

		beforeAll(async () => {
			client = new PGlite();
			db = drizzle<{ users: typeof users }>({
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
		});

		beforeEach(async () => {
			// Insert test data
			await db.insert(users).values([
				{ id: 1, name: "John", email: "john@example.com" },
				{ id: 2, name: "Jane", email: "jane@example.com" },
			]);

			// Setup spies
			transactionSpy = vi.spyOn(db, "transaction");
			const originalTransaction = db.transaction.bind(db);
			db.transaction = vi.fn(async (callback) => {
				const tx = await originalTransaction(async (tx) => {
					updateSpy = vi.spyOn(tx, "update");
					return callback(tx);
				});
				return tx;
			});
		});

		afterEach(async () => {
			await db.execute("DELETE FROM users");
			vi.clearAllMocks();
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS users");
			await client.close();
		});

		it("should update multiple records in a transaction", async () => {
			await transactionUpdate({
				db,
				table: users,
				tasks: [
					{
						id: 1,
						update: { name: "John Updated", email: "john.updated@example.com" },
					},
					{
						id: 2,
						update: { name: "Jane Updated", email: "jane.updated@example.com" },
					},
				],
			});

			// Verify transaction was used
			expect(transactionSpy).toHaveBeenCalledTimes(1);

			// Verify updates were made
			expect(updateSpy).toHaveBeenCalledTimes(2);

			const result = await db.query.users.findMany({
				orderBy: (users) => [users.id],
			});

			expect(result).toEqual([
				{ id: 1, name: "John Updated", email: "john.updated@example.com" },
				{ id: 2, name: "Jane Updated", email: "jane.updated@example.com" },
			]);
		});

		it("should handle empty updates array", async () => {
			await transactionUpdate({ db, table: users, tasks: [] });

			expect(transactionSpy).not.toHaveBeenCalled();
			expect(updateSpy).not.toHaveBeenCalled();
		});

		it("should rollback all changes if one update fails", async () => {
			const originalState = await db.query.users.findMany({
				orderBy: (users) => [users.id],
			});

			await expect(
				transactionUpdate({
					db,
					table: users,
					tasks: [
						{ id: 1, update: { name: "John Updated" } },
						{
							id: 2, // Non-existent ID

							// @ts-expect-error
							update: { foo: "bar" },
						},
					],
				}),
			).rejects.toThrow();

			const newState = await db.query.users.findMany({
				orderBy: (users) => [users.id],
			});

			expect(newState).toEqual(originalState);
		});
	});

	describe("transaction updates with different ID types", () => {
		const textIdTable = pgTable("text_id_table", {
			id: text("id").primaryKey(),
			value: text("value"),
		});

		const uuidIdTable = pgTable("uuid_id_table", {
			id: uuid("id").primaryKey(),
			value: text("value"),
		});

		let db: PgliteDatabase<{
			text_id_table: typeof textIdTable;
			uuid_id_table: typeof uuidIdTable;
		}>;

		const uuidId1 = v7();
		const uuidId2 = v7();

		beforeAll(async () => {
			client = new PGlite();
			db = drizzle<{
				text_id_table: typeof textIdTable;
				uuid_id_table: typeof uuidIdTable;
			}>({
				client,
				schema: { text_id_table: textIdTable, uuid_id_table: uuidIdTable },
			});

			await db.execute(`
				CREATE TABLE IF NOT EXISTS text_id_table (
					id text PRIMARY KEY,
					value text
				)
			`);

			await db.execute(`
				CREATE TABLE IF NOT EXISTS uuid_id_table (
					id uuid PRIMARY KEY,
					value text
				)
			`);
		});

		beforeEach(async () => {
			// Insert test data
			await db.insert(textIdTable).values([
				{ id: "id1", value: "value1" },
				{ id: "id2", value: "value2" },
			]);

			await db.insert(uuidIdTable).values([
				{ id: uuidId1, value: "value1" },
				{ id: uuidId2, value: "value2" },
			]);
		});

		afterEach(async () => {
			await db.execute("DELETE FROM text_id_table");
			await db.execute("DELETE FROM uuid_id_table");
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS text_id_table");
			await db.execute("DROP TABLE IF EXISTS uuid_id_table");
			await client.close();
		});

		it("should handle text IDs", async () => {
			await transactionUpdate({
				db,
				table: textIdTable,
				tasks: [
					{ id: "id1", update: { value: "updated1" } },
					{ id: "id2", update: { value: "updated2" } },
				],
			});

			const result = await db.query.text_id_table.findMany({
				orderBy: (table) => [table.id],
			});

			expect(result).toEqual([
				{ id: "id1", value: "updated1" },
				{ id: "id2", value: "updated2" },
			]);
		});

		it("should handle UUID IDs", async () => {
			await transactionUpdate({
				db,
				table: uuidIdTable,
				tasks: [
					{ id: uuidId1, update: { value: "updated1" } },
					{ id: uuidId2, update: { value: "updated2" } },
				],
			});

			const result = await db.query.uuid_id_table.findMany({
				orderBy: (table) => [table.id],
			});

			expect(result).toEqual([
				{ id: uuidId1, value: "updated1" },
				{ id: uuidId2, value: "updated2" },
			]);
		});
	});

	describe("transaction updates performance", () => {
		const largeTable = pgTable("large_table", {
			id: integer("id").primaryKey(),
			value: text("value"),
		});

		let db: PgliteDatabase<{ large_table: typeof largeTable }>;

		beforeAll(async () => {
			client = new PGlite();
			db = drizzle<{ large_table: typeof largeTable }>({
				client,
				schema: { large_table: largeTable },
			});

			await db.execute(`
				CREATE TABLE IF NOT EXISTS large_table (
					id integer PRIMARY KEY,
					value text
				)
			`);
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS large_table");
			await client.close();
		});

		it("should handle 100 updates in a transaction", async () => {
			// Insert 100 records
			const initialData = Array.from({ length: 100 }, (_, i) => ({
				id: i + 1,
				value: `value${i + 1}`,
			}));

			await db.insert(largeTable).values(initialData);

			// Perform updates
			await transactionUpdate({
				db,
				table: largeTable,
				tasks: initialData.map((row) => ({
					id: row.id,
					update: { value: `updated${row.id}` },
				})),
			});

			// Verify first and last records
			const result = await db.query.large_table.findMany({
				where: (table, { or }) => or(eq(table.id, 1), eq(table.id, 100)),
				orderBy: (table) => [table.id],
			});

			expect(result).toEqual([
				{ id: 1, value: "updated1" },
				{ id: 100, value: "updated100" },
			]);
		});
	});
});
