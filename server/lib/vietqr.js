import QRCode from 'qrcode';
import { asciiLine } from './text.js';

/**
 * Build a VietQR (NAPAS 247, EMVCo-compliant) payload for a bank account transfer.
 * Generated fully offline — no third-party QR service is called.
 */

function tlv(id, value) {
  const v = String(value);
  return `${id}${String(v.length).padStart(2, '0')}${v}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as required by EMVCo tag 63. */
export function crc16(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildVietQrPayload({ bin, accountNumber, amount, message }) {
  if (!/^\d{6}$/.test(bin || '')) throw new Error('BIN ngân hàng không hợp lệ');
  if (!/^[0-9A-Za-z]{4,19}$/.test(accountNumber || '')) throw new Error('Số tài khoản không hợp lệ');

  const beneficiary = tlv('00', bin) + tlv('01', accountNumber);
  const merchantInfo = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  const amountValue = Number.isFinite(amount) && amount > 0 ? String(Math.round(amount)) : '';
  const note = asciiLine(message || '', 25);

  let payload =
    tlv('00', '01') +
    tlv('01', amountValue ? '12' : '11') +
    tlv('38', merchantInfo) +
    tlv('53', '704') +
    (amountValue ? tlv('54', amountValue) : '') +
    tlv('58', 'VN') +
    (note ? tlv('62', tlv('08', note)) : '');
  payload += '6304';
  return payload + crc16(payload);
}

/** Inline SVG markup for a VietQR code, or null when the account info is incomplete/invalid. */
export async function vietQrSvg(opts) {
  try {
    const payload = buildVietQrPayload(opts);
    return await QRCode.toString(payload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
  } catch {
    return null;
  }
}
