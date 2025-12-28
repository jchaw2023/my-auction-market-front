import { useState, useEffect, useRef } from 'react';
import { Card, Descriptions, Statistic, Row, Col, message, Form, Input, Button, Space } from 'antd';
import { EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWalletStore } from '@/store/walletStore';
import { formatAddress } from '@/utils/format';
import { userApi } from '@/services/api';
import { User } from '@/types';
import Loading from '@/components/Common/Loading';
import './Profile.css';

export default function Profile() {
  const { t } = useTranslation();
  const { address, user, setUser, token } = useWalletStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<User | null>(user);
  const hasFetchedRef = useRef(false);
  const [editingField, setEditingField] = useState<'username' | 'email' | null>(null);

  // 获取平台统计数据
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => userApi.getPlatformStats(),
    staleTime: 60000, // 1分钟缓存
    refetchInterval: 60000, // 每分钟自动刷新
  });

  // 更新用户信息 mutation
  const updateProfileMutation = useMutation({
    mutationFn: (payload: { username?: string; email?: string }) => userApi.updateProfile(payload),
    onSuccess: (response) => {
      if (response.success && response.data) {
        const userData: User = {
          id: response.data.id,
          username: response.data.username,
          email: response.data.email,
          walletAddress: response.data.walletAddress,
        };
        setProfileData(userData);
        setUser(userData); // 更新 store 中的用户信息
        setEditingField(null);
        form.resetFields();
        message.success(t('profile.updateSuccess', { defaultValue: '更新成功' }));
      }
    },
    onError: (error: any) => {
      message.error(error.message || t('profile.updateFailed', { defaultValue: '更新失败' }));
    },
  });

  useEffect(() => {
    // 当 token 变化时，重置获取标志
    hasFetchedRef.current = false;
  }, [token]);

  useEffect(() => {
    // 如果有 token 且还没有获取过数据，则从 API 获取最新的用户信息
    if (token && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      setLoading(true);
      userApi.getProfile()
        .then((response) => {
          if (response.success && response.data) {
            const userData: User = {
              id: response.data.id,
              username: response.data.username,
              email: response.data.email,
              walletAddress: response.data.walletAddress,
            };
            setProfileData(userData);
            setUser(userData); // 更新 store 中的用户信息
          }
        })
        .catch((error: any) => {
          console.error('Failed to fetch user profile:', error);
          message.error(error.message || t('profile.fetchError'));
          // 如果 API 调用失败，使用 store 中的现有数据
          if (user) {
            setProfileData(user);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (!token && user) {
      // 如果没有 token 但有 user 数据，使用现有的 user 数据
      setProfileData(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, setUser, t]); // 只依赖 token，不依赖 user 以避免循环

  if (!profileData && !user) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <p>{t('profile.pleaseConnectWallet')}</p>
      </div>
    );
  }

  if (loading) {
    return <Loading fullScreen />;
  }

  const displayUser = profileData || user;

  // 处理编辑字段
  const handleEdit = (field: 'username' | 'email') => {
    setEditingField(field);
    form.setFieldsValue({
      [field]: displayUser?.[field] || '',
    });
  };

  // 处理保存
  const handleSave = async (field: 'username' | 'email') => {
    try {
      const values = await form.validateFields([field]);
      const payload: { username?: string; email?: string } = {};
      if (field === 'username') {
        payload.username = values.username;
      } else if (field === 'email') {
        payload.email = values.email;
      }
      updateProfileMutation.mutate(payload);
    } catch (error) {
      // 验证失败，不处理
    }
  };

  // 处理取消
  const handleCancel = () => {
    setEditingField(null);
    form.resetFields();
  };

  return (
    <div className="profile-page">
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title={t('profile.accountInfo')}>
            <Form form={form} layout="vertical">
              <Descriptions column={1}>
                <Descriptions.Item label={t('profile.username')}>
                  {editingField === 'username' ? (
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item
                        name="username"
                        rules={[
                          { required: true, message: t('profile.usernameRequired', { defaultValue: '请输入用户名' }) },
                          { min: 1, max: 64, message: t('profile.usernameLength', { defaultValue: '用户名长度为1-64个字符' }) },
                        ]}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Input />
                      </Form.Item>
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={() => handleSave('username')}
                        loading={updateProfileMutation.isPending}
                        style={{ marginLeft: 8 }}
                      />
                      <Button
                        icon={<CloseOutlined />}
                        onClick={handleCancel}
                        disabled={updateProfileMutation.isPending}
                        style={{ marginLeft: 4 }}
                      />
                    </Space.Compact>
                  ) : (
                    <Space>
                      <span>{displayUser?.username || '-'}</span>
                      <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit('username')}
                        size="small"
                      />
                    </Space>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t('profile.email')}>
                  {editingField === 'email' ? (
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item
                        name="email"
                        rules={[
                          { required: true, message: t('profile.emailRequired', { defaultValue: '请输入邮箱' }) },
                          { type: 'email', message: t('profile.emailInvalid', { defaultValue: '请输入有效的邮箱地址' }) },
                        ]}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Input type="email" />
                      </Form.Item>
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        onClick={() => handleSave('email')}
                        loading={updateProfileMutation.isPending}
                        style={{ marginLeft: 8 }}
                      />
                      <Button
                        icon={<CloseOutlined />}
                        onClick={handleCancel}
                        disabled={updateProfileMutation.isPending}
                        style={{ marginLeft: 4 }}
                      />
                    </Space.Compact>
                  ) : (
                    <Space>
                      <span>{displayUser?.email || '-'}</span>
                      <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit('email')}
                        size="small"
                      />
                    </Space>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t('wallet.walletAddress')}>
                  {formatAddress(address || displayUser?.walletAddress || '', 8)}
                </Descriptions.Item>
              </Descriptions>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={t('profile.statistics')}>
            <Statistic 
              title={t('profile.totalUsers', { defaultValue: '总用户数' })} 
              value={statsLoading ? '...' : (statsData?.data?.totalUsers || 0)} 
            />
            <Statistic 
              title={t('profile.totalAuctions')} 
              value={statsLoading ? '...' : (statsData?.data?.totalAuctions || 0)} 
              style={{ marginTop: 16 }} 
            />
            <Statistic 
              title={t('profile.totalBids')} 
              value={statsLoading ? '...' : (statsData?.data?.totalBids || 0)} 
              style={{ marginTop: 16 }} 
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

