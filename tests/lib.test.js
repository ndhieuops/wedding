import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeLunar, solarToLunar } from '../server/lib/lunar.js';
import { asciiLine, isValidSlug, nameKey, shortName, slugify, stripDiacritics, titleCaseName } from '../server/lib/text.js';
import { buildVietQrPayload, crc16, vietQrSvg } from '../server/lib/vietqr.js';
import { buildIcs } from '../server/lib/ics.js';
import { createSignedToken, jsonForScript, verifySignedToken } from '../server/lib/security.js';
import { sniff } from '../server/lib/media.js';

describe('Âm lịch (lunar calendar)', () => {
  const cases = [
    ['2024-02-10', 1, 1, 2024, false, 'Giáp Thìn'], // Tết Giáp Thìn
    ['2025-01-29', 1, 1, 2025, false, 'Ất Tỵ'],
    ['2026-02-17', 1, 1, 2026, false, 'Bính Ngọ'],
    ['2027-02-06', 1, 1, 2027, false, 'Đinh Mùi'],
    ['2023-03-22', 1, 2, 2023, true, 'Quý Mão'], // tháng 2 nhuận
    ['2025-07-25', 1, 6, 2025, true, 'Ất Tỵ'], // tháng 6 nhuận
    ['2026-12-20', 12, 11, 2026, false, 'Bính Ngọ'],
    ['1985-02-20', 1, 2, 1985, false, 'Ất Sửu'], // VN Tết 1985 differs from China (UTC+7 vs +8)
  ];
  for (const [iso, d, m, y, leap, canChi] of cases) {
    it(`${iso} → ${d}/${m}${leap ? ' nhuận' : ''}/${y} ${canChi}`, () => {
      const l = describeLunar(iso);
      assert.equal(l.day, d);
      assert.equal(l.month, m);
      assert.equal(l.year, y);
      assert.equal(l.leap, leap);
      assert.equal(l.canChi, canChi);
    });
  }
  it('returns null for invalid input', () => {
    assert.equal(describeLunar('2026-13-45'.replace('13-45', 'xx')), null);
    assert.equal(describeLunar(''), null);
    assert.equal(describeLunar(undefined), null);
  });
  it('day can-chi of Tết Giáp Thìn is Giáp Thìn', () => {
    assert.equal(describeLunar('2024-02-10').dayCanChi, 'Giáp Thìn');
    assert.equal(solarToLunar(10, 2, 2024).jd, 2460351);
  });
});

describe('Xử lý chữ tiếng Việt', () => {
  it('strips diacritics including đ/Đ', () => assert.equal(stripDiacritics('Đỗ Thị Hằng đẹp'), 'Do Thi Hang dep'));
  it('title-cases names and collapses spaces', () => assert.equal(titleCaseName('  nguyễn   VĂN\tminh '), 'Nguyễn Văn Minh'));
  it('normalises NFD input (macOS keyboards) to NFC', () => {
    const nfd = 'Hà'.normalize('NFD');
    assert.notEqual(nfd, 'Hà');
    assert.equal(titleCaseName(nfd), 'Hà');
  });
  it('short name is the last word', () => assert.equal(shortName('Trần Thị Thu Hà'), 'Hà'));
  it('slugify', () => {
    assert.equal(slugify('Minh & Hà — 20/12'), 'minh-ha-20-12');
    assert.equal(slugify('Đặng Đức'), 'dang-duc');
  });
  it('slug validation', () => {
    assert.ok(isValidSlug('minh-ha'));
    for (const bad of ['a', '-minh', 'minh-', 'Minh', 'minh--ha', 'admin', 'api', 'minh_ha', 'x'.repeat(61)]) assert.ok(!isValidSlug(bad), bad);
  });
  it('nameKey ignores case, spaces and accents', () => assert.equal(nameKey(' Lê  Văn A '), nameKey('le van a')));
  it('asciiLine keeps transfer notes bank-safe', () => assert.equal(asciiLine('Mừng cưới Minh & Hà!!', 25), 'Mung cuoi Minh Ha'));
});

describe('VietQR', () => {
  it('CRC-16/CCITT-FALSE check value', () => assert.equal(crc16('123456789'), '29B1'));
  it('builds a valid EMVCo payload', () => {
    const p = buildVietQrPayload({ bin: '970436', accountNumber: '0123456789', message: 'Mừng cưới Minh Hà' });
    assert.ok(p.startsWith('000201010211'));
    assert.ok(p.includes('0010A000000727'));
    assert.ok(p.includes('0006970436'));
    assert.ok(p.includes('01100123456789'));
    assert.ok(p.includes('0208QRIBFTTA'));
    assert.ok(p.includes('5303704') && p.includes('5802VN'));
    assert.ok(p.includes('Mung cuoi Minh Ha'));
    assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
  });
  it('rejects bad input', () => {
    assert.throws(() => buildVietQrPayload({ bin: '12', accountNumber: '0123456789' }));
    assert.throws(() => buildVietQrPayload({ bin: '970436', accountNumber: '12' }));
  });
  it('renders SVG or null', async () => {
    assert.match(await vietQrSvg({ bin: '970436', accountNumber: '0123456789' }), /^<svg/);
    assert.equal(await vietQrSvg({ bin: 'x', accountNumber: '1' }), null);
  });
});

describe('Bảo mật', () => {
  it('jsonForScript cannot break out of <script>', () => {
    const out = jsonForScript({ a: '</script><script>alert(1)</script>', b: ' ' });
    assert.ok(!out.includes('</script>'));
    assert.ok(!out.includes('<'));
    assert.deepEqual(JSON.parse(out), { a: '</script><script>alert(1)</script>', b: ' ' });
  });
  it('signed tokens verify, expire and resist tampering', () => {
    const t = createSignedToken({ role: 'admin' }, 'k'.repeat(32), 60);
    assert.equal(verifySignedToken(t, 'k'.repeat(32)).role, 'admin');
    assert.equal(verifySignedToken(t, 'x'.repeat(32)), null);
    assert.equal(verifySignedToken(t.replace(/^./, 'A'), 'k'.repeat(32)), null);
    assert.equal(verifySignedToken(createSignedToken({}, 'k'.repeat(32), -5), 'k'.repeat(32)), null);
  });
  it('sniffs real file types from magic bytes', () => {
    assert.equal(sniff(Buffer.from('89504e470d0a1a0a0000000d', 'hex')).mime, 'image/png');
    assert.equal(sniff(Buffer.from('ffd8ffe000104a4649460001', 'hex')).mime, 'image/jpeg');
    assert.equal(sniff(Buffer.from('ID3\u0004\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000', 'latin1')).kind, 'audio');
    assert.equal(sniff(Buffer.from('<?php echo 1; ?>   ')), null);
    assert.equal(sniff(Buffer.from('<svg xmlns="x"></svg>')), null);
  });
});

describe('ICS', () => {
  it('produces a valid calendar with UTC times', () => {
    const ics = buildIcs({ uid: 'x@y', title: 'Tiệc cưới, Minh & Hà', date: '2026-12-20', time: '17:30', tz: '+07:00', location: 'Hà Nội' });
    assert.match(ics, /DTSTART:20261220T103000Z/);
    assert.match(ics, /DTEND:20261220T133000Z/);
    assert.match(ics, /SUMMARY:Tiệc cưới\\, Minh & Hà/);
    assert.ok(ics.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
  });
  it('returns null for invalid dates', () => assert.equal(buildIcs({ uid: 'x', title: 't', date: 'nope' }), null));
});
