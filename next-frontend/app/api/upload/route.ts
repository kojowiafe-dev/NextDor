import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 1. Multipart Form Data (file upload from input type="file")
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const folder = (formData.get("folder") as string) || "nextdor/products";

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No file provided in form data." },
          { status: 400 }
        );
      }

      // Validate mime type
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { success: false, error: "Only image files are allowed." },
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

    // 2. JSON Body (base64 string or remote image URL)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { image, url, folder = "nextdor/products" } = body;
      const target = image || url;

      if (!target || typeof target !== "string") {
        return NextResponse.json(
          { success: false, error: "No image URL or base64 data provided." },
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
