import type { Hono, Schema } from "hono";
import type { ExtractSchema } from "hono/types";
import { type TypedHonoFetcher, honoFetcher } from "./honoFetcher";

const DUMMY_URL = "http://dummy-url";

export type DOWithHonoApp<S extends Schema = Schema> =
	Rpc.DurableObjectBranded & {
		// biome-ignore lint/suspicious/noExplicitAny: We need to be able to pass in any schema
		app: Hono<any, S>;
	};

export type DOSchemaMap<T extends DOWithHonoApp> = T extends DOWithHonoApp
	? ExtractSchema<T["app"]>
	: never;

export type DOSchemaKeys<T extends DOWithHonoApp> = string &
	keyof DOSchemaMap<T>;

export type DOStubSchema<T extends DurableObjectStub> =
	T extends DurableObjectStub<infer S>
		? S extends DOWithHonoApp
			? ExtractSchema<S["app"]>
			: never
		: never;

export type TypedFetcher<T extends DurableObjectStub> = TypedHonoFetcher<
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	Hono<any, DOStubSchema<T>>
>;

export const honoDoFetcher = <const T extends DurableObjectStub<DOWithHonoApp>>(
	durableObject: T,
): TypedFetcher<T> => {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return honoFetcher<Hono<any, DOStubSchema<T>>>((url, init) => {
		return durableObject.fetch(`${DUMMY_URL}${url}`, init);
	});
};

export const honoDoFetcherWithName = <
	const T extends Rpc.DurableObjectBranded & DOWithHonoApp,
>(
	namespace: DurableObjectNamespace<T>,
	name: string,
): TypedFetcher<DurableObjectStub<T>> => {
	return honoDoFetcher(namespace.get(namespace.idFromName(name)));
};

export const honoDoFetcherWithId = <
	const T extends Rpc.DurableObjectBranded & DOWithHonoApp,
>(
	namespace: DurableObjectNamespace<T>,
	id: string,
): TypedFetcher<DurableObjectStub<T>> => {
	return honoDoFetcher(namespace.get(namespace.idFromString(id)));
};
