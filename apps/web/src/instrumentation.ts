export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.JBCN_LOCAL !== "1") {
    const { syncSchedulerState } = await import("@/lib/scheduler");
    await syncSchedulerState();
  }
}
