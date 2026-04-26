import { useEffect, useRef } from 'react';
import { useEventStore } from '../../store/eventStore';

const levelColors: Record<string, string> = {
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
  debug: '#6b7280',
};

const levelLabels: Record<string, string> = {
  info: '信息',
  warn: '警告',
  error: '错误',
  debug: '调试',
};

/**
 * 实时事件日志列表
 */
export function EventLog() {
  const { autoScroll, getFilteredEvents } = useEventStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredEvents = getFilteredEvents();

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEvents.length, autoScroll]);

  return (
    <div className="event-log">
      <div className="event-log-list" ref={scrollRef}>
        {filteredEvents.length === 0 ? (
          <div className="event-log-empty">暂无事件记录</div>
        ) : (
          filteredEvents.map((event) => {
            const level = event.event_level || 'info';
            const time = event.created_at || event.timestamp || '';
            const content = event.content || event.message || '';
            const source = event.agent_name || event.source || '';

            return (
              <div key={event.id} className={`event-item level-${level}`}>
                <div className="event-item-header">
                  <span
                    className="event-level"
                    style={{ color: levelColors[level] || '#94a3b8' }}
                  >
                    [{levelLabels[level] || level}]
                  </span>
                  {source && <span className="event-source">{source}</span>}
                  <span className="event-time">
                    {time ? new Date(time).toLocaleTimeString('zh-CN') : ''}
                  </span>
                </div>
                <div className="event-message">{content}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default EventLog;
