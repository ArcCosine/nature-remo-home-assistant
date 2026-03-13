import { NextResponse } from "next/server";
import { verifyPasskey } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  createValidationErrorResponse,
  LightControlRequestSchema,
  validateApplianceId,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const clientIp = (request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown") as string;

    // Check rate limit: 10 requests per minute per IP
    const rateLimitResult = checkRateLimit(clientIp, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 1000,
          ),
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(
              (rateLimitResult.resetTime - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    const bodyText = await request.text();
    const params = new URLSearchParams(bodyText);
    const passkey = params.get("passkey");

    // Validate request parameters
    const validationResult = LightControlRequestSchema.safeParse({
      passkey,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        createValidationErrorResponse(validationResult.error.issues),
        { status: 400 },
      );
    }

    // Check if the passkey matches using timing-safe comparison
    if (!verifyPasskey(passkey, process.env.PASSKEY)) {
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
    const applianceIds = applianceIdsString
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    // Validate appliance IDs
    const invalidIds = applianceIds.filter((id) => !validateApplianceId(id));
    if (invalidIds.length > 0) {
      console.error("Invalid appliance IDs in configuration:", invalidIds);
      return NextResponse.json(
        { error: "Server configuration error: Invalid appliance IDs." },
        { status: 500 },
      );
    }

    if (applianceIds.length === 0) {
      return NextResponse.json(
        { error: "No appliance IDs configured." },
        { status: 500 },
      );
    }

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
          body: "button=off",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to turn off light for appliance ${applianceId}:`,
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
          message: "One or more light off requests failed.",
          failed: failedRequests,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "Light off requests sent successfully." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing light off request:", error);
    return NextResponse.json(
      { error: "Failed to process light off request." },
      { status: 500 },
    );
  }
}
