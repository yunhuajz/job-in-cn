"use client";
import { useCallback, useState } from "react";
import { useActivity } from "@/context/ActivityContext";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";

export function useActivitySwitchConfirm() {
  const { currentActivity, stopActivity } = useActivity();
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestStart = useCallback(
    (action: () => void) => {
      if (currentActivity) {
        setPendingAction(() => action);
      } else {
        action();
      }
    },
    [currentActivity],
  );

  const confirmSwitch = useCallback(async () => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    await stopActivity();
    action();
  }, [pendingAction, stopActivity]);

  const confirmDialog = (
    <DeleteAlertDialog
      pageTitle="活动"
      open={pendingAction !== null}
      onOpenChange={(open) => !open && setPendingAction(null)}
      onDelete={confirmSwitch}
      alertTitle="停止当前活动并开始新活动？"
      alertDescription={
        currentActivity
          ? `「${currentActivity.activityName}」正在进行中,要停止它并开始新活动吗？`
          : undefined
      }
      actionLabel="停止并开始"
      actionVariant="default"
    />
  );

  return { requestStart, confirmDialog };
}
