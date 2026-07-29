import { authenticate } from "@/actions/auth.actions";
import SigninForm from "@/components/auth/SigninForm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";

// Mock the external dependencies
vi.mock("@/actions/auth.actions", () => ({
  authenticate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

describe("SigninForm Component", () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    (useRouter as any).mockReturnValue({ push: mockPush });
    render(<SigninForm />);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the SigninForm component correctly", () => {
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /登录/ })).toBeInTheDocument();
  });

  it("should display invalid email error", async () => {
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "admin" },
    });

    fireEvent.click(screen.getByRole("button", { name: /登录/ }));

    await waitFor(() => {
      expect(
        screen.getByText("请输入有效邮箱。")
      ).toBeInTheDocument();
    });
  });

  it("should display number of characters invalid error", async () => {
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "ad" },
    });

    fireEvent.click(screen.getByRole("button", { name: /登录/ }));

    await waitFor(() => {
      expect(
        screen.getByText("邮箱至少 3 个字符。")
      ).toBeInTheDocument();
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("submits the form successfully", async () => {
    (authenticate as any).mockResolvedValueOnce(null);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "password" },
    });

    fireEvent.click(screen.getByRole("button", { name: /登录/ }));

    await waitFor(() => {
      expect(authenticate).toHaveBeenCalledWith("", expect.any(FormData));
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows an error message on failed submit", async () => {
    const errorMessage = "Invalid credentials";
    (authenticate as any).mockResolvedValueOnce(errorMessage);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "wrongpassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /登录/ }));

    await waitFor(() => {
      expect(authenticate).toHaveBeenCalledWith("", expect.any(FormData));
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});
