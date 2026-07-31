import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiAssistantService } from './ai-assistant.service';
import { ChatMessageDto } from './ai-assistant.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@mrikipos/shared-types';

@Controller('v1/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiAssistantController {
  constructor(private readonly aiService: AiAssistantService) {}

  /**
   * POST /v1/ai/chat
   * Kirim pesan ke AI assistant.
   * Rate limit: 20 request/menit per user.
   */
  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.KASIR, UserRole.STAFF)
  async chat(@Body() dto: ChatMessageDto, @CurrentUser() user: any) {
    const result = await this.aiService.chat(dto, user);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /v1/ai/conversations
   * Daftar percakapan user.
   */
  @Get('conversations')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.KASIR, UserRole.STAFF)
  async getConversations(
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.aiService.getConversations(tenantId, userId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /v1/ai/conversations/:id
   * Detail percakapan + messages.
   */
  @Get('conversations/:id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.KASIR, UserRole.STAFF)
  async getConversation(
    @Param('id') id: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.aiService.getConversation(id, tenantId, userId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * DELETE /v1/ai/conversations/:id
   * Hapus percakapan.
   */
  @Delete('conversations/:id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.KASIR, UserRole.STAFF)
  async deleteConversation(
    @Param('id') id: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.aiService.deleteConversation(id, tenantId, userId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Controller khusus Public / Demo AI Assistant (tanpa JWT Guard untuk pengujian UI/Frontend demo)
 */
@Controller('v1/public-ai')
export class AiPublicAssistantController {
  constructor(private readonly aiService: AiAssistantService) {}

  @Post('chat')
  async publicChat(@Body() dto: { message: string }) {
    // Context user demo
    const mockUser = {
      id: 'demo-user-1',
      tenant_id: 'tenant-demo',
      outlet_id: 'outlet-demo',
      role: 'OWNER',
    };
    const result = await this.aiService.chat({ message: dto.message }, mockUser);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
