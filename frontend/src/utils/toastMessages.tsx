import { toast, ToastOptions } from 'react-toastify';

// Toasts appear at the bottom of the screen, styled like the app's cards (see index.css).

type Kind = 'success' | 'error' | 'warning' | 'info';

const TITLES: Record<Kind, string> = {
  success: 'Done',
  error: 'Something went wrong',
  warning: 'Heads up',
  info: 'Info',
};

function ToastGlyph({ kind }: { kind: Kind }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (kind === 'success') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.2 12.3 2.4 2.4 5-5" />
      </svg>
    );
  }
  if (kind === 'error') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
      </svg>
    );
  }
  if (kind === 'warning') {
    return (
      <svg {...common}>
        <path d="M12 3.5 2.8 19.5h18.4Z" />
        <path d="M12 10v4M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function ToastContent({ kind, message }: { kind: Kind; message: string }) {
  return (
    <div className="ax-toast">
      <span className="ax-toast-title">{TITLES[kind]}</span>
      <span className="ax-toast-message">{message}</span>
    </div>
  );
}

function options(kind: Kind, autoClose: number): ToastOptions {
  return {
    position: 'bottom-center',
    autoClose,
    pauseOnHover: true,
    draggable: true,
    closeOnClick: true,
    icon: <ToastGlyph kind={kind} />,
  };
}

/** Green — something worked. */
export const showSuccess = (message: string) => {
  toast.success(<ToastContent kind="success" message={message} />, options('success', 3200));
};

/** Red — something failed. */
export const showError = (message: string) => {
  toast.error(<ToastContent kind="error" message={message} />, options('error', 5000));
};

/** Amber — heads-up, nothing broke. */
export const showWarning = (message: string) => {
  toast.warning(<ToastContent kind="warning" message={message} />, options('warning', 4500));
};

/** Blue — neutral information. */
export const showInfo = (message: string) => {
  toast.info(<ToastContent kind="info" message={message} />, options('info', 3200));
};
