import { useEffect, useRef, useState } from 'react';
import getWebSocketService, { MessageType, WebSocketMessage, ConnectionStatus } from '@/services/websocket';
import { message } from 'antd';
import { ethers } from 'ethers';

/**
 * WebSocket Hook
 * 用于在组件中方便地使用 WebSocket 服务
 */
export const useWebSocket = (autoConnect: boolean = true) => {
  const wsService = getWebSocketService();
  const [status, setStatus] = useState<ConnectionStatus>(wsService.getStatus());
  const handlersRef = useRef<Map<MessageType | null, Set<(msg: WebSocketMessage) => void>>>(new Map());

  // 更新连接状态
  useEffect(() => {
    const updateStatus = () => {
      setStatus(wsService.getStatus());
    };

    const unsubscribeOpen = wsService.onOpen(updateStatus);
    const unsubscribeClose = wsService.onClose(updateStatus);
    const unsubscribeError = wsService.onError(updateStatus);

    return () => {
      unsubscribeOpen();
      unsubscribeClose();
      unsubscribeError();
    };
  }, [wsService]);

  // 自动连接
  useEffect(() => {
    if (autoConnect && status === ConnectionStatus.DISCONNECTED) {
      // 从 localStorage 获取 token
      const token = localStorage.getItem('authToken');
      if (token) {
        wsService.setToken(token);
      }
      wsService.connect();
    }

    return () => {
      // 组件卸载时不自动断开，因为可能是单例服务
      // 如果需要断开，可以手动调用 disconnect()
    };
  }, [autoConnect, status, wsService]);

  // 监听 token 变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authToken') {
        wsService.setToken(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // 也监听当前窗口的 token 变化（通过自定义事件）
    const handleTokenChange = () => {
      const token = localStorage.getItem('authToken');
      wsService.setToken(token);
    };
    
    // 监听自定义的 token 更新事件
    window.addEventListener('tokenUpdated', handleTokenChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenUpdated', handleTokenChange);
    };
  }, [wsService]);

  /**
   * 监听特定类型的消息
   */
  const onMessage = (type: MessageType | null, handler: (msg: WebSocketMessage) => void) => {
    const unsubscribe = wsService.onMessage(type, handler);
    
    // 保存 handler 引用以便清理
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    return () => {
      unsubscribe();
      const handlers = handlersRef.current.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(type);
        }
      }
    };
  };

  /**
   * 连接 WebSocket
   */
  const connect = () => {
    wsService.connect();
  };

  /**
   * 断开 WebSocket
   */
  const disconnect = () => {
    wsService.disconnect();
  };

  /**
   * 设置 token
   */
  const setToken = (token: string | null) => {
    wsService.setToken(token);
  };

  return {
    status,
    isConnected: status === ConnectionStatus.CONNECTED,
    connect,
    disconnect,
    setToken,
    onMessage,
  };
};

/**
 * 使用 WebSocket 并显示通知
 */
export const useWebSocketWithNotifications = (autoConnect: boolean = true) => {
  const { status, isConnected, connect, disconnect, setToken, onMessage } = useWebSocket(autoConnect);

  // 监听拍卖创建事件
  useEffect(() => {
    const unsubscribe = onMessage(MessageType.AUCTION_CREATED, () => {
      message.success('新拍卖已创建！');
    });

    return unsubscribe;
  }, [onMessage]);

  // 注意：AUCTION_BID_PLACED 事件不在全局处理，由具体页面（如 AuctionDetail）自行处理
  // 这样可以避免重复的消息提示，并且页面可以执行特定的业务逻辑（如刷新列表、重置按钮状态等）

  // 监听拍卖结束事件
  useEffect(() => {
    const unsubscribe = onMessage(MessageType.AUCTION_ENDED, (msg) => {
      const data = msg.data;
      if (data) {
        // 判断 winner 是否为零地址
        const isZeroAddress = !data.winner || 
          data.winner.toLowerCase() === ethers.ZeroAddress.toLowerCase() ||
          data.winner === '0x0000000000000000000000000000000000000000';
        
        if (isZeroAddress) {
          // 无人出价，拍卖已结束但没有获胜者
          message.info(`拍卖 #${data.nftName} 已结束，无人出价`);
        } else {
          // 有获胜者
          message.success(`拍卖 #${data.nftName} 已结束，最终出价: ${data.usdValueStr} USD`);
        }
      }
    });

    return unsubscribe;
  }, [onMessage]);

  // 监听拍卖取消事件
  useEffect(() => {
    const unsubscribe = onMessage(MessageType.AUCTION_CANCELLED, (msg) => {
      const data = msg.data;
      if (data) {
        message.warning(`拍卖 #${data.auctionId} 已被取消`);
      } else {
        message.warning('拍卖已被取消');
      }
    });

    return unsubscribe;
  }, [onMessage]);

  // 监听强制结束拍卖事件
  useEffect(() => {
    const unsubscribe = onMessage(MessageType.AUCTION_FORCE_ENDED, (msg) => {
      const data = msg.data;
      if (data) {
        message.info(`拍卖 #${data.auctionId} 已被强制结束`);
      } else {
        message.info('拍卖已被强制结束');
      }
    });

    return unsubscribe;
  }, [onMessage]);

  // 注意：NFT_APPROVED 事件不在全局处理，由具体页面（如 MyNFTs）自行处理
  // 这样可以避免重复的消息提示，并且页面可以执行特定的业务逻辑（如刷新列表）

  // 监听错误事件
  useEffect(() => {
    const unsubscribe = onMessage(MessageType.ERROR, (msg) => {
      if (msg.error) {
        message.error(`WebSocket 错误: ${msg.error}`);
      }
    });

    return unsubscribe;
  }, [onMessage]);

  return {
    status,
    isConnected,
    connect,
    disconnect,
    setToken,
    onMessage,
  };
};

