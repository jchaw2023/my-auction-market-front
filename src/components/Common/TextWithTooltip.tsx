import React from 'react';
import { Tooltip } from 'antd';

interface TextWithTooltipProps {
  /**
   * 要显示的文本内容
   */
  text: string | number | null | undefined;
  
  /**
   * 最大宽度（可选，默认不限制）
   */
  maxWidth?: number | string;
  
  /**
   * 是否显示 tooltip（可选，默认当文本被截断时显示）
   */
  showTooltip?: boolean;
  
  /**
   * Tooltip 的标题（可选，默认使用 text）
   */
  tooltipTitle?: React.ReactNode;
  
  /**
   * 自定义样式
   */
  style?: React.CSSProperties;
  
  /**
   * 自定义类名
   */
  className?: string;
  
  /**
   * 子元素（如果提供，将包裹子元素而不是文本）
   */
  children?: React.ReactNode;
}

/**
 * 带 Tooltip 的文本组件
 * 当文本过长被截断时，鼠标悬浮会显示完整内容
 */
const TextWithTooltip: React.FC<TextWithTooltipProps> = ({
  text,
  maxWidth,
  showTooltip,
  tooltipTitle,
  style,
  className,
  children,
}) => {
  const displayText = text !== null && text !== undefined ? String(text) : '';
  const tooltipContent = tooltipTitle !== undefined ? tooltipTitle : displayText;
  
  // 如果提供了 children，包裹 children
  if (children !== undefined) {
    return (
      <Tooltip title={showTooltip !== false ? tooltipContent : undefined}>
        <span
          style={{
            ...style,
            ...(maxWidth ? { maxWidth, display: 'inline-block' } : {}),
          }}
          className={className}
        >
          {children}
        </span>
      </Tooltip>
    );
  }
  
  // 默认显示文本
  const textStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    ...(maxWidth ? { maxWidth, display: 'inline-block' } : {}),
    ...style,
  };
  
  return (
    <Tooltip title={showTooltip !== false ? tooltipContent : undefined}>
      <span style={textStyle} className={className}>
        {displayText}
      </span>
    </Tooltip>
  );
};

export default TextWithTooltip;

