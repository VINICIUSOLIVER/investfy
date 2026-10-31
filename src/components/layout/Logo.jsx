import { TrendingUp } from 'lucide-react';

export function Logo({ size = 'md' }) {
  const big = size === 'lg';
  return (
    <div className="flex items-center gap-2">
      <span className={`flex items-center justify-center rounded-lg bg-blue-600 text-white ${big ? 'size-9' : 'size-7'}`}>
        <TrendingUp className={big ? 'size-5' : 'size-4'} />
      </span>
      <span className={`font-semibold tracking-tight text-slate-900 ${big ? 'text-xl' : 'text-base'}`}>Investfy</span>
    </div>
  );
}
