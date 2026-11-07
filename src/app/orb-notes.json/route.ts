import { chapters } from "@/content/chapters";
import { orbNotes } from "@/lib/orb-notes";

export const dynamic = "force-static";

export function GET() {
  return Response.json(orbNotes(chapters));
}
