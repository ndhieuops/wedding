import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultRsvpDeadline, generateField, generateInvitation, GENERATABLE_FIELDS, todayIso } from '../server/lib/content-generator.js';
import { parseInvitationData, publishProblems, referencedAssetIds } from '../server/lib/schema.js';

describe('Bộ sinh nội dung', () => {
  const input = { groomName: 'nguyễn văn minh', brideName: 'TRẦN THU HÀ', date: '2030-12-20', time: '17:30', venue: 'Hoa Sen', address: 'Q1', tone: 'classic', seed: 7 };

  it('creates a complete, schema-valid invitation from just names', () => {
    const data = parseInvitationData(generateInvitation({ groomName: 'Minh', brideName: 'Hà' }));
    assert.equal(data.groom.fullName, 'Minh');
    assert.ok(data.content.invitation.length > 50);
    assert.ok(data.content.quote);
    assert.equal(data.story.length, 4);
    assert.ok(data.events.length >= 1);
  });

  it('normalises names and keeps short name derived (empty)', () => {
    const d = generateInvitation(input);
    assert.equal(d.groom.fullName, 'Nguyễn Văn Minh');
    assert.equal(d.bride.fullName, 'Trần Thu Hà');
    assert.equal(d.groom.shortName, '');
    assert.match(d.content.hashtag, /^#\w+/);
  });

  it('is deterministic per seed', () => {
    assert.deepEqual(generateInvitation(input).content, generateInvitation(input).content);
  });

  it('every tone and field produces text', () => {
    for (const tone of ['classic', 'romantic', 'modern', 'traditional']) {
      for (const field of GENERATABLE_FIELDS) {
        const v = generateField(field, { ...input, tone });
        assert.ok(v && (typeof v === 'string' ? v.length > 0 : true), `${tone}/${field}`);
        if (typeof v === 'string') assert.ok(!/\{[A-Z_]+\}/.test(v), `unfilled placeholder in ${tone}/${field}: ${v}`);
      }
    }
  });

  it('never sets an RSVP deadline in the past', () => {
    const now = Date.parse('2030-12-15T00:00:00Z');
    assert.equal(defaultRsvpDeadline('2030-12-20', now), '');
    assert.equal(defaultRsvpDeadline('2031-01-30', now), '2031-01-20');
    assert.equal(defaultRsvpDeadline('', now), '');
    assert.match(todayIso(), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects unknown fields', () => assert.throws(() => generateField('nope', input)));
});

describe('Schema dữ liệu thiệp', () => {
  it('fills every default from an empty object', () => {
    const d = parseInvitationData({});
    assert.equal(d.order, 'groom-first');
    assert.deepEqual(d.events, []);
    assert.equal(d.groom.fullName, '');
    assert.equal(d.rsvp.askGuests, true);
  });

  it('validates dates, times, colors, urls and lengths', () => {
    const bad = [
      { wedding: { date: '2026-02-30' } },
      { wedding: { time: '25:00' } },
      { theme: { colors: { primary: 'red' } } },
      { theme: { fonts: { heading: 'Comic Sans MS' } } },
      { music: { url: 'javascript:alert(1)' } },
      { events: [{ id: 'e1', mapUrl: 'data:text/html,hi' }] },
      { groom: { fullName: 'x'.repeat(81) } },
      { gallery: [{ id: 'g', image: { id: 'a', url: 'https://evil.example/x.png' } }] },
      { groom: { photo: { id: 'a', url: '/uploads/../../etc/passwd' } } },
      { events: Array.from({ length: 7 }, (_, i) => ({ id: `e${i}` })) },
      { gift: { accounts: [{ id: 'a', accountNumber: '12' }] } },
    ];
    for (const input of bad) assert.throws(() => parseInvitationData(input), JSON.stringify(input).slice(0, 80));
  });

  it('accepts valid data and trims/normalises text', () => {
    const d = parseInvitationData({
      groom: { fullName: '  Minh  ' },
      content: { invitation: 'a\r\n\r\n\r\n\r\nb' },
      theme: { colors: { primary: '#ABCDEF' } },
      music: { url: 'https://cdn.example.com/song.mp3' },
      sections: [{ key: 'hero', enabled: true }, { key: 'hero', enabled: false }, { key: 'gallery', enabled: false }],
    });
    assert.equal(d.groom.fullName, 'Minh');
    assert.equal(d.content.invitation, 'a\n\nb');
    assert.equal(d.theme.colors.primary, '#abcdef');
    assert.equal(d.sections.length, 2);
  });

  it('lists what is missing before publishing', () => {
    const p = publishProblems(parseInvitationData({ groom: { fullName: 'A' } }));
    assert.ok(p.includes('Chưa nhập tên cô dâu'));
    assert.ok(p.includes('Chưa chọn ngày cưới'));
    assert.ok(p.some((x) => x.includes('sự kiện')));
    assert.deepEqual(publishProblems(parseInvitationData(generateInvitation({ groomName: 'A', brideName: 'B', date: '2030-01-01', venue: 'X' }))), []);
  });

  it('collects referenced asset ids for garbage collection', () => {
    const ref = (id) => ({ id, url: `/uploads/inv/${id}.webp` });
    const d = parseInvitationData({ cover: { image: ref('c1') }, groom: { photo: ref('p1') }, gallery: [{ id: 'g', image: ref('g1') }], story: [{ id: 's', image: ref('s1') }] });
    assert.deepEqual([...referencedAssetIds(d)].sort(), ['c1', 'g1', 'p1', 's1']);
  });
});
