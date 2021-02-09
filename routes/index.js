const axios = require('axios').default;
const express = require('express');
const qs = require('qs');
const router = express.Router();

const port = process.env.PORT || '3000';
const serverUrl = `http://localhost:${port}`;

// const CNH_BASE_AUDIENCE_URL = 'https://ag.api.cnhind.com'
// const CNH_BASE_IDENTITY_URL = 'https://identity.cnhind.com/authorize'
const CNH_BASE_AUDIENCE_URL = 'https://stg.api.cnhind.com'
const CNH_BASE_IDENTITY_URL = 'https://stg.identity.cnhind.com/authorize'

let settings = {
  audience: CNH_BASE_AUDIENCE_URL,
  callbackUrl: `${serverUrl}/login`,
  response_type: 'code',
  clientId: 'VzTQ0u4cEkXWohxn7pzya8ayXwRAyR5w',
  clientSecret: 'BGRcgbCgo9N1CyRF7SGTC9ulW-se8dTqxSNQmOG7WNn0GjMKc3rHK3Cz8FWvmWDJ',
  scope: 'offline_access',
};
let metaData = {};

const populateSettings = (reqBody) => {
  settings = {
    ...settings,
    clientId: reqBody.clientId,
    clientSecret: reqBody.clientSecret,
    callbackUrl: reqBody.callbackUrl,
    scope: reqBody.scope,
    audience: reqBody.audience
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
  console.log('here????', body);
  populateSettings(body);

  // metaData = (await axios.get(body.wellKnown)).data;
  const params = new URLSearchParams({
    client_id: body.clientId,
    scope: body.scope,
    redirect_uri: body.callbackUrl,
    response_type: settings.response_type,
    audience: body.audience
  });
  const url = `${CNH_BASE_IDENTITY_URL}?${params.toString()}`;
  console.log('logging url', url)
  res.redirect(url)
});

/* OIDC callback */
router.get('/login', async function ({ query }, res, next) {
  console.log('here?? callback', query)
  res.status(200)
  // if (query.error) {
  //   const description = query.error_description;
  //   return res.render('error', {
  //     error: description
  //   });
  // }

  // try {
  //   const code = query.code;
  //   console.log('logging code', code);
  //   const basicAuthHeader = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');
  //   console.log("LOGGING CODE", code)
  //   res.render('index')
  //   const token = (await axios.post(metaData.token_endpoint, qs.stringify({
  //     grant_type: 'authorization_code',
  //     redirect_uri: settings.callbackUrl,
  //     code,
  //     scope: settings.scopes
  //   }), {
  //     headers: {
  //       'Accept': 'application/json',
  //       'Authorization': `Basic ${basicAuthHeader}`,
  //       'Content-Type': 'application/x-www-form-urlencoded'
  //     }
  //   })).data;
  //   console.log('logging token', token)
  //   updateTokenInfo(token);

  //   const organizationAccessUrl = await needsOrganizationAccess();

  //   if (organizationAccessUrl) {
  //     res.redirect(organizationAccessUrl);
  //   } else {
  //     res.render('index', settings);
  //   }
  // } catch (e) {
  //   return res.render('error', {
  //     error: e
  //   });
  // }
});

router.get('/refresh-access-token', async function (req, res, next) {
  try {
    const buffer_from = Buffer.from(`${settings.clientId}:${settings.clientSecret}`)
    const basicAuthHeader = buffer_from.toString('base64');
    const test = (await axios.get(settings.wellKnown)).data;
    const qs_test = qs.stringify({
      grant_type: 'refresh_token',
      redirect_uri: settings.callbackUrl,
      refresh_token: settings.refreshToken,
      scope: settings.scopes
    })
    console.log('logging qs_test', qs_test)
    const token = (await axios.post(test.token_endpoint, qs_test, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${basicAuthHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })).data;
    console.log('successfuly got token', token)
    updateTokenInfo(token);
    res.render('index', settings);
  } catch (e) {
    return res.render('error', {
      error: e
    });
  }
});

router.post('/call-api', async function ({ body }, res, next) {
  try {
    const response = (await axios.get(body.url, {
      headers: {
        'Authorization': `Bearer ${settings.accessToken}`,
        'Accept': 'application/vnd.deere.axiom.v3+json'
      }
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
