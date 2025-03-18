
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    React.useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const adjustHeight = () => {
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        };
        
        textarea.addEventListener('input', adjustHeight);
        adjustHeight(); // 初期値のサイズ調整

        return () => textarea.removeEventListener('input', adjustHeight);
      }
    }, []);

    return (
      <textarea
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={(element) => {
          if (typeof ref === 'function') {
            ref(element);
          } else if (ref) {
            ref.current = element;
          }
          textareaRef.current = element;
        }}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
