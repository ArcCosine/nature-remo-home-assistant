import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const bodyText = await request.text();
		const params = new URLSearchParams(bodyText);
		const passkey = params.get("passkey");

		// Check if the passkey matches the one in the environment variables
		if (passkey !== process.env.PASSKEY) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const token = process.env.NATUREREMO_TOKEN;
		if (!token) {
			console.error("NATUREREMO_TOKEN is not set.");
			return NextResponse.json(
				{ error: "Server configuration error." },
				{ status: 500 },
			);
		}

		const applianceIdsString = process.env.LIGHT_APPLIANCE_IDS;
		if (!applianceIdsString) {
			console.error("LIGHT_APPLIANCE_IDS is not set.");
			return NextResponse.json(
				{
					error: "Server configuration error: LIGHT_APPLIANCE_IDS is missing.",
				},
				{ status: 500 },
			);
		}
		const applianceIds = applianceIdsString.split(",").map((id) => id.trim());

		const results = [];
		for (let i = 0; i < applianceIds.length; i++) {
			const applianceId = applianceIds[i];
			const response = await fetch(
				`https://api.nature.global/1/appliances/${applianceId}/light`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: "button=on",
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					`Failed to turn on light for appliance ${applianceId}:`,
					errorText,
				);
				results.push({ success: false, applianceId, error: errorText });
			} else {
				results.push({ success: true, applianceId });
			}

			// Wait 500ms before the next request if there are more appliances
			if (i < applianceIds.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		const failedRequests = results.filter((r) => !r.success);
		if (failedRequests.length > 0) {
			return NextResponse.json(
				{
					message: "One or more light on requests failed.",
					failed: failedRequests,
				},
				{ status: 500 },
			);
		}

		return NextResponse.json(
			{ message: "Light on requests sent successfully." },
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error processing light on request:", error);
		return NextResponse.json(
			{ error: "Failed to process light on request." },
			{ status: 500 },
		);
	}
}
