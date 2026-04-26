import { useEffect, useRef } from 'react';
import { useEventStore } from '../../store/eventStore';
import type { EventLevel, EventSource } from '../../types';

const levelColors: Record<EventLevel, string> = {
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
  debug: '#6b7280',
};

const levelLabels: Record<EventLevel, string> = {
  info: '信息',
  warn: '警告',
  error: '错误',
  debug: '调试',
};

const sourceLabels: Record<EventSource, string> = {
  system: '系统',
  agent: '智能体',
  task: '任务',
  human: '人工',
};

/**
 * 实时事件日志列表
 */
export function EventLog() {
  const { autoScroll, getFilteredEvents } = useEventStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredEvents = getFilteredEvents();

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEvents.length, autoScroll]);

  return (
    <div className="event-log">
      <div className="event-log-header">
        <h3 className="event-log-title">事件日志</h3>
        <span className="event-count">{filteredEvents.length} 条记录</span>
      </div>

      <div className="event-log-list" ref={scrollRef}>
        {filteredEvents.length === 0 ? (
          <div className="event-log-empty">暂无事件记录</div>
        ) : (
          filteredEvents.map((event) => (
            <div key={event.id} className={`event-item level-${event.level}`}>
              <div className="event-item-header">
                <span
                  className="event-level"
                  style={{ color: levelColors[event.level] }}
                >
                  [{levelLabels[event.level]}]
                </span>
                <span className="event-source">
                  {sourceLabels[event.source]}
                </span>
                <span className="event-time">
                  {new Date(event.timestamp).toLocaleTimeString('zh-CN')}
                </span>
              </div>
              <div className="event-message">{event.message}</div>
              {event.source_id && (
                <div className="event-source-id">
                  ID: {event.source_id.slice(0, 12)}...
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EventLog;
