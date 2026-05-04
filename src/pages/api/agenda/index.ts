import type { APIRoute } from "astro";
import { authorize } from "../../../server/auth";
import type { AgendaEvent } from "../../../server/agendaStore";
import { readEvents, writeEvents } from "../../../server/agendaStore";

export const prerender = false;

function sanitizeString(input: unknown): string {
	return typeof input === "string" ? input.trim() : "";
}

function sanitizeGallery(input: unknown): string[] {
	if (Array.isArray(input)) {
		return input
			.map((item) => sanitizeString(item))
			.filter((item) => Boolean(item));
	}

	if (typeof input === "string") {
		return input
			.split(/[\n,]/)
			.map((item) => item.trim())
			.filter((item) => Boolean(item));
	}

	return [];
}

function isValidRange(startDate: string, endDate: string): boolean {
	return !endDate || endDate >= startDate;
}

function buildId(event: Pick<AgendaEvent, "date" | "title">): string {
	const datePart = sanitizeString(event.date) || new Date().toISOString().split("T")[0];
	const titlePart = sanitizeString(event.title)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `${titlePart || "evento"}-${datePart}`;
}

export const GET: APIRoute = async () => {
	const events = await readEvents();
	const sorted = events.sort((a, b) => a.date.localeCompare(b.date));

	return new Response(JSON.stringify(sorted), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const POST: APIRoute = async ({ request }) => {
	const isAuthorized = await authorize(request);
	if (!isAuthorized) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	let payload: Partial<AgendaEvent>;
	try {
		payload = await request.json();
	} catch (error) {
		return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const title = sanitizeString(payload.title);
	const date = sanitizeString(payload.date);
	const endDate = sanitizeString(payload.endDate);

	if (!title || !date) {
		return new Response(
			JSON.stringify({ error: "Both `title` and `date` are required fields." }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (!isValidRange(date, endDate)) {
		return new Response(JSON.stringify({ error: "La fecha fin no puede ser anterior a la fecha inicio." }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const events = await readEvents();
	const id = sanitizeString(payload.id) || buildId({ title, date });

	if (events.some((item) => item.id === id)) {
		return new Response(JSON.stringify({ error: "Duplicated event id." }), {
			status: 409,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const event: AgendaEvent = {
			id,
			title,
			date,
			endDate: endDate || undefined,
			time: sanitizeString(payload.time) || undefined,
			location: sanitizeString(payload.location) || undefined,
			description: sanitizeString(payload.description) || undefined,
			image: sanitizeString(payload.image) || undefined,
		};

		const gallery = sanitizeGallery(payload.gallery);
		if (gallery.length) {
			event.gallery = gallery;
		}

		events.push(event);
		await writeEvents(events);

		return new Response(JSON.stringify(event), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "No se pudo guardar el evento.";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};

export const OPTIONS: APIRoute = async () =>
	new Response(null, {
		status: 204,
		headers: {
			Allow: "GET,POST,OPTIONS",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
	});
