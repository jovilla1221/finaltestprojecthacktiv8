import { Module } from '@nestjs/common';
import { AiAssistantController, AiPublicAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';

@Module({
  controllers: [AiAssistantController, AiPublicAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
