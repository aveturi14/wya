import { PaymentProvider } from './types';

const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

function isValidAbn(digits: string) {
  const sum = digits.split('').reduce((total, d, i) => total + ABN_WEIGHTS[i] * (Number(d) - (i === 0 ? 1 : 0)), 0);
  return sum % 89 === 0;
}

// Australian PayID: a mobile number, email or ABN linked to a bank account.
// Transfers are instant between most Australian banks, with no fees.
export const payid: PaymentProvider = {
  id: 'payid',
  label: 'PayID',
  inputLabel: 'Your PayID',
  placeholder: '0412 345 678 or you@email.com',
  help: 'The mobile number, email or ABN your bank has set up as a PayID.',

  normalize(raw) {
    const value = raw.trim();
    const digits = value.replace(/[\s\-()]/g, '');
    if (/^04\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
    if (/^\+614\d{8}$/.test(digits)) return digits;
    if (/^614\d{8}$/.test(digits)) return `+${digits}`;
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return value.toLowerCase();
    if (/^\d{11}$/.test(digits) && isValidAbn(digits)) return digits;
    return null;
  },

  format(value) {
    if (/^\+614\d{8}$/.test(value)) return `0${value.slice(3, 6)} ${value.slice(6, 9)} ${value.slice(9)}`;
    if (/^\d{11}$/.test(value)) return `${value.slice(0, 2)} ${value.slice(2, 5)} ${value.slice(5, 8)} ${value.slice(8)}`;
    return value;
  },

  instructions: ({ amount, reference, hostName }) => [
    `Open your banking app and choose Pay → PayID.`,
    `Paste ${hostName}'s PayID and check the name matches.`,
    `Send ${amount} with ${reference} as the description.`,
  ],
};
