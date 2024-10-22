import type { Hono } from "hono";
import { type TypedHonoFetcher, honoFetcher } from "./honoFetcher";

export const appHonoFetcher = <T extends Hono>(app: T): TypedHonoFetcher<T> => {
	return honoFetcher<T>((request, init) => {
		return app.request(request, init) as ReturnType<T["request"]>;
	});
};
