import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/utils';
import {
  formatSaleQuantity,
  isWeightZero,
  parseWeightKg,
  roundWeightKg,
  splitWeightKg,
} from '@/lib/weight';
import { t } from '@/i18n';

const PRESETS = [0.5, 1, 1.2, 1.5, 2, 2.5];

type WeightEntryModalProps = {
  open: boolean;
  productName: string;
  pricePerKg: number;
  inCartKg: number;
  maxKg: number;
  onClose: () => void;
  onConfirm: (kg: number) => void;
};

export function WeightEntryModal({
  open,
  productName,
  pricePerKg,
  inCartKg,
  maxKg,
  onClose,
  onConfirm,
}: WeightEntryModalProps) {
  const [kgPart, setKgPart] = useState('');
  const [gramsPart, setGramsPart] = useState('');
  const isEditing = inCartKg > 0.001;

  useEffect(() => {
    if (!open) return;
    if (isEditing) {
      const { kg, grams } = splitWeightKg(inCartKg);
      setKgPart(kg);
      setGramsPart(grams);
    } else {
      setKgPart('');
      setGramsPart('');
    }
  }, [open, productName, inCartKg, isEditing]);

  const parsed = parseWeightKg(kgPart, gramsPart);
  const lineTotal = parsed != null ? roundWeightKg(parsed * pricePerKg) : null;
  const overStock = parsed != null && parsed > maxKg + 0.0001;

  const handlePreset = (kg: number) => {
    const whole = Math.floor(kg);
    const g = Math.round((kg - whole) * 1000);
    setKgPart(whole > 0 ? String(whole) : '');
    setGramsPart(g > 0 ? String(g) : whole === 0 ? String(Math.round(kg * 1000)) : '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed == null || overStock) return;
    onConfirm(parsed);
    onClose();
  };

  const title = isEditing ? t('orders.weightEditTitle') : t('orders.weightAddTitle');

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm font-medium">{productName}</p>
        <p className="text-xs text-slate-500">
          {t('orders.pricePerKg', { price: formatCurrency(pricePerKg) })}
          {' · '}
          {t('orders.weightAvailable', { n: formatSaleQuantity(maxKg, 'KG') })}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('orders.weightKg')}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={kgPart}
            onChange={(e) => setKgPart(e.target.value)}
            placeholder="0"
          />
          <Input
            label={t('orders.weightGrams')}
            type="number"
            min="0"
            max="999"
            step="1"
            inputMode="numeric"
            value={gramsPart}
            onChange={(e) => setGramsPart(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((kg) => (
            <Button key={kg} type="button" size="sm" variant="secondary" onClick={() => handlePreset(kg)}>
              {kg} кг
            </Button>
          ))}
        </div>

        {parsed != null && lineTotal != null && !isWeightZero(parsed) && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('orders.weightLineTotal', { total: formatCurrency(lineTotal) })}
          </p>
        )}
        {overStock && (
          <p className="text-sm text-red-600 dark:text-red-400">{t('orders.weightOverStock')}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={parsed == null || isWeightZero(parsed) || overStock}
          >
            {isEditing ? t('common.save') : t('orders.addToCart')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
