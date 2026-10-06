import { NextDorPageLoader } from "@/components/ui/NextDorPageLoader";

export default function Loading() {
  return (
    <NextDorPageLoader
      message="Loading NextDor..."
      subMessage="Shop More, Wait Less"
      fullScreen={false}
    />
  );
}
