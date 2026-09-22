import React, { useState } from 'react';
import { FileCode, Check, Copy } from 'lucide-react';

export interface ExportModalProps {
  isOpen: boolean;
  title: string;
  content: string;
  accentColor: string;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  title,
  content,
  accentColor,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#14171e] border border-[#242934] rounded-lg shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#242934] bg-[#101217]">
          <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: accentColor }}>
            <FileCode className="w-4 h-4" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
        <pre className="p-4 bg-[#090b0e] text-slate-200 text-xs overflow-auto max-h-96 whitespace-pre font-mono-code">
          {content}
        </pre>
        <div className="flex items-center justify-between px-4 py-3 bg-[#11141b] border-t border-[#242934]">
          <span className="text-xs text-slate-500">Ready to copy into your project header</span>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs rounded font-bold text-black flex items-center gap-1.5 transition hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded bg-[#202530] hover:bg-[#2a3240] text-slate-200 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

