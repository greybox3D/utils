import { PGlite } from "@electric-sql/pglite";
import { vector as vectorExtension } from "@electric-sql/pglite/vector";
import { type SQL, sql } from "drizzle-orm";
import {
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	vector,
} from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core";
import { type PgliteDatabase, drizzle } from "drizzle-orm/pglite";
import { v7 } from "uuid";
import {
	assert,
	type MockInstance,
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { batchUpdate } from "../src/batchUpdate";

const pgDialect = new PgDialect();

describe("batchUpdate", () => {
	let client: PGlite;

	describe("batchUpdate with integer id and varied fields", () => {
		// Create a test table for our examples
		const users = pgTable("users", {
			id: integer("id").primaryKey(),
			name: text("name"),
			email: text("email"),
		});

		const products = pgTable("products", {
			id: text("id").primaryKey(), // Using text as id
			name: text("name"),
			price: integer("price"),
			description: text("description"),
		});

		const orders = pgTable("orders", {
			id: uuid("id").primaryKey(),
			total: integer("total"),
			status: text("status"),
		});

		let db: PgliteDatabase<{
			users: typeof users;
			products: typeof products;
			orders: typeof orders;
		}>;
		let updates: SQL | undefined;
		let updatesSpy: MockInstance;
		let transactionSpy: MockInstance;
		let transactionUpdateSpy: MockInstance;

		beforeAll(async () => {
			// Setup in-memory PGlite database
			client = new PGlite();
			db = drizzle<{
				users: typeof users;
				products: typeof products;
				orders: typeof orders;
			}>({
				client,
				schema: { users, products, orders },
			});

			// Create the test table
			await db.execute(sql`
			CREATE TABLE IF NOT EXISTS ${users} (
				${sql.identifier(users.id.name)} ${sql.raw(users.id.getSQLType())},
				${sql.identifier(users.name.name)} ${sql.raw(users.name.getSQLType())},
				${sql.identifier(users.email.name)} ${sql.raw(users.email.getSQLType())}
			)
		`);
		});

		beforeEach(async () => {
			// Insert some test data
			await db.insert(users).values([
				{ id: 1, name: "Old John", email: "old.john@example.com" },
				{ id: 2, name: "Old Jane", email: "old.jane@example.com" },
			]);

			// Spy on the transaction creation
			transactionSpy = vi.spyOn(db, "transaction");

			// Spy on the transaction's execute by wrapping the transaction method
			const originalTransaction = db.transaction.bind(db);
			db.transaction = vi.fn(async (callback) => {
				const tx = await originalTransaction(async (tx) => {
					// Spy on the transaction's execute method
					transactionUpdateSpy = vi.spyOn(tx, "execute");
					return callback(tx);
				});
				return tx;
			});

			updatesSpy = vi.spyOn(db, "execute");
		});

		afterEach(async () => {
			await db.execute("DELETE FROM users");
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS users");
			await client.close();
		});

		it("should generate correct SQL for single field update", async () => {
			await batchUpdate(db, users, [
				{
					id: 1,
					update: { name: "John" },
				},
				{
					id: 2,
					update: { name: "Jane" },
				},
			]);
			updates = updatesSpy.mock.calls[0][0];
			assert(updates);
			expect(
				pgDialect
					.sqlToQuery(updates)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toBe(
				`UPDATE "users" as t SET "name" = c."name" FROM ( VALUES ($1::integer, $2::text), ($3::integer, $4::text) ) AS c("id", "name") WHERE c."id" = t."id"`,
			);

			const queryResult = await db.query.users.findMany({
				orderBy: (users) => [users.id],
				columns: {
					id: true,
					name: true,
				},
			});

			expect(queryResult).toEqual([
				{ id: 1, name: "John" },
				{ id: 2, name: "Jane" },
			]);
		});

		it("should generate correct SQL for multiple field updates", async () => {
			await batchUpdate(db, users, [
				{
					id: 1,
					update: {
						name: "John Updated",
						email: "john@example.com",
					},
				},
				{
					id: 2,
					update: {
						name: "Jane Updated",
						email: "jane@example.com",
					},
				},
			]);

			updates = updatesSpy.mock.calls[0][0];

			assert(updates);

			// Test SQL generation
			expect(
				pgDialect
					.sqlToQuery(updates)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toBe(
				`UPDATE "users" as t SET "email" = c."email", "name" = c."name" FROM ( VALUES ($1::integer, $2::text, $3::text), ($4::integer, $5::text, $6::text) ) AS c("id", "email", "name") WHERE c."id" = t."id"`,
			);

			const queryResult = await db.query.users.findMany({
				orderBy: (users) => [users.id],
				columns: {
					id: true,
					name: true,
					email: true,
				},
			});

			expect(queryResult).toEqual([
				{ id: 1, name: "John Updated", email: "john@example.com" },
				{ id: 2, name: "Jane Updated", email: "jane@example.com" },
			]);
		});

		it("should return undefined for empty tasks array", async () => {
			// TODO use a spy to check that the transaction/execute method is not called
			await batchUpdate(db, users, []);

			expect(updatesSpy.mock.calls.length).toBe(0);
		});

		it("should handle heterogeneous updates", async () => {
			await db.insert(users).values([
				{ id: 3, name: "Old Bob", email: "old.bob@example.com" },
				{ id: 4, name: "Old Alice", email: "old.alice@example.com" },
			]);

			await batchUpdate(db, users, [
				{ id: 1, update: { name: "John" } },
				{ id: 2, update: { name: "Jane", email: "jane@example.com" } },
				{ id: 3, update: { email: "bob@example.com" } },
				{ id: 4, update: { name: "Alice", email: "alice@example.com" } },
			]);

			// Check that transaction was called once
			expect(transactionSpy).toHaveBeenCalledTimes(1);

			// Check that execute was called 3 times within the transaction
			// (one for each unique update shape)
			expect(transactionUpdateSpy).toHaveBeenCalledTimes(3);

			// Get the SQL from the first update call
			const firstUpdate = transactionUpdateSpy.mock.calls[0][0];
			expect(
				pgDialect
					.sqlToQuery(firstUpdate)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toBe(
				`UPDATE "users" as t SET "name" = c."name" FROM ( VALUES ($1::integer, $2::text) ) AS c("id", "name") WHERE c."id" = t."id"`,
			);

			// Get the SQL from the second update call
			const secondUpdate = transactionUpdateSpy.mock.calls[1][0];
			expect(
				pgDialect
					.sqlToQuery(secondUpdate)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toBe(
				`UPDATE "users" as t SET "email" = c."email", "name" = c."name" FROM ( VALUES ($1::integer, $2::text, $3::text), ($4::integer, $5::text, $6::text) ) AS c("id", "email", "name") WHERE c."id" = t."id"`,
			);

			// Get the SQL from the third update call
			const thirdUpdate = transactionUpdateSpy.mock.calls[2][0];
			expect(
				pgDialect
					.sqlToQuery(thirdUpdate)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toBe(
				`UPDATE "users" as t SET "email" = c."email" FROM ( VALUES ($1::integer, $2::text) ) AS c("id", "email") WHERE c."id" = t."id"`,
			);

			const queryResult = await db.query.users.findMany({
				orderBy: (users) => [users.id],
				columns: {
					id: true,
					name: true,
					email: true,
				},
			});

			expect(queryResult).toEqual([
				{ id: 1, name: "John", email: "old.john@example.com" },
				{ id: 2, name: "Jane", email: "jane@example.com" },
				{ id: 3, name: "Old Bob", email: "bob@example.com" },
				{ id: 4, name: "Alice", email: "alice@example.com" },
			]);
		});

		it("should handle null values", async () => {
			await batchUpdate(db, users, [
				{ id: 1, update: { name: null, email: null } },
				{ id: 2, update: { name: null, email: null } },
			]);

			const result = await db.query.users.findMany({
				orderBy: (users) => [users.id],
				columns: { id: true, name: true, email: true },
			});

			expect(result).toEqual([
				{ id: 1, name: null, email: null },
				{ id: 2, name: null, email: null },
			]);
		});

		it("should handle special characters in text fields", async () => {
			await batchUpdate(db, users, [
				{ id: 1, update: { name: "O'Connor", email: 'test"quote"@test.com' } },
				{
					id: 2,
					update: { name: 'Robert "Bob"', email: "semi;colon@test.com" },
				},
			]);

			const result = await db.query.users.findMany({
				orderBy: (users) => [users.id],
				columns: { id: true, name: true, email: true },
			});

			expect(result).toEqual([
				{ id: 1, name: "O'Connor", email: 'test"quote"@test.com' },
				{ id: 2, name: 'Robert "Bob"', email: "semi;colon@test.com" },
			]);
		});

		it("should handle many different update shapes", async () => {
			await db.delete(users);

			// Insert 100 test records
			await db.insert(users).values(
				Array.from({ length: 100 }, (_, i) => ({
					id: i + 1,
					name: `Original Name ${i}`,
					email: `original${i}@test.com`,
				})),
			);

			const updates = Array.from({ length: 100 }, (_, i) => ({
				id: i + 1,
				update: {
					...(i % 2 === 0 ? { name: `Updated Name ${i}` } : {}),
					...(i % 3 === 0 ? { email: `updated${i}@test.com` } : {}),
				},
			}));

			await batchUpdate(db, users, updates);

			// Verify transaction was used
			expect(transactionSpy).toHaveBeenCalledTimes(1);

			// Should have 3 different update shapes:
			// 1. name only
			// 2. email only
			// 3. both name and email
			expect(transactionUpdateSpy).toHaveBeenCalledTimes(3);

			// Verify results
			const result = await db.query.users.findMany({
				orderBy: (users) => [users.id],
				columns: { id: true, name: true, email: true },
			});

			result.forEach((row, i) => {
				expect(row).toEqual({
					id: i + 1,
					name: i % 2 === 0 ? `Updated Name ${i}` : `Original Name ${i}`,
					email: i % 3 === 0 ? `updated${i}@test.com` : `original${i}@test.com`,
				});
			});
		});

		it("should handle concurrent batch updates", async () => {
			const iterations = 10;
			const promises = Array.from({ length: iterations }, (_, i) =>
				batchUpdate(db, users, [
					{
						id: 1,
						update: {
							name: `Name Update ${i}`,
							email: `email${i}@test.com`,
						},
					},
					{
						id: 2,
						update: {
							name: `Other Name ${i}`,
							email: `other${i}@test.com`,
						},
					},
				]),
			);

			await Promise.all(promises);

			const result = await db.query.users.findMany({
				orderBy: (users) => [users.id],
				columns: { id: true, name: true, email: true },
			});

			// We can't know which update will be last, but we know:
			// 1. Both records should exist
			// 2. Names should match pattern "Name Update N" or "Other Name N"
			// 3. Emails should match pattern "emailN@test.com" or "otherN@test.com"
			expect(result).toHaveLength(2);
			expect(result[0].name).toMatch(/^Name Update \d+$/);
			expect(result[0].email).toMatch(/^email\d+@test\.com$/);
			expect(result[1].name).toMatch(/^Other Name \d+$/);
			expect(result[1].email).toMatch(/^other\d+@test\.com$/);
		});

		it("should validate ID types", async () => {
			// Test integer ID validation
			await expect(
				batchUpdate(db, users, [
					{ id: 1, update: { name: "John" } },
					// @ts-expect-error - Testing runtime behavior with wrong type
					{ id: "2", update: { name: "Jane" } },
				]),
			).rejects.toThrow(
				"Invalid ID type at index 1: Expected integer id but got string",
			);

			// Test text ID validation (using products table)
			await expect(
				batchUpdate(db, products, [
					{ id: "p1", update: { name: "Product" } },
					// @ts-expect-error - Testing runtime behavior with wrong type
					{ id: 123, update: { name: "Invalid" } },
				]),
			).rejects.toThrow(
				"Invalid ID type at index 1: Expected text id but got number",
			);

			// Test UUID ID validation (using orders table)
			await expect(
				batchUpdate(db, orders, [
					{ id: v7(), update: { status: "pending" } },
					{ id: "not-a-uuid", update: { status: "invalid" } },
				]),
			).rejects.toThrow(
				"Invalid ID type at index 1: Expected UUID id but got not-a-uuid",
			);
		});

		it("should rollback all changes if one update fails", async () => {
			// First get current state
			const originalState = await db.query.users.findMany({
				orderBy: (users) => [users.id],
				columns: { id: true, name: true, email: true },
			});

			// Attempt updates with one invalid operation
			await expect(
				batchUpdate(db, users, [
					{ id: 1, update: { name: "Valid Name" } },
					{
						id: 2,
						update: {
							// @ts-expect-error - Intentionally wrong type to cause runtime error
							name: { invalid: "object" },
						},
					},
					{ id: 3, update: { name: "Should Not Update" } },
				]),
			).rejects.toThrow();

			// Verify state hasn't changed
			const newState = await db.query.users.findMany({
				orderBy: (users) => [users.id],
				columns: { id: true, name: true, email: true },
			});

			expect(newState).toEqual(originalState);
		});
	});

	describe("batchUpdate with text id and varied fields", () => {
		// Create a test table with different id types and varied field types
		const products = pgTable("products", {
			id: text("id").primaryKey(), // Using text as id
			name: text("name"),
			price: integer("price"),
			description: text("description"),
		});

		let db: PgliteDatabase<{ products: typeof products }>;
		let updates: SQL | undefined;
		let spy: MockInstance;

		beforeAll(async () => {
			// Setup in-memory PGlite database
			client = new PGlite();
			db = drizzle<{ products: typeof products }>({
				client,
				schema: { products },
			});

			// Create the test table
			await db.execute(sql`
			CREATE TABLE IF NOT EXISTS ${products} (
				${sql.identifier(products.id.name)} ${sql.raw(products.id.getSQLType())},
				${sql.identifier(products.name.name)} ${sql.raw(products.name.getSQLType())},
				${sql.identifier(products.price.name)} ${sql.raw(products.price.getSQLType())},
				${sql.identifier(products.description.name)} ${sql.raw(products.description.getSQLType())}
			)
		`);

			// Insert some test data
			await db.insert(products).values([
				{
					id: "p1",
					name: "Product 1",
					price: 100,
					description: "Description 1",
				},
				{
					id: "p2",
					name: "Product 2",
					price: 200,
					description: "Description 2",
				},
			]);

			spy = vi.spyOn(db, "execute");
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS products");
			await client.close();
		});

		it("should generate correct SQL for text id and varied fields update", async () => {
			// TODO: get the updaates from a db spy
			await batchUpdate(db, products, [
				{
					id: "p1",
					update: { name: "Updated Product 1", price: 150 },
				},
				{
					id: "p2",
					update: { name: "Updated Product 2", price: 250 },
				},
			]);

			updates = spy.mock.calls[0][0];

			assert(updates);

			expect(
				pgDialect
					.sqlToQuery(updates)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toBe(
				`UPDATE "products" as t SET "name" = c."name", "price" = c."price" FROM ( VALUES ($1::text, $2::text, $3::integer), ($4::text, $5::text, $6::integer) ) AS c("id", "name", "price") WHERE c."id" = t."id"`,
			);

			// Test actual database update
			await db.execute(updates);

			const queryResult = await db.query.products.findMany({
				orderBy: (products) => [products.id],
				columns: {
					id: true,
					name: true,
					price: true,
				},
			});

			expect(queryResult).toEqual([
				{ id: "p1", name: "Updated Product 1", price: 150 },
				{ id: "p2", name: "Updated Product 2", price: 250 },
			]);
		});
	});

	describe("batchUpdate with UUID id and varied fields", () => {
		const orders = pgTable("orders", {
			id: uuid("id").primaryKey(), // Using text as id
			total: integer("total"),
			status: text("status"),
		});

		const firstId: string = v7();
		const secondId: string = v7();

		let db: PgliteDatabase<{ orders: typeof orders }>;
		let updates: SQL | undefined;
		let spy: MockInstance;

		beforeAll(async () => {
			// Setup in-memory PGlite database
			client = new PGlite();
			db = drizzle<{ orders: typeof orders }>({ client, schema: { orders } });

			// Create the test table
			await db.execute(sql`
			CREATE TABLE IF NOT EXISTS ${orders} (
				${sql.identifier(orders.id.name)} ${sql.raw(orders.id.getSQLType())},
				${sql.identifier(orders.total.name)} ${sql.raw(orders.total.getSQLType())},
				${sql.identifier(orders.status.name)} ${sql.raw(orders.status.getSQLType())}
			)
		`);

			// Insert some test data
			await db.insert(orders).values([
				{ id: firstId, total: 300, status: "pending" },
				{ id: secondId, total: 400, status: "shipped" },
			]);

			spy = vi.spyOn(db, "execute");
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS orders");
			await client.close();
		});

		it("should generate correct SQL for UUID id and varied fields update", async () => {
			await batchUpdate(db, orders, [
				{
					id: firstId,
					update: { total: 350, status: "completed" },
				},
				{
					id: secondId,
					update: { total: 450, status: "delivered" },
				},
			]);

			updates = spy.mock.calls[0][0];

			assert(updates);

			expect(
				pgDialect
					.sqlToQuery(updates)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toBe(
				`UPDATE "orders" as t SET "status" = c."status", "total" = c."total" FROM ( VALUES ($1::uuid, $2::text, $3::integer), ($4::uuid, $5::text, $6::integer) ) AS c("id", "status", "total") WHERE c."id" = t."id"`,
			);

			// Test actual database update
			await db.execute(updates);

			const queryResult = await db.query.orders.findMany({
				orderBy: (orders) => [orders.id],
				columns: {
					id: true,
					total: true,
					status: true,
				},
			});

			expect(queryResult).toEqual([
				{ id: firstId, total: 350, status: "completed" },
				{ id: secondId, total: 450, status: "delivered" },
			]);
		});
	});

	describe("batchUpdate stress tests", () => {
		const largeTable = pgTable("large_table", {
			id: integer("id").primaryKey(),
			value: text("value"),
		});

		let db: PgliteDatabase<{ large_table: typeof largeTable }>;
		let updates: SQL | undefined;
		let spy: MockInstance;

		beforeAll(async () => {
			// Setup in-memory PGlite database
			client = new PGlite();
			db = drizzle<{ large_table: typeof largeTable }>({
				client,
				schema: { large_table: largeTable },
			});

			// Create the test table
			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS ${largeTable} (
					${sql.identifier(largeTable.id.name)} ${sql.raw(largeTable.id.getSQLType())},
					${sql.identifier(largeTable.value.name)} ${sql.raw(largeTable.value.getSQLType())}
				)
			`);

			spy = vi.spyOn(db, "execute");
		});

		afterEach(async () => {
			await db.execute("DELETE FROM large_table");
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS large_table");
			await client.close();
		});

		it("should handle 1,000 rows update", async () => {
			// Insert 1,000 rows
			const initialData = Array.from({ length: 1000 }, (_, i) => ({
				id: i + 1,
				value: `Value ${i + 1}`,
			}));
			await db.insert(largeTable).values(initialData);

			// Prepare updates
			await batchUpdate(
				db,
				largeTable,
				initialData.map((row) => ({
					id: row.id,
					update: { value: `Updated ${row.value}` },
				})),
			);

			updates = spy.mock.calls[0][0];

			assert(updates);

			// Execute updates
			await db.execute(updates);

			// Verify updates
			const queryResult = await db.query.large_table.findMany({
				orderBy: (largeTable) => [largeTable.id],
				columns: {
					id: true,
					value: true,
				},
			});

			expect(queryResult).toEqual(
				initialData.map((row) => ({
					id: row.id,
					value: `Updated ${row.value}`,
				})),
			);
		});

		it("should handle 10,000 rows update", async () => {
			// Insert 10,000 rows
			const initialData = Array.from({ length: 10000 }, (_, i) => ({
				id: i + 1,
				value: `Value ${i + 1}`,
			}));

			await db.insert(largeTable).values(initialData);

			// Prepare updates
			batchUpdate(
				db,
				largeTable,
				initialData
					.filter((row) => row.id % 2 === 0)
					.map((row) => ({
						id: row.id,
						update: { value: `Updated ${row.value}` },
					})),
			);

			updates = spy.mock.calls[0][0];

			assert(updates);

			// Verify updates
			const queryResult = await db.query.large_table.findMany({
				orderBy: (largeTable) => [largeTable.id],
				columns: {
					id: true,
					value: true,
				},
			});

			expect(queryResult).toEqual(
				initialData.map((row) => ({
					id: row.id,
					value: row.id % 2 === 0 ? `Updated ${row.value}` : row.value,
				})),
			);
		});
	});

	describe("batchUpdate with vector types", () => {
		const embeddings = pgTable("embeddings", {
			id: integer("id").primaryKey(),
			embedding: vector("embedding", { dimensions: 3 }), // Assuming 3-dimensional vectors
		});

		let db: PgliteDatabase<{ embeddings: typeof embeddings }>;
		let updates: SQL | undefined;
		let spy: MockInstance;

		beforeAll(async () => {
			client = new PGlite({
				extensions: { vector: vectorExtension },
			});
			db = drizzle<{ embeddings: typeof embeddings }>({
				client,
				schema: { embeddings },
			});

			await db.execute(sql`
				CREATE EXTENSION IF NOT EXISTS vector;
			`);

			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS ${embeddings} (
					${sql.identifier(embeddings.id.name)} ${sql.raw(embeddings.id.getSQLType())},
					${sql.identifier(embeddings.embedding.name)} ${sql.raw(embeddings.embedding.getSQLType())}
				)
			`);

			await db.insert(embeddings).values([
				{ id: 1, embedding: [0.1, 0.2, 0.3] },
				{ id: 2, embedding: [0.4, 0.5, 0.6] },
			]);

			spy = vi.spyOn(db, "execute");
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS embeddings");
			await client.close();
		});

		it("should generate correct SQL for vector type update", async () => {
			batchUpdate(db, embeddings, [
				{
					id: 1,
					update: { embedding: [0.7, 0.8, 0.9] },
				},
				{
					id: 2,
					update: { embedding: [1.0, 1.1, 1.2] },
				},
			]);

			updates = spy.mock.calls[0][0];

			assert(updates);

			await db.execute(updates);

			const queryResult = await db.query.embeddings.findMany({
				orderBy: (embeddings) => [embeddings.id],
				columns: {
					id: true,
					embedding: true,
				},
			});

			expect(queryResult).toEqual([
				{ id: 1, embedding: [0.7, 0.8, 0.9] },
				{ id: 2, embedding: [1.0, 1.1, 1.2] },
			]);

			expect(
				pgDialect
					.sqlToQuery(updates)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toBe(
				`UPDATE "embeddings" as t SET "embedding" = c."embedding" FROM ( VALUES ($1::integer, ARRAY[0.7, 0.8, 0.9]::vector(3)), ($2::integer, ARRAY[1, 1.1, 1.2]::vector(3)) ) AS c("id", "embedding") WHERE c."id" = t."id"`,
			);
		});
	});

	describe("batchUpdate with large vector types", () => {
		const largeEmbeddings = pgTable("large_embeddings", {
			id: integer("id").primaryKey(),
			embedding: vector("embedding", { dimensions: 2000 }), // 2k-dimensional vectors
		});

		let db: PgliteDatabase<{ large_embeddings: typeof largeEmbeddings }>;
		let updates: SQL | undefined;
		let spy: MockInstance;

		beforeAll(async () => {
			client = new PGlite({
				extensions: { vector: vectorExtension },
			});
			db = drizzle<{ large_embeddings: typeof largeEmbeddings }>({
				client,
				schema: { large_embeddings: largeEmbeddings },
			});

			await db.execute(sql`
				CREATE EXTENSION IF NOT EXISTS vector;
			`);

			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS ${largeEmbeddings} (
					${sql.identifier(largeEmbeddings.id.name)} ${sql.raw(largeEmbeddings.id.getSQLType())},
					${sql.identifier(largeEmbeddings.embedding.name)} ${sql.raw(largeEmbeddings.embedding.getSQLType())}
				)
			`);

			// Insert some test data with 2k-dimensional vectors
			await db.insert(largeEmbeddings).values([
				{ id: 1, embedding: Array.from({ length: 2000 }, (_, i) => i * 0.001) },
				{ id: 2, embedding: Array.from({ length: 2000 }, (_, i) => i * 0.002) },
			]);

			spy = vi.spyOn(db, "execute");
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS large_embeddings");
			await client.close();
		});

		it("should handle updates for 2k-dimensional vectors", async () => {
			batchUpdate(db, largeEmbeddings, [
				{
					id: 1,
					update: {
						embedding: Array.from({ length: 2000 }, (_, i) => i * 0.003),
					},
				},
				{
					id: 2,
					update: {
						embedding: Array.from({ length: 2000 }, (_, i) => i * 0.004),
					},
				},
			]);

			updates = spy.mock.calls[0][0];
			assert(updates);

			const queryResult = await db.query.large_embeddings.findMany({
				orderBy: (largeEmbeddings) => [largeEmbeddings.id],
				columns: {
					id: true,
					embedding: true,
				},
			});

			expect(
				queryResult.map((row) => row.embedding?.map((v) => v.toFixed(3))),
			).toEqual([
				Array.from({ length: 2000 }, (_, i) => (i * 0.003).toFixed(3)),
				Array.from({ length: 2000 }, (_, i) => (i * 0.004).toFixed(3)),
			]);
		});

		it.skip("should handle 1000 items of 2000-dimensional vectors", async () => {
			// Insert 2,000 items with 2k-dimensional vectors
			const initialData = Array.from({ length: 1000 }, (_, i) => ({
				id: i + 1,
				embedding: Array.from({ length: 2000 }, (_, j) => j * 0.001),
			}));

			await db.insert(largeEmbeddings).values(initialData);

			// Prepare updates
			batchUpdate(
				db,
				largeEmbeddings,
				initialData.map((row) => ({
					id: row.id,
					update: { embedding: row.embedding.map((v) => v * 2) },
				})),
			);

			updates = spy.mock.calls[0][0];

			assert(updates);

			// Verify updates
			const queryResult = await db.query.large_embeddings.findMany({
				orderBy: (largeEmbeddings) => [largeEmbeddings.id],
				columns: {
					id: true,
					embedding: true,
				},
			});

			expect(
				queryResult
					.slice(0, 10)
					.map((row) => row.embedding?.map((v) => v.toFixed(3))),
			).toEqual(
				initialData
					.slice(0, 10)
					.map((row) => row.embedding.map((v) => (v * 2).toFixed(3))),
			);
		});
	});

	describe("batchUpdate with camelCase to snake_case conversion", () => {
		const events = pgTable("events", {
			id: integer("id").primaryKey(),
			createdAt: text("created_at"), // Assuming createdAt is stored as created_at
			name: text("name"),
		});

		let db: PgliteDatabase<{ events: typeof events }>;
		let updates: SQL | undefined;
		let spy: MockInstance;

		beforeAll(async () => {
			client = new PGlite();
			db = drizzle<{ events: typeof events }>({ client, schema: { events } });

			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS ${events} (
					${sql.identifier(events.id.name)} ${sql.raw(events.id.getSQLType())},
					${sql.identifier(events.createdAt.name)} ${sql.raw(events.createdAt.getSQLType())},
					${sql.identifier(events.name.name)} ${sql.raw(events.name.getSQLType())}
				)
			`);

			await db.insert(events).values([
				{ id: 1, createdAt: "2023-01-01", name: "Event 1" },
				{ id: 2, createdAt: "2023-01-02", name: "Event 2" },
			]);

			spy = vi.spyOn(db, "execute");
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS events");
			await client.close();
		});

		it("should handle camelCase to snake_case field updates", async () => {
			batchUpdate(db, events, [
				{
					id: 1,
					update: { createdAt: "2023-01-10", name: "Updated Event 1" },
				},
				{
					id: 2,
					update: { createdAt: "2023-01-11", name: "Updated Event 2" },
				},
			]);

			updates = spy.mock.calls[0][0];

			assert(updates);

			expect(
				pgDialect
					.sqlToQuery(updates)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toEqual(
				`UPDATE "events" as t SET "created_at" = c."created_at", "name" = c."name" FROM ( VALUES ($1::integer, $2::text, $3::text), ($4::integer, $5::text, $6::text) ) AS c("id", "created_at", "name") WHERE c."id" = t."id"`,
			);

			await db.execute(updates);

			const queryResult = await db.query.events.findMany({
				orderBy: (events) => [events.id],
				columns: {
					id: true,
					createdAt: true,
					name: true,
				},
			});

			expect(queryResult).toEqual([
				{ id: 1, createdAt: "2023-01-10", name: "Updated Event 1" },
				{ id: 2, createdAt: "2023-01-11", name: "Updated Event 2" },
			]);
		});
	});

	describe("batchUpdate with complex schema", () => {
		const sceneObjects = pgTable("scene_objects", {
			id: uuid("id").primaryKey().defaultRandom(),
			sceneId: uuid("scene_id").notNull(),
			objectType: text("object_type").notNull(),
			metadata: jsonb("metadata"),
			position: vector("position", { dimensions: 3 }).notNull(),
			quaternion: vector("quaternion", { dimensions: 4 }).notNull(),
			scale: vector("scale", { dimensions: 3 }).notNull(),
			color: text("color").notNull().default("orange"),
			createdAt: timestamp("created_at").defaultNow().notNull(),
			updatedAt: timestamp("updated_at").defaultNow().notNull(),
			deletedAt: timestamp("deleted_at"),
		});

		let db: PgliteDatabase<{ scene_objects: typeof sceneObjects }>;

		const firstId = v7();
		const secondId = v7();

		let updates: SQL | undefined;
		let spy: MockInstance;

		beforeAll(async () => {
			client = new PGlite({
				extensions: { vector: vectorExtension },
			});
			db = drizzle<{ scene_objects: typeof sceneObjects }>({
				client,
				schema: { scene_objects: sceneObjects },
			});

			await db.execute(sql`
				CREATE EXTENSION IF NOT EXISTS vector;
			`);

			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS ${sceneObjects} (
					${sql.identifier(sceneObjects.id.name)} ${sql.raw(sceneObjects.id.getSQLType())},
					${sql.identifier(sceneObjects.sceneId.name)} ${sql.raw(sceneObjects.sceneId.getSQLType())},
					${sql.identifier(sceneObjects.objectType.name)} ${sql.raw(sceneObjects.objectType.getSQLType())},
					${sql.identifier(sceneObjects.metadata.name)} ${sql.raw(sceneObjects.metadata.getSQLType())},
					${sql.identifier(sceneObjects.position.name)} ${sql.raw(sceneObjects.position.getSQLType())},
					${sql.identifier(sceneObjects.quaternion.name)} ${sql.raw(sceneObjects.quaternion.getSQLType())},
					${sql.identifier(sceneObjects.scale.name)} ${sql.raw(sceneObjects.scale.getSQLType())},
					${sql.identifier(sceneObjects.color.name)} ${sql.raw(sceneObjects.color.getSQLType())},
					${sql.identifier(sceneObjects.createdAt.name)} ${sql.raw(sceneObjects.createdAt.getSQLType())},
					${sql.identifier(sceneObjects.updatedAt.name)} ${sql.raw(sceneObjects.updatedAt.getSQLType())},
					${sql.identifier(sceneObjects.deletedAt.name)} ${sql.raw(sceneObjects.deletedAt.getSQLType())}
				)
			`);
		});

		beforeEach(async () => {
			// Insert some test data
			await db.insert(sceneObjects).values([
				{
					id: firstId,
					sceneId: v7(),
					objectType: "cube",
					metadata: { key: "value" },
					position: [1.0, 2.0, 3.0],
					quaternion: [0.0, 0.0, 0.0, 1.0],
					scale: [1.0, 1.0, 1.0],
					color: "red",
					createdAt: new Date("2023-01-01"),
					updatedAt: new Date("2023-01-01"),
				},
				{
					id: secondId,
					sceneId: v7(),
					objectType: "sphere",
					metadata: { key: "value" },
					position: [4.0, 5.0, 6.0],
					quaternion: [0.0, 0.0, 0.0, 1.0],
					scale: [1.0, 1.0, 1.0],
					color: "blue",
					createdAt: new Date("2023-01-01"),
					updatedAt: new Date("2023-01-01"),
				},
			]);

			spy = vi.spyOn(db, "execute");
		});

		afterEach(async () => {
			await db.delete(sceneObjects);
		});

		afterAll(async () => {
			await db.execute("DROP TABLE IF EXISTS scene_objects");
			await client.close();
		});

		it("should generate correct SQL for complex schema update", async () => {
			batchUpdate(db, sceneObjects, [
				{
					id: firstId,
					update: {
						objectType: "updated_cube",
						metadata: { newKey: "newValue" },
						position: [7.0, 8.0, 9.0],
						color: "green",
						updatedAt: new Date("2023-01-02"),
					},
				},
				{
					id: secondId,
					update: {
						objectType: "updated_sphere",
						metadata: { newKey: "newValue" },
						position: [10.0, 11.0, 12.0],
						color: "yellow",
						updatedAt: new Date("2023-01-02"),
					},
				},
			]);

			updates = spy.mock.calls[0][0];

			assert(updates);

			expect(
				pgDialect
					.sqlToQuery(updates)
					.sql.replace(/[\s\n\t]+/g, " ")
					.trim(),
			).toBe(
				`UPDATE "scene_objects" as t SET "color" = c."color", "metadata" = c."metadata", "object_type" = c."object_type", "position" = c."position", "updated_at" = c."updated_at" FROM ( VALUES ($1::uuid, $2::text, $3::jsonb, $4::text, ARRAY[7, 8, 9]::vector(3), $5::timestamp), ($6::uuid, $7::text, $8::jsonb, $9::text, ARRAY[10, 11, 12]::vector(3), $10::timestamp) ) AS c("id", "color", "metadata", "object_type", "position", "updated_at") WHERE c."id" = t."id"`,
			);

			const queryResult = await db.query.scene_objects.findMany({
				columns: {
					id: true,
					objectType: true,
					metadata: true,
					position: true,
					color: true,
				},
			});

			expect(queryResult.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
				[
					{
						id: firstId,
						objectType: "updated_cube",
						metadata: { newKey: "newValue" },
						position: [7.0, 8.0, 9.0],
						color: "green",
					},
					{
						id: secondId,
						objectType: "updated_sphere",
						metadata: { newKey: "newValue" },
						position: [10.0, 11.0, 12.0],
						color: "yellow",
					},
				].sort((a, b) => a.id.localeCompare(b.id)),
			);
		});
	});
});
