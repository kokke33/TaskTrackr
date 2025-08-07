
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    // 高さ自動調整機能を無効化
    React.useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        // 高さを固定に設定
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
        
        // 高さ調整イベントリスナーを削除
        const adjustHeight = () => {
          // 何もしない
        };
        
        textarea.addEventListener('input', adjustHeight);
        
        // 初期値のサイズ調整（値の変更を待ってから実行）
        const initialAdjustment = setTimeout(() => {
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        }, 0);
        
        return () => {
          clearTimeout(initialAdjustment);
          textarea.removeEventListener('input', adjustHeight);
        };
      }
    }, [props.value]);

    return (
      <textarea
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden",
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
