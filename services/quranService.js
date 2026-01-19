const axios = require('axios');

/**
 * Quran Foundation API Service
 * Handles OAuth2 client credentials flow and API requests
 */
class QuranService {
  constructor() {
    this.clientId = process.env.QF_CLIENT_ID;
    this.clientSecret = process.env.QF_CLIENT_SECRET;
    this.environment = process.env.QF_ENV || 'prelive';

    // Token cache
    this.accessToken = null;
    this.tokenExpiry = null;

    // Environment-specific URLs
    this.authUrl = this.getAuthUrl();
    this.apiBaseUrl = this.getApiBaseUrl();

    console.log(`✅ Quran Service initialized (Environment: ${this.environment})`);
  }

  /**
   * Get OAuth2 authentication URL based on environment
   * @returns {string} Auth URL
   */
  getAuthUrl() {
    return this.environment === 'production'
      ? 'https://oauth2.quran.foundation'
      : 'https://prelive-oauth2.quran.foundation';
  }

  /**
   * Get API base URL based on environment
   * @returns {string} API base URL
   */
  getApiBaseUrl() {
    return this.environment === 'production'
      ? 'https://apis.quran.foundation'
      : 'https://apis-prelive.quran.foundation';
  }

  /**
   * Check if the cached token is valid
   * @returns {boolean} True if token is valid and not expiring soon
   */
  isTokenValid() {
    if (!this.accessToken || !this.tokenExpiry) {
      return false;
    }

    // Consider token invalid if expiring in less than 30 seconds
    const now = Date.now();
    const expiryBuffer = 30 * 1000; // 30 seconds in milliseconds

    return this.tokenExpiry - now > expiryBuffer;
  }

  /**
   * Obtain a new access token using OAuth2 client credentials flow
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    try {
      const tokenUrl = `${this.authUrl}/oauth2/token`;
      
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('scope', 'content');

      const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(tokenUrl, params, {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, expires_in } = response.data;

      // Cache the token and calculate expiry time
      this.accessToken = access_token;
      this.tokenExpiry = Date.now() + expires_in * 1000;

      console.log(`✅ New access token obtained (expires in ${expires_in}s)`);
      return access_token;
    } catch (error) {
      console.error('❌ Error obtaining access token:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Quran Foundation API');
    }
  }

  /**
   * Ensure we have a valid access token
   * @returns {Promise<string>} Valid access token
   */
  async ensureValidToken() {
    if (!this.isTokenValid()) {
      return await this.getAccessToken();
    }
    return this.accessToken;
  }

  /**
   * Search for verses containing a specific Arabic word
   * @param {string} arabicWord - The Arabic word to search for
   * @param {number} size - Number of results to return (default: 2)
   * @returns {Promise<Object>} Search results with verses
   */
  async getVerses(arabicWord, size = 2) {
    console.log(`🔍 Fetching verses for: ${arabicWord}, size: ${size}`);
    try {
      const token = await this.ensureValidToken();

      // 1. Search for the word to get Verse Keys
      const searchUrl = `${this.apiBaseUrl}/content/api/v4/search`;
      const searchResponse = await axios.get(searchUrl, {
        params: {
          q: arabicWord,
          size: size,
          language: 'en'
        },
        headers: {
          'x-auth-token': token,
          'x-client-id': this.clientId,
          'Content-Type': 'application/json',
        },
      });

      const searchResults = searchResponse.data.search ? searchResponse.data.search.results : [];
      
      if (!searchResults.length) {
        return { success: true, data: { search: { results: [] } }, query: arabicWord };
      }

      // 2. Fetch full details (with translation) for each verse found
      // We limit this to the requested 'size' to avoid too many requests
      const detailedVerses = await Promise.all(
        searchResults.map(async (result) => {
          try {
            const verseKey = result.verse_key;
            // Fetch verse details with Saheeh International (131)
            const detailsUrl = `${this.apiBaseUrl}/content/api/v4/verses/by_key/${verseKey}`;
            const detailsResponse = await axios.get(detailsUrl, {
              params: {
                language: 'en',
                words: true,
                translations: 131, 
                fields: 'text_uthmani,text_indopak'
              },
              headers: {
                'x-auth-token': token,
                'x-client-id': this.clientId,
              }
            });
            return detailsResponse.data.verse;
          } catch (err) {
            console.error(`Error fetching details for ${result.verse_key}:`, err.message);
            return null; // Skip failed ones
          }
        })
      );

      // Filter out nulls
      const validVerses = detailedVerses.filter(v => v !== null);

      // Return in a structure mimicking the search response for frontend compatibility
      return {
        success: true,
        data: {
          search: {
            results: validVerses
          }
        },
        query: arabicWord,
      };

    } catch (error) {
      console.error('❌ Error in getVerses:', error.message);
      // Simplify error handling for now to bubble up
      throw new Error('Failed to fetch verses from Quran Foundation API');
    }
  }

  /**
   * Get detailed verse information by reference
   * @param {string} verseRef - Verse reference (e.g., "2:255")
   * @returns {Promise<Object>} Verse details
   */
  async getVerseDetails(verseRef) {
    try {
      const token = await this.ensureValidToken();
      const verseUrl = `${this.apiBaseUrl}/content/api/v4/verses/by_key/${verseRef}`;

      const response = await axios.get(verseUrl, {
        params: {
          language: 'en',
        },
        headers: {
          'x-auth-token': token,      // ✅ REQUIRED
          'x-client-id': this.clientId, // ✅ REQUIRED
          'Content-Type': 'application/json',
        },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('❌ Error fetching verse details:', error.response?.data || error.message);
      throw new Error('Failed to fetch verse details');
    }
  }
}

// Export a singleton instance
module.exports = new QuranService();
