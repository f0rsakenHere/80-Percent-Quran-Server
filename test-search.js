require("dotenv").config();
const axios = require("axios");

async function run() {
  // Read from env (now has prelive credentials)
  const clientId = process.env.QF_CLIENT_ID;
  const clientSecret = process.env.QF_CLIENT_SECRET;
  const env = process.env.QF_ENV || "prelive";

  console.log(`Env: ${env}, ClientID: ${clientId}`);

  // Urls
  const authUrl = "https://prelive-oauth2.quran.foundation";
  const apiBaseUrl = "https://apis-prelive.quran.foundation";

  // 1. Get Token
  let token;
  try {
    const tokenUrl = `${authUrl}/oauth2/token`;
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("scope", "content");

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );

    console.log("Authenticating...");
    const response = await axios.post(tokenUrl, params, {
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    token = response.data.access_token;
    console.log("Token obtained.");
  } catch (err) {
    console.error("Auth failed:", err.response?.data || err.message);
    return;
  }

  // 2. Test Verse Details for 1:1 (sanity check)
  console.log(`\n--- Test 1: Verse Details (1:1) ---`);
  const verseUrl = `${apiBaseUrl}/content/api/v4/verses/by_key/1:1`;
  try {
    const res = await axios.get(verseUrl, {
      params: {
        language: "en",
        words: true,
        translations: "131",
        fields: "text_uthmani",
      },
      headers: {
        "x-auth-token": token,
        "x-client-id": clientId,
        "Content-Type": "application/json",
      },
    });
    console.log("✅ Verse 1:1 Success!");
  } catch (err) {
    console.log(`❌ Verse 1:1 Failed: ${err.message}`);
    if (err.response) {
      console.log("Status:", err.response.status);
      // console.log('Data:', JSON.stringify(err.response.data, null, 2));
    }
  }

  // 3. Test Search with different Paths
  const paths = ["/content/api/v4/search", "/api/v4/search", "/v4/search"];

  for (const path of paths) {
    const url = `${apiBaseUrl}${path}`;
    console.log(`\n--- Test Search Path: ${path} ---`);
    try {
      // Try minimal params
      const res = await axios.get(url, {
        params: {
          q: "Allah",
          size: 1,
          page: 1,
          language: "en",
        },
        headers: {
          "x-auth-token": token,
          "x-client-id": clientId,
          "Content-Type": "application/json",
        },
      });
      console.log("✅ Success!");
      console.log("Data keys:", Object.keys(res.data));
      if (res.data.search) {
        console.log("Results:", res.data.search.results?.length);
      }
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`);
      if (err.response) {
        console.log(`Status: ${err.response.status}`);
        console.log(`Data: ${JSON.stringify(err.response.data)}`);
      }
    }
  }
}

run();
