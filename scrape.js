(async () => {
  try {
    const { default: scrape } = await import('website-scraper');
    const { default: PuppeteerPlugin } = await import('website-scraper-puppeteer');

    const options = {
      urls: ['https://blissdermacare.framer.website/'],
      directory: './downloaded_site',
      recursive: true,
      maxDepth: 3,
      plugins: [
        new PuppeteerPlugin({
          launchOptions: { headless: true },
          scrollToBottom: { timeout: 10000, viewportN: 10 },
          blockNavigation: false,
        })
      ],
      urlFilter: function (url) {
        return url.startsWith('https://blissdermacare.framer.website');
      },
    };

    await scrape(options);
    console.log('Website successfully downloaded');
  } catch (err) {
    console.error('An error occurred', err);
    process.exitCode = 1;
  }
})();