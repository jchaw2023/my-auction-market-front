import { Spin } from 'antd';

interface LoadingProps {
  size?: 'small' | 'default' | 'large';
  tip?: string;
  fullScreen?: boolean;
}

export default function Loading({ size = 'large', tip = 'Loading...', fullScreen = false }: LoadingProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
        <Spin size={size} tip={tip} />
      </div>
    );
  }

  // 使用嵌套模式来支持 tip 属性，或者不使用 tip
  return (
    <div className="flex items-center justify-center py-8">
      {tip ? (
        <Spin size={size} tip={tip}>
          <div style={{ minHeight: '200px' }} />
        </Spin>
      ) : (
        <Spin size={size} />
      )}
    </div>
  );
}

