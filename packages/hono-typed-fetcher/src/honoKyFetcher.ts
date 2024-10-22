import type { Hono } from "hono";
import ky from "ky";
import { type TypedHonoFetcher, honoFetcher } from "./honoFetcher";

export const honoKyFetcher = <T extends Hono>(
	baseUrl: string,
): TypedHonoFetcher<T> => {
	const kyInstance = ky.create({ prefixUrl: baseUrl });

	return honoFetcher<T>((request, init) => {
		// Remove the leading slash from the request URL
		const url = request.startsWith("/") ? request.slice(1) : request;
		return kyInstance(url, init) as ReturnType<T["request"]>;
	});
};
