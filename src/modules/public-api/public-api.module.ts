import { Module } from '@nestjs/common';
import { PublicMeController } from './controllers/public-me.controller';
import { PublicDashboardController } from './controllers/public-dashboard.controller';
import { PublicMessagesController } from './controllers/public-messages.controller';
import { PublicChannelsController } from './controllers/public-channels.controller';
import { PublicMessagesService } from './services/public-messages.service';
import { PublicChannelsService } from './services/public-channels.service';
import { PublicMediaService } from './services/public-media.service';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ChannelHubModule } from '../channel-hub/channel-hub.module';

@Module({
  imports: [AuthModule, DashboardModule, MessagingModule, ChannelHubModule],
  controllers: [
    PublicMeController,
    PublicDashboardController,
    PublicMessagesController,
    PublicChannelsController,
  ],
  providers: [PublicMessagesService, PublicChannelsService, PublicMediaService],
})
export class PublicApiModule {}
