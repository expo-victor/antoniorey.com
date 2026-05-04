import type { APIRoute } from "astro";
import { authorize } from "../../../server/auth";
import type { AgendaEvent } from "../../../server/agendaStore";
import { readEvents, writeEvents } from "../../../server/agendaStore";

export const prerender = false;

function sanitize(input: unknown): string {
	return typeof input === "string" ? input.trim() : "";
}

function sanitizeGallery(input: unknown): string[] {
	if (Array.isArray(input)) {
		return input.map((item) => sanitize(item)).filter(Boolean);
	}

	if (typeof input === "string") {
		return input
			.split(/[\n,]/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	return [];
}

function isValidRange(startDate: string, endDate: string): boolean {
	return !endDate || endDate >= startDate;
}

export const PUT: APIRoute = async ({ params, request }) => {
	const isAuthorized = await authorize(request);
	if (!isAuthorized) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const id = params.id ?? "";
	if (!id) {
		return new Response(JSON.stringify({ error: "Missing event id." }), {
			status: 400,
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

	const events = await readEvents();
	const index = events.findIndex((item) => item.id === id);

	if (index === -1) {
		return new Response(JSON.stringify({ error: "Event not found." }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	const current = events[index];
	const title = sanitize(payload.title);
	const date = sanitize(payload.date);
	const endDate = sanitize(payload.endDate);
	const time = sanitize(payload.time);
	const location = sanitize(payload.location);
	const description = sanitize(payload.description);
	const image = sanitize(payload.image);
	const hasGallery = Object.prototype.hasOwnProperty.call(payload, "gallery");
	const gallery = sanitizeGallery(payload.gallery);

	if (!title || !date) {
		return new Response(JSON.stringify({ error: "Both `title` and `date` must be provided." }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	if (!isValidRange(date, endDate)) {
		return new Response(JSON.stringify({ error: "La fecha fin no puede ser anterior a la fecha inicio." }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const updated: AgendaEvent = {
		...current,
		title,
		date,
	};

	if (Object.prototype.hasOwnProperty.call(payload, "endDate")) {
		if (endDate) {
			updated.endDate = endDate;
		} else {
			delete updated.endDate;
		}
	} else if (current.endDate) {
		updated.endDate = current.endDate;
	}

	if (Object.prototype.hasOwnProperty.call(payload, "time")) {
		if (time) {
			updated.time = time;
		} else {
			delete updated.time;
		}
	} else if (current.time) {
		updated.time = current.time;
	}

	if (Object.prototype.hasOwnProperty.call(payload, "location")) {
		if (location) {
			updated.location = location;
		} else {
			delete updated.location;
		}
	} else if (current.location) {
		updated.location = current.location;
	}

	if (Object.prototype.hasOwnProperty.call(payload, "description")) {
		if (description) {
			updated.description = description;
		} else {
			delete updated.description;
		}
	} else if (current.description) {
		updated.description = current.description;
	}

	if (Object.prototype.hasOwnProperty.call(payload, "image")) {
		if (image) {
			updated.image = image;
		} else {
			delete updated.image;
		}
	} else if (current.image) {
		updated.image = current.image;
	}

	if (hasGallery) {
		if (gallery.length) {
			updated.gallery = gallery;
		} else {
			delete updated.gallery;
		}
	} else if (current.gallery?.length) {
		updated.gallery = current.gallery;
	}

	events[index] = updated;
	await writeEvents(events);

	return new Response(JSON.stringify(updated), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};

export const DELETE: APIRoute = async ({ params, request }) => {
	const isAuthorized = await authorize(request);
	if (!isAuthorized) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const id = params.id ?? "";
	if (!id) {
		return new Response(JSON.stringify({ error: "Missing event id." }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const events = await readEvents();
	const next = events.filter((event) => event.id !== id);

	if (events.length === next.length) {
		return new Response(JSON.stringify({ error: "Event not found." }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	await writeEvents(next);

	return new Response(null, {
		status: 204,
	});
};

export const OPTIONS: APIRoute = async () =>
	new Response(null, {
		status: 204,
		headers: {
			Allow: "PUT,DELETE,OPTIONS",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "PUT,DELETE,OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		},
	});
