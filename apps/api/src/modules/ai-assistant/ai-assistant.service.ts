import {
  Injectable,
  Logger,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../database/prisma.service';
import { ChatMessageDto } from './ai-assistant.dto';
import { AI_TOOLS } from './ai-tools';
import { TransactionStatus } from '@mrikipos/shared-types';

/** Maximum number of past messages to include as context */
const MAX_CONTEXT_MESSAGES = 20;

/** Roles that can access financial data */
const FINANCIAL_ROLES = ['OWNER', 'MANAGER'];

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);
  private openai: OpenAI | null = null;
  private model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const baseURL = this.configService.get<string>('AI_ROUTER_BASE_URL');
    const apiKey = this.configService.get<string>('AI_ROUTER_API_KEY');
    this.model = this.configService.get<string>('AI_ROUTER_MODEL', 'gpt-4o-mini');

    if (baseURL && apiKey) {
      this.openai = new OpenAI({ baseURL, apiKey });
      this.logger.log(`AI Assistant connected to ${baseURL}, model: ${this.model}`);
    } else {
      this.logger.warn(
        'AI Assistant disabled: AI_ROUTER_BASE_URL or AI_ROUTER_API_KEY not configured',
      );
    }
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  /**
   * Process a chat message and return AI response (non-streaming).
   * Supports function calling for real-time POS data.
   */
  async chat(
    dto: ChatMessageDto,
    user: { id: string; tenant_id: string; outlet_id: string; role: string },
  ): Promise<{ conversation_id: string; response: string; title?: string }> {
    if (!this.openai) {
      throw new InternalServerErrorException(
        'AI Assistant belum dikonfigurasi. Hubungi admin untuk mengatur AI_ROUTER_BASE_URL dan AI_ROUTER_API_KEY.',
      );
    }

    // 1. Get or create conversation
    let conversationId = dto.conversation_id;
    let isNewConversation = false;

    if (!conversationId) {
      const conversation = await this.prisma.chatConversation.create({
        data: {
          tenant_id: user.tenant_id,
          user_id: user.id,
        },
      });
      conversationId = conversation.id;
      isNewConversation = true;
    } else {
      // Verify conversation belongs to user
      const existing = await this.prisma.chatConversation.findFirst({
        where: {
          id: conversationId,
          tenant_id: user.tenant_id,
          user_id: user.id,
        },
      });
      if (!existing) {
        throw new ForbiddenException('Percakapan tidak ditemukan');
      }
    }

    // 2. Save user message
    await this.prisma.chatMessage.create({
      data: {
        conversation_id: conversationId,
        role: 'user',
        content: dto.message,
      },
    });

    // 3. Load conversation history
    const history = await this.prisma.chatMessage.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
      take: MAX_CONTEXT_MESSAGES,
      select: { role: true, content: true },
    });

    // 4. Build messages array
    const systemPrompt = this.buildSystemPrompt(user);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // 5. Call LLM with function calling support
    let response: string;
    let totalTokens = 0;

    try {
      response = await this.callWithTools(messages, user, 0);
      // We don't track tokens precisely for tool-call chains; set estimate
      totalTokens = 0;
    } catch (err: any) {
      this.logger.error(`AI chat error: ${err.message}`, err.stack);
      response =
        'Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.';
    }

    // 6. Save assistant response
    await this.prisma.chatMessage.create({
      data: {
        conversation_id: conversationId,
        role: 'assistant',
        content: response,
        tokens_used: totalTokens || null,
      },
    });

    // 7. Generate title for new conversations
    let title: string | undefined;
    if (isNewConversation) {
      title = dto.message.length > 60 ? dto.message.substring(0, 57) + '...' : dto.message;
      await this.prisma.chatConversation.update({
        where: { id: conversationId },
        data: { title },
      });
    }

    return { conversation_id: conversationId!, response, title };
  }

  // ── LLM Call with Tool Support ────────────────────────────────────────────

  /**
   * Recursively call LLM, executing tool calls as needed.
   * Max 5 tool-call rounds to prevent infinite loops.
   */
  private async callWithTools(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    user: { id: string; tenant_id: string; outlet_id: string; role: string },
    depth: number,
  ): Promise<string> {
    if (depth > 5) {
      return 'Maaf, saya memerlukan terlalu banyak langkah untuk menjawab pertanyaan ini. Silakan coba pertanyaan yang lebih spesifik.';
    }

    const completion = await this.openai!.chat.completions.create({
      model: this.model,
      messages,
      tools: AI_TOOLS,
      tool_choice: 'auto',
    });

    const choice = completion.choices[0];

    if (!choice) {
      return 'Maaf, tidak ada respons dari AI. Silakan coba lagi.';
    }

    // If no tool calls, return the content directly
    if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
      return choice.message.content || 'Maaf, saya tidak bisa menjawab pertanyaan itu.';
    }

    // Process tool calls
    const updatedMessages = [
      ...messages,
      choice.message, // assistant message with tool_calls
    ];

    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const functionName = toolCall.function.name;
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        args = {};
      }

      this.logger.debug(`AI tool call: ${functionName}(${JSON.stringify(args)})`);

      let result: string;
      try {
        result = await this.executeTool(functionName, args, user);
      } catch (err: any) {
        this.logger.error(`Tool ${functionName} error: ${err.message}`);
        result = JSON.stringify({ error: `Gagal mengambil data: ${err.message}` });
      }

      updatedMessages.push({
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Recursive call with tool results
    return this.callWithTools(updatedMessages, user, depth + 1);
  }

  // ── Tool Execution ────────────────────────────────────────────────────────

  private async executeTool(
    name: string,
    args: Record<string, any>,
    user: { id: string; tenant_id: string; outlet_id: string; role: string },
  ): Promise<string> {
    const { tenant_id, outlet_id, role } = user;

    switch (name) {
      case 'get_today_sales':
        return JSON.stringify(await this.getTodaySales(tenant_id, outlet_id));

      case 'get_sales_by_period':
        return JSON.stringify(
          await this.getSalesByPeriod(
            tenant_id,
            outlet_id,
            args.date_from,
            args.date_to,
            args.period || 'daily',
          ),
        );

      case 'get_top_products':
        return JSON.stringify(
          await this.getTopProducts(tenant_id, outlet_id, args.limit || 10, args.date_from, args.date_to),
        );

      case 'get_low_stock_products':
        return JSON.stringify(await this.getLowStockProducts(tenant_id, outlet_id));

      case 'get_profit_loss':
        if (!FINANCIAL_ROLES.includes(role)) {
          return JSON.stringify({
            error: 'Anda tidak memiliki akses ke data laba rugi. Fitur ini hanya untuk OWNER dan MANAGER.',
          });
        }
        return JSON.stringify(
          await this.getProfitLoss(tenant_id, outlet_id, args.date_from, args.date_to),
        );

      case 'get_cashier_summary':
        return JSON.stringify(
          await this.getCashierSummary(tenant_id, outlet_id, args.date_from, args.date_to),
        );

      case 'search_products':
        return JSON.stringify(await this.searchProducts(tenant_id, outlet_id, args.query));

      case 'get_product_count':
        return JSON.stringify(await this.getProductCount(tenant_id, outlet_id));

      case 'get_customer_count':
        return JSON.stringify(await this.getCustomerCount(tenant_id, outlet_id));

      default:
        return JSON.stringify({ error: `Tool tidak dikenal: ${name}` });
    }
  }

  // ── Data Query Methods ────────────────────────────────────────────────────

  private async getTodaySales(tenantId: string, outletId: string) {
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    const result = await this.prisma.transaction.aggregate({
      where: {
        tenant_id: tenantId,
        outlet_id: outletId,
        status: TransactionStatus.COMPLETED,
        created_at: { gte: start, lte: end },
      },
      _sum: { grand_total: true, diskon: true },
      _count: { id: true },
    });

    return {
      tanggal: today.toISOString().split('T')[0],
      total_omzet: Number(result._sum.grand_total || 0),
      jumlah_transaksi: result._count.id,
      total_diskon: Number(result._sum.diskon || 0),
    };
  }

  private async getSalesByPeriod(
    tenantId: string,
    outletId: string,
    dateFrom: string,
    dateTo: string,
    period: string,
  ) {
    const start = new Date(dateFrom);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        tenant_id: tenantId,
        outlet_id: outletId,
        status: TransactionStatus.COMPLETED,
        created_at: { gte: start, lte: end },
      },
      select: { created_at: true, grand_total: true, diskon: true },
      orderBy: { created_at: 'asc' },
    });

    // Group by period
    const map = new Map<string, { total: number; count: number; diskon: number }>();
    for (const txn of transactions) {
      const key = this.periodKey(txn.created_at, period);
      const existing = map.get(key) || { total: 0, count: 0, diskon: 0 };
      existing.total += Number(txn.grand_total);
      existing.count += 1;
      existing.diskon += Number(txn.diskon ?? 0);
      map.set(key, existing);
    }

    return Array.from(map.entries()).map(([periode, data]) => ({
      periode,
      total_omzet: data.total,
      jumlah_transaksi: data.count,
      total_diskon: data.diskon,
    }));
  }

  private async getTopProducts(
    tenantId: string,
    outletId: string,
    limit: number,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const dateFilter: any = {};
    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      dateFilter.gte = start;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const grouped = await this.prisma.transactionItem.groupBy({
      by: ['product_id'],
      where: {
        transaction: {
          tenant_id: tenantId,
          outlet_id: outletId,
          status: TransactionStatus.COMPLETED,
          ...(Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {}),
        },
      },
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) return [];

    const productIds = grouped.map((g) => g.product_id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenant_id: tenantId },
      select: { id: true, nama: true, stok: true, harga_jual: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return grouped.map((g) => {
      const p = productMap.get(g.product_id);
      return {
        nama: p?.nama ?? 'Produk Dihapus',
        qty_terjual: g._sum.qty ?? 0,
        total_penjualan: Number(g._sum.subtotal ?? 0),
        stok_saat_ini: p?.stok ?? 0,
        harga_jual: p ? Number(p.harga_jual) : 0,
      };
    });
  }

  private async getLowStockProducts(tenantId: string, outletId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        tenant_id: tenantId,
        outlet_id: outletId,
        is_active: true,
      },
      select: {
        nama: true,
        stok: true,
        stok_minimum: true,
        satuan: true,
        harga_jual: true,
      },
      orderBy: { stok: 'asc' },
    });

    // Filter low stock in memory (stok <= stok_minimum)
    const lowStock = products.filter((p) => p.stok <= p.stok_minimum);

    return {
      total_produk_stok_rendah: lowStock.length,
      produk: lowStock.slice(0, 20).map((p) => ({
        nama: p.nama,
        stok: p.stok,
        stok_minimum: p.stok_minimum,
        satuan: p.satuan,
        harga_jual: Number(p.harga_jual),
      })),
    };
  }

  private async getProfitLoss(
    tenantId: string,
    outletId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const dateFilter: any = {};
    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      dateFilter.gte = start;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    // Default to today
    if (!dateFrom && !dateTo) {
      const today = new Date();
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      dateFilter.gte = start;
      dateFilter.lte = end;
    }

    const items = await this.prisma.transactionItem.findMany({
      where: {
        transaction: {
          tenant_id: tenantId,
          outlet_id: outletId,
          status: TransactionStatus.COMPLETED,
          created_at: dateFilter,
        },
      },
      select: {
        qty: true,
        subtotal: true,
        product: { select: { harga_beli: true } },
      },
    });

    let totalPenjualan = 0;
    let totalModal = 0;

    for (const item of items) {
      totalPenjualan += Number(item.subtotal);
      const hargaBeli = item.product?.harga_beli ? Number(item.product.harga_beli) : null;
      if (hargaBeli !== null) {
        totalModal += hargaBeli * item.qty;
      }
    }

    return {
      total_penjualan: totalPenjualan,
      total_modal: totalModal,
      laba_kotor: totalPenjualan - totalModal,
    };
  }

  private async getCashierSummary(
    tenantId: string,
    outletId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const dateFilter: any = {};
    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      dateFilter.gte = start;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    if (!dateFrom && !dateTo) {
      const today = new Date();
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      dateFilter.gte = start;
      dateFilter.lte = end;
    }

    const grouped = await this.prisma.transaction.groupBy({
      by: ['kasir_id'],
      where: {
        tenant_id: tenantId,
        outlet_id: outletId,
        status: TransactionStatus.COMPLETED,
        created_at: dateFilter,
      },
      _count: { id: true },
      _sum: { grand_total: true },
    });

    if (grouped.length === 0) return [];

    const kasirIds = grouped.map((g) => g.kasir_id);
    const users = await this.prisma.user.findMany({
      where: { id: { in: kasirIds } },
      select: { id: true, nama: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.nama]));

    return grouped.map((g) => ({
      kasir: userMap.get(g.kasir_id) ?? 'Tidak Dikenal',
      jumlah_transaksi: g._count.id,
      total_penjualan: Number(g._sum.grand_total ?? 0),
    }));
  }

  private async searchProducts(tenantId: string, outletId: string, query: string) {
    const products = await this.prisma.product.findMany({
      where: {
        tenant_id: tenantId,
        outlet_id: outletId,
        is_active: true,
        OR: [
          { nama: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        nama: true,
        harga_jual: true,
        stok: true,
        satuan: true,
        barcode: true,
        category: { select: { nama: true } },
      },
      take: 10,
    });

    return products.map((p) => ({
      nama: p.nama,
      harga_jual: Number(p.harga_jual),
      stok: p.stok,
      satuan: p.satuan,
      barcode: p.barcode,
      kategori: p.category?.nama ?? '-',
    }));
  }

  private async getProductCount(tenantId: string, outletId: string) {
    const count = await this.prisma.product.count({
      where: { tenant_id: tenantId, outlet_id: outletId, is_active: true },
    });
    return { total_produk_aktif: count };
  }

  private async getCustomerCount(tenantId: string, outletId: string) {
    const count = await this.prisma.customer.count({
      where: { tenant_id: tenantId, outlet_id: outletId },
    });
    return { total_pelanggan: count };
  }

  // ── System Prompt ─────────────────────────────────────────────────────────

  private buildSystemPrompt(user: { role: string }): string {
    const isFinancialRole = FINANCIAL_ROLES.includes(user.role);

    return `Kamu adalah "Asisten AI MrikiPOS", asisten cerdas untuk sistem kasir digital (POS) UMKM.

ATURAN:
- Selalu jawab dalam bahasa Indonesia yang sopan dan mudah dipahami.
- Format angka mata uang dalam Rupiah (Rp) dengan titik pemisah ribuan (contoh: Rp 1.500.000).
- Jika pengguna bertanya tentang data penjualan, stok, atau produk, SELALU gunakan tool/fungsi yang tersedia untuk mengambil data terbaru — JANGAN mengarang data.
- Jika tidak ada data, beritahu dengan jujur.
- Untuk pertanyaan umum tentang cara menggunakan MrikiPOS, jawab berdasarkan pengetahuan tentang fitur-fitur POS.
- Jawab dengan ringkas tapi informatif. Gunakan format tabel jika data lebih dari 3 baris.
${
  isFinancialRole
    ? '- Pengguna ini adalah ' + user.role + ', kamu boleh menampilkan data laba rugi dan keuangan.'
    : '- Pengguna ini adalah ' + user.role + '. JANGAN tampilkan data laba rugi atau keuangan. Jika diminta, jelaskan bahwa data tersebut hanya bisa diakses oleh OWNER atau MANAGER.'
}

FITUR MrikiPOS yang bisa kamu jelaskan:
- POS / Kasir: transaksi, pembayaran tunai/QRIS, hold order, cetak struk
- Produk: CRUD produk, kategori, varian, barcode, import CSV/Excel
- Inventory: stok, mutasi, stock opname, peringatan stok minimum
- Shift kasir: buka/tutup shift, modal awal, selisih kas
- Kasbon/piutang: pencatatan dan cicilan
- Pelanggan: database pelanggan dan riwayat belanja
- Laporan: penjualan, laba rugi, produk terlaris, rekap kasir, export Excel/CSV
- Approval: persetujuan aksi sensitif (void, refund, perubahan harga)
- Mode offline: transaksi tetap bisa dilakukan tanpa internet`;
  }

  // ── Conversation Management ───────────────────────────────────────────────

  async getConversations(tenantId: string, userId: string) {
    return this.prisma.chatConversation.findMany({
      where: { tenant_id: tenantId, user_id: userId },
      orderBy: { updated_at: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        created_at: true,
        updated_at: true,
        _count: { select: { messages: true } },
      },
    });
  }

  async getConversation(conversationId: string, tenantId: string, userId: string) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, tenant_id: tenantId, user_id: userId },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
          select: { id: true, role: true, content: true, created_at: true },
        },
      },
    });

    if (!conversation) {
      throw new ForbiddenException('Percakapan tidak ditemukan');
    }

    return conversation;
  }

  async deleteConversation(conversationId: string, tenantId: string, userId: string) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, tenant_id: tenantId, user_id: userId },
    });

    if (!conversation) {
      throw new ForbiddenException('Percakapan tidak ditemukan');
    }

    await this.prisma.chatConversation.delete({
      where: { id: conversationId },
    });

    return { message: 'Percakapan berhasil dihapus' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private periodKey(date: Date, period: string): string {
    const d = new Date(date);
    if (period === 'monthly') {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    if (period === 'weekly') {
      const thursday = new Date(d);
      thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
      const jan4 = new Date(thursday.getFullYear(), 0, 4);
      const week = Math.round(((thursday.getTime() - jan4.getTime()) / 86400000 + 1) / 7);
      return `${thursday.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    return d.toISOString().split('T')[0];
  }
}
