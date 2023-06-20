module.exports = function (RED) {
    const axios = require("axios");

    const baseUrl = 'https://api.delta.electrolux.com/api';
    const clientUrl = 'https://electrolux-wellbeing-client.vercel.app/api/mu52m5PR9X';
    const CONTENT_TYPE_HEADER = {
        'Content-Type': 'application/json',
    };

    async function token() {
        const response = await axios.get(clientUrl, {
            headers: {
                ...CONTENT_TYPE_HEADER
            },
        });
        return response.data.accessToken;
    }

    function now() {
        return Math.floor(Date.now() / 1000);
    }

    async function login(username, password, clientToken) {
        const response = await axios.post(
            `${baseUrl}/Users/Login`,
            {
                Username: username,
                password: password,
            },
            {
                headers: {
                    ...CONTENT_TYPE_HEADER,
                    Authorization: `Bearer ${clientToken}`,
                },
            },
        )
        return {
            token: response.data.accessToken,
            expires: now() + response.data.expiresIn
        }
    }

    function createPurifier(username, password, pncId) {
        let authToken;
        let http;

        function isAuthenticated() {
            return authToken && authToken.expires > now();
        }

        async function httpClient() {
            if (http && isAuthenticated()) {
                return http;
            } else {
                const clientToken = await token();
                authToken = await login(username, password, clientToken);
                http = axios.create({
                    baseURL: baseUrl,
                    headers: {
                        ...CONTENT_TYPE_HEADER,
                        Authorization: `Bearer ${authToken.token}`,
                    },
                });
                return http;
            }
        }

        return {
            async off() {
                const http = await httpClient();
                return (await http.put(`/Appliances/${pncId}/Commands`, {
                    'WorkMode': 'PowerOff',
                })).data;
            },
            async auto() {
                const http = await httpClient();
                return (await http.put(`/Appliances/${pncId}/Commands`, {
                    'WorkMode': 'Auto',
                })).data;
            },
            async manual() {
                const http = await httpClient();
                return (await http.put(`/Appliances/${pncId}/Commands`, {
                    'WorkMode': 'Manual',
                })).data;
            },
            async data() {
                const http = await httpClient();
                const response = await http.get(`/Appliances/${pncId}`);
                return response.data;
            },
            async speed(fanSpeed) {
                const http = await httpClient();
                return (await http.put(`/Appliances/${pncId}/Commands`, {
                    'FanSpeed': fanSpeed,
                })).data;
            },
            async ionizerOn() {
                const http = await httpClient();
                return (await http.put(`/Appliances/${pncId}/Commands`, {
                    'Ionizer': 'On',
                })).data;
            },
            async ionizerOff() {
                const http = await httpClient();
                return (await http.put(`/Appliances/${pncId}/Commands`, {
                    'Ionizer': 'Off',
                })).data;
            }
        }
    }

    function ElectroluxPureA9Node(config) {
        RED.nodes.createNode(this, config);

        const node = this;

        const username = node.credentials.username;
        const password = node.credentials.password;
        const purifier = createPurifier(username, password, config.appliance);

        function setMode(mode) {
            if (mode === "off") {
                return purifier.off();
            } else if (mode === "auto") {
                return purifier.auto();
            } else if (mode === "manual") {
                return purifier.manual();
            }
        }

        function setFanSpeed(fanSpeed) {
            const fanSpeedAdjusted = Math.floor(fanSpeed / (100 / 8)) + 1;
            return purifier.speed(fanSpeedAdjusted);
        }

        function setIonizer(active) {
            if (active) {
                return purifier.ionizerOn();
            } else {
                return purifier.ionizerOff();
            }
        }

        function mapMode(workMode) {
            switch (workMode) {
                case "Manual":
                    return "manual";
                case "Auto":
                    return "auto";
                case "Off":
                default:
                    return "off";
            }
        }

        function mapFanSpeed(fanSpeed) {
            if (fanSpeed === 9) {
                return 100;
            }
            return fanSpeed * 10;
        }

        function updateData() {
            purifier.data().then(data => {
                let metrics = data.twin.properties.reported;
                node.send({
                    payload: {
                        mode: mapMode(metrics.Workmode),
                        filter: metrics.FilterLife,
                        speed: mapFanSpeed(metrics.Fanspeed),
                        ionizer: metrics.Ionizer,
                        tvoc: metrics.TVOC,
                        co2: metrics.CO2,
                        temperature: metrics.Temp,
                        humidity: metrics.Humidity,
                        pm1: metrics.PM1,
                        pm2_5: metrics.PM2_5,
                        pm10: metrics.PM10,
                        light: metrics.UILight
                    }
                })
            });
        }

        node.on('input', function (msg) {
            const payload = msg.payload;
            try {
                if ('mode' in payload) {
                    setMode(payload.mode, msg).then(() => {}, err => node.error(err));
                }
                if ('speed' in payload) {
                    setFanSpeed(payload.speed).then(() => {}, err => node.error(err));
                }
                if ('ionizer' in payload) {
                    setIonizer(payload.ionizer).then(() => {}, err => node.error(err));
                }
            } catch (e) {
                node.error("Error updating purifier", e);
            }
            setTimeout(() => {
                try {
                    updateData()
                } catch(e) {
                    node.error("Error refreshing purifier state", e)
                }
            }, 10_000);
        });
    }

    RED.nodes.registerType("electrolux-pure-a9", ElectroluxPureA9Node, {
        credentials: {
            username: {type: "text"},
            password: {type: "password"}
        }
    });
}