import { toast } from "@/components/ui/use-toast";
import {
  buildInsufficientSectionsMessage,
  hasMinResumeSections,
} from "@/lib/resumeSections";

export { hasMinResumeSections };

export const warnInsufficientResumeSections = (
  action: string,
  hint?: string,
): void => {
  toast({
    variant: "destructive",
    title: "简历内容不足",
    description: buildInsufficientSectionsMessage(action, hint),
  });
};
