/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/stocks': [
      './thailand_stocks_unmasked.json',
      './undervalued_stocks_unmasked.json',
      './sync_status.json',
    ],
    '/api/stocks/sync': [
      './thailand_stocks_unmasked.json',
      './undervalued_stocks_unmasked.json',
      './sync_status.json',
    ],
  },
};

module.exports = nextConfig;
