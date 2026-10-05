import { EN_FREQUENCIES, UK_FREQUENCIES, getFrequencyTable } from '@shiftcrack/shared';

/**
 * Letter-frequency tables are the single source of truth in
 * `@shiftcrack/shared` (the web client renders the same numbers in its
 * reference table); this module re-exports them under the server-side name.
 */
export { EN_FREQUENCIES, UK_FREQUENCIES, getFrequencyTable };
