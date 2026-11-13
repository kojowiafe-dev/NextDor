import { NextdorPageLoader } from "@/components/ui/NextdorPageLoader";

export default function Loading() {
  return (
    <NextdorPageLoader
      message="Loading Nextdor..."
      subMessage="Shop More, Wait Less"
      fullScreen={false}
    />
  );
}
