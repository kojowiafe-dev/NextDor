import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { API_BASE } from "@/lib/api-config";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ALLOWED_FOLDERS = new Set([
  "nextdor/products",
  "nextdor/vendors",
  "nextdor/avatars",
  "nextdor/categories",
  "nextdor/banners",
  "nextdor/reviews",
]);

function isPrivateIpOrHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host === "metadata.google.internal" ||
    host === "instance-data"
  ) {
    return true;
  }

  // IPv4 check
  const parts = host.split(".").map((p) => parseInt(p, 10));
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // Cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  // IPv6 check
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Authentication Check ──────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    const cookieToken =
      req.cookies.get("nextdor_access_token")?.value ||
      req.cookies.get("nextdor-token")?.value ||
      req.cookies.get("vendor_token")?.value;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required to upload media." },
        { status: 401 }
      );
    }

    try {
      const authRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!authRes.ok) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired session token." },
          { status: 401 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Authentication service temporarily unavailable." },
        { status: 503 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    // ── 2. Multipart Form Data (Direct File Upload) ──────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const requestedFolder = (formData.get("folder") as string) || "nextdor/products";
      const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : "nextdor/products";

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No file provided in form data." },
          { status: 400 }
        );
      }

      // Restrict strictly to safe raster images (disallowing SVGs and executables)
      if (!file.type || !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
        return NextResponse.json(
          {
            success: false,
            error: "Only safe raster image formats (JPEG, PNG, WebP, GIF, AVIF) are permitted.",
          },
          { status: 400 }
        );
      }

      // Max file size: 10MB
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: "Image size must be less than 10MB." },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const result: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(buffer);
      });

      return NextResponse.json({
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      });
    }

    // ── 3. JSON Body (Base64 data or verified external URL) ─────────────────
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { image, url, folder: requestedFolder = "nextdor/products" } = body;
      const target = image || url;
      const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : "nextdor/products";

      if (!target || typeof target !== "string") {
        return NextResponse.json(
          { success: false, error: "No image URL or base64 data provided." },
          { status: 400 }
        );
      }

      // Base64 Data URI check
      if (target.startsWith("data:")) {
        const isSafeDataUri = /^data:image\/(jpeg|png|webp|gif|avif);base64,/i.test(target);
        if (!isSafeDataUri) {
          return NextResponse.json(
            { success: false, error: "Only safe image MIME types (JPEG, PNG, WebP, GIF, AVIF) are allowed in base64 uploads." },
            { status: 400 }
          );
        }
      } else if (target.startsWith("http://") || target.startsWith("https://")) {
        // External URL check
        try {
          const parsed = new URL(target);
          if (parsed.protocol !== "https:") {
            return NextResponse.json(
              { success: false, error: "Remote image URLs must use secure HTTPS." },
              { status: 400 }
            );
          }
          if (isPrivateIpOrHost(parsed.hostname)) {
            return NextResponse.json(
              { success: false, error: "Target host points to a restricted or private address." },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: "Invalid remote image URL." },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: "Unrecognized image format. Must be HTTPS URL or base64 data URI." },
          { status: 400 }
        );
      }

      const result = await cloudinary.uploader.upload(target, {
        folder,
        resource_type: "image",
      });

      return NextResponse.json({
        success: true,
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      });
    }

    return NextResponse.json(
      { success: false, error: "Unsupported Content-Type header." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Cloudinary upload error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to upload image to Cloudinary.",
      },
      { status: 500 }
    );
  }
}
