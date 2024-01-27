module.exports = async function (username, password) {
    const {Gigya} = require("gigya");
    const axios = require("axios");

    const ACCOUNTS_API_KEY = '4_JZvZObbVWc1YROHF9e6y8A';
    const API_KEY = '2AMqwEV5MqVhTKrRCyYfVF8gmKrd2rAmp7cUsfky';
    const AUTH_API_URL = 'https://api.eu.ocp.electrolux.one/one-account-authorization/api/v1';
    const APPLIANCE_API_URL = 'https://api.eu.ocp.electrolux.one/appliance/api/v2';

    const axiosAuth = axios.create({
        baseURL: AUTH_API_URL,
        headers: {
            'Accept': 'application/json',
            'Accept-Charset': 'utf-8',
            'Authorization': 'Bearer',
            'x-api-key': API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'Ktor client'
        }
    });

    let accessToken, refreshToken, tokenExpirationDate;

    async function refreshAccessToken() {
        const response = await axiosAuth.post('/token', {
            grantType: 'refresh_token',
            clientId: 'ElxOneApp',
            refreshToken: this.refreshToken,
            scope: ''
        });

        accessToken = response.data.accessToken;
        refreshToken = response.data.refreshToken;
        tokenExpirationDate = Date.now() + response.data.expiresIn * 1000;
    }

    function isExpired() {
        return tokenExpirationDate <= Date.now()
    }

    const gigya = new Gigya(ACCOUNTS_API_KEY, 'eu1');
    const loginResponse = await gigya.accounts.login({
        loginID: username,
        password: password,
        targetEnv: 'mobile'
    });

    const jwtResponse = await gigya.accounts.getJWT({
        targetUID: loginResponse.UID,
        fields: 'country',
        oauth_token: loginResponse.sessionInfo?.sessionToken,
        secret: loginResponse.sessionInfo?.sessionSecret
    });

    const response = await axiosAuth.post(
        '/token',
        {
            grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
            clientId: 'ElxOneApp',
            idToken: jwtResponse.id_token,
            scope: ''
        },
        {
            headers: {
                'Origin-Country-Code': 'PL'
            }
        }
    );

    accessToken = response.data.accessToken;
    refreshToken = response.data.refreshToken;
    tokenExpirationDate = Date.now() + response.data.expiresIn * 1000;

    return {
        create: async function () {
            if (isExpired()) {
                await refreshAccessToken()
            }
            return axios.create({
                baseURL: APPLIANCE_API_URL,
                headers: {
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Charset': 'utf-8',
                    'x-api-key': API_KEY,
                    'Accept': 'application/json',
                    'User-Agent': 'Ktor client',
                    'Authorization': `Bearer ${accessToken}`
                }
            });
        }
    }
}