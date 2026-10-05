import { Group, ItemToolbar, Select, TextField, Toggle } from '../components/fields.jsx';
import { moveItem, uid } from '../util.js';

export function GiftPanel({ data, update, meta, sectionEnabled, setSectionEnabled }) {
  const accounts = data.gift.accounts;
  const set = (list) => update('gift.accounts', list);
  const bankOptions = [{ value: '', label: '— Chọn ngân hàng —' }, ...meta.banks.map((b) => ({ value: b.code, label: b.name })), { value: 'OTHER', label: 'Ngân hàng khác (nhập BIN)' }];

  return (
    <>
      <Group>
        <Toggle label="Hiện hộp mừng cưới" hint="Khách có thể quét mã VietQR để chuyển khoản." checked={sectionEnabled('gift')} onChange={(v) => setSectionEnabled('gift', v)} />
      </Group>
      {accounts.map((a, i) => {
        const bankValue = a.bankCode || (a.bankBin ? 'OTHER' : '');
        return (
          <Group key={a.id} title={a.label || (a.owner === 'groom' ? 'Mừng cưới chú rể' : a.owner === 'bride' ? 'Mừng cưới cô dâu' : `Tài khoản ${i + 1}`)} actions={<ItemToolbar index={i} total={accounts.length} onMove={(x, y) => set(moveItem(accounts, x, y))} onRemove={(idx) => set(accounts.filter((_, j) => j !== idx))} />}>
            <div class="row">
              <Select label="Của" value={a.owner} onChange={(v) => update(`gift.accounts.${i}.owner`, v)} options={[{ value: 'groom', label: 'Chú rể' }, { value: 'bride', label: 'Cô dâu' }, { value: 'other', label: 'Khác' }]} />
              <TextField label="Nhãn (tuỳ chọn)" placeholder="Mừng cưới chú rể" value={a.label} maxLength={60} onInput={(v) => update(`gift.accounts.${i}.label`, v)} />
            </div>
            <Select
              label="Ngân hàng"
              value={bankValue}
              onChange={(v) => update(`gift.accounts.${i}`, { ...a, bankCode: v === 'OTHER' ? '' : v, bankBin: v === 'OTHER' ? a.bankBin : '', bankName: v === 'OTHER' ? a.bankName : '' })}
              options={bankOptions}
            />
            {bankValue === 'OTHER' && (
              <div class="row">
                <TextField label="Tên ngân hàng" value={a.bankName} maxLength={60} onInput={(v) => update(`gift.accounts.${i}.bankName`, v)} />
                <TextField label="Mã BIN (6 số)" value={a.bankBin} maxLength={6} inputMode="numeric" onInput={(v) => update(`gift.accounts.${i}.bankBin`, v.replace(/\D/g, ''))} />
              </div>
            )}
            <TextField label="Số tài khoản" value={a.accountNumber} maxLength={19} inputMode="numeric" onInput={(v) => update(`gift.accounts.${i}.accountNumber`, v.replace(/[^0-9A-Za-z]/g, ''))} />
            <TextField label="Tên chủ tài khoản" placeholder="NGUYEN VAN MINH" value={a.accountName} maxLength={60} onInput={(v) => update(`gift.accounts.${i}.accountName`, v.toUpperCase())} />
            <Toggle label="Hiện mã QR chuyển khoản (VietQR)" hint="Hãy quét thử bằng app ngân hàng trước khi gửi thiệp." checked={a.showQr} onChange={(v) => update(`gift.accounts.${i}.showQr`, v)} />
          </Group>
        );
      })}
      <button
        type="button"
        class="btn btn--block btn--dashed"
        disabled={accounts.length >= 4}
        onClick={() => {
          set([...accounts, { id: uid(), owner: accounts.some((x) => x.owner === 'groom') ? 'bride' : 'groom', label: '', bankCode: '', bankBin: '', bankName: '', accountNumber: '', accountName: '', showQr: true }]);
          if (!sectionEnabled('gift')) setSectionEnabled('gift', true);
        }}
      >
        + Thêm tài khoản
      </button>
    </>
  );
}
