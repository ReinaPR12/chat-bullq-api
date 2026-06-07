import { Module } from '@nestjs/common';
import { PublicMeController } from './controllers/public-me.controller';
import { PublicDashboardController } from './controllers/public-dashboard.controller';
import { PublicMessagesController } from './controllers/public-messages.controller';
import { PublicMessagesService } from './services/public-messages.service';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [AuthModule, DashboardModule, MessagingModule],
  controllers: [PublicMeController, PublicDashboardController, PublicMessagesController],
  providers: [PublicMessagesService],
})
export class PublicApiModule {}
