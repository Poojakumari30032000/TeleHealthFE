import { computed, inject, Injectable, NgZone, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel, HttpTransportType } from '@microsoft/signalr';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { AuthService } from 'app/shared/Auth/auth.service';
import { GeneralService } from 'app/shared/services/general.service';
import { environment } from 'environments/environment';
import { Observable, Subject, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';

interface OnlineUserDTO {
  userId: string;
  userName: string;
  lastMessage: string;
  lastMsgTime: string;
  profilePic: string;
  connectionId: string;
  isOnline: boolean;
  isTyping: boolean;
  facilityName: string;
  unreadCount: number;
}

interface ChatMessage {
  id: number;
  senderId: string;
  senderName?: string;
  receiverId: string;
  content: string;
  type: string;
  fileType?: string;
  fileName?: string;
  fileSize?: string;
  uploadProgress?: number;
  time: string;
  rawTime?: string;
  isRead: boolean;
  channelId?: number;
  messageType?: string;
}

interface ChatDeliveredMessage {
  id?: number;
  senderId: string;
  senderName?: string;
  receiverId: string;
  content: string;
  sentAt: string;
  facilityId?: number;
  facilityName?: string;
  channelId?: number;
  messageType?: string;
  individualReceiverId?: number;
}

interface ChatChannel {
  channelId: number | null;
  channelName: string;
  channelType: string;
  patientId?: number;
  treatmentId?: number;
  lastMessage?: string;
  lastMessageDate?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isIndividualMessage?: boolean;
  individualReceiverId?: number;
  individualReceiverName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private authService = inject(AuthService);
  private generalService = inject(GeneralService);
  private notification = inject(NzNotificationService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private audioUnlocked = false;

  constructor() {

    this.setupAudioUnlock();
  }

  private setupAudioUnlock(): void {
    const events: Array<keyof DocumentEventMap> = ['click', 'keydown', 'touchstart'];
    const unlock = () => {
      if (this.audioUnlocked) return;
      this.audioUnlocked = true;
      try {
        const a = new Audio('assets/audio/notification.wav');
        a.muted = true;
        a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
      } catch {  }
      events.forEach((e) => document.removeEventListener(e, unlock));
    };
    events.forEach((e) => document.addEventListener(e, unlock, { passive: true }));
  }

  private showNewMessageToast(title: string, body: string, navigate: () => void): void {
    const ref = this.notification.info(title, body, { nzDuration: 6000, nzPlacement: 'topRight' });
    ref?.onClick?.pipe(take(1)).subscribe(() => this.ngZone.run(() => navigate()));
  }
  private getBaseUrl(): string {
    let basePath = environment.IAMGE_PATH || '';

    if (!basePath.startsWith('http://') && !basePath.startsWith('https://')) {

      if (basePath.includes('localhost:7039') || basePath.includes('127.0.0.1:7039')) {
        basePath = `https://${basePath}`;
      } else if (basePath.includes('localhost') || basePath.includes('127.0.0.1')) {
        basePath = `http://${basePath}`;
      } else {
        basePath = `https://${basePath}`;
      }
    } else if (basePath.startsWith('http://localhost:7039') || basePath.startsWith('http://127.0.0.1:7039')) {

      basePath = basePath.replace('http://', 'https://');
    }

    basePath = basePath.replace(/\/$/, '');
    return `${basePath}/ChatHub`;
  }
  onlineUsers = signal<OnlineUserDTO[]>([]);
  currentOpenedChat = signal<OnlineUserDTO | null>(null);
  chatChannels = signal<ChatChannel[]>([]);
  currentOpenedChannel = signal<ChatChannel | null>(null);
  chatMessages = signal<ChatMessage[]>([]);
  totalUnreadMessages = computed(() => {
    const directMessagesCount = this.onlineUsers().reduce(
      (total, user) => total + (user.unreadCount || 0),
      0
    );
    const channelsCount = this.chatChannels().reduce(
      (total, channel) => total + (channel.unreadCount || 0),
      0
    );
    return directMessagesCount + channelsCount;
  });
  hasUnreadMessages = computed(() => this.totalUnreadMessages() > 0);
  isLoading = signal<boolean>(false);
  isLoadingUsers = signal<boolean>(true);
  isLoadingChannels = signal<boolean>(false);
  connectionState = signal<HubConnectionState>(HubConnectionState.Disconnected);
  canViewChannels = signal<boolean>(true);
  canSendMessages = signal<boolean>(false);
  private typingTimeouts = new Map<string, NodeJS.Timeout>();
  private hubConnection: HubConnection | undefined;
  private maxReconnectAttempts = 5;
  private isStartingConnection = false;
  private usersRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private messageListLoadedSubject = new Subject<void>();
  private notificationSoundRetryAfter = 0;
  private notificationSoundMissingWarned = false;
  private pendingDirectHistoryLoad: { recipientId: string; pageNumber: number } | null = null;
  private pendingChannelHistoryLoad: {
    channelId: number;
    pageNumber: number;
    individualReceiverId: number | null;
  } | null = null;

  private messageErrorSubject = new Subject<string>();
  messageError$ = this.messageErrorSubject.asObservable();
  messageListLoaded$ = this.messageListLoadedSubject.asObservable();

  private formatMessageTime(timeStr: string): string {
    if (!timeStr) return '';

    if (timeStr === 'Today' || timeStr === 'Yesterday' || timeStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return timeStr;
    }

    const date = new Date(timeStr);
    if (Number.isNaN(date.getTime())) {
      return timeStr;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(date);
    messageDate.setHours(0, 0, 0, 0);

    if (messageDate.getTime() === today.getTime()) {
      return 'Today';
    }

    if (messageDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    return date.toISOString().split('T')[0] || '';
  }

  private normalizeMessageListPayload(payload: unknown): ChatMessage[] {
    if (Array.isArray(payload)) {
      return payload as ChatMessage[];
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const candidate = payload as {
      messages?: ChatMessage[];
      data?: ChatMessage[];
      result?: ChatMessage[];
    };

    if (Array.isArray(candidate.messages)) {
      return candidate.messages;
    }

    if (Array.isArray(candidate.data)) {
      return candidate.data;
    }

    if (Array.isArray(candidate.result)) {
      return candidate.result;
    }

    return [];
  }

  private fixWebSocketConflict(): void {
    if (typeof window === 'undefined') return;

    const nativeWS = (window as any).__NATIVE_WEBSOCKET_PRESERVED__ ||
                     (window as any).__NATIVE_WEBSOCKET__;

    if (nativeWS && window.WebSocket !== nativeWS) {

      window.WebSocket = nativeWS;
      console.log('ChatService: Restored native WebSocket from preserved reference');
    }

    const paceWS = (window as any)._WebSocket;
    if (paceWS && paceWS !== window.WebSocket) {
      window.WebSocket = paceWS;
      console.log('ChatService: Restored native WebSocket from pace.js _WebSocket');
    }

    if ((window as any).Pace && (window as any).Pace.options) {
      (window as any).Pace.options.ajax = (window as any).Pace.options.ajax || {};
      (window as any).Pace.options.ajax.trackWebSockets = false;
    }
  }

  private runInZone(work: () => void): void {
    if (NgZone.isInAngularZone()) {
      work();
      return;
    }

    this.ngZone.run(work);
  }

  private scheduleUsersRefresh(delayMs: number = 800): void {
    if (this.usersRefreshTimer) {
      return;
    }

    this.usersRefreshTimer = setTimeout(() => {
      this.usersRefreshTimer = null;
      this.getUsersChat();
    }, delayMs);
  }

  private playNotificationSound(): void {
    if (Date.now() < this.notificationSoundRetryAfter) {
      return;
    }

    try {
      const audio = new Audio('assets/audio/notification.wav');
      audio.addEventListener(
        'error',
        () => {

          this.notificationSoundRetryAfter = Date.now() + 15000;
          if (!this.notificationSoundMissingWarned) {
            this.notificationSoundMissingWarned = true;
            console.warn('ChatService: Notification sound disabled - file not found at assets/audio/notification.wav');
          }
        },
        { once: true }
      );
      audio.play().catch(() => {

        this.notificationSoundRetryAfter = Date.now() + 3000;
      });
    } catch {
      this.notificationSoundRetryAfter = Date.now() + 3000;
    }
  }

  private flushPendingHistoryLoads(): void {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return;
    }

    if (this.pendingDirectHistoryLoad) {
      const pending = this.pendingDirectHistoryLoad;
      this.pendingDirectHistoryLoad = null;
      const currentRecipientId = this.currentOpenedChat()?.userId;
      if (currentRecipientId && currentRecipientId === pending.recipientId) {
        this.loadMessage(pending.pageNumber);
      }
    }

    if (this.pendingChannelHistoryLoad) {
      const pending = this.pendingChannelHistoryLoad;
      this.pendingChannelHistoryLoad = null;
      const currentChannel = this.currentOpenedChannel();
      const currentIndividualReceiverId = currentChannel?.individualReceiverId ?? null;
      if (
        currentChannel?.channelId === pending.channelId &&
        currentIndividualReceiverId === pending.individualReceiverId
      ) {
        this.loadChannelMessages(pending.channelId, pending.pageNumber);
      }
    }
  }

  async startConnection(): Promise<void> {
    if (this.isStartingConnection) {
      return;
    }

    if (
      this.hubConnection?.state === HubConnectionState.Connected ||
      this.hubConnection?.state === HubConnectionState.Connecting ||
      this.hubConnection?.state === HubConnectionState.Reconnecting
    ) {
      return;
    }

    this.isStartingConnection = true;
    this.connectionState.set(HubConnectionState.Connecting);

    try {

      if (this.hubConnection && this.hubConnection.state !== HubConnectionState.Disconnected) {
        try {
          await this.hubConnection.stop();
        } catch (error) {
          console.warn('ChatService: Error stopping existing connection', error);
        }
      }

      const token = localStorage.getItem('isolHealthToken');
      if (!token) {
        const error = 'No authentication token found';
        console.error('ChatService:', error);
        this.isLoadingUsers.set(false);
        throw new Error(error);
      }

      this.fixWebSocketConflict();

      const hubUrl = this.getBaseUrl();
      console.log('ChatService: Connecting to SignalR hub at:', hubUrl);

      try {
        const healthUrl = hubUrl.replace('/ChatHub', '/api/Health');
        console.log('ChatService: Checking backend health at:', healthUrl);
        const healthResponse = await fetch(healthUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },

          mode: 'cors',
          credentials: 'include'
        });
        if (!healthResponse.ok) {
          console.warn('ChatService: Backend health check failed:', healthResponse.status);
        } else {
          console.log('ChatService: Backend is accessible');
        }
      } catch (healthError: any) {

        if (healthError?.message?.includes('Failed to fetch') || healthError?.message?.includes('ERR_EMPTY_RESPONSE')) {
          console.error('ChatService: Backend health check failed - backend may not be running or not accessible');
          console.error('ChatService: Make sure the backend is running on HTTPS at:', hubUrl.replace('/ChatHub', ''));
          throw new Error(`Backend is not accessible. Please ensure the backend is running on ${hubUrl.replace('/ChatHub', '')}. If using HTTPS, make sure the certificate is trusted.`);
        }
        throw healthError;
      }

      this.hubConnection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => {
            const currentToken = localStorage.getItem('isolHealthToken');
            if (!currentToken) {
              console.error('ChatService: Token not available');
              throw new Error('Token not available');
            }
            console.log('ChatService: Token found, length:', currentToken.length);
            return currentToken;
          },
          skipNegotiation: false,
          withCredentials: true
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.previousRetryCount < this.maxReconnectAttempts) {
              return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
            }
            return null;
          },
        })
        .configureLogging(LogLevel.Warning)
        .build();

      this.registerConnectionHandlers();
      this.registerListeners();

      try {
        await this.hubConnection.start();

        if (this.hubConnection.state !== HubConnectionState.Connected) {
          throw new Error(`Connection not in Connected state. Current state: ${this.hubConnection.state}`);
        }

        this.connectionState.set(HubConnectionState.Connected);
        console.log('ChatService: Connection started successfully, state updated to Connected');

        await new Promise((resolve) => setTimeout(resolve, 100));

        this.getUsersChat();
        this.loadChannels().subscribe();
        this.flushPendingHistoryLoads();
      } catch (webSocketError: any) {

        if (webSocketError?.message?.includes('WebSocket') ||
            webSocketError?.message?.includes('OPEN state')) {
          console.warn('ChatService: WebSocket failed, retrying with LongPolling fallback');

          if (this.hubConnection) {
            try {
              await this.hubConnection.stop();
            } catch {

            }
            this.hubConnection = undefined;
          }

          this.fixWebSocketConflict();

          const hubUrl = this.getBaseUrl();
          this.hubConnection = new HubConnectionBuilder()
            .withUrl(hubUrl, {
              accessTokenFactory: () => {
                const currentToken = localStorage.getItem('isolHealthToken');
                if (!currentToken) {
                  throw new Error('Token not available');
                }
                return currentToken;
              },
              transport: HttpTransportType.LongPolling,
              skipNegotiation: false,
              withCredentials: true
            })
            .withAutomaticReconnect({
              nextRetryDelayInMilliseconds: (retryContext) => {
                if (retryContext.previousRetryCount < this.maxReconnectAttempts) {
                  return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
                }
                return null;
              },
            })
            .configureLogging(LogLevel.Warning)
            .build();

          this.registerConnectionHandlers();
          this.registerListeners();

          await this.hubConnection.start();

          if (this.hubConnection.state !== HubConnectionState.Connected) {
            throw new Error(`LongPolling connection failed. State: ${this.hubConnection.state}`);
          }

          this.connectionState.set(HubConnectionState.Connected);
          console.log('ChatService: Connection started successfully with LongPolling, state updated to Connected');
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.getUsersChat();
          this.loadChannels().subscribe();
        } else {
          throw webSocketError;
        }
      }
    } catch (error) {
      console.error('ChatService: Connection failed', error);
      this.connectionState.set(HubConnectionState.Disconnected);
      this.isLoadingUsers.set(false);

      if (this.hubConnection) {
        try {
          await this.hubConnection.stop();
        } catch {

        }
        this.hubConnection = undefined;
      }

      throw error;
    } finally {
      this.isStartingConnection = false;
    }
  }

  private registerConnectionHandlers(): void {
    if (!this.hubConnection) return;

    this.connectionState.set(this.hubConnection.state);

    this.hubConnection.onclose((error) => {
      console.log('ChatService: Connection closed', error);
      this.connectionState.set(HubConnectionState.Disconnected);
      this.isLoadingUsers.set(true);

      if (error) {
        console.error('ChatService: Connection closed with error', error);
      }
    });

    this.hubConnection.onreconnecting((error) => {
      console.log('ChatService: Reconnecting...', error);
      this.connectionState.set(HubConnectionState.Reconnecting);
      this.isLoadingUsers.set(true);
    });

    this.hubConnection.onreconnected((connectionId) => {
      console.log('ChatService: Reconnected with connection ID:', connectionId);
      this.connectionState.set(HubConnectionState.Connected);
      this.getUsersChat();
      this.loadChannels().subscribe();
      this.flushPendingHistoryLoads();
    });
  }

  private registerListeners(): void {
    if (!this.hubConnection) return;

    try {
      this.hubConnection.off('ReceiveMessage');
      this.hubConnection.off('ReceiveMessageList');
      this.hubConnection.off('ReceiveOnlineUsers');
      this.hubConnection.off('UserOnlineNotification');
      this.hubConnection.off('NotifyTypingToUser');
      this.hubConnection.off('NotifyNotTypingToUser');
      this.hubConnection.off('ConnectionError');
      this.hubConnection.off('MessageSent');
      this.hubConnection.off('MessageError');
      this.hubConnection.off('ReceiveChannelMessage');
      this.hubConnection.off('ReceiveChannelMessageList');
    } catch (error) {

      console.warn('ChatService: Error removing listeners', error);
    }

    this.hubConnection.on('ConnectionError', (error: string) => {
      console.error('ChatService: Connection error from server:', error);
      this.isLoadingUsers.set(false);
    });

    this.hubConnection.on('MessageError', (error: string) => {
      console.error('ChatService: Message error from server:', error);

      this.messageErrorSubject.next(error);
    });

    this.hubConnection.on('ReceiveOnlineUsers', (users: OnlineUserDTO[]) => {
      this.runInZone(() => {
        const currentUserId = this.authService.getUserId()?.toString();
        const openedChatUserId = this.currentOpenedChat()?.userId;

        const filteredUsers = users.filter(
          (user) => user.userId !== currentUserId && user.userName !== 'Unknown' && user.userName.trim() !== ''
        );

        const normalizedUsers = filteredUsers.map((user) =>
          openedChatUserId && user.userId === openedChatUserId
            ? { ...user, unreadCount: 0 }
            : user
        );

        if (filteredUsers.length > 0 || users.length === 0) {
          this.onlineUsers.set(normalizedUsers);
          this.isLoadingUsers.set(false);
          console.log('ChatService: Online users updated', normalizedUsers.length, 'for user', currentUserId);
        } else {
          console.warn('ChatService: Received invalid user list, not updating');
        }
      });
    });

    this.hubConnection.on('UserOnlineNotification', (userId: string, isOnline: boolean) => {
      this.onlineUsers.update((users) =>
        users.map((user) => {
          if (user.userId === userId) {
            return { ...user, isOnline };
          }
          return user;
        })
      );
    });

    this.hubConnection.on('NotifyTypingToUser', (senderUserId: string) => {
      this.onlineUsers.update((users) =>
        users.map((user) => ({
          ...user,
          isTyping: user.userId === senderUserId ? true : user.isTyping,
        }))
      );

      if (this.typingTimeouts.has(senderUserId)) {
        clearTimeout(this.typingTimeouts.get(senderUserId)!);
      }

      const timeoutId = setTimeout(() => {
        this.onlineUsers.update((users) =>
          users.map((user) => ({
            ...user,
            isTyping: user.userId === senderUserId ? false : user.isTyping,
          }))
        );
        this.typingTimeouts.delete(senderUserId);
      }, 3000);

      this.typingTimeouts.set(senderUserId, timeoutId);
    });

    this.hubConnection.on('NotifyNotTypingToUser', (senderUserId: string) => {
      this.onlineUsers.update((users) =>
        users.map((user) => ({
          ...user,
          isTyping: user.userId === senderUserId ? false : user.isTyping,
        }))
      );

      if (this.typingTimeouts.has(senderUserId)) {
        clearTimeout(this.typingTimeouts.get(senderUserId)!);
        this.typingTimeouts.delete(senderUserId);
      }
    });

    this.hubConnection.on('ReceiveMessageList', (payload: unknown) => {
      this.runInZone(() => {
        const allMessages = this.normalizeMessageListPayload(payload);
        const currentChat = this.currentOpenedChat();
        const currentChannel = this.currentOpenedChannel();
        const currentUserId = this.authService.getUserId()?.toString() || '';

        if (!currentChat || currentChannel || !currentUserId) {
          console.warn('ChatService: Ignoring direct message list - no active direct conversation');
          return;
        }

        const expectedUserId = currentChat.userId;
        const messages = allMessages.filter((message) => {
          const senderId = String(message.senderId || '');
          const receiverId = String(message.receiverId || '');
          return (
            (senderId === expectedUserId && receiverId === currentUserId) ||
            (senderId === currentUserId && receiverId === expectedUserId)
          );
        });

        if (allMessages.length > 0 && messages.length === 0) {
          console.warn('ChatService: Ignoring stale direct message list for a previously opened chat');
          return;
        }

        if (messages.length !== allMessages.length) {
          console.warn(
            'ChatService: Filtered out messages from another conversation',
            allMessages.length - messages.length
          );
        }

        console.log('ChatService: Received message list', messages.length, 'messages');

        if (currentChat) {
          this.onlineUsers.update(users =>
            users.map(user =>
              user.userId === currentChat.userId
                ? { ...user, unreadCount: 0 }
                : user
            )
          );
        }

        setTimeout(() => {

          console.log('ChatService: Messages loaded and marked as read, user list should be refreshed');
        }, 2000);

        if (messages.length > 0) {
          this.chatMessages.update((existingMessages) => {
            const existingIds = new Set(existingMessages.map((m) => m.id));
            const uniqueNewMessages = messages.filter(
              (newMessage) => !existingIds.has(newMessage.id)
            );

            if (existingMessages.length === 0) {

              const formattedMessages = uniqueNewMessages.map(msg => ({
                ...msg,
                rawTime: msg.rawTime ?? msg.time ?? '',
                time: this.formatMessageTime(msg.time ?? '')
              }));
              console.log('ChatService: Setting initial messages', formattedMessages.length);
              return formattedMessages;
            } else {

              const formattedMessages = uniqueNewMessages.map(msg => ({
                ...msg,
                rawTime: msg.rawTime ?? msg.time ?? '',
                time: this.formatMessageTime(msg.time ?? '')
              }));
              const merged = [...formattedMessages, ...existingMessages];
              console.log('ChatService: Merged messages, total:', merged.length);
              return merged;
            }
          });
        } else {

          console.log('ChatService: No messages received from server');
          if (this.chatMessages().length === 0) {

            console.log('ChatService: No messages in conversation');
          }
        }

        this.isLoading.set(false);
        this.messageListLoadedSubject.next();
        console.log('ChatService: Message list updated, total messages:', this.chatMessages().length);
      });
    });

    this.hubConnection.on('ReceiveMessage', (message: ChatDeliveredMessage) => {
      this.runInZone(() => {
        const currentChat = this.currentOpenedChat();
        const currentUserId = this.authService.getUserId()?.toString();
        const incomingForCurrentUser = !!currentUserId && message.receiverId === currentUserId;

        console.log('ChatService: Received message', message);

        const sentDate = new Date(message.sentAt);
        const lastMsgTimeStr = sentDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        if (incomingForCurrentUser) {
          this.playNotificationSound();

          const openChat = this.currentOpenedChat();
          if (!openChat || openChat.userId !== message.senderId) {
            const senderId = message.senderId;

            const senderName =
              message.senderName ||
              this.onlineUsers().find((u) => u.userId === message.senderId)?.userName ||
              'Someone';
            this.showNewMessageToast(
              'New message',
              `${senderName} sent you a message`,
              () => this.router.navigate(['/chat'], { queryParams: { userId: senderId } })
            );
          }

          this.onlineUsers.update(users => {
            const senderIdx = users.findIndex(user => user.userId === message.senderId);
            if (senderIdx === -1) {
              return [{
                userId: message.senderId,
                userName: message.senderName || 'New Message',
                lastMessage: message.content,
                lastMsgTime: lastMsgTimeStr,
                profilePic: 'assets/img/userPlaceholderImg.jpg',
                connectionId: '',
                isOnline: true,
                isTyping: false,
                facilityName: message.facilityName || '',
                unreadCount: currentChat?.userId === message.senderId ? 0 : 1
              }, ...users];
            }

            const existingUser = users[senderIdx];
            if (!existingUser) return users;
            const updatedUser = {
              ...existingUser,
              lastMessage: message.content,
              lastMsgTime: lastMsgTimeStr,
              unreadCount: currentChat?.userId === message.senderId ? 0 : (existingUser.unreadCount || 0) + 1
            };

            return [updatedUser, ...users.filter(u => u.userId !== message.senderId)];
          });

          if (currentChat?.userId !== message.senderId) {
            this.scheduleUsersRefresh();
          }
        }

        if (!currentChat) {
          console.log('ChatService: No current chat, skipping message display');
          return;
        }

        const isForCurrentChat =
          (message.senderId === currentChat.userId && message.receiverId === currentUserId) ||
          (message.receiverId === currentChat.userId && message.senderId === currentUserId);

        if (isForCurrentChat) {

        const sentDate = new Date(message.sentAt);

        const lastMsgTimeStr = sentDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const newMessage: ChatMessage = {
          id: message.id ?? Date.now(),
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: message.content,
          isRead: currentUserId === message.receiverId ? false : true,
          type: 'text',
          time: this.formatMessageTime(message.sentAt),
          rawTime: message.sentAt,
        };

        this.chatMessages.update((messages) => {

          const exists = messages.some(m => m.id === newMessage.id);
          if (exists) {
            return messages;
          }

          const optimisticIndex = messages.findIndex(m =>
            m.content === message.content &&
            m.senderId === message.senderId &&
            m.id > 1000000000000
          );

          if (optimisticIndex >= 0) {

            const updated = [...messages];
            updated[optimisticIndex] = newMessage;
            return updated;
          }

          return [...messages, newMessage];
        });

          this.onlineUsers.update(users =>
            users.map(user => {

              if (user.userId === message.senderId || user.userId === message.receiverId) {
                return {
                  ...user,
                  lastMessage: message.content,
                  lastMsgTime: lastMsgTimeStr,

                  unreadCount: user.userId === currentChat.userId ? 0 : (user.unreadCount || 0)
                };
              }
              return user;
            })
          );

        setTimeout(() => {
          const scrollEvent = new CustomEvent('newMessageReceived');
          window.dispatchEvent(scrollEvent);
        }, 100);

          console.log('ChatService: Message added to chat');
        } else {
          console.log('ChatService: Message not for current chat, sender:', message.senderId, 'current chat:', currentChat.userId);
        }
      });
    });

    this.hubConnection.on('MessageSent', (message: string) => {
      console.log('ChatService: Message sent confirmation:', message);
    });

    this.hubConnection.on('ReceiveChannelMessage', (message: ChatDeliveredMessage) => {
      this.runInZone(() => {

        if (!this.canViewChannels()) {
          return;
        }

        const currentChannel = this.currentOpenedChannel();
        const currentUserId = this.authService.getUserId()?.toString();
        const incomingFromOtherUser = !!currentUserId && message.senderId !== currentUserId;

        console.log('ChatService: Received channel message', { id: message.id, channelId: message.channelId });

        if (incomingFromOtherUser) {
          this.playNotificationSound();

          const openChannel = this.currentOpenedChannel();
          const viewingThis = !!openChannel && Number(openChannel.channelId) === Number(message.channelId);
          if (!viewingThis && message.channelId) {
            const channelId = message.channelId;
            const channelName = this.chatChannels().find(c => Number(c.channelId) === Number(channelId))?.channelName || 'a channel';
            this.showNewMessageToast(
              'New message',
              `New message in ${channelName}`,
              () => this.router.navigate(['/chat'], { queryParams: { channelId } })
            );
          }
        }

        const sentDate = new Date(message.sentAt);

        if (currentChannel && message.channelId && currentChannel.channelId === message.channelId) {
        const newMessage: ChatMessage = {
          id: message.id ?? Date.now(),
          senderId: message.senderId,
          ...(message.senderName && { senderName: message.senderName }),
          receiverId: message.receiverId,
          content: message.content,
          isRead: currentUserId === message.senderId ? true : false,
          type: 'text',
          time: this.formatMessageTime(message.sentAt),
          rawTime: message.sentAt,
          ...(message.channelId && { channelId: message.channelId }),
          ...(message.messageType && { messageType: message.messageType }),
        };

        this.chatMessages.update((messages) => {
          const exists = messages.some(m => m.id === newMessage.id);
          if (exists) {
            return messages;
          }

          const optimisticIndex = messages.findIndex(m =>
            m.content === message.content &&
            m.senderId === message.senderId &&
            m.id > 1000000000000
          );

          if (optimisticIndex >= 0) {
            const updated = [...messages];
            updated[optimisticIndex] = newMessage;
            return updated;
          }

          return [...messages, newMessage];
        });

        setTimeout(() => {
          const scrollEvent = new CustomEvent('newMessageReceived');
          window.dispatchEvent(scrollEvent);
        }, 100);
        }

        if (message.channelId) {
          const lastMsgTimeStr = sentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

          const incomingChannelId = Number(message.channelId);
          this.chatChannels.update(channels => {
            const existing = channels.find(c => Number(c.channelId) === incomingChannelId);
            if (!existing) return channels;
            const updatedChannel = {
              ...existing,
              lastMessage: message.content,
              lastMessageTime: lastMsgTimeStr,
              lastMessageDate: message.sentAt,
              unreadCount: (Number(existing.channelId) === Number(currentChannel?.channelId))
                ? 0
                : (existing.unreadCount || 0) + 1
            };

            return [updatedChannel, ...channels.filter(c => Number(c.channelId) !== incomingChannelId)];
          });
        }
      });
    });

    this.hubConnection.on('ReceiveChannelMessageList', (payload: unknown) => {
      this.runInZone(() => {

        if (!this.canViewChannels()) {
          return;
        }

        const allMessages = this.normalizeMessageListPayload(payload);
        const currentChannel = this.currentOpenedChannel();
        const currentDirectChat = this.currentOpenedChat();

        if (!currentChannel || currentDirectChat || !currentChannel.channelId) {
          console.warn('ChatService: Ignoring channel message list - no active channel conversation');
          return;
        }

        const expectedChannelId = currentChannel.channelId;
        const messages = allMessages.filter((message) => message.channelId === expectedChannelId);

        if (allMessages.length > 0 && messages.length === 0) {
          console.warn('ChatService: Ignoring stale channel message list for a previously opened channel');
          return;
        }

        if (messages.length !== allMessages.length) {
          console.warn(
            'ChatService: Filtered out messages from another channel',
            allMessages.length - messages.length
          );
        }

        console.log('ChatService: Received channel message list', messages.length, 'messages');

        if (currentChannel) {
          this.chatChannels.update(channels =>
            channels.map(channel =>
              channel.channelId === currentChannel.channelId
                ? { ...channel, unreadCount: 0 }
                : channel
            )
          );

          this.currentOpenedChannel.update(ch => ch ? { ...ch, unreadCount: 0 } : null);
        }

        setTimeout(() => {

          console.log('ChatService: Channel messages loaded and marked as read, channel list should be refreshed');
        }, 2000);

        if (messages.length > 0) {
          this.chatMessages.update((existingMessages) => {
            const existingIds = new Set(existingMessages.map((m) => m.id));
            const uniqueNewMessages = messages.filter(
              (newMessage) => !existingIds.has(newMessage.id)
            );

            if (existingMessages.length === 0) {
              return uniqueNewMessages.map(msg => ({
                ...msg,
                rawTime: msg.rawTime ?? msg.time ?? '',
                time: this.formatMessageTime(msg.time ?? '')
              }));
            } else {
              const formattedMessages = uniqueNewMessages.map(msg => ({
                ...msg,
                rawTime: msg.rawTime ?? msg.time ?? '',
                time: this.formatMessageTime(msg.time ?? '')
              }));
              return [...formattedMessages, ...existingMessages];
            }
          });
        }

        this.isLoading.set(false);
        this.messageListLoadedSubject.next();
      });
    });

    this.hubConnection.on('MessageDeleted', (payload: unknown) => {
      this.runInZone(() => {
        if (!payload || typeof payload !== 'object') return;

        const p = payload as { id?: number; content?: string; senderId?: string; receiverId?: string; channelId?: number };
        if (!p.id) return;

        const deletedContent = p.content ?? 'This message was deleted';

        this.chatMessages.update(messages =>
          messages.map(m => (m.id === p.id ? { ...m, content: deletedContent } : m))
        );

        const currentUserId = this.authService.getUserId()?.toString() || '';
        const senderId = p.senderId?.toString();
        const receiverId = p.receiverId?.toString();

        if (currentUserId && senderId && receiverId && (senderId !== '' || receiverId !== '')) {
          const partnerId = currentUserId === senderId ? receiverId : senderId;
          this.onlineUsers.update(users =>
            users.map(u => (u.userId === partnerId ? { ...u, lastMessage: deletedContent } : u))
          );
        }

        if (typeof p.channelId === 'number') {
          this.chatChannels.update(channels =>
            channels.map(c => (c.channelId === p.channelId ? { ...c, lastMessage: deletedContent } : c))
          );
        }
      });
    });
  }

  loadChannels(): Observable<ChatChannel[]> {
    const userId = this.authService.getUserId();
    const roleId = Number(this.authService.getUserRoleId() || 0);
    const facilityId = Number(localStorage.getItem('FOS'));

    if (!userId) {
      return of([]);
    }

    this.isLoadingChannels.set(true);
    let url = `Chats/getChatChannels?UserId=${userId}&RoleId=${roleId}`;
    if (facilityId > 0) {
      url = `${url}&FacilityId=${facilityId}`;
    }

    return this.generalService.commonGet(url).pipe(
      map((response: any) => {
        this.isLoadingChannels.set(false);
        if (response?.status === 1 && response?.data) {
          const data = response.data;
          const channelsList = data.channels || (Array.isArray(data) ? data : []);
          const canViewChannels = data.canViewChannels !== undefined ? data.canViewChannels : true;
          const canSendMessages = data.canSendMessages === true;

          const channels: ChatChannel[] = (Array.isArray(channelsList) ? channelsList : []).map((element: any) => ({
            channelId: element.channelId,
            channelName: element.channelName,
            channelType: element.channelType,
            patientId: element.patientId,
            treatmentId: element.treatmentId,
            lastMessage: element.lastMessage || '',
            lastMessageTime: element.lastMessageTime || '',
            unreadCount: element.unreadCount || 0,
            isIndividualMessage: element.isIndividualMessage || false,
            individualReceiverId: element.individualReceiverId,
            individualReceiverName: element.individualReceiverName,
          }));
          this.chatChannels.set(channels);

          if (roleId === 3) {
            this.canViewChannels.set(canViewChannels);
            this.canSendMessages.set(canSendMessages);
          } else {
            this.canViewChannels.set(true);
            this.canSendMessages.set(true);
          }
          return channels;
        }
        this.chatChannels.set([]);
        return [];
      }),
      catchError((error) => {
        this.isLoadingChannels.set(false);
        console.error('ChatService: Error loading channels', error);
        this.chatChannels.set([]);
        return of<ChatChannel[]>([]);
      })
    );
  }

  getUsersChat(): void {

    if (!this.hubConnection) {
      console.warn('ChatService: Cannot get users chat - no connection');
      this.isLoadingUsers.set(false);
      return;
    }

    if (this.hubConnection.state === HubConnectionState.Connecting) {

      setTimeout(() => this.getUsersChat(), 500);
      return;
    }

    if (this.hubConnection.state !== HubConnectionState.Connected) {
      console.warn('ChatService: Cannot get users chat - connection not established. State:', this.hubConnection.state);
      this.isLoadingUsers.set(false);
      return;
    }

    const userId = this.authService.getUserId()?.toString();
    if (!userId) {
      console.warn('ChatService: Cannot get users chat - no user ID');
      this.isLoadingUsers.set(false);
      return;
    }

    try {
      this.hubConnection
        .invoke('GetOnlineUsersList', userId)
        .then(() => {
          console.log('ChatService: GetOnlineUsersList invoked successfully');
        })
        .catch((error) => {
          console.error('ChatService: Error getting users chat', error);
          this.isLoadingUsers.set(false);
        });
    } catch (error) {
      console.error('ChatService: Exception getting users chat', error);
      this.isLoadingUsers.set(false);
    }
  }

  async sendMessage(message: ChatMessage): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      throw new Error('Connection not established');
    }

    const request = {
      receiverId: message.receiverId,
      content: message.content,
    };

    try {
      await this.hubConnection.invoke('SendMessage', request);
    } catch (error) {
      console.error('ChatService: Error sending message', error);
      throw error;
    }
  }

  async deleteMessage(messageId: number): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      throw new Error('Connection not established');
    }

    if (!messageId || messageId <= 0) return;

    await this.hubConnection.invoke('DeleteMessage', messageId);
  }

  loadMessage(pageNumber: number): void {
    const recipientId = this.currentOpenedChat()?.userId;
    if (!recipientId) {
      console.warn('ChatService: Cannot load messages - no recipient selected');
      this.isLoading.set(false);
      return;
    }

    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      console.warn('ChatService: Connection not ready, queueing direct message load');
      this.pendingDirectHistoryLoad = { recipientId, pageNumber };
      this.isLoading.set(true);
      this.startConnection().catch((error) => {
        console.error('ChatService: Failed to start connection while queueing direct message load', error);
        this.isLoading.set(false);
      });
      return;
    }

    this.isLoading.set(true);
    console.log('ChatService: Loading messages for recipient:', recipientId, 'page:', pageNumber);

    this.hubConnection
      .invoke('LoadMessages', recipientId, pageNumber, 50)
      .then(() => {
        console.log('ChatService: LoadMessages invoked successfully');

        setTimeout(() => {
          if (this.isLoading()) {
            console.warn('ChatService: LoadMessages timeout - no response received');
            this.isLoading.set(false);
          }
        }, 10000);
      })
      .catch((error) => {
        console.error('ChatService: Error loading messages', error);
        this.isLoading.set(false);

        this.messageErrorSubject.next('Failed to load messages. Please try again.');
      });
  }

  notifyTyping(): void {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return;
    }

    const recipientId = this.currentOpenedChat()?.userId;
    if (!recipientId) return;

    this.hubConnection.invoke('NotifyTyping', recipientId).catch((error) => {
      console.error('ChatService: Error notifying typing', error);
    });
  }

  notifyNotTyping(): void {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return;
    }

    const recipientId = this.currentOpenedChat()?.userId;
    if (!recipientId) return;

    this.hubConnection.invoke('NotifyNotTyping', recipientId).catch((error) => {
      console.error('ChatService: Error notifying not typing', error);
    });
  }

  async disConnectConnection(): Promise<void> {
    if (
      this.hubConnection &&
      this.hubConnection.state !== HubConnectionState.Disconnected
    ) {
      try {
        await this.hubConnection.stop();
        console.log('ChatService: Connection stopped');
      } catch (error) {
        console.error('ChatService: Error stopping connection', error);
      }
    }

    this.connectionState.set(HubConnectionState.Disconnected);
    this.isStartingConnection = false;
    this.pendingDirectHistoryLoad = null;
    this.pendingChannelHistoryLoad = null;

    this.typingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.typingTimeouts.clear();
    if (this.usersRefreshTimer) {
      clearTimeout(this.usersRefreshTimer);
      this.usersRefreshTimer = null;
    }
  }

  clearAllData(): void {
    console.log('ChatService: Clearing all chat data');

    this.onlineUsers.set([]);
    this.currentOpenedChat.set(null);
    this.chatChannels.set([]);

    this.canViewChannels.set(true);
    this.canSendMessages.set(false);
    this.currentOpenedChannel.set(null);
    this.chatMessages.set([]);
    this.isLoading.set(false);
    this.isLoadingUsers.set(true);
    this.isLoadingChannels.set(false);
    this.connectionState.set(HubConnectionState.Disconnected);
    this.pendingDirectHistoryLoad = null;
    this.pendingChannelHistoryLoad = null;

    this.typingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.typingTimeouts.clear();
    if (this.usersRefreshTimer) {
      clearTimeout(this.usersRefreshTimer);
      this.usersRefreshTimer = null;
    }

    if (this.hubConnection) {
      this.disConnectConnection().catch(err => {
        console.error('ChatService: Error disconnecting during clear', err);
      });
    }

    console.log('ChatService: All chat data cleared');
  }

  isUserOnline(): string {
    const onlineUser = this.onlineUsers().find(
      (user) => user.userId === this.currentOpenedChat()?.userId
    );
    return onlineUser?.isOnline ? 'online' : 'offline';
  }

  status(userName: string): string {
    const currentChatUser = this.currentOpenedChat();
    if (!currentChatUser) {
      return 'offline';
    }

    const onlineUser = this.onlineUsers().find((user) => user.userName === userName);
    if (onlineUser?.isTyping) {
      return 'Typing...';
    }

    return this.isUserOnline();
  }

  async sendChannelMessage(channelId: number, content: string, individualReceiverId?: number): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      throw new Error('Connection not established');
    }

    const request = {
      channelId: channelId,
      content: content,
      individualReceiverId: individualReceiverId
    };

    try {
      await this.hubConnection.invoke('SendChannelMessage', request);
    } catch (error) {
      console.error('ChatService: Error sending channel message', error);
      throw error;
    }
  }

  loadChannelMessages(channelId: number, pageNumber: number): void {
    const individualReceiverId = this.currentOpenedChannel()?.individualReceiverId ?? null;

    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      console.warn('ChatService: Connection not ready, queueing channel message load');
      this.pendingChannelHistoryLoad = {
        channelId,
        pageNumber,
        individualReceiverId
      };
      this.isLoading.set(true);
      this.startConnection().catch((error) => {
        console.error('ChatService: Failed to start connection while queueing channel message load', error);
        this.isLoading.set(false);
      });
      return;
    }

    this.isLoading.set(true);
    console.log('ChatService: Loading channel messages for channel:', channelId, 'page:', pageNumber);

    this.hubConnection
      .invoke('LoadChannelMessages', channelId, pageNumber, 50, individualReceiverId)
      .then(() => {
        console.log('ChatService: LoadChannelMessages invoked successfully');
        setTimeout(() => {
          if (this.isLoading()) {
            console.warn('ChatService: LoadChannelMessages timeout - no response received');
            this.isLoading.set(false);
          }
        }, 10000);
      })
      .catch((error) => {
        console.error('ChatService: Error loading channel messages', error);
        this.isLoading.set(false);
        this.messageErrorSubject.next('Failed to load channel messages. Please try again.');
      });
  }
}
