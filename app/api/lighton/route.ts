import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { passkey } = body;

        // Check if the passkey matches the one in the environment variables
        if (passkey !== process.env.PASSKEY) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const token = process.env.NATUREREMO_TOKEN;
        if (!token) {
            console.error("NATUREREMO_TOKEN is not set.");
            return NextResponse.json(
                { error: "Server configuration error." },
                { status: 500 }
            );
        }

        const applianceIdsString = process.env.LIGHTON_APPLIANCE_IDS;
        if (!applianceIdsString) {
            console.error("LIGHTON_APPLIANCE_IDS is not set.");
            return NextResponse.json(
                {
                    error: "Server configuration error: LIGHTON_APPLIANCE_IDS is missing.",
                },
                { status: 500 }
            );
        }
        const applianceIds = applianceIdsString
            .split(",")
            .map((id) => id.trim());

        const requests = applianceIds.map((applianceId) =>
            fetch(
                `https://api.nature.global/1/appliances/${applianceId}/light`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: "button=on",
                }
            )
        );

        const responses = await Promise.all(requests);

        const results = await Promise.all(
            responses.map(async (response, index) => {
                const applianceId = applianceIds[index];
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(
                        `Failed to turn on light for appliance ${applianceId}:`,
                        errorText
                    );
                    return { success: false, applianceId, error: errorText };
                }
                return { success: true, applianceId };
            })
        );

        const failedRequests = results.filter((r) => !r.success);
        if (failedRequests.length > 0) {
            return NextResponse.json(
                {
                    message: "One or more light on requests failed.",
                    failed: failedRequests,
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { message: "Light on requests sent successfully." },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error processing light on request:", error);
        return NextResponse.json(
            { error: "Failed to process light on request." },
            { status: 500 }
        );
    }
}
