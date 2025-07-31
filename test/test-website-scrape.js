import { scrapeAllRoutes } from '../src/utils/scrapeWebsite.ts';

async function testWebsiteScraping() {
  console.log('🧪 Testing Website Scraping Functionality');
  console.log('==========================================');

  // Test URLs - you can change these to test different websites
  const testUrls = [
    'https://davidtsx.vercel.app',
  ];

  for (const url of testUrls) {
    console.log(`\n📄 Testing URL: ${url}`);
    console.log('─'.repeat(50));

    try {
      // Test first route only (fast mode)
      console.log('⏱️  Testing first route only mode...');
      const startTime = Date.now();
      
      const result = await scrapeAllRoutes(url, { firstRouteOnly: true });
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (typeof result === 'string') {
        console.log('✅ Success! Content scraped:');
        console.log(`📊 Duration: ${duration}ms`);
        console.log(`📏 Content length: ${result.length} characters`);
        console.log(`📝 First 200 characters: ${result.substring(0, 200)}...`);
        
        // Show a sample of the cleaned content
        const lines = result.split('\n').filter(line => line.trim().length > 0);
        console.log(`📄 Number of text lines: ${lines.length}`);
        if (lines.length > 0) {
          console.log(`📖 Sample line: "${lines[0].substring(0, 100)}..."`);
        }
      } else {
        console.log('❌ Error occurred:');
        console.log(`🔍 Error: ${result.error}`);
        console.log(`📊 Duration: ${duration}ms`);
      }

    } catch (error) {
      console.log('❌ Exception occurred:');
      console.log(`🔍 Error: ${error.message}`);
    }
  }

  console.log('\n🎯 Test Summary');
  console.log('===============');
  console.log('✅ First route only mode is working for faster testing');
  console.log('💡 You can now test website scraping without waiting for full crawl');
  console.log('🔧 To test full crawling, remove the { firstRouteOnly: true } option');
}

// Run the test
testWebsiteScraping().catch(console.error); 