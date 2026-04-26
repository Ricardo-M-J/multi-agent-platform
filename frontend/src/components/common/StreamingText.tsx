import { useEffect, useRef } from 'react';

interface StreamingTextProps {
  /** 文本内容 */
  text: string;
  /** 是否正在流式传输 */
  isStreaming?: boolean;
  /** 最大高度 */
  maxHeight?: string;
  /** 自定义类名 */
  className?: string;
}

/**
 * 流式文本渲染组件
 * 支持自动滚动到底部、闪烁光标效果
 */
export function StreamingText({
  text,
  isStreaming = false,
  maxHeight = '400px',
  className = '',
}: StreamingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`streaming-text ${className}`}
      style={{
        maxHeight,
        overflowY: 'auto',
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        fontSize: '13px',
        lineHeight: '1.6',
        color: '#e2e8f0',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {text || (
        <span style={{ color: '#64748b' }}>等待输出...</span>
      )}
      {isStreaming && (
        <span
          className="streaming-cursor"
          style={{
            display: 'inline-block',
            width: '2px',
            height: '16px',
            backgroundColor: '#22c55e',
            marginLeft: '2px',
            verticalAlign: 'text-bottom',
            animation: 'blink 1s infinite',
          }}
        />
      )}
    </div>
  );
}

export default StreamingText;
