export const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

export const URL_PATTERN = /\bhttps?:\/\/\S+\b|\bwww\.\S+\b|\blinkedin\.com\/\S+\b/gi;

export const PHONE_PATTERN = /(\+?\d[\d\-.\s()]{7,}\d)/g;

// Street-address-style lines: a house/building number followed by a street
// keyword, or a standalone 6-digit Indian PIN code.
export const ADDRESS_LINE_PATTERN =
  /^.*\b\d{1,5}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Lane|Ln\.?|Block|Sector|Marg|Nagar|Colony|Society|Apartments?|Enclave)\b.*$/gim;

export const PIN_CODE_PATTERN = /\b\d{6}\b(?=\D*$)/gm;

export const DOB_PATTERN =
  /\b(?:date of birth|dob)\s*[:\-]?\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/gi;

export const GENDER_FIELD_PATTERN =
  /\b(?:gender|sex)\s*[:\-]\s*(?:male|female|m|f|non-binary|nonbinary|other)\b/gi;
