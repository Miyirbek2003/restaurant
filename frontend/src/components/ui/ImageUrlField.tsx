import { useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MenuImage } from '@/components/ui/MenuImage';
import { uploadMenuImage } from '@/lib/uploadImage';
import { useRestaurantId } from '@/contexts/AuthContext';
import { t } from '@/i18n';

type ImageUrlFieldProps = {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  previewAlt: string;
};

export function ImageUrlField({ label, value, onChange, previewAlt }: ImageUrlFieldProps) {
  const restaurantId = useRestaurantId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || !restaurantId) return;
    setUploading(true);
    try {
      const url = await uploadMenuImage(file, restaurantId);
      onChange(url);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <MenuImage src={value} alt={previewAlt} size="lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            label={label ?? t('common.image')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('common.imagePlaceholder')}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {t('common.uploadImage')}
          </Button>
        </div>
      </div>
    </div>
  );
}
