import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActivitySwitchConfirm } from "@/hooks/useActivitySwitchConfirm";
import { useActivity } from "@/context/ActivityContext";

vi.mock("@/context/ActivityContext", () => ({
  useActivity: vi.fn(),
}));

function TestHarness({ action }: { action: () => void }) {
  const { requestStart, confirmDialog } = useActivitySwitchConfirm();
  return (
    <div>
      <button onClick={() => requestStart(action)}>Trigger Start</button>
      {confirmDialog}
    </div>
  );
}

describe("useActivitySwitchConfirm", () => {
  const user = userEvent.setup();
  const mockStopActivity = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the action immediately when there is no activity in progress", async () => {
    (useActivity as any).mockReturnValue({
      currentActivity: undefined,
      stopActivity: mockStopActivity,
    });

    const action = vi.fn();
    render(<TestHarness action={action} />);

    await user.click(screen.getByText("Trigger Start"));

    expect(action).toHaveBeenCalledTimes(1);
    expect(mockStopActivity).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/停止当前活动并开始新活动/)
    ).not.toBeInTheDocument();
  });

  it("shows a confirm dialog naming the in-progress activity instead of running the action", async () => {
    (useActivity as any).mockReturnValue({
      currentActivity: { id: "a1", activityName: "Writing docs" },
      stopActivity: mockStopActivity,
    });

    const action = vi.fn();
    render(<TestHarness action={action} />);

    await user.click(screen.getByText("Trigger Start"));

    expect(action).not.toHaveBeenCalled();
    expect(mockStopActivity).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/停止当前活动并开始新活动/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/「Writing docs」正在进行中/)
    ).toBeInTheDocument();
  });

  it("stops the current activity then runs the pending action on confirm", async () => {
    (useActivity as any).mockReturnValue({
      currentActivity: { id: "a1", activityName: "Writing docs" },
      stopActivity: mockStopActivity,
    });

    const action = vi.fn();
    render(<TestHarness action={action} />);

    await user.click(screen.getByText("Trigger Start"));

    const confirmButton = await screen.findByRole("button", {
      name: "停止并开始",
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockStopActivity).toHaveBeenCalledTimes(1);
      expect(action).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        screen.queryByText(/停止当前活动并开始新活动/)
      ).not.toBeInTheDocument();
    });
  });

  it("does not run the action when the dialog is dismissed", async () => {
    (useActivity as any).mockReturnValue({
      currentActivity: { id: "a1", activityName: "Writing docs" },
      stopActivity: mockStopActivity,
    });

    const action = vi.fn();
    render(<TestHarness action={action} />);

    await user.click(screen.getByText("Trigger Start"));

    const cancelButton = await screen.findByRole("button", { name: "取消" });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(
        screen.queryByText(/停止当前活动并开始新活动/)
      ).not.toBeInTheDocument();
    });

    expect(action).not.toHaveBeenCalled();
    expect(mockStopActivity).not.toHaveBeenCalled();
  });
});
