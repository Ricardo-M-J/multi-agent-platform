import { useState } from 'react';
import { FileText, Code, Image, Database, Edit3, Save, RotateCcw } from 'lucide-react';
import type { Artifact } from '../../types';

interface OutputPreviewProps {
  artifact: Artifact | null;
  onContentChange?: (content: string) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  text: <FileText size={14} />,
  code: <Code size={14} />,
  image: <Image size={14} />,
  document: <FileText size={14} />,
  data: <Database size={14} />,
};

const typeLabels: Record<string, string> = {
  text: '文本',
  code: '代码',
  image: '图片',
  document: '文档',
  data: '数据',
};

export function OutputPreview({ artifact, onContentChange }: OutputPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  if (!artifact) {
    return (
      <div className="output-preview empty">
        <FileText size={32} />
        <p>选择产出物查看内容</p>
      </div>
    );
  }

  const handleEdit = () => {
    setEditContent(artifact.content);
    setIsEditing(true);
  };

  const handleSave = () => {
    onContentChange?.(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <div className="output-preview">
      <div className="preview-header">
        <div className="preview-info">
          <span className="artifact-type-icon">{typeIcons[artifact.type]}</span>
          <div>
            <div className="artifact-name">{artifact.name}</div>
            <div className="artifact-meta">
              <span className="artifact-type">{typeLabels[artifact.type]}</span>
              <span className="artifact-version">v{artifact.version}</span>
              {artifact.approved && <span className="artifact-approved">已审核</span>}
            </div>
          </div>
        </div>
        <div className="preview-actions">
          {!isEditing ? (
            <button className="btn-icon" onClick={handleEdit} title="编辑">
              <Edit3 size={14} />
            </button>
          ) : (
            <>
              <button className="btn-icon btn-save" onClick={handleSave} title="保存">
                <Save size={14} />
              </button>
              <button className="btn-icon" onClick={handleCancel} title="取消">
                <RotateCcw size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="preview-content">
        {isEditing ? (
          <textarea
            className="content-editor"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            autoFocus
          />
        ) : (
          <pre className="content-display">
            {artifact.type === 'code' ? (
              <code>{artifact.content}</code>
            ) : (
              artifact.content
            )}
          </pre>
        )}
      </div>
    </div>
  );
}

export default OutputPreview;
