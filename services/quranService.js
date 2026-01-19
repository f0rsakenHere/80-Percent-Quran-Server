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
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);

      const response = await axios.post(tokenUrl, params, {
        headers: {
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
    try {
      // Ensure we have a valid token
      const token = await this.ensureValidToken();

      // Make the API request
      const searchUrl = `${this.apiBaseUrl}/content/api/v4/search`;
      
      const response = await axios.get(searchUrl, {
        params: {
          q: arabicWord,
          size: size,
          language: 'en',
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        success: true,
        data: response.data,
        query: arabicWord,
      };
    } catch (error) {
      console.error('❌ Error fetching verses:', error.response?.data || error.message);

      // If authentication error, clear token and retry once
      if (error.response?.status === 401 && this.accessToken) {
        console.log('⚠️  Authentication error, clearing token and retrying...');
        this.accessToken = null;
        this.tokenExpiry = null;
        
        // Retry once
        try {
          const token = await this.ensureValidToken();
          const searchUrl = `${this.apiBaseUrl}/content/api/v4/search`;
          
          const response = await axios.get(searchUrl, {
            params: {
              q: arabicWord,
              size: size,
              language: 'en',
            },
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          return {
            success: true,
            data: response.data,
            query: arabicWord,
          };
        } catch (retryError) {
          throw retryError;
        }
      }

      throw new Error(
        error.response?.data?.message || 
        'Failed to fetch verses from Quran Foundation API'
      );
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
      const verseUrl = `${this.apiBaseUrl}/content/api/v4/verses/${verseRef}`;

      const response = await axios.get(verseUrl, {
        params: {
          language: 'en',
        },
        headers: {
          Authorization: `Bearer ${token}`,
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
