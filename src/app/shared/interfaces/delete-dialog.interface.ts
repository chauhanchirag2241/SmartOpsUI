export interface DeleteDialogData {
  /** Title of the dialog, e.g., "Delete student?" */
  title?: string;
  /** Main description text */
  description?: string;
  /** The name of the record being deleted */
  recordName: string;
  /** Metadata for the record (e.g., email, ID, class) */
  recordMeta: string;
  /** Initials for the avatar */
  initials: string;
  /** Optional warning message shown in the warning box */
  warningMessage?: string;
  /** Text for the confirm button (default: "Yes, delete") */
  confirmButtonText?: string;
  /** Text for the cancel button (default: "Cancel") */
  cancelButtonText?: string;
}
