import { z } from "zod";

export const SigninFormSchema = z.object({
  email: z
    .string({
      error: "请填写邮箱。",
    })
    .min(3, {
      message: "邮箱至少 3 个字符。",
    })
    .email("请输入有效邮箱。"),
  password: z
    .string({
      error: "请输入密码。",
    })
    .min(1),
});
