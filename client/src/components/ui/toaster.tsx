import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // デバッグ: title/description が空の場合に原因追跡ログを出す
        try {
          if (!title && !description) {
            // eslint-disable-next-line no-console
            console.warn('[Toaster] toast rendered without title/description', { id, props })
          }
        } catch {
          // noop
        }

        // フォールバック: タイトル・説明が両方空の場合は簡易メッセージを表示する
        const hasContent = Boolean(title) || Boolean(description)
        const fallbackTitle = '通知'

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {hasContent ? (
                <>
                  {title && <ToastTitle>{title}</ToastTitle>}
                  {description && (
                    <ToastDescription>{description}</ToastDescription>
                  )}
                </>
              ) : (
                <ToastTitle>{fallbackTitle}</ToastTitle>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
