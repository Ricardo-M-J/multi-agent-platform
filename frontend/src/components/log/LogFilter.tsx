import { Filter, X } from 'lucide-react';
import { useEventStore } from '../../store/eventStore';

const levelOptions = [
  { value: '', label: '全部级别' },
  { value: 'info', label: '信息' },
  { value: 'warn', label: '警告' },
  { value: 'error', label: '错误' },
  { value: 'debug', label: '调试' },
];

/**
 * 日志过滤器组件
 */
export function LogFilter() {
  const { filters, setFilterLevel, setFilterSource, setFilterSearch } =
    useEventStore();

  const hasFilters = filters.level || filters.source || filters.search;

  const clearFilters = () => {
    setFilterLevel(null);
    setFilterSource(null);
    setFilterSearch('');
  };

  return (
    <div className="log-filter">
      <div className="filter-row">
        <Filter size={14} className="filter-icon" />

        <select
          className="filter-select"
          value={filters.level || ''}
          onChange={(e) => setFilterLevel(e.target.value || null)}
        >
          {levelOptions.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          className="filter-search"
          type="text"
          placeholder="搜索事件..."
          value={filters.search}
          onChange={(e) => setFilterSearch(e.target.value)}
        />

        {hasFilters && (
          <button className="btn-icon filter-clear" onClick={clearFilters} title="清除筛选">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export default LogFilter;
