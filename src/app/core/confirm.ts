import { ConfirmationService } from 'primeng/api';

/** Options of a confirmation prompt guarding a destructive action. */
export interface ConfirmOptions {
  header: string;
  message: string;
  /** Label of the accept button. Defaults to "Supprimer". */
  acceptLabel?: string;
  /** Accept-button tone: "danger" for an irreversible delete (the default),
   *  "warn" for a reversible action such as undeploying or releasing. */
  acceptSeverity?: 'danger' | 'warn';
  /** Dialog icon. Defaults to the warning triangle. */
  icon?: string;
}

/**
 * Asks for confirmation through the application's ConfirmDialog (rendered once
 * by the root component) and runs `onAccept` when the user confirms.
 *
 * Every destructive action goes through this helper rather than
 * `window.confirm`: the native dialog ignores the theme, blocks the main thread,
 * cannot be styled or translated, and is suppressed outright by some browsers
 * after repeated use — which would silently turn a "cancel" into a "delete".
 */
export function confirmDestructive(
  confirmer: ConfirmationService,
  opts: ConfirmOptions,
  onAccept: () => void,
): void {
  confirmer.confirm({
    header: opts.header,
    message: opts.message,
    icon: opts.icon ?? 'pi pi-exclamation-triangle',
    acceptLabel: opts.acceptLabel ?? 'Supprimer',
    rejectLabel: 'Annuler',
    acceptButtonProps: { severity: opts.acceptSeverity ?? 'danger' },
    rejectButtonProps: { severity: 'secondary', text: true },
    accept: onAccept,
  });
}
