/**
 * Vietnamese banks participating in NAPAS 247 / VietQR, keyed by short code.
 * `bin` is the 6-digit acquirer id embedded in VietQR payloads.
 * If a bank is missing, users can still pick "Khác" and type the BIN manually.
 */
export const BANKS = [
  { code: 'VCB', bin: '970436', name: 'Vietcombank' },
  { code: 'ICB', bin: '970415', name: 'VietinBank' },
  { code: 'BIDV', bin: '970418', name: 'BIDV' },
  { code: 'VBA', bin: '970405', name: 'Agribank' },
  { code: 'TCB', bin: '970407', name: 'Techcombank' },
  { code: 'MB', bin: '970422', name: 'MB Bank' },
  { code: 'ACB', bin: '970416', name: 'ACB' },
  { code: 'VPB', bin: '970432', name: 'VPBank' },
  { code: 'TPB', bin: '970423', name: 'TPBank' },
  { code: 'STB', bin: '970403', name: 'Sacombank' },
  { code: 'HDB', bin: '970437', name: 'HDBank' },
  { code: 'VIB', bin: '970441', name: 'VIB' },
  { code: 'SHB', bin: '970443', name: 'SHB' },
  { code: 'EIB', bin: '970431', name: 'Eximbank' },
  { code: 'MSB', bin: '970426', name: 'MSB' },
  { code: 'SEAB', bin: '970440', name: 'SeABank' },
  { code: 'OCB', bin: '970448', name: 'OCB' },
  { code: 'LPB', bin: '970449', name: 'LPBank' },
  { code: 'NAB', bin: '970428', name: 'Nam A Bank' },
  { code: 'BAB', bin: '970409', name: 'Bac A Bank' },
  { code: 'ABB', bin: '970425', name: 'ABBANK' },
  { code: 'PVCB', bin: '970412', name: 'PVcomBank' },
  { code: 'KLB', bin: '970452', name: 'KienlongBank' },
  { code: 'VAB', bin: '970427', name: 'VietABank' },
  { code: 'BVB', bin: '970438', name: 'BaoViet Bank' },
  { code: 'NCB', bin: '970419', name: 'NCB' },
  { code: 'SGICB', bin: '970400', name: 'Saigonbank' },
  { code: 'VCCB', bin: '970454', name: 'BVBank (Viet Capital)' },
  { code: 'VIETBANK', bin: '970433', name: 'VietBank' },
  { code: 'PGB', bin: '970430', name: 'PG Bank' },
  { code: 'GPB', bin: '970408', name: 'GPBank' },
  { code: 'SCB', bin: '970429', name: 'SCB' },
  { code: 'SHBVN', bin: '970424', name: 'Shinhan Bank' },
  { code: 'WVN', bin: '970457', name: 'Woori Bank' },
  { code: 'CAKE', bin: '546034', name: 'Cake by VPBank' },
  { code: 'UBANK', bin: '546035', name: 'Ubank by VPBank' },
  { code: 'TIMO', bin: '963388', name: 'Timo' },
];

const BY_CODE = new Map(BANKS.map((b) => [b.code, b]));
const BY_BIN = new Map(BANKS.map((b) => [b.bin, b]));

export function findBank({ code, bin } = {}) {
  return (code && BY_CODE.get(code)) || (bin && BY_BIN.get(bin)) || null;
}
