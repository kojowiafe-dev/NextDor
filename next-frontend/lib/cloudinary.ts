import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUD_NAME ||
    "mq17etnb",
  api_key:
    process.env.CLOUDINARY_API_KEY ||
    process.env.CLOUD_API_KEY ||
    "536664647454792",
  api_secret:
    process.env.CLOUDINARY_API_SECRET ||
    process.env.CLOUD_API_SECRET ||
    "VzaEvbCJW8KHmd_IwCYAr3h34-U",
  secure: true,
});

export default cloudinary;
