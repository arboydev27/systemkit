import type { Metadata } from "next";
import { ReviewSession } from "@/components/ReviewSession";

export const metadata: Metadata = {
  title: "Five-minute review — SystemKit",
  description: "Revisit system design decisions with short, spaced practice from lessons you’ve studied.",
};

export default function ReviewPage() {
  return <ReviewSession />;
}
