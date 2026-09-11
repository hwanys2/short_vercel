'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function exec(cmd, value) {
  document.execCommand(cmd, false, value);
}

function ToolbarButton({ onClick, title, active = false, children, disabled }) {
  return (
    <button
      type="button"
      className={`rte-btn${active ? ' is-active' : ''}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="rte-divider" aria-hidden="true" />;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '내용을 입력해주세요',
  disabled = false,
}) {
  const visualRef = useRef(null);
  const colorRef = useRef(null);
  const bgRef = useRef(null);
  const [view, setView] = useState('split'); // visual | html | split

  useEffect(() => {
    const el = visualRef.current;
    if (!el) return;
    if (el.innerHTML !== (value || '')) {
      el.innerHTML = value || '';
    }
  }, [value, view]);

  const emitFromVisual = useCallback(() => {
    const el = visualRef.current;
    if (el) onChange(el.innerHTML);
  }, [onChange]);

  const run = useCallback(
    (cmd, cmdValue) => {
      if (disabled) return;
      visualRef.current?.focus();
      exec(cmd, cmdValue);
      emitFromVisual();
    },
    [disabled, emitFromVisual]
  );

  const showVisual = view === 'visual' || view === 'split';
  const showHtml = view === 'html' || view === 'split';

  return (
    <div className={`rich-text-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="rte-toolbar">
        <div className="rte-view-tabs" role="tablist" aria-label="본문 보기">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'visual'}
            className={`rte-tab${view === 'visual' ? ' is-active' : ''}`}
            onClick={() => setView('visual')}
          >
            시각 편집
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'html'}
            className={`rte-tab${view === 'html' ? ' is-active' : ''}`}
            onClick={() => setView('html')}
          >
            HTML
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'split'}
            className={`rte-tab${view === 'split' ? ' is-active' : ''}`}
            onClick={() => setView('split')}
          >
            양쪽
          </button>
        </div>

        <Divider />

        <ToolbarButton disabled={disabled} onClick={() => run('formatBlock', '<H1>')} title="제목 1">
          H1
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('formatBlock', '<H2>')} title="제목 2">
          H2
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('formatBlock', '<H3>')} title="제목 3">
          H3
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('formatBlock', '<P>')} title="본문">
          P
        </ToolbarButton>
        <Divider />
        <ToolbarButton disabled={disabled} onClick={() => run('bold')} title="굵게">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('italic')} title="기울임">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('underline')} title="밑줄">
          <span style={{ textDecoration: 'underline' }}>U</span>
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('strikeThrough')} title="취소선">
          <s>S</s>
        </ToolbarButton>
        <Divider />
        <div className="rte-color-wrap">
          <ToolbarButton disabled={disabled} onClick={() => colorRef.current?.click()} title="글자 색">
            A
          </ToolbarButton>
          <input
            ref={colorRef}
            type="color"
            className="rte-color-input"
            onChange={(e) => run('foreColor', e.target.value)}
            disabled={disabled}
            tabIndex={-1}
          />
        </div>
        <div className="rte-color-wrap">
          <ToolbarButton disabled={disabled} onClick={() => bgRef.current?.click()} title="배경 색">
            ▮
          </ToolbarButton>
          <input
            ref={bgRef}
            type="color"
            className="rte-color-input"
            onChange={(e) => run('hiliteColor', e.target.value)}
            disabled={disabled}
            tabIndex={-1}
          />
        </div>
        <Divider />
        <ToolbarButton disabled={disabled} onClick={() => run('justifyLeft')} title="왼쪽 정렬">
          ⇤
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('justifyCenter')} title="가운데 정렬">
          ≡
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('justifyRight')} title="오른쪽 정렬">
          ⇥
        </ToolbarButton>
        <Divider />
        <ToolbarButton disabled={disabled} onClick={() => run('insertUnorderedList')} title="기호 목록">
          •
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('insertOrderedList')} title="번호 목록">
          1.
        </ToolbarButton>
        <ToolbarButton disabled={disabled} onClick={() => run('formatBlock', '<BLOCKQUOTE>')} title="인용">
          “
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          disabled={disabled}
          title="링크 삽입"
          onClick={() => {
            const url = window.prompt('링크 주소를 입력하세요 (https:// 포함)');
            if (!url) return;
            run('createLink', url);
          }}
        >
          링크
        </ToolbarButton>
        <ToolbarButton
          disabled={disabled}
          title="이미지 URL 삽입"
          onClick={() => {
            const url = window.prompt('이미지 주소를 입력하세요 (https:// 포함)');
            if (!url) return;
            run('insertImage', url);
          }}
        >
          이미지
        </ToolbarButton>
      </div>

      <p className="rte-hint">
        시각 편집과 HTML은 같은 본문입니다. 한쪽을 수정하면 다른 쪽에도 바로 반영됩니다.
      </p>

      <div className={`rte-panes rte-panes-${view}`}>
        {showVisual && (
          <div
            ref={visualRef}
            className="rte-visual"
            contentEditable={!disabled}
            suppressContentEditableWarning
            data-placeholder={placeholder}
            onInput={(e) => onChange(e.currentTarget.innerHTML)}
          />
        )}
        {showHtml && (
          <textarea
            className="rte-html"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            spellCheck={false}
            placeholder="<p>HTML을 직접 작성할 수 있습니다</p>"
            aria-label="메일 본문 HTML"
          />
        )}
      </div>
    </div>
  );
}
