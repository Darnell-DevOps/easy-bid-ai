import { forwardRef } from "react";
import { AlertCircle } from "lucide-react";

type AuthFormErrorProps = {
  id: string;
  message: string | null;
};

const AuthFormError = forwardRef<HTMLDivElement, AuthFormErrorProps>(function AuthFormError(
  { id, message },
  ref,
) {
  if (!message) return null;

  return (
    <div
      ref={ref}
      id={id}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={-1}
      className="mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/60 bg-destructive/10 px-3.5 py-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
      <span>{message}</span>
    </div>
  );
});

export default AuthFormError;
