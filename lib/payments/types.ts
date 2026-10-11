// A way for one person to pay another directly (wya never holds the money).
// Each provider is one file; adding Venmo or PayPal later means adding a file
// and its id to the database's payment_methods.provider check.

export type ProviderId = 'payid';

export type PaymentProvider = {
  id: ProviderId;
  label: string; // "PayID"
  inputLabel: string; // field label in "Get paid"
  placeholder: string;
  help: string; // one line under the field
  // Must match the database's private.normalize_payid; returns null if invalid
  normalize: (raw: string) => string | null;
  format: (value: string) => string; // for display, e.g. "+61 412 345 678"
  // Steps shown on the "You owe" card
  instructions: (p: { amount: string; reference: string; hostName: string }) => string[];
  // A link that opens a payment app, where one exists (PayID has none)
  deepLink?: (p: { value: string; amountCents: number; reference: string }) => string | null;
};
