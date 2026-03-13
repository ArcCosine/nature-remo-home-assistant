import { NextResponse } from "next/server";
import { aesCmac } from "node-aes-cmac";
import { verifyPasskey } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  createValidationErrorResponse,
  LockControlRequestSchema,
  validateDeviceId,
} from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const clientIp = (request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown") as string;

    // Check rate limit: 5 requests per minute per IP for lock control
    const rateLimitResult = checkRateLimit(clientIp, {
      maxRequests: 5,
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
    const validationResult = LockControlRequestSchema.safeParse({
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

    const apiKey = process.env.SESAME_API_KEY;
    const deviceIdEnv = process.env.SESAME_UUID;
    const secretKeyHex = process.env.SESAME_SECRET;

    if (!apiKey || !deviceIdEnv || !secretKeyHex) {
      console.error("SESAME configuration is missing.");
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 },
      );
    }

    // Validate device ID format
    if (!validateDeviceId(deviceIdEnv)) {
      console.error("Invalid SESAME_UUID format:", deviceIdEnv);
      return NextResponse.json(
        { error: "Server configuration error: Invalid device ID." },
        { status: 500 },
      );
    }

    // 1. Get current status
    const statusResponse = await fetch(
      `https://app.candyhouse.co/api/sesame2/${deviceIdEnv}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
      },
    );

    let currentStatus = null;
    if (statusResponse.ok) {
      currentStatus = await statusResponse.json();
    } else {
      console.warn("Failed to get Sesame status:", await statusResponse.text());
    }

    // 2. Generate Signature for unlocking
    // The Sesame API v2 signature:
    // 2nd, 3rd, and 4th bytes of current Unix timestamp (little-endian)
    const timestamp = Math.floor(Date.now() / 1000);
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(timestamp);
    const message = buffer.subarray(1, 4);

    const key = Buffer.from(secretKeyHex, "hex");
    const signature = aesCmac(key, message);

    // 3. Send Unlock command
    const historyName = "Home Assistant";
    const historyBase64 = Buffer.from(historyName).toString("base64");

    const unlockResponse = await fetch(
      `https://app.candyhouse.co/api/sesame2/${deviceIdEnv}/cmd`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cmd: 83, // 83: Unlock
          history: historyBase64,
          sign: signature,
        }),
      },
    );

    if (!unlockResponse.ok) {
      const errorText = await unlockResponse.text();
      console.error("Failed to unlock Sesame:", errorText);
      return NextResponse.json(
        {
          error: "Failed to unlock Sesame.",
          details: errorText,
          status: currentStatus,
        },
        { status: 500 },
      );
    }

    const unlockResult = await unlockResponse.json();

    return NextResponse.json(
      {
        message: "Sesame unlock request sent successfully.",
        status: currentStatus,
        unlockResult: unlockResult,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing Sesame unlock request:", error);
    return NextResponse.json(
      { error: "Failed to process Sesame unlock request." },
      { status: 500 },
    );
  }
}
