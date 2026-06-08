import { Module } from '@nestjs/common';
import { PublicMeController } from './controllers/public-me.controller';
import { PublicDashboardController } from './controllers/public-dashboard.controller';
import { PublicMessagesController } from './controllers/public-messages.controller';
import { PublicChannelsController } from './controllers/public-channels.controller';
import { PublicTagsController } from './controllers/public-tags.controller';
import { PublicInboxViewsController } from './controllers/public-inbox-views.controller';
import { PublicMessagesService } from './services/public-messages.service';
import { PublicChannelsService } from './services/public-channels.service';
import { PublicMediaService } from './services/public-media.service';
import { PublicTagsService } from './services/public-tags.service';
import { PublicInboxViewsService } from './services/public-inbox-views.service';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ChannelHubModule } from '../channel-hub/channel-hub.module';
import { TagsModule } from '../tags/tags.module';
import { InboxViewsModule } from '../inbox-views/inbox-views.module';

@Module({
  imports: [
    AuthModule,
    DashboardModule,
    MessagingModule,
    ChannelHubModule,
    TagsModule,
    InboxViewsModule,
  ],
  controllers: [
    PublicMeController,
    PublicDashboardController,
    PublicMessagesController,
    PublicChannelsController,
    PublicTagsController,
    PublicInboxViewsController,
  ],
  providers: [
    PublicMessagesService,
    PublicChannelsService,
    PublicMediaService,
    PublicTagsService,
    PublicInboxViewsService,
  ],
})
export class PublicApiModule {}
