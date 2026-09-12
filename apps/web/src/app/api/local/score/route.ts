import "server-only";

import { auth } from "@/auth";
import { evaluateJobsForUser } from "@/lib/ai/evaluate";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.JBCN_LOCAL !== "1") return new Response(null, { status: 404 });
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response(null, { status: 401 });

    const body = z
      .object({ ids: z.array(z.string().uuid()).min(1).max(10) })
      .parse(await request.json());

    const result = await evaluateJobsForUser(body, userId);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "评分失败" },
      { status: 400 },
    );
  }
}
