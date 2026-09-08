import { localSession } from "@/lib/local/session";
export const dynamic = "force-dynamic";
export async function GET() {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  await localSession();
  return Response.json({ app: "JBCN", root: process.env.JBCN_ROOT });
}
