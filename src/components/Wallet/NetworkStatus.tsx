import { Alert, Button } from 'antd';
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNetwork } from '@/hooks/useNetwork';

/**
 * 网络状态显示组件
 */
export default function NetworkStatus() {
  const { isCorrect, currentNetworkName, targetNetworkName, isLoading, switchNetwork } = useNetwork();

  // 如果网络正确，不显示任何内容
  if (isCorrect || isLoading) {
    return null;
  }

  return (
    <Alert
      message="网络不匹配"
      description={
        <div>
          <p>
            当前网络: <strong>{currentNetworkName}</strong>
          </p>
          <p>
            需要切换到: <strong>{targetNetworkName}</strong>
          </p>
          <Button
            type="primary"
            size="small"
            onClick={switchNetwork}
            loading={isLoading}
            style={{ marginTop: 8 }}
          >
            切换到 {targetNetworkName}
          </Button>
        </div>
      }
      type="warning"
      icon={<WarningOutlined />}
      showIcon
      closable
      style={{ marginBottom: 16 }}
    />
  );
}

