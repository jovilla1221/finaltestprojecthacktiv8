import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * AI Tool definitions untuk function calling.
 * AI dapat memanggil fungsi-fungsi ini untuk mendapatkan data POS secara real-time.
 */
export const AI_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_today_sales',
      description:
        'Mendapatkan ringkasan penjualan hari ini: total omzet, jumlah transaksi, total diskon.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sales_by_period',
      description:
        'Mendapatkan data penjualan dalam rentang tanggal tertentu.',
      parameters: {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            description: 'Tanggal awal dalam format YYYY-MM-DD',
          },
          date_to: {
            type: 'string',
            description: 'Tanggal akhir dalam format YYYY-MM-DD',
          },
          period: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
            description: 'Periode agregasi data',
          },
        },
        required: ['date_from', 'date_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_products',
      description: 'Mendapatkan daftar produk terlaris berdasarkan jumlah terjual.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Jumlah produk yang ingin ditampilkan (default 10)',
          },
          date_from: {
            type: 'string',
            description: 'Tanggal awal filter (format YYYY-MM-DD)',
          },
          date_to: {
            type: 'string',
            description: 'Tanggal akhir filter (format YYYY-MM-DD)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_low_stock_products',
      description:
        'Mendapatkan daftar produk yang stoknya menipis (di bawah stok minimum).',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_profit_loss',
      description:
        'Mendapatkan laporan laba rugi kotor. HANYA tersedia untuk role OWNER dan MANAGER.',
      parameters: {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            description: 'Tanggal awal (format YYYY-MM-DD)',
          },
          date_to: {
            type: 'string',
            description: 'Tanggal akhir (format YYYY-MM-DD)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cashier_summary',
      description: 'Mendapatkan rekap penjualan per kasir.',
      parameters: {
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            description: 'Tanggal awal (format YYYY-MM-DD)',
          },
          date_to: {
            type: 'string',
            description: 'Tanggal akhir (format YYYY-MM-DD)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description:
        'Mencari produk berdasarkan nama, barcode, atau SKU.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Kata kunci pencarian produk',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_count',
      description: 'Mendapatkan total jumlah produk aktif di toko.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_count',
      description: 'Mendapatkan total jumlah pelanggan terdaftar.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];
