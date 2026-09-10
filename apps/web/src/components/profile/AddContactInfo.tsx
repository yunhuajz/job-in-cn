"use client";
import { Loader, X } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { AddContactInfoFormSchema } from "@/models/addContactInfoForm.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useTransition } from "react";
import { toast } from "../ui/use-toast";
import { ContactInfo } from "@/models/profile.model";
import { addContactInfo, updateContactInfo } from "@/actions/profile.actions";

interface AddContactInfoProps {
  dialogOpen: boolean;
  setDialogOpen: (e: boolean) => void;
  contactInfoToEdit?: ContactInfo | null;
  resumeId: string | undefined;
}

function AddContactInfo({
  dialogOpen,
  setDialogOpen,
  contactInfoToEdit,
  resumeId,
}: AddContactInfoProps) {
  const [isPending, startTransition] = useTransition();
  const [showLink2, setShowLink2] = useState(false);

  const pageTitle = contactInfoToEdit
    ? "编辑基本信息"
    : "新增基本信息";

  const form = useForm<z.infer<typeof AddContactInfoFormSchema>>({
    resolver: zodResolver(AddContactInfoFormSchema),
    defaultValues: {
      resumeId,
      firstName: "",
      lastName: "",
      headline: "",
      email: "",
      phone: "",
      address: "",
      url1: "",
      url1Label: "",
      url2: "",
      url2Label: "",
    },
  });

  const { reset, formState } = form;

  useEffect(() => {
    if (contactInfoToEdit) {
      setShowLink2(!!contactInfoToEdit.url2);
      reset(
        {
          id: contactInfoToEdit.id,
          resumeId: contactInfoToEdit.resumeId,
          firstName: contactInfoToEdit.firstName,
          lastName: contactInfoToEdit.lastName,
          headline: contactInfoToEdit.headline,
          email: contactInfoToEdit.email,
          phone: contactInfoToEdit.phone,
          address: contactInfoToEdit.address ?? "",
          url1: contactInfoToEdit.url1 ?? "",
          url1Label: contactInfoToEdit.url1Label ?? "",
          url2: contactInfoToEdit.url2 ?? "",
          url2Label: contactInfoToEdit.url2Label ?? "",
        },
        { keepDefaultValues: true }
      );
    } else {
      reset();
    }
  }, [contactInfoToEdit, reset]);

  const onSubmit = (data: z.infer<typeof AddContactInfoFormSchema>) => {
    startTransition(async () => {
      const res = contactInfoToEdit
        ? await updateContactInfo(data)
        : await addContactInfo(data);
      if (!res.success) {
        toast({
          variant: "destructive",
          title: "错误",
          description: res.message,
        });
      } else {
        reset();
        setDialogOpen(false);
        toast({
          variant: "success",
          description: `联系方式已${contactInfoToEdit ? "更新" : "新增"}成功`,
        });
      }
    });
  };

  const closeDialog = () => setDialogOpen(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="lg:max-h-screen overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>{pageTitle}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2"
          >
            {/* FIRST NAME */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* LAST NAME */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* HEADLINE */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="headline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>个人标题</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* EMAIL */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* PHONE */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>电话</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ADDRESS */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>地址</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* LINK 1 */}
            <div className="md:col-span-2">
              <p className="text-sm font-medium mb-2">
                链接 1{" "}
                <span className="text-muted-foreground font-normal">
                  （可选，例如个人主页、LinkedIn、GitHub 等）
                </span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name="url1Label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：LinkedIn" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url1"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-xs text-muted-foreground">链接</FormLabel>
                      <FormControl>
                        <Input placeholder="https://" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* LINK 2 */}
            {showLink2 ? (
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">链接 2</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => {
                      form.setValue("url2", "", { shouldDirty: true });
                      form.setValue("url2Label", "");
                      setShowLink2(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <FormField
                    control={form.control}
                    name="url2Label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">名称</FormLabel>
                        <FormControl>
                        <Input placeholder="例如：GitHub" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="url2"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs text-muted-foreground">链接</FormLabel>
                        <FormControl>
                          <Input placeholder="https://" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ) : (
              <div className="md:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground px-0 h-auto"
                  onClick={() => setShowLink2(true)}
                >
                  + 添加另一个链接
                </Button>
              </div>
            )}

            <div className="md:col-span-2 mt-4">
              <DialogFooter>
                <div>
                  <Button
                    type="reset"
                    variant="outline"
                    className="mt-2 md:mt-0 w-full"
                    onClick={closeDialog}
                  >
                    取消
                  </Button>
                </div>
                <Button type="submit" disabled={!formState.isDirty}>
                  保存
                  {isPending && <Loader className="h-4 w-4 shrink-0 spinner" />}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AddContactInfo;
