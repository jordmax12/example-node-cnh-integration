const axios = require('axios').default;
const express = require('express');
const qs = require('qs');
const router = express.Router();

const port = process.env.PORT || '3000';
const serverUrl = `http://localhost:${port}`;

// const CNH_BASE_AUDIENCE_URL = 'https://ag.api.cnhind.com'
// const CNH_BASE_IDENTITY_URL = 'https://identity.cnhind.com/authorize'
const CNH_BASE_AUDIENCE_URL = 'https://stg.api.cnhind.com'
const CNH_BASE_IDENTITY_URL = 'https://stg.identity.cnhind.com'

let settings = {
  audience: CNH_BASE_AUDIENCE_URL,
  callback_url: `${serverUrl}/login`,
  response_type: 'code',
  client_id: 'VzTQ0u4cEkXWohxn7pzya8ayXwRAyR5w',
  client_secret: 'BGRcgbCgo9N1CyRF7SGTC9ulW-se8dTqxSNQmOG7WNn0GjMKc3rHK3Cz8FWvmWDJ',
  scope: 'offline_access',
  grant_type: 'authorization_code',
  api_url: CNH_BASE_AUDIENCE_URL,
  previous_seaches: []
};
let metaData = {};

const populateSettings = (reqBody) => {
  settings = {
    ...settings,
    client_id: reqBody.client_id,
    client_secret: reqBody.client_secret,
    callback_url: reqBody.callback_url
  };
};

const updateTokenInfo = (token) => {
  settings = {
    ...settings,
    idToken: token.id_token,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    exp: token.expires_in
  };
}

const needsOrganizationAccess = async () => {
  const response = (await axios.get(`${settings.apiUrl}/organizations`, {
    headers: {
      'Authorization': `Bearer ${settings.accessToken}`,
      'Accept': 'application/vnd.deere.axiom.v3+json'
    }
  })).data;

  const organizations = response.values;
  const connectionsLink = organizations.flatMap((org) => org.links)
    .find((link) => link.rel === 'connections');

  if (connectionsLink) {
    const param = new URLSearchParams({
      redirect_uri: settings.orgConnectionCompletedUrl
    });

    return `${connectionsLink.uri}?${param.toString()}`;
  }
  return null;
};

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', settings);
});

/* Initialize OIDC login */
router.post('/', async function ({ body }, res, next) {
  populateSettings(body);

  // metaData = (await axios.get(body.wellKnown)).data;
  const params = new URLSearchParams({
    client_id: body.client_id,
    scope: body.scope,
    redirect_uri: body.callback_url,
    response_type: settings.response_type,
    audience: body.audience
  });
  const url = `${CNH_BASE_IDENTITY_URL}/authorize?${params.toString()}`;
  res.redirect(url)
});

/* OIDC callback */
router.get('/login', async function ({ query }, res, next) {
  const data = {
    client_id: settings.client_id,
    client_secret: settings.client_secret,
    redirect_uri: settings.callback_url,
    grant_type: settings.grant_type,
    code: query.code
  }
  const url = `${CNH_BASE_IDENTITY_URL}/oauth/token`;
  try {
    const token = await axios({
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
        },
        method: 'post',
        url,
        data
    })
    settings.access_token = token.data.access_token;
    settings.refresh_token = token.data.refresh_token;
    settings.expires_in = token.data.expires_in;
    res.render('index', { ...settings });
  }
  catch(e) {
    console.log('logging error', e)
    res.render('index', settings);
  }
});

router.get('/refresh-access-token', async function (req, res, next) {
  const data = {
    grant_type: 'refresh_token',
    client_id: settings.client_id,
    client_secret: settings.client_secret,
    refresh_token: settings.refresh_token
  }
  const url = `${CNH_BASE_IDENTITY_URL}/oauth/token`;
  try {
    const token = await axios({
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache'
        },
        method: 'post',
        url,
        data
    })
    settings.access_token = token.data.access_token;
    // settings.refresh_token = token.data.refresh_token;
    settings.expires_in = token.data.expires_in;
    res.render('index', { ...settings });
  } catch (e) {
    return res.render('error', {
      error: e
    });
  }
});

router.post('/call-api', async function ({ body }, res, next) {
  try {
    const headers = {
      'Authorization': `Bearer ${settings.access_token}`,
      'Ocp-Apim-Subscription-Key': '4ad4152e1f0f4dca90e0cf9b986be597',
      'Accept': 'application/json'
    }
    if(!settings.previous_seaches.includes(body.url))
      settings.previous_seaches.push(body.url);
    const response = (await axios.get(body.url, {
      headers
    })).data;

    res.render('index', {
      ...settings,
      apiResponse: JSON.stringify(response, null, 2)
    });
  } catch (e) {
    return res.render('error', {
      error: e
    });
  }
});

module.exports = router;
