import { beforeAll, describe, expect, test } from "vitest";
import {
	type TypedFetcher,
	honoDoFetcherWithId,
	honoDoFetcherWithName,
} from "../../hono-typed-fetcher/src/honoDoFetcher";

import { env } from "cloudflare:test";
import type { TestDurableObject, TestEnv } from "./worker";

declare module "cloudflare:test" {
	interface ProvidedEnv {
		TEST: DurableObjectNamespace<TestDurableObject>;
	}
}

describe("doFetcher with mock worker", () => {
	test("durable object can be instantiated", async () => {
		await new Promise((resolve) => setTimeout(resolve, 2000));
		const id = env.TEST.idFromName("test-id");
		const stub = await env.TEST.get(id);
		expect(stub).not.toBeNull();

		const response = await stub.fetch("http://localhost:8787/test");
		const data = await response.json();
		expect(data).toEqual({
			method: "GET",
			id: expect.any(String),
		});
	});

	const runFetcherTests = (
		description: string,
		createFetcher: () => TypedFetcher<DurableObjectStub<TestDurableObject>>,
	) => {
		describe(description, () => {
			let fetcher: TypedFetcher<DurableObjectStub<TestDurableObject>>;

			beforeAll(() => {
				fetcher = createFetcher();
			});

			test("GET request", async () => {
				const response = await fetcher.get({ url: "/test" });
				const responseBody = await response.text();
				try {
					const data = JSON.parse(responseBody);
					expect(data).toEqual({
						method: "GET",
						id: expect.any(String),
					});
				} catch (error) {
					console.error(responseBody, error);
					throw error;
				}
			});

			test("POST request", async () => {
				const response = await fetcher.post({
					url: "/test",
					body: { foo: "bar" },
				});
				const data = await response.json();
				expect(data).toEqual({
					method: "POST",
					body: { foo: "bar" },
					id: expect.any(String),
				});
			});

			test("PUT request", async () => {
				const response = await fetcher.put({
					url: "/test",
					body: { baz: "qux" },
				});
				const data = await response.json();
				expect(data).toEqual({
					method: "PUT",
					body: { baz: "qux" },
					id: expect.any(String),
				});
			});

			test("DELETE request", async () => {
				const response = await fetcher.delete({ url: "/test" });
				const data = await response.json();
				expect(data).toEqual({
					method: "DELETE",
					id: expect.any(String),
				});
			});

			test("PATCH request", async () => {
				const response = await fetcher.patch({
					url: "/test",
					body: { update: "value" },
				});
				const data = await response.json();
				expect(data).toEqual({
					method: "PATCH",
					body: { update: "value" },
					id: expect.any(String),
				});
			});

			test("POST request with validated JSON", async () => {
				const response = await fetcher.post({
					url: "/test-json-validated",
					body: { item: "newItem", quantity: 5 },
				});
				const data = await response.json();
				expect(data).toEqual({
					method: "POST",
					body: { item: "newItem", quantity: 5 },
					id: expect.any(String),
					validated: "json",
				});
			});

			test("POST request with validated form data", async () => {
				const response = await fetcher.post({
					url: "/test-form-validated",
					form: {
						item: "newItem",
						quantity: "5",
					},
				});
				const data = await response.json();
				expect(data).toEqual({
					method: "POST",
					body: { item: "newItem", quantity: 5 },
					id: expect.any(String),
					validated: "form",
				});
			});

			test("POST request with unvalidated JSON", async () => {
				const response = await fetcher.post({
					url: "/test-json-unvalidated",
					body: { anyKey: "anyValue" },
				});
				const data = await response.json();
				expect(data).toEqual({
					method: "POST",
					body: { anyKey: "anyValue" },
					id: expect.any(String),
					validated: false,
				});
			});

			test("POST request with unvalidated form data", async () => {
				const response = await fetcher.post({
					url: "/test-form-unvalidated",
					form: { anyKey: "anyValue" },
				});
				const data = await response.json();
				expect(data).toEqual({
					method: "POST",
					body: { anyKey: "anyValue" },
					id: expect.any(String),
					validated: false,
				});
			});
		});
	};

	runFetcherTests("honoDoFetcherWithName", () =>
		honoDoFetcherWithName(env.TEST, "test-name"),
	);

	runFetcherTests("honoDoFetcherWithId", () =>
		honoDoFetcherWithId(env.TEST, env.TEST.idFromName("test-id").toString()),
	);
});
// // Typing tests
// import { expectTypeOf } from "vitest";

// describe("doFetcher type checks", () => {
// 	const dummyNamespace = {} as DurableObjectNamespace<TestDurableObject>;
// 	const fetcher = doFetcherWithName(dummyNamespace, "test-name");

// 	test("GET request typing", () => {
// 		expectTypeOf(fetcher.get).parameter(0).toMatchTypeOf<{
// 			url: string;
// 			init?: RequestInit;
// 		}>();
// 	});

// 	// test("POST request typing", () => {
// 	// 	expectTypeOf(fetcher.post).parameter(0).toMatchTypeOf<{
// 	// 		url: string;
// 	// 		body?: unknown;
// 	// 		form?: Record<string, string | string[]>;
// 	// 		init?: RequestInit;
// 	// 		params?: Record<string, string | string[]>;
// 	// 	}>();
// 	// });

// 	test("PUT request typing", () => {
// 		expectTypeOf(fetcher.put).parameter(0).toMatchTypeOf<{
// 			url: string;
// 			body?: unknown;
// 			init?: RequestInit;
// 		}>();
// 	});

// 	test("DELETE request typing", () => {
// 		expectTypeOf(fetcher.delete).parameter(0).toMatchTypeOf<{
// 			url: string;
// 			init?: RequestInit;
// 		}>();
// 	});

// 	test("PATCH request typing", () => {
// 		expectTypeOf(fetcher.patch).parameter(0).toMatchTypeOf<{
// 			url: string;
// 			body?: unknown;
// 			init?: RequestInit;
// 		}>();
// 	});

// 	// test("Return type", () => {
// 	// 	expectTypeOf(fetcher.get).returns.toEqualTypeOf<Promise<Response>>();
// 	// 	expectTypeOf(fetcher.post).returns.toEqualTypeOf<Promise<Response>>();
// 	// 	expectTypeOf(fetcher.put).returns.toEqualTypeOf<Promise<Response>>();
// 	// 	expectTypeOf(fetcher.delete).returns.toEqualTypeOf<Promise<Response>>();
// 	// 	expectTypeOf(fetcher.patch).returns.toEqualTypeOf<Promise<Response>>();
// 	// });
// });
