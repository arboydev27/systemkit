import type { Metadata } from "next";
import { ReviewSession } from "@/components/ReviewSession";

export const metadata: Metadata = {
  title: "Five-minute system design review | SystemKit",
  description: "Revisit system design decisions with short, spaced practice from lessons you’ve studied.",
  alternates: { canonical: "/review/" },
};

export default function ReviewPage() {
  return <ReviewSession />;
}
