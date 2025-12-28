/**
 * WebSocket 服务
 * 用于接收后端推送的实时事件消息
 */

// WebSocket 消息类型
export enum MessageType {
  AUCTION_CREATED = 'auction_created',
  AUCTION_BID_PLACED = 'auction_bid_placed',
  AUCTION_ENDED = 'auction_ended',
  AUCTION_CANCELLED = 'auction_cancelled',
  AUCTION_FORCE_ENDED = 'auction_force_ended',
  NFT_APPROVED = 'nft_approved',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong',
  SUBSCRIBE = 'subscribe',              // 订阅房间
  UNSUBSCRIBE = 'unsubscribe',          // 取消订阅房间
  SUBSCRIBE_SUCCESS = 'subscribe_success',      // 订阅成功响应
  UNSUBSCRIBE_SUCCESS = 'unsubscribe_success',  // 取消订阅成功响应
}

// WebSocket 消息结构
export interface WebSocketMessage {
  type: MessageType;
  timestamp: number;
  data?: any;
  error?: string;
}

// WebSocket 事件回调类型
export type MessageHandler = (message: WebSocketMessage) => void;
export type ErrorHandler = (error: Event) => void;
export type CloseHandler = (event: CloseEvent) => void;
export type OpenHandler = () => void;

// WebSocket 连接状态
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // 初始重连延迟（毫秒）
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<MessageType, Set<MessageHandler>> = new Map();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private closeHandlers: Set<CloseHandler> = new Set();
  private openHandlers: Set<OpenHandler> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;
  private pongTimeout: NodeJS.Timeout | null = null;
  private lastPongTime: number = 0;
  private pingIntervalMs = 30000; // 30秒发送一次 ping
  private pongTimeoutMs = 10000; // 10秒内必须收到 pong，否则认为连接断开
  private enableLogging = true; // 是否启用日志

  constructor(baseURL: string = '') {
    // 从 baseURL 提取 WebSocket URL
    let wsUrl = baseURL;
    if (!wsUrl) {
      // 使用默认的 API_BASE_URL
      const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 
        (import.meta.env.DEV ? '/api' : 'http://localhost:8080/api');
      wsUrl = apiBaseURL;
    }
    
    // 转换为 WebSocket URL
    if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    } else if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    } else if (wsUrl.startsWith('/')) {
      // 相对路径（开发环境通过 Vite 代理）
      // 使用当前页面的协议和主机，Vite 会代理 WebSocket 请求
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}${wsUrl}`;
    } else {
      // 假设是完整 URL，添加协议
      wsUrl = `ws://${wsUrl}`;
    }
    
    // 确保以 /ws 结尾
    this.url = wsUrl.replace(/\/$/, '') + '/ws';
    
    // 在开发环境下，如果使用相对路径，直接使用相对路径让 Vite 代理处理
    if (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL) {
      // 开发环境且没有配置 VITE_API_BASE_URL，使用相对路径
      this.url = '/api/ws';
    }
  }

  /**
   * 设置认证 token
   */
  setToken(token: string | null) {
    const tokenChanged = this.token !== token;
    this.token = token;
    
    if (tokenChanged) {
      this.log('info', '🔑 Token 已更新', {
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
      });
      
      // 如果已连接，需要重新连接以应用新的 token
      if (this.isConnected()) {
        this.log('info', '🔄 Token 更新，重新连接 WebSocket');
        this.disconnect();
        this.connect();
      }
    }
  }

  /**
   * 获取当前连接状态
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 连接 WebSocket
   */
  connect(): void {
    if (this.isConnected()) {
      this.log('warn', '⚠️ WebSocket 已连接，跳过重复连接');
      return;
    }

    if (this.status === ConnectionStatus.CONNECTING || this.status === ConnectionStatus.RECONNECTING) {
      this.log('warn', '⚠️ WebSocket 正在连接中，跳过重复连接');
      return;
    }

    this.status = this.reconnectAttempts > 0 ? ConnectionStatus.RECONNECTING : ConnectionStatus.CONNECTING;
    
    // 构建 WebSocket URL（包含 token 参数）
    let wsUrl = this.url;
    if (this.token) {
      wsUrl += `?token=${encodeURIComponent(this.token)}`;
    }

    this.log('info', '🔄 开始连接 WebSocket', {
      url: wsUrl.replace(/\?token=[^&]+/, '?token=***'), // 隐藏 token
      reconnectAttempt: this.reconnectAttempts,
      status: this.status,
    });

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      this.log('error', '❌ 创建 WebSocket 连接失败', { error });
      this.status = ConnectionStatus.ERROR;
      this.scheduleReconnect();
    }
  }

  /**
   * 日志输出
   */
  private log(level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (!this.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[WebSocket ${timestamp}]`;
    
    switch (level) {
      case 'info':
        console.log(`%c${prefix} ${message}`, 'color: #1890ff', ...args);
        break;
      case 'warn':
        console.warn(`%c${prefix} ${message}`, 'color: #faad14', ...args);
        break;
      case 'error':
        console.error(`%c${prefix} ${message}`, 'color: #ff4d4f', ...args);
        break;
    }
  }

  /**
   * 设置 WebSocket 事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log('info', '✅ WebSocket 连接已建立', {
        url: this.url,
        readyState: this.ws?.readyState,
      });
      this.status = ConnectionStatus.CONNECTED;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.clearReconnectTimer();
      this.lastPongTime = Date.now();
      
      // 触发打开事件
      this.openHandlers.forEach(handler => handler());

      // 启动心跳
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        this.log('info', '📥 收到原始 WebSocket 消息', {
          dataType: typeof event.data,
          dataLength: event.data?.length || 0,
          dataPreview: typeof event.data === 'string' ? event.data.substring(0, 200) : '[Binary]',
        });

        // 处理多行消息（可能包含多个 JSON 对象）
        const messageStrings = event.data.split('\n').filter((line: string) => line.trim());
        this.log('info', '📦 解析后的消息数量', { count: messageStrings.length });

        messageStrings.forEach((messageStr: string, index: number) => {
          try {
            const message: WebSocketMessage = JSON.parse(messageStr);
            this.log('info', `📋 消息 ${index + 1}/${messageStrings.length}`, {
              type: message.type,
              raw: messageStr,
            });
            this.handleMessage(message);
          } catch (parseError) {
            this.log('error', `❌ 解析消息 ${index + 1} 失败`, {
              error: parseError,
              raw: messageStr,
            });
          }
        });
      } catch (error) {
        this.log('error', '❌ 处理 WebSocket 消息失败', {
          error,
          data: event.data,
          dataType: typeof event.data,
        });
      }
    };

    this.ws.onerror = (error) => {
      this.log('error', '❌ WebSocket 发生错误', { error, readyState: this.ws?.readyState });
      this.status = ConnectionStatus.ERROR;
      this.errorHandlers.forEach(handler => handler(error));
    };

    this.ws.onclose = (event) => {
      this.log('warn', '⚠️ WebSocket 连接已关闭', {
        code: event.code,
        reason: event.reason || '无原因',
        wasClean: event.wasClean,
        readyState: this.ws?.readyState,
      });
      this.status = ConnectionStatus.DISCONNECTED;
      this.stopPing();
      this.clearPongTimeout();
      this.clearReconnectTimer();
      
      // 触发关闭事件
      this.closeHandlers.forEach(handler => handler(event));

      // 如果不是正常关闭，尝试重连
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else if (event.code === 1000) {
        this.log('info', 'ℹ️ WebSocket 正常关闭，不进行重连');
      } else {
        this.log('error', '❌ 达到最大重连次数，停止重连');
      }
    };
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WebSocketMessage): void {
    // 处理心跳响应
    if (message.type === MessageType.PONG) {
      const now = Date.now();
      const timeSinceLastPong = this.lastPongTime > 0 ? now - this.lastPongTime : 0;
      this.lastPongTime = now;
      this.clearPongTimeout();
      this.log('info', '💓 收到 PONG 响应', {
        timeSinceLastPong: `${timeSinceLastPong}ms`,
        timestamp: new Date(message.timestamp * 1000).toISOString(),
        message: JSON.stringify(message),
      });
      return;
    }

    // 记录其他消息（排除 PING，因为 PING 是我们自己发送的）
    if (message.type !== MessageType.PING) {
      this.log('info', '📨 收到消息', {
        type: message.type,
        timestamp: new Date(message.timestamp * 1000).toISOString(),
        hasData: !!message.data,
        message: JSON.stringify(message),
      });
    }

    // 触发对应类型的消息处理器
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    // 触发通用消息处理器（监听所有消息类型）
    const allHandlers = this.messageHandlers.get(null as any);
    if (allHandlers) {
      allHandlers.forEach(handler => handler(message));
    }
  }

  /**
   * 注册消息处理器
   */
  onMessage(type: MessageType | null, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type as any)) {
      this.messageHandlers.set(type as any, new Set());
    }
    this.messageHandlers.get(type as any)!.add(handler);

    // 返回取消注册函数
    return () => {
      const handlers = this.messageHandlers.get(type as any);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(type as any);
        }
      }
    };
  }

  /**
   * 注册错误处理器
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * 注册关闭处理器
   */
  onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  /**
   * 注册打开处理器
   */
  onOpen(handler: OpenHandler): () => void {
    this.openHandlers.add(handler);
    return () => {
      this.openHandlers.delete(handler);
    };
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.log('info', '🔌 主动断开 WebSocket 连接');
    this.clearReconnectTimer();
    this.stopPing();
    this.clearPongTimeout();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.status = ConnectionStatus.DISCONNECTED;
    this.reconnectAttempts = 0;
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log('error', '❌ 达到最大重连次数，停止重连', {
        maxAttempts: this.maxReconnectAttempts,
        currentAttempts: this.reconnectAttempts,
      });
      this.status = ConnectionStatus.ERROR;
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // 指数退避，最大30秒
    
    this.log('info', '⏰ 安排重连', {
      attempt: `${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
      delay: `${delay}ms`,
      delaySeconds: `${(delay / 1000).toFixed(1)}s`,
    });
    
    this.reconnectTimer = setTimeout(() => {
      this.log('info', '🔄 执行重连', { attempt: this.reconnectAttempts });
      this.connect();
    }, delay);
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 清除 PONG 超时定时器
   */
  private clearPongTimeout(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  /**
   * 发送 PING 消息
   */
  private sendPing(): void {
    if (!this.isConnected() || !this.ws) {
      this.log('warn', '⚠️ 无法发送 PING：连接未建立');
      return;
    }

    try {
      const pingMessage: WebSocketMessage = {
        type: MessageType.PING,
        timestamp: Math.floor(Date.now() / 1000),
      };
      
      this.ws.send(JSON.stringify(pingMessage));
      this.log('info', '💓 发送 PING 消息', {
        timestamp: new Date(pingMessage.timestamp * 1000).toISOString(),
      });

      // 设置 PONG 超时检测
      this.clearPongTimeout();
      this.pongTimeout = setTimeout(() => {
        const timeSinceLastPong = Date.now() - this.lastPongTime;
        this.log('error', '❌ PONG 响应超时', {
          timeout: `${this.pongTimeoutMs}ms`,
          timeSinceLastPong: `${timeSinceLastPong}ms`,
          lastPongTime: this.lastPongTime ? new Date(this.lastPongTime).toISOString() : '从未收到',
        });
        
        // PONG 超时，认为连接已断开，关闭连接并触发重连
        if (this.ws) {
          this.ws.close(1006, 'Pong timeout');
        }
      }, this.pongTimeoutMs);
    } catch (error) {
      this.log('error', '❌ 发送 PING 失败', { error });
    }
  }

  /**
   * 启动心跳
   */
  private startPing(): void {
    this.stopPing();
    this.clearPongTimeout();
    
    this.log('info', '💓 启动心跳机制', {
      pingInterval: `${this.pingIntervalMs}ms (${this.pingIntervalMs / 1000}s)`,
      pongTimeout: `${this.pongTimeoutMs}ms (${this.pongTimeoutMs / 1000}s)`,
    });

    // 立即发送第一个 PING
    this.sendPing();

    // 定期发送 PING
    this.pingInterval = setInterval(() => {
      if (this.isConnected() && this.ws) {
        this.sendPing();
      } else {
        this.log('warn', '⚠️ 心跳定时器触发但连接未建立，停止心跳');
        this.stopPing();
      }
    }, this.pingIntervalMs);
  }

  /**
   * 停止心跳
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      this.log('info', '💓 心跳机制已停止');
    }
    this.clearPongTimeout();
  }

  /**
   * 发送消息
   */
  private send(message: WebSocketMessage): void {
    if (!this.isConnected() || !this.ws) {
      this.log('warn', '⚠️ WebSocket 未连接，无法发送消息');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      this.log('error', '❌ 发送消息失败', { error, message });
    }
  }

  /**
   * 订阅房间（例如：特定拍卖的出价消息）
   */
  subscribeRoom(roomID: string): void {
    if (!this.isConnected()) {
      this.log('warn', '⚠️ WebSocket 未连接，无法订阅房间');
      return;
    }

    const message: WebSocketMessage = {
      type: MessageType.SUBSCRIBE,
      timestamp: Math.floor(Date.now() / 1000),
      data: { room_id: roomID },
    };

    this.send(message);
    this.log('info', `📥 订阅房间: ${roomID}`);
  }

  /**
   * 取消订阅房间
   */
  unsubscribeRoom(roomID: string): void {
    if (!this.isConnected()) {
      this.log('warn', '⚠️ WebSocket 未连接，无法取消订阅房间');
      return;
    }

    const message: WebSocketMessage = {
      type: MessageType.UNSUBSCRIBE,
      timestamp: Math.floor(Date.now() / 1000),
      data: { room_id: roomID },
    };

    this.send(message);
    this.log('info', `📤 取消订阅房间: ${roomID}`);
  }
}

// 创建单例实例
let wsServiceInstance: WebSocketService | null = null;

export const getWebSocketService = (baseURL?: string): WebSocketService => {
  if (!wsServiceInstance) {
    // 从环境变量或配置中获取 base URL
    const apiBaseURL = baseURL || import.meta.env.VITE_API_BASE_URL || 
      (import.meta.env.DEV ? '/api' : 'http://localhost:8080/api');
    wsServiceInstance = new WebSocketService(apiBaseURL);
  }
  return wsServiceInstance;
};

export default getWebSocketService;

