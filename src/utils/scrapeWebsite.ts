import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer';
import { URL } from 'url';
import UserAgent from 'user-agents';

// Debug mode configuration
const DEBUG_MODE = process.env.DEBUG_SCRAPING === 'true' || process.env.NODE_ENV === 'development';

function debugLog(message: string, data?: any): void {
  if (DEBUG_MODE) {
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG ${timestamp}] ${message}`);
    if (data) {
      console.log(`[DEBUG] Data:`, JSON.stringify(data, null, 2));
    }
  }
}

function cleanHTML(inputHtml: string): string {
  debugLog('Starting HTML cleaning process');
  try {
    debugLog(`Input HTML length: ${inputHtml.length} characters`);
    const window = new JSDOM('').window;
    const DOMPurify = createDOMPurify(window);
    const cleaned = DOMPurify.sanitize(inputHtml, { ALLOWED_TAGS: [] });
    debugLog(`Cleaned HTML length: ${cleaned.length} characters`);
    const result = cleaned.trim();
    debugLog(`Final cleaned content length: ${result.length} characters`);
    return result;
  } catch (error: any) {
    debugLog(`Error cleaning HTML: ${error.message}`, { stack: error.stack });
    console.error(`Error cleaning HTML: ${error.message}`);
    throw new Error(`Failed to clean HTML content: ${error.message}`);
  }
}

async function scrapeAndCleanContent(url: string): Promise<string> {
  debugLog(`Starting to scrape content from: ${url}`);
  let browser = null;
  let retries = 3;
  
  while (retries > 0) {
    try {
      debugLog(`Launching browser... (attempt ${4 - retries}/3)`);
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.NODE_ENV === "production" 
      ? process.env.PUPPETEER_EXECUTABLE_PATH 
      : undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-pings',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-networking',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-domain-reliability',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--safebrowsing-disable-auto-update',
          '--enable-automation',
          '--password-store=basic',
          '--use-mock-keychain',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=WebUIDarkMode',
        ],
        timeout: 30000,
      });
      debugLog('Browser launched successfully');

      const page = await browser.newPage();
      debugLog('New page created');

      // Set page timeout
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);

      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
      debugLog(`Setting user agent: ${userAgent.substring(0, 50)}...`);
      await page.setUserAgent(userAgent);
      
      debugLog('Enabling JavaScript...');
      await page.setJavaScriptEnabled(true);
      
      debugLog('Setting up request interception...');
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        if (["image", "stylesheet", "font"].includes(req.resourceType())) {
          debugLog(`Blocking resource: ${req.resourceType()} - ${req.url().substring(0, 100)}...`);
          req.abort();
        } else {
          req.continue();
        }
      });

      debugLog(`Navigating to URL: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      debugLog('Page loaded successfully');

      // Wait a bit for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));

      const pageContent = await page.content();
      debugLog(`Page content length: ${pageContent.length} characters`);

      if (
        pageContent.includes('Verifying you are human') ||
        pageContent.includes('Cloudflare')
      ) {
        debugLog('Cloudflare verification detected in page content');
        throw new Error('Cloudflare verification detected');
      }

      debugLog('Extracting article content...');
      const htmlContent = await page.evaluate(() => {
        const article = document.querySelector('article') || document.body;
        return article.innerHTML;
      });
      debugLog(`Extracted HTML content length: ${htmlContent.length} characters`);

      const cleanedContent = cleanHTML(htmlContent);
      debugLog(`Cleaned content length: ${cleanedContent.length} characters`);

      if (!cleanedContent) {
        debugLog('No content extracted from page');
        throw new Error('No content extracted from page');
      }

      debugLog('Content scraping completed successfully');
      return cleanedContent;
    } catch (error: any) {
      debugLog(`Error scraping ${url} (attempt ${4 - retries}/3): ${error.message}`, { 
        stack: error.stack,
        url: url 
      });
      console.error(`Error scraping ${url} (attempt ${4 - retries}/3): ${error.message}`);
      

      
      // Close browser if it exists
      if (browser) {
        try {
          await browser.close();
          debugLog('Browser closed after error');
        } catch (closeError: any) {
          debugLog(`Error closing browser: ${closeError.message}`);
        }
        browser = null;
      }
      
      retries--;
      if (retries > 0) {
        debugLog(`Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      } else {
        throw new Error(`Failed to scrape content after 3 attempts: ${error.message}`);
      }
    } finally {
      if (browser) {
        try {
          debugLog('Closing browser...');
          await browser.close();
          debugLog('Browser closed successfully');
        } catch (error: any) {
          debugLog(`Error closing browser: ${error.message}`, { stack: error.stack });
          console.error(`Error closing browser: ${error.message}`);
        }
      }
    }
  }
  
  throw new Error('All retry attempts failed');
}

async function getAllLinks(url: string): Promise<string[]> {
  debugLog(`Getting all links from: ${url}`);
  let browser = null;
  let retries = 3;
  
  while (retries > 0) {
    try {
      debugLog(`Launching browser for link extraction... (attempt ${4 - retries}/3)`);
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.NODE_ENV === "production" 
      ? process.env.PUPPETEER_EXECUTABLE_PATH 
      : undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-pings',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-networking',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--disable-domain-reliability',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--safebrowsing-disable-auto-update',
          '--enable-automation',
          '--password-store=basic',
          '--use-mock-keychain',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=WebUIDarkMode',
        ],
        timeout: 30000,
      });
      
      const page = await browser.newPage();
      
      // Set page timeout
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);
      
      const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
      await page.setUserAgent(userAgent);
      
      debugLog(`Navigating to URL for link extraction: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait a bit for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      debugLog('Extracting links from page...');
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a')).map((anchor) => anchor.href)
      );
      debugLog(`Found ${links.length} links on page`);
      return links;
    } catch (error: any) {
      debugLog(`Error getting links from ${url} (attempt ${4 - retries}/3): ${error.message}`, { stack: error.stack });
      console.error(`Error getting links from ${url} (attempt ${4 - retries}/3): ${error.message}`);
      

      
      // Close browser if it exists
      if (browser) {
        try {
          await browser.close();
          debugLog('Browser closed after error');
        } catch (closeError: any) {
          debugLog(`Error closing browser: ${closeError.message}`);
        }
        browser = null;
      }
      
      retries--;
      if (retries > 0) {
        debugLog(`Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      } else {
        debugLog('All retry attempts failed for link extraction');
        return [];
      }
    } finally {
      if (browser) {
        try {
          debugLog('Closing browser for link extraction...');
          await browser.close();
        } catch (error: any) {
          debugLog(`Error closing browser for link extraction: ${error.message}`, { stack: error.stack });
          console.error(`Error closing browser: ${error.message}`);
        }
      }
    }
  }
  
  return [];
}

function isImportantRoute(url: string, baseUrl: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const parsedBaseUrl = new URL(baseUrl);
    
    // Must be same hostname
    if (parsedUrl.hostname !== parsedBaseUrl.hostname) {
      return false;
    }
    
    const path = parsedUrl.pathname.toLowerCase();
    const search = parsedUrl.search.toLowerCase();
    
    // Exclude common non-content paths
    const excludePatterns = [
      '/admin',
      '/login',
      '/logout',
      '/register',
      '/signup',
      '/signin',
      '/dashboard',
      '/profile',
      '/settings',
      '/account',
      '/cart',
      '/checkout',
      '/payment',
      '/api/',
      '/wp-admin',
      '/wp-login',
      '/wp-content/uploads',
      '/wp-includes',
      '/assets/',
      '/static/',
      '/css/',
      '/js/',
      '/images/',
      '/img/',
      '/fonts/',
      '/media/',
      '/uploads/',
      '/downloads/',
      '/files/',
      '/temp/',
      '/tmp/',
      '/cache/',
      '/search',
      '/sitemap',
      '/robots.txt',
      '/favicon',
      '/.well-known',
      '/feed',
      '/rss',
      '/atom',
      '/json',
      '/xml',
      '/pdf',
      '/doc',
      '/docx',
      '/xls',
      '/xlsx',
      '/zip',
      '/rar',
      '/tar',
      '/gz'
    ];
    
    // Check if URL contains any excluded patterns
    for (const pattern of excludePatterns) {
      if (path.includes(pattern) || search.includes(pattern)) {
        debugLog(`Excluding URL (matches pattern ${pattern}): ${url}`);
        return false;
      }
    }
    
    // Exclude URLs with file extensions (except .html)
    const fileExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.mp3', '.mp4', '.avi', '.mov'];
    for (const ext of fileExtensions) {
      if (path.endsWith(ext) || path.includes(ext + '?')) {
        debugLog(`Excluding URL (file extension ${ext}): ${url}`);
        return false;
      }
    }
    
    // Exclude URLs that are too long (likely dynamic content)
    if (url.length > 200) {
      debugLog(`Excluding URL (too long): ${url}`);
      return false;
    }
    
    // Exclude URLs with too many query parameters
    const queryParams = parsedUrl.searchParams;
    if (queryParams.size > 5) {
      debugLog(`Excluding URL (too many query params): ${url}`);
      return false;
    }
    
    // Prioritize main content pages
    const priorityPatterns = [
      '/',
      '/about',
      '/company',
      '/team',
      '/services',
      '/products',
      '/solutions',
      '/features',
      '/pricing',
      '/contact',
      '/blog',
      '/news',
      '/articles',
      '/help',
      '/support',
      '/faq',
      '/documentation',
      '/docs',
      '/guide',
      '/tutorial'
    ];
    
    // Check if URL matches priority patterns
    for (const pattern of priorityPatterns) {
      if (path === pattern || path.startsWith(pattern + '/')) {
        debugLog(`Priority URL found: ${url}`);
        return true;
      }
    }
    
    // Include URLs that don't match exclusion patterns and have reasonable paths
    const isValidPath = path.length > 0 && path.length < 100 && !path.includes('?') && !path.includes('#');
    if (isValidPath) {
      debugLog(`Including URL (valid path): ${url}`);
      return true;
    }
    
    debugLog(`Excluding URL (invalid path): ${url}`);
    return false;
  } catch (error: unknown) {
    if (error instanceof Error) {
      debugLog(`Error checking if URL is important: ${url}`, { error: error.message });
    } else {
      debugLog(`Error checking if URL is important: ${url}`, { error: String(error) });
    }
    return false;
  }
}

export async function scrapeAllRoutes(baseUrl: string, options?: { firstRouteOnly?: boolean }): Promise<string | { error: string; source: string }> {
  debugLog(`Starting scrapeAllRoutes for base URL: ${baseUrl}${options?.firstRouteOnly ? ' (first route only)' : ''}`);
  try {
    if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      debugLog('Invalid baseUrl: empty or not a string');
      throw new Error('baseUrl must be a non-empty string');
    }
    
    try {
      new URL(baseUrl);
      debugLog('URL format validation passed');
    } catch {
      debugLog('Invalid URL format');
      throw new Error('Invalid URL format');
    }

    // If firstRouteOnly is true, just scrape the base URL
    if (options?.firstRouteOnly) {
      debugLog('First route only mode: scraping only the base URL');
      try {
        const cleanedContent = await scrapeAndCleanContent(baseUrl);
        if (!cleanedContent || cleanedContent.trim() === '') {
          debugLog('No content scraped from base URL');
          throw new Error('No content scraped from base URL');
        }
        debugLog('First route scraping completed successfully');
        console.log('[DEBUG] First route content:', cleanedContent.substring(0, 500) + '...');
        return cleanedContent.trim();
      } catch (error: any) {
        debugLog(`Error scraping first route ${baseUrl}: ${error.message}`, { 
          stack: error.stack,
          baseUrl: baseUrl 
        });
        console.error(`Error scraping first route ${baseUrl}: ${error.message}`);
        return { error: error.message, source: 'website' };
      }
    }

    // Original full crawling logic
    const visitedLinks = new Set<string>();
    const linksToVisit: string[] = [baseUrl];
    let combinedContent = '';
    const maxPages = 10;
    let pageCount = 0;

    debugLog(`Starting crawl with max pages: ${maxPages}`);

    while (linksToVisit.length > 0 && pageCount < maxPages) {
      const currentLink = linksToVisit.pop();
      debugLog(`Processing link ${pageCount + 1}/${maxPages}: ${currentLink}`);
      
      if (currentLink && !visitedLinks.has(currentLink)) {
        visitedLinks.add(currentLink);
        pageCount++;
        
        try {
          debugLog(`Scraping content from: ${currentLink}`);
          const cleanedContent = await scrapeAndCleanContent(currentLink);
          if (cleanedContent) {
            combinedContent += `\n\n${cleanedContent}`;
            debugLog(`Added content from ${currentLink}, total length: ${combinedContent.length}`);
          } else {
            debugLog(`No content extracted from ${currentLink}`);
          }
        } catch (error: any) {
          debugLog(`Skipping ${currentLink}: ${error.message}`, { stack: error.stack });
          console.error(`Skipping ${currentLink}: ${error.message}`);
          continue;
        }

        debugLog(`Extracting links from: ${currentLink}`);
        const newLinks = await getAllLinks(currentLink);
        debugLog(`Found ${newLinks.length} links on ${currentLink}`);

        const parsedBaseUrl = new URL(baseUrl);
        let validLinksCount = 0;
        
        for (const link of newLinks) {
          try {
            // Only include important routes
            if (isImportantRoute(link, baseUrl)) {
              const parsedLink = new URL(link);
              if (
                parsedLink.hostname === parsedBaseUrl.hostname &&
                !visitedLinks.has(link) &&
                !linksToVisit.includes(link)
              ) {
                linksToVisit.push(link);
                validLinksCount++;
              }
            }
          } catch {
            debugLog(`Invalid link found: ${link}`);
            continue;
          }
        }
        
        debugLog(`Added ${validLinksCount} valid important links to visit queue`);
        debugLog(`Remaining links to visit: ${linksToVisit.length}`);
      }
    }

    debugLog(`Crawl completed. Processed ${pageCount} pages`);
    debugLog(`Final combined content length: ${combinedContent.length} characters`);

    if (!combinedContent || combinedContent.trim() === '') {
      debugLog('No content scraped from website');
      throw new Error('No content scraped from website');
    }

    debugLog('Scraping completed successfully');
    console.log('[DEBUG] Combined content:', combinedContent.substring(0, 500) + '...');
    return combinedContent.trim();
  } catch (error: any) {
    debugLog(`Error scraping website ${baseUrl}: ${error.message}`, { 
      stack: error.stack,
      baseUrl: baseUrl 
    });
    console.error(`Error scraping website ${baseUrl}: ${error.message}`);
    return { error: error.message, source: 'website' };
  }
} 
