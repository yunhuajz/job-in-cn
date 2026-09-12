import { auth } from "@/auth";
import { executeApprovedGreeting } from "@/lib/boss/apply";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    if (!session?.user) return new Response(null, { status: 401 });
    const body = z
      .object({ ids: z.array(z.string().uuid()).min(1).max(20), confirmed: z.boolean() })
      .parse(await request.json());
    const report = await executeApprovedGreeting(body, session.user.id);
    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "自动投递失败" }, { status: 400 });
  }
}
