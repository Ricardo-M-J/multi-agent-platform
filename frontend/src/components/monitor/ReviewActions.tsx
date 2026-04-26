import { useState } from 'react';
import { CheckCircle, XCircle, Pencil, RotateCcw, Send } from 'lucide-react';
import type { TaskReviewRequest } from '../../types';

interface ReviewActionsProps {
  taskId: string;
  projectId: string;
  onReview: (projectId: string, taskId: string, data: TaskReviewRequest) => Promise<void>;
  disabled?: boolean;
}

export function ReviewActions({
  taskId,
  projectId,
  onReview,
  disabled = false,
}: ReviewActionsProps) {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (action: TaskReviewRequest['action']) => {
    setIsSubmitting(true);
    try {
      await onReview(projectId, taskId, {
        action,
        comment: comment || undefined,
      });
      setComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="review-actions">
      <div className="review-buttons">
        <button
          className="btn btn-approve"
          onClick={() => handleAction('approve')}
          disabled={disabled || isSubmitting}
          title="通过"
        >
          <CheckCircle size={16} />
          <span>通过</span>
        </button>

        <button
          className="btn btn-reject"
          onClick={() => handleAction('reject')}
          disabled={disabled || isSubmitting}
          title="拒绝"
        >
          <XCircle size={16} />
          <span>拒绝</span>
        </button>

        <button
          className="btn btn-modify"
          onClick={() => handleAction('modify')}
          disabled={disabled || isSubmitting}
          title="修改后继续"
        >
          <Pencil size={16} />
          <span>修改</span>
        </button>

        <button
          className="btn btn-retry"
          onClick={() => handleAction('retry')}
          disabled={disabled || isSubmitting}
          title="重试"
        >
          <RotateCcw size={16} />
          <span>重试</span>
        </button>
      </div>

      <div className="review-comment">
        <textarea
          className="comment-input"
          placeholder="添加审核备注..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          disabled={disabled || isSubmitting}
        />
        <button
          className="btn btn-comment"
          onClick={() => handleAction('approve')}
          disabled={disabled || isSubmitting || !comment.trim()}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

export default ReviewActions;
