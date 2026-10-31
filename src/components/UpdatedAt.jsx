import { time } from '../lib/format';
import { Spinner } from './ui';

/** "Atualizado às HH:MM" + indicador de atualização em segundo plano. */
export function UpdatedAt({ query }) {
  if (!query.dataUpdatedAt) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      · Atualizado às {time(query.dataUpdatedAt)}
      {query.isFetching && <Spinner className="size-3" />}
    </span>
  );
}
