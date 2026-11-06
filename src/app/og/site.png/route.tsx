import { shareImage } from "@/lib/share-image";

export const dynamic = "force-static";

export function GET() {
  return shareImage({ title: "Learn system design by making the calls.", context: "Labs, design challenges, and spaced review" });
}
