import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useResourceList } from '@/hooks/useResource';
import { formatCurrency } from '@/lib/utils';

type TableName = 'customers' | 'suppliers' | 'expenses' | 'discounts';

interface ResourceListPageProps {
  table: TableName;
  title: string;
  fields: string[];
}

export function ResourceListPage({ table, title, fields }: ResourceListPageProps) {
  const { data, isLoading } = useResourceList<Record<string, unknown>>(table);

  const formatValue = (key: string, value: unknown) => {
    if (key === 'amount') return formatCurrency(Number(value));
    if (key === 'is_active') return value ? 'Yes' : 'No';
    if (key === 'loyalty_points') return `${value} pts`;
    return String(value ?? '—');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState title={`No ${title.toLowerCase()}`} />
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <Card key={String(item.id)}>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                {fields.map((field) => (
                  <div key={field}>
                    <p className="text-xs uppercase text-slate-500">{field.replace('_', ' ')}</p>
                    <p className="font-medium">{formatValue(field, item[field])}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
