/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/stocks': [
      './thailand_stocks_unmasked.json',
      './thailand_stocks_overvalued.json',
      './undervalued_stocks_unmasked.json',
      './us_stocks_overvalued.json',
      './sync_status.json',
    ],
    '/api/stocks/sync': [
      './thailand_stocks_unmasked.json',
      './thailand_stocks_overvalued.json',
      './undervalued_stocks_unmasked.json',
      './us_stocks_overvalued.json',
      './sync_status.json',
    ],
  },
};

module.exports = nextConfig;
