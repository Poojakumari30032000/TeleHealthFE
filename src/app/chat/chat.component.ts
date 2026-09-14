import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  SimpleChanges,
  ViewChild,
  signal
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PipeModule } from 'app/shared/pipes/pipe.module';
import { SharedModule } from 'app/shared/shared.module';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { Subject, takeUntil, filter } from 'rxjs';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { GeneralService } from 'app/shared/services/general.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { ChatService } from './chat.service';
import { HubConnectionState } from '@microsoft/signalr';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzInputModule,
    NzDropDownModule,
    NzButtonModule,
    NzSelectModule,
    NzModalModule,
    PipeModule,
    PickerComponent,
    SharedModule
  ],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent {

  @Input() embeddedInView = false;
  @Input() initialDirectUserId: number | null = null;
  @Input() initialChannelId: number | null = null;
  @Input() initialChannelName: string | null = null;

  @Input() initialPatientId: number | null = null;

  @ViewChild('msgBox', { static: false }) msgBox!: ElementRef;

  users: Array<{
    userId: string;
    userName: string;
    userType:string;
    lastMessage: string;
    lastMsgTime: string;
    profilePic: string;
    connectionId: string;
    isOnline: boolean;
    isTyping: boolean;
    facilityName: string;
  }> = [];
  messages: any[] = [];

  selectedUser: any = null;
  lgBreakpoint: number = 1024;
  screenWidth: number = 0;
  messageInput: string = '';
  showEmojiPicker: boolean = false;
  showComposeModal: boolean = false;
  composeUsers: Array<{
    userId: string;
    userName: string;
    userType: string;
    facilityName: string;
  }> = [];
  isLoadingComposeUsers: boolean = false;

  primaryColor: string = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
  isDarkMode: boolean = false;

  dynamicHeight: number = 250;
  textareaMaxHeight: number = 4 * 24;
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  searchTerm: string = '';
  composeSearchTerm: string = '';
  public pageNumber: number = 1;
  showChannelsTab: boolean = false;

  public currentUserId: number = this.auth.getUserId() || 0;
  private destroy$ = new Subject<void>();
  private deepLinkChatUserId: string | null = null;
  private deepLinkChannelId: number | null = null;
  private deepLinkRetryCount = 0;
  private deepLinkRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly deepLinkMaxRetries = 20;
  private readonly newMessageReceivedHandler = () => this.scrollToBottom(true);
  private shouldScrollToLatestOnLoad = false;

  public userRoleId = signal<number>(this.auth.getUserRoleId() || 0);

  public shouldShowInput = signal<boolean>(true);

  constructor(
    public cdr: ChangeDetectorRef,
    private notification: NzNotificationService,
    public chatService: ChatService,
    private auth: AuthService,
    private generalService: GeneralService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  @HostListener('window:resize', ['$event'])
  onResize(_event: Event): void {
    this.screenWidth = window.innerWidth;
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  closeEmojiPicker(): void {
    this.showEmojiPicker = false;
    this.cdr.detectChanges();
  }

  private previousUserId: number | null = null;
  private previousRoleId: number | null = null;

  userRole : string | null = this.auth.getUserRole();

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.embeddedInView) return;

    const embeddedChannelId = Number(this.initialChannelId || 0);
    if (embeddedChannelId > 0) {
      this.ensureEmbeddedChannelSelection(embeddedChannelId);
      return;
    }

    const channelIdChanged = !!changes['initialChannelId'];
    const nextChannelId = Number(this.initialChannelId || 0);

    const userIdChanged = !!changes['initialDirectUserId'];
    const nextUserId = Number(this.initialDirectUserId || 0);

    const patientIdChanged = !!changes['initialPatientId'];
    const nextPatientId = Number(this.initialPatientId || 0);

    if (channelIdChanged && nextChannelId > 0) {
      this.setDeepLinkChannelAndTryOpen(nextChannelId);
      return;
    }

    if (patientIdChanged && nextPatientId > 0) {
      this.ensureEmbeddedPatientChannelSelection(nextPatientId);
      return;
    }

    if (this.canShowDirectMessages && userIdChanged && nextUserId > 0) {
      this.setDeepLinkUserAndTryOpen(String(nextUserId));
    }
  }

  ngOnInit(): void {
    this.screenWidth = window.innerWidth;

    this.userRole = this.auth.getUserRole();

    const currentUserId = this.auth.getUserId() || 0;
    const currentRoleId = this.auth.getUserRoleId() || 0;

    if (this.previousUserId !== null &&
        (this.previousUserId !== currentUserId || this.previousRoleId !== currentRoleId)) {
      console.log('ChatComponent: User or role changed, clearing and reinitializing');

      this.chatService.clearAllData();

      this.showChannelsTab = this.shouldDefaultToChannels;
      this.messageInput = '';
      this.users = [];
    }

    this.previousUserId = currentUserId;
    this.previousRoleId = currentRoleId;

    this.userRoleId.set(currentRoleId);
    console.log('ChatComponent: Initialized with userId:', currentUserId, 'roleId:', currentRoleId);

    if (this.shouldDefaultToChannels) {
      this.showChannelsTab = true;
    }

    if (this.isPatientUser) {
      this.chatService.currentOpenedChat.set(null);
    }

    this.updateMessageInputVisibility();

    this.chatService.startConnection().catch((error) => {
      console.error('Failed to start chat connection:', error);
    });

    this.getUsers();

    this.chatService.canViewChannels.set(Number(this.auth.getUserRoleId() || 0) !== 3);
    this.getChannels();
    if (!this.embeddedInView && this.canShowDirectMessages) {
      this.watchDeepLinkQueryParams();
    } else if (Number(this.initialChannelId || 0) > 0) {
      this.ensureEmbeddedChannelSelection(Number(this.initialChannelId));
    } else if (this.canShowDirectMessages && Number(this.initialDirectUserId || 0) > 0) {
      this.setDeepLinkUserAndTryOpen(String(Number(this.initialDirectUserId)));
    }
    window.addEventListener('newMessageReceived', this.newMessageReceivedHandler);

    this.chatService.messageError$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (errorMessage) => {
        this.notification.error('Message Error', errorMessage, {
          nzDuration: 5000,
          nzPlacement: 'topRight'
        });
        this.cdr.detectChanges();
      }
    });

    this.chatService.messageListLoaded$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (!this.shouldScrollToLatestOnLoad || this.pageNumber !== 1) {
        return;
      }
      this.shouldScrollToLatestOnLoad = false;
      this.scrollToBottom(true);
    });

    this.router.events
      .pipe(
        takeUntil(this.destroy$),
        filter((event): event is NavigationEnd => event instanceof NavigationEnd)
      )
      .subscribe((event) => {
        if (!this.embeddedInView && !event.urlAfterRedirects.includes('/chat')) {
          this.resetOpenedConversationState();
          return;
        }

        if (event.urlAfterRedirects.includes('/chat')) {
          const currentUserId = this.auth.getUserId() || 0;
          const currentRoleId = this.auth.getUserRoleId() || 0;

          if (this.previousUserId !== null &&
              (this.previousUserId !== currentUserId || this.previousRoleId !== currentRoleId)) {
            console.log('ChatComponent: Route change detected - user/role changed, reinitializing');

            this.chatService.clearAllData();
            this.showChannelsTab = this.shouldDefaultToChannels;
            this.messageInput = '';
            this.users = [];
            this.previousUserId = currentUserId;
            this.previousRoleId = currentRoleId;
            this.userRoleId.set(currentRoleId);

            this.chatService.startConnection().catch((error) => {
              console.error('Failed to start chat connection:', error);
            });
            this.getUsers();
            this.getChannels();
            this.updateMessageInputVisibility();
            this.cdr.detectChanges();
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.resetOpenedConversationState();

    if (this.embeddedInView) {
      this.chatService.disConnectConnection();
    }
    window.removeEventListener('newMessageReceived', this.newMessageReceivedHandler);
    this.clearDeepLinkRetryTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resetOpenedConversationState(): void {
    this.chatService.currentOpenedChat.set(null);
    this.chatService.currentOpenedChannel.set(null);
    this.chatService.chatMessages.set([]);
    this.pageNumber = 1;
    this.updateMessageInputVisibility();
  }

  private watchDeepLinkQueryParams(): void {
    this.activatedRoute.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const userIdParam = (params.get('userId') || '').trim();
      if (userIdParam) {
        this.setDeepLinkUserAndTryOpen(userIdParam);
        return;
      }

      const channelIdParam = Number((params.get('channelId') || '').trim());
      if (channelIdParam > 0) {
        this.setDeepLinkChannelAndTryOpen(channelIdParam);
      }
    });
  }

  private setDeepLinkUserAndTryOpen(userId: string): void {
    this.deepLinkChatUserId = userId;
    this.deepLinkChannelId = null;
    this.deepLinkRetryCount = 0;
    this.showChannelsTab = false;
    this.chatService.currentOpenedChannel.set(null);
    this.updateMessageInputVisibility();
    this.tryOpenDeepLinkedConversation();
  }

  private setDeepLinkChannelAndTryOpen(channelId: number): void {
    this.deepLinkChannelId = channelId;
    this.deepLinkChatUserId = null;
    this.deepLinkRetryCount = 0;
    this.showChannelsTab = true;
    this.chatService.currentOpenedChat.set(null);
    this.updateMessageInputVisibility();
    this.tryOpenDeepLinkedChannel();
  }

  private ensureEmbeddedChannelSelection(channelId: number): void {
    if (!this.embeddedInView || channelId <= 0) return;

    const currentChannelId = Number(this.chatService.currentOpenedChannel()?.channelId || 0);
    if (currentChannelId === channelId) return;

    this.showChannelsTab = true;
    this.deepLinkChatUserId = null;
    this.deepLinkChannelId = null;
    this.deepLinkRetryCount = 0;
    this.clearDeepLinkRetryTimer();

    const matchedChannel = this.chatService.chatChannels().find(
      (channel) => Number(channel?.channelId || 0) === channelId
    );

    if (matchedChannel) {
      this.selectChannel(matchedChannel);
      return;
    }

    this.selectChannel({
      channelId,
      channelName: (this.initialChannelName || '').trim() || 'Treatment Channel',
      channelType: 'Treatment',
      unreadCount: 0,
      patientId: undefined,
      treatmentId: undefined
    });
  }

  private ensureEmbeddedPatientChannelSelection(patientId: number): void {
    if (!this.embeddedInView || patientId <= 0) return;

    const currentChannel = this.chatService.currentOpenedChannel();
    if (currentChannel && Number(currentChannel.patientId || 0) === patientId) return;

    const matchedChannel = this.chatService.chatChannels().find(
      (channel) => Number(channel?.patientId || 0) === patientId
    );

    if (matchedChannel) {
      this.showChannelsTab = true;
      this.deepLinkChatUserId = null;
      this.deepLinkChannelId = null;
      this.cdr.markForCheck();
      this.selectChannel(matchedChannel);
    }
  }

  private tryOpenDeepLinkedConversation(): void {

    if (this.embeddedInView && Number(this.initialChannelId || 0) > 0) {
      this.deepLinkChatUserId = null;
      this.clearDeepLinkRetryTimer();
      return;
    }

    const targetUserId = this.deepLinkChatUserId;
    if (!targetUserId) return;

    const onlineUser = this.chatService.onlineUsers().find((item) => item.userId === targetUserId);
    const userFromList = this.users.find((item) => item.userId === targetUserId);
    const matchedUser = onlineUser || userFromList;

    if (matchedUser) {
      this.deepLinkChatUserId = null;
      this.deepLinkRetryCount = 0;
      this.clearDeepLinkRetryTimer();
      this.selectUser(matchedUser);
      if (!this.embeddedInView) {
        this.clearDeepLinkUserIdQueryParam();
      }
      return;
    }

    if (this.deepLinkRetryCount >= this.deepLinkMaxRetries) {
      this.notification.warning('Conversation Unavailable', 'Patient conversation is not available for this account.', {
        nzDuration: 4000,
        nzPlacement: 'topRight'
      });
      this.deepLinkChatUserId = null;
      this.deepLinkRetryCount = 0;
      this.clearDeepLinkRetryTimer();
      if (!this.embeddedInView) {
        this.clearDeepLinkUserIdQueryParam();
      }
      return;
    }

    this.deepLinkRetryCount += 1;
    if (this.deepLinkRetryCount % 3 === 1) {
      this.chatService.getUsersChat();
      this.getUsers();
    }

    this.clearDeepLinkRetryTimer();
    this.deepLinkRetryTimer = setTimeout(() => {
      this.tryOpenDeepLinkedConversation();
    }, 400);
  }

  private tryOpenDeepLinkedChannel(): void {
    const targetChannelId = Number(this.deepLinkChannelId || 0);
    if (!targetChannelId) return;

    const matchedChannel = this.chatService.chatChannels().find(
      (channel) => Number(channel?.channelId || 0) === targetChannelId
    );

    if (matchedChannel) {
      this.deepLinkChannelId = null;
      this.deepLinkRetryCount = 0;
      this.clearDeepLinkRetryTimer();
      this.selectChannel(matchedChannel);
      return;
    }

    if (this.deepLinkRetryCount >= this.deepLinkMaxRetries) {

      if (this.embeddedInView && targetChannelId > 0) {
        const fallbackChannel = {
          channelId: targetChannelId,
          channelName: (this.initialChannelName || '').trim() || 'Treatment Channel',
          channelType: 'Treatment',
          unreadCount: 0,
          patientId: undefined,
          treatmentId: undefined
        };

        this.deepLinkChannelId = null;
        this.deepLinkRetryCount = 0;
        this.clearDeepLinkRetryTimer();
        this.selectChannel(fallbackChannel);
        return;
      }

      this.notification.warning('Channel Unavailable', 'Treatment channel is not available for this account.', {
        nzDuration: 4000,
        nzPlacement: 'topRight'
      });
      this.deepLinkChannelId = null;
      this.deepLinkRetryCount = 0;
      this.clearDeepLinkRetryTimer();
      return;
    }

    this.deepLinkRetryCount += 1;
    if (this.deepLinkRetryCount % 3 === 1) {
      this.getChannels();
    }

    this.clearDeepLinkRetryTimer();
    this.deepLinkRetryTimer = setTimeout(() => {
      this.tryOpenDeepLinkedChannel();
    }, 400);
  }

  private clearDeepLinkRetryTimer(): void {
    if (!this.deepLinkRetryTimer) return;
    clearTimeout(this.deepLinkRetryTimer);
    this.deepLinkRetryTimer = null;
  }

  private clearDeepLinkUserIdQueryParam(): void {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { userId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    }).catch(() => {});
  }

  isEmbeddedConversationLoading(): boolean {
    return this.embeddedInView && (!!this.deepLinkChatUserId || !!this.deepLinkChannelId);
  }

  getUsers(): void {
    if (this.isPatientUser) {
      this.users = [];
      this.chatService.onlineUsers.set([]);
      this.chatService.isLoadingUsers.set(false);
      this.cdr.detectChanges();
      return;
    }

    this.users = [];
    const roleId = this.auth.getUserRoleId() || 0;
    const facilityID = Number(localStorage.getItem('FOS'));
    let url : string = `Chats/getAllUsersforChat?UserId=${this.currentUserId}&RoleId=${roleId}`;
    if(facilityID > 0 && roleId !== 4){
      url = `${url}&FacilityId=${facilityID}`;
    }
    this.generalService.commonGet(url).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response?.status === 1 && response?.data) {
          response.data.forEach((element: any) => {
            this.users.push({
              userId: element.userId.toString(),
              userName: element.userName,
              userType: element.userType,
              facilityName: element.facilityName || '',
              lastMessage: '',
              profilePic: element?.profilePic || 'assets/img/userPlaceholderImg.jpg',
              lastMsgTime: '',
              connectionId: '',
              isOnline: false,
              isTyping: false
            });
          });
        } else {
          this.users = [];
          console.warn('Failed to fetch USer data:', response?.message);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.users = [];
        console.error('API Error:', error);
      }
    });
  }

  selectUser(user: any) {
    if (this.chatService.currentOpenedChat()?.userId === user.userId) return;

    this.chatService.currentOpenedChannel.set(null);

    this.chatService.isLoading.set(true);

    this.chatService.chatMessages.set([]);
    this.pageNumber = 1;

    this.chatService.onlineUsers.update(users =>
      users.map(u =>
        u.userId === user.userId
          ? { ...u, unreadCount: 0 }
          : u
      )
    );

    const User = this.chatService.onlineUsers().find(item => item.userId === user.userId);
    if (User) {

      this.chatService.currentOpenedChat.set({ ...User, unreadCount: 0 });
    } else {

      const chatUser = {
        userId: user.userId,
        userName: user.userName || 'Unknown',
        lastMessage: user.lastMessage || '',
        lastMsgTime: user.lastMsgTime || '',
        profilePic: user.profilePic || 'assets/img/userPlaceholderImg.jpg',
        connectionId: user.connectionId || '',
        isOnline: user.isOnline || false,
        isTyping: false,
        facilityName: user.facilityName || '',
        unreadCount: 0
      };
      this.chatService.currentOpenedChat.set(chatUser);
    }

    this.updateMessageInputVisibility();

    this.shouldScrollToLatestOnLoad = true;
    this.chatService.loadMessage(this.pageNumber);
    this.markDirectMessagesAsRead(user.userId).then(() => {
      this.chatService.getUsersChat();
      this.cdr.detectChanges();
    });

    this.cdr.detectChanges();
  }

  private markDirectMessagesAsRead(recipientId: string): Promise<void> {
    return new Promise((resolve) => {
      const url = `Chats/markDirectMessagesAsRead?recipientId=${recipientId}`;

      this.generalService.commonGet(url).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          if (response?.status === 1) {
            console.log('ChatComponent: Direct messages marked as read on backend via HTTP API');
            resolve();
          } else {
            console.warn('ChatComponent: Failed to mark direct messages as read:', response?.message);
            resolve();
          }
        },
        error: (error) => {
          console.error('ChatComponent: Error marking direct messages as read:', error);
          resolve();
        }
      });
    });
  }

  scrollToBottom(force: boolean = false): void {
    if (!this.msgBox) return;
    setTimeout(() => {
      const element = this.msgBox.nativeElement;
      const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;

      if (force || isNearBottom) {
        element.scrollTo({
          top: element.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 100);
  }

  scrollToTop() {
    if (!this.msgBox) return;
    setTimeout(() => {
      this.msgBox.nativeElement.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }, 0);
  }

  loadMessage(): void {
    this.pageNumber++;
    this.chatService.loadMessage(this.pageNumber);
    this.scrollToTop();
  }

  handleEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        return;
      }
      event.preventDefault();

      if (this.chatService.currentOpenedChannel()) {

        if (this.canSendMessageInChannel()) {
          this.sendChannelMessage();
        }
      } else if (this.chatService.currentOpenedChat()) {
        this.sendMessage();
      }
    }
  }

  sendMessage(): void {
    const content = this.messageInput.trim();
    if (!content || !this.chatService.currentOpenedChat()) return;

    const currentChat = this.chatService.currentOpenedChat();
    if (!currentChat) return;

    const originalMessage = content;
    const optimisticId = Date.now();

    const optimisticMessage = {
      id: optimisticId,
      senderId: this.currentUserId.toString(),
      receiverId: currentChat.userId,
      content: content,
      type: 'text',
      isRead: false,
      time: 'Today',
      rawTime: new Date().toISOString(),
    };

      this.chatService.chatMessages.update(messages => [...messages, optimisticMessage]);
      this.messageInput = '';
      this.scrollToBottom(true);
      this.cdr.detectChanges();

    const newMessage = {
      id: 0,
      senderId: this.currentUserId.toString(),
      receiverId: currentChat.userId,
      content: content,
      type: 'text',
      isRead: false,
      time: 'Now',
    };

    this.chatService.sendMessage(newMessage).then(() => {

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      this.chatService.onlineUsers.update(users =>
        users.map(user => {
          if (user.userId === currentChat.userId) {
            return {
              ...user,
              lastMessage: content,
              lastMsgTime: timeStr
            };
          }
          return user;
        })
      );

      console.log('Message sent successfully');
    }).catch((error) => {
      console.error('Error sending message:', error);
      const errorMessage = error?.message || 'Failed to send message. Please try again.';
      this.notification.error('Send Message Failed', errorMessage, {
        nzDuration: 5000,
        nzPlacement: 'topRight'
      });

      this.chatService.chatMessages.update(messages =>
        messages.filter(m => m.id !== optimisticId)
      );
      this.messageInput = originalMessage;
      this.cdr.detectChanges();
    });
  }

  toggleEmojiPicker(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.showEmojiPicker = !this.showEmojiPicker;
    this.cdr.detectChanges();
  }

  addEmoji(event: any): void {
    this.messageInput += event.emoji.native;
    this.cdr.detectChanges();
  }

  adjustHeight(textarea: HTMLTextAreaElement): void {
    const baseHeight = 250;
    const minHeight = 52;
    const currentHeight = textarea.scrollHeight;

    if (minHeight === currentHeight) {
      if (this.dynamicHeight !== 250) {
        this.dynamicHeight = 250;
        this.cdr.detectChanges();
      }
      return;
    }

    if (currentHeight <= this.textareaMaxHeight) {
      textarea.style.height = `${currentHeight}px`;
    } else {
      textarea.style.height = `${this.textareaMaxHeight}px`;
      textarea.style.overflowY = 'auto';
    }
    this.dynamicHeight = (baseHeight + Math.min(currentHeight, this.textareaMaxHeight)) - minHeight;
  }

  getMessageTime(message: any): string {
    if (!message.time) return '';
    const sourceTime = message.rawTime || message.time;
    const parsedDate = new Date(sourceTime);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    if (message.time.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = new Date(message.time);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    return String(message.time);
  }

  goBack(): void {
    this.chatService.currentOpenedChat.set(null);
    this.chatService.currentOpenedChannel.set(null);
    this.chatService.chatMessages.set([]);
    this.updateMessageInputVisibility();
    this.cdr.detectChanges();
  }

  getConnectionStatusText(): string {
    const state = this.chatService.connectionState();
    switch(state) {
      case HubConnectionState.Connected: return 'Connected';
      case HubConnectionState.Reconnecting: return 'Reconnecting...';
      case HubConnectionState.Disconnected: return 'Disconnected';
      case HubConnectionState.Connecting: return 'Connecting...';
      default: return 'Unknown';
    }
  }

  isConnected(): boolean {
    return this.chatService.connectionState() === HubConnectionState.Connected;
  }

  isReconnecting(): boolean {
    return this.chatService.connectionState() === HubConnectionState.Reconnecting;
  }

  get currentUserRoleId(): number {
    return this.userRoleId();
  }

  get isPatientUser(): boolean {
    return this.userRole === 'Patient' || Number(this.userRoleId()) === 6;
  }

  get canShowDirectMessages(): boolean {
    return !this.isPatientUser;
  }

  get shouldDefaultToChannels(): boolean {
    return this.isPatientUser || this.userRole === 'Global Admin';
  }

  canSendMessageInChannel(): boolean {

    const roleId = this.userRoleId();
    const isChannelOpen = !!this.chatService.currentOpenedChannel();

    if (!isChannelOpen) {
      return true;
    }

    if (Number(roleId) === 3) {
      return this.chatService.canSendMessages();
    }

    return true;
  }

  switchToDirectMessages(): void {
    if (!this.canShowDirectMessages) return;
    if (!this.showChannelsTab) return;

    this.showChannelsTab = false;

    if (this.chatService.currentOpenedChannel()) {
      this.chatService.currentOpenedChannel.set(null);
      this.chatService.chatMessages.set([]);
    }
    this.updateMessageInputVisibility();
    this.cdr.detectChanges();
  }

  switchToChannels(): void {
    if (this.showChannelsTab) return;

    this.showChannelsTab = true;

    if (this.chatService.currentOpenedChat()) {
      this.chatService.currentOpenedChat.set(null);
      this.chatService.chatMessages.set([]);
    }
    this.updateMessageInputVisibility();
    this.cdr.detectChanges();
  }

  updateMessageInputVisibility(): void {
    const currentChannel = this.chatService.currentOpenedChannel();
    const roleId = this.userRoleId();

    if (!currentChannel) {
      this.shouldShowInput.set(true);
      return;
    }

    if (Number(roleId) === 3) {
      this.shouldShowInput.set(this.chatService.canSendMessages());
    } else {
      this.shouldShowInput.set(true);
    }
  }

  shouldShowMessageInput(): boolean {

    return this.shouldShowInput();
  }

  openCurrentChannelPatientDetail(): void {
    const patientId = Number(this.chatService.currentOpenedChannel()?.patientId || 0);
    if (!patientId) {
      console.warn('ChatComponent: Cannot open patient detail - no patientId on selected channel');
      return;
    }

    this.router.navigate(['patient/detail', patientId]);
  }

  openCurrentChannelTreatmentDetail(): void {
    const treatmentId = Number(this.chatService.currentOpenedChannel()?.treatmentId || 0);
    if (!treatmentId) {
      console.warn('ChatComponent: Cannot open treatment detail - no treatmentId on selected channel');
      return;
    }

    this.router.navigate(['treatment/detail', treatmentId]);
  }

  openComposeModal(): void {
    this.showComposeModal = true;
    this.composeSearchTerm = '';
    this.loadComposeUsers();
    this.cdr.detectChanges();
  }

  closeComposeModal(): void {
    this.showComposeModal = false;
    this.composeSearchTerm = '';
    this.composeUsers = [];
    this.cdr.detectChanges();
  }

  loadComposeUsers(): void {
    this.isLoadingComposeUsers = true;
    const roleId = this.auth.getUserRoleId() || 0;
    const facilityID = Number(localStorage.getItem('FOS'));
    let url: string = `Chats/getUsersForCompose?UserId=${this.currentUserId}&RoleId=${roleId}`;
    if (facilityID > 0 && roleId !== 4) {
      url = `${url}&FacilityId=${facilityID}`;
    }
    this.generalService.commonGet(url).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.isLoadingComposeUsers = false;
        if (response?.status === 1 && response?.data) {
          this.composeUsers = response.data.map((element: any) => ({
            userId: element.userId.toString(),
            userName: element.userName,
            userType: element.userType,
            facilityName: element.facilityName || ''
          }));
        } else {
          this.composeUsers = [];
          console.warn('Failed to fetch compose users:', response?.message);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoadingComposeUsers = false;
        this.composeUsers = [];
        console.error('API Error loading compose users:', error);
        this.cdr.detectChanges();
      }
    });
  }

  selectComposeUser(user: any): void {
    this.closeComposeModal();

    const existingUser = this.chatService.onlineUsers().find(u => u.userId === user.userId);
    if (existingUser) {
      this.chatService.currentOpenedChat.set(existingUser);
    } else {

      const newUser = {
        userId: user.userId,
        userName: user.userName,
        lastMessage: '',
        lastMsgTime: '',
        profilePic: 'assets/img/userPlaceholderImg.jpg',
        connectionId: '',
        isOnline: false,
        isTyping: false,
        facilityName: user.facilityName,
        unreadCount: 0
      };
      this.chatService.currentOpenedChat.set(newUser);
    }
    this.chatService.isLoading.set(true);
    this.chatService.chatMessages.update(() => []);
    this.pageNumber = 1;
    this.shouldScrollToLatestOnLoad = true;
    this.chatService.loadMessage(this.pageNumber);
  }

  getChannels(): void {
    const roleId = Number(this.auth.getUserRoleId() || 0);

    this.chatService.loadChannels().pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (roleId === 3) {
        if (!this.chatService.canViewChannels()) {

          this.showChannelsTab = false;
        }
      } else if (this.isPatientUser) {
        this.showChannelsTab = true;
      }

      if (this.embeddedInView && Number(this.initialPatientId || 0) > 0) {
        this.ensureEmbeddedPatientChannelSelection(Number(this.initialPatientId));
      }

      this.updateMessageInputVisibility();
      this.cdr.detectChanges();
    });
  }

  selectChannel(channel: any): void {
    if (this.chatService.currentOpenedChannel()?.channelId === channel.channelId &&
        this.chatService.currentOpenedChannel()?.individualReceiverId === channel.individualReceiverId) return;

    this.chatService.currentOpenedChat.set(null);

    this.chatService.isLoading.set(true);

    this.chatService.chatMessages.set([]);
    this.pageNumber = 1;

    this.chatService.chatChannels.update(channels =>
      channels.map(ch =>
        (ch.channelId === channel.channelId && ch.individualReceiverId === channel.individualReceiverId)
          ? { ...ch, unreadCount: 0 }
          : ch
      )
    );

    this.chatService.currentOpenedChannel.set({ ...channel, unreadCount: 0 });

    this.updateMessageInputVisibility();

    this.cdr.detectChanges();

    if (channel.channelId) {
      this.shouldScrollToLatestOnLoad = true;
      this.chatService.loadChannelMessages(channel.channelId, this.pageNumber);

      this.markChannelMessagesAsRead(channel.channelId, channel.individualReceiverId).then(() => {
        this.getChannels();
        this.cdr.detectChanges();
      });
    } else if (channel.isIndividualMessage && channel.individualReceiverId) {

      this.chatService.chatMessages.set([]);
      this.cdr.detectChanges();
    }
  }

  private markChannelMessagesAsRead(channelId: number, individualReceiverId: number | undefined): Promise<void> {
    return new Promise((resolve) => {

      let url = `Chats/markChannelMessagesAsRead?channelId=${channelId}`;
      if (individualReceiverId) {
        url += `&individualReceiverId=${individualReceiverId}`;
      }

      this.generalService.commonGet(url).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          if (response?.status === 1) {
            console.log('ChatComponent: Channel messages marked as read on backend via HTTP API');
            resolve();
          } else {
            console.warn('ChatComponent: Failed to mark channel messages as read:', response?.message);
            resolve();
          }
        },
        error: (error) => {
          console.error('ChatComponent: Error marking channel messages as read:', error);
          resolve();
        }
      });
    });
  }

  sendChannelMessage(): void {

    if (!this.canSendMessageInChannel()) {
      console.warn('ChatComponent: Clinic Admin attempted to send channel message - blocked');
      return;
    }

    const content = this.messageInput.trim();
    const currentChannel = this.chatService.currentOpenedChannel();
    if (!content || !currentChannel || !currentChannel.channelId) return;

    const originalMessage = content;
    const optimisticId = Date.now();

    const optimisticMessage = {
      id: optimisticId,
      senderId: this.currentUserId.toString(),
      receiverId: currentChannel.channelId.toString(),
      content: content,
      type: 'text',
      isRead: false,
      time: 'Today',
      rawTime: new Date().toISOString(),
    };

    this.chatService.chatMessages.update(messages => [...messages, optimisticMessage]);
    this.messageInput = '';
    this.scrollToBottom(true);
    this.cdr.detectChanges();

    this.chatService.sendChannelMessage(
      currentChannel.channelId,
      content,
      currentChannel.individualReceiverId
    ).then(() => {
      console.log('Channel message sent successfully');
    }).catch((error) => {
      console.error('Error sending channel message:', error);
      const errorMessage = error?.message || 'Failed to send message. Please try again.';
      this.notification.error('Send Message Failed', errorMessage, {
        nzDuration: 5000,
        nzPlacement: 'topRight'
      });

      this.chatService.chatMessages.update(messages =>
        messages.filter(m => m.id !== optimisticId)
      );
      this.messageInput = originalMessage;
      this.cdr.detectChanges();
    });
  }

  loadChannelMessage(): void {
    const currentChannel = this.chatService.currentOpenedChannel();
    if (!currentChannel || !currentChannel.channelId) return;

    this.pageNumber++;
    this.chatService.loadChannelMessages(currentChannel.channelId, this.pageNumber);
    this.scrollToTop();
  }
}
