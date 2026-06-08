import { Module } from '@nestjs/common';
import { PublicMeController } from './controllers/public-me.controller';
import { PublicDashboardController } from './controllers/public-dashboard.controller';
import { PublicMessagesController } from './controllers/public-messages.controller';
import { PublicChannelsController } from './controllers/public-channels.controller';
import { PublicTagsController } from './controllers/public-tags.controller';
import { PublicInboxViewsController } from './controllers/public-inbox-views.controller';
import { PublicChatbotController } from './controllers/public-chatbot.controller';
import { PublicAiAgentsController } from './controllers/public-ai-agents.controller';
import { PublicConversationAiController } from './controllers/public-conversation-ai.controller';
import { PublicConversationsController } from './controllers/public-conversations.controller';
import { PublicAiAgentsService } from './services/public-ai-agents.service';
import { PublicMessagesService } from './services/public-messages.service';
import { PublicChannelsService } from './services/public-channels.service';
import { PublicMediaService } from './services/public-media.service';
import { PublicTagsService } from './services/public-tags.service';
import { PublicInboxViewsService } from './services/public-inbox-views.service';
import { PublicChatbotService } from './services/public-chatbot.service';
import { PublicConversationsService } from './services/public-conversations.service';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { MessageNodeExecutor } from '../chatbot/engine/node-executors/message-node.executor';
import { MenuNodeExecutor } from '../chatbot/engine/node-executors/menu-node.executor';
import { ConditionNodeExecutor } from '../chatbot/engine/node-executors/condition-node.executor';
import { WaitNodeExecutor } from '../chatbot/engine/node-executors/wait-node.executor';
import { TransferNodeExecutor } from '../chatbot/engine/node-executors/transfer-node.executor';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ChannelHubModule } from '../channel-hub/channel-hub.module';
import { TagsModule } from '../tags/tags.module';
import { InboxViewsModule } from '../inbox-views/inbox-views.module';
import { AiAgentsModule } from '../ai-agents/ai-agents.module';

@Module({
  imports: [
    AuthModule,
    DashboardModule,
    MessagingModule,
    ChannelHubModule,
    TagsModule,
    InboxViewsModule,
    ChatbotModule,
    AiAgentsModule,
  ],
  controllers: [
    PublicMeController,
    PublicDashboardController,
    PublicMessagesController,
    PublicChannelsController,
    PublicTagsController,
    PublicInboxViewsController,
    PublicChatbotController,
    PublicAiAgentsController,
    PublicConversationAiController,
    PublicConversationsController,
  ],
  providers: [
    PublicMessagesService,
    PublicChannelsService,
    PublicMediaService,
    PublicTagsService,
    PublicInboxViewsService,
    PublicChatbotService,
    PublicAiAgentsService,
    PublicConversationsService,
    MessageNodeExecutor,
    MenuNodeExecutor,
    ConditionNodeExecutor,
    WaitNodeExecutor,
    TransferNodeExecutor,
  ],
})
export class PublicApiModule {}
