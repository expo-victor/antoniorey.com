import type { APIRoute } from "astro";
import { AUTH_COOKIE_NAME, authorize, computeToken, getOperator } from "../../server/auth";

export const prerender = false;
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type LoginRequest = {
	username?: string;
	password?: string;
};

export const POST: APIRoute = async ({ request, cookies }) => {
	const operator = await getOperator();
	if (!operator) {
		return new Response(JSON.stringify({ error: "Operator file not found" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	let body: LoginRequest;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	if (body.username !== operator.username || body.password !== operator.password) {
		return new Response(JSON.stringify({ error: "Credenciales incorrectas." }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const token = computeToken(operator);
	cookies.set(AUTH_COOKIE_NAME, token, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: import.meta.env.PROD,
		maxAge: SESSION_MAX_AGE,
	});

	return new Response(JSON.stringify({ username: operator.username }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const GET: APIRoute = async ({ request }) => {
	const operator = await getOperator();
	if (!operator || !(await authorize(request))) {
		return new Response(JSON.stringify({ authenticated: false }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify({ authenticated: true, username: operator.username }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const DELETE: APIRoute = async ({ cookies }) => {
	cookies.delete(AUTH_COOKIE_NAME, {
		path: "/",
	});

	return new Response(null, {
		status: 204,
	});
};

export const OPTIONS: APIRoute = async () =>
	new Response(null, {
		status: 204,
		headers: {
			Allow: "GET,POST,DELETE,OPTIONS",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
