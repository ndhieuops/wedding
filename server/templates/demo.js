import { generateInvitation, shiftDate, todayIso } from '../lib/content-generator.js';
import { parseInvitationData } from '../lib/schema.js';

const demoImage = (name, w, h) => ({ id: name, url: `/t/_shared/demo/${name}.webp`, thumb: `/t/_shared/demo/${name}-thumb.webp`, w, h });

/**
 * Sample invitation used for template demos (/templates/:id) and template previews.
 * The wedding date is always ~4 months ahead so the countdown is alive.
 */
export function demoInvitation(template, { overrides = {} } = {}) {
  const date = shiftDate(todayIso(), 120);
  const generated = generateInvitation({
    groomName: 'Nguyễn Minh Anh',
    brideName: 'Trần Thu Hà',
    date,
    time: '17:30',
    venue: 'Trung tâm Hội nghị Tiệc cưới White Palace',
    address: '194 Hoàng Văn Thụ, Phường 9, Phú Nhuận, TP. Hồ Chí Minh',
    groomAddress: '25 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    tone: template.defaults.tone,
    seed: 1,
  });

  // Schema parsing fills every default; demo pictures live in templates/_shared/demo and
  // are attached afterwards because user data may only reference /uploads.
  const data = parseInvitationData({
    ...generated,
    groom: { ...generated.groom, father: 'Nguyễn Văn Hùng', mother: 'Lê Thị Mai' },
    bride: { ...generated.bride, father: 'Trần Quốc Bảo', mother: 'Phạm Thị Lan', address: '12 Nguyễn Trãi, Phường 2, Quận 5, TP. Hồ Chí Minh' },
    gift: {
      accounts: [
        { id: 'acc1', owner: 'groom', bankCode: 'VCB', accountNumber: '0123456789', accountName: 'NGUYEN MINH ANH' },
        { id: 'acc2', owner: 'bride', bankCode: 'TCB', accountNumber: '19031234567890', accountName: 'TRAN THU HA' },
      ],
    },
    music: { enabled: false },
    ...overrides,
  });

  data.groom.photo = demoImage('groom', 800, 1000);
  data.bride.photo = demoImage('bride', 800, 1000);
  data.story = data.story.map((s, i) => ({ ...s, date: ['Mùa thu 2019', 'Tháng 2/2020', 'Tháng 12/2024', 'Hôm nay'][i] || '', image: i === 2 ? demoImage('rings', 900, 900) : null }));
  data.gallery = [
    ['couple-sunset', 900, 1200, 'Hoàng hôn của riêng mình'],
    ['rings', 900, 900, 'Nhẫn cưới'],
    ['bouquet', 900, 1100, 'Bó hoa cô dâu'],
    ['couple-arch', 900, 1200, 'Dưới cổng hoa'],
    ['toast', 900, 1100, 'Nâng ly chúc mừng'],
    ['cake', 900, 1100, 'Bánh cưới'],
  ].map(([name, w, h, caption], i) => ({ id: `g${i}`, image: demoImage(name, w, h), caption }));

  return {
    id: 'demo',
    slug: '',
    templateId: template.id,
    status: 'published',
    data,
  };
}

export const DEMO_WISHES = [
  { id: 1, name: 'Hoàng Lan', message: 'Chúc hai bạn trăm năm hạnh phúc, sớm có thiên thần nhỏ nhé! 💕' },
  { id: 2, name: 'Đức Thịnh', message: 'Happy wedding! Chúc vợ chồng son luôn yêu thương nhau như ngày đầu.' },
  { id: 3, name: 'Gia đình chú Tư', message: 'Chúc mừng hạnh phúc hai cháu. Bách niên giai lão!' },
];
