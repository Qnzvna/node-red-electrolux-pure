module.exports = function createPurifier(username, password, pncId) {
    const api = require("./api");

    async function client() {
        let factory = await api(username, password);
        return factory.create();
    }

    function mapSpeedTo100Scale(fanSpeed) {
        if (fanSpeed === 9) {
            return 100;
        }
        return fanSpeed * 10;
    }

    function mapSpeedTo9Scale(fanSpeed) {
        return Math.floor(fanSpeed / (100 / 8)) + 1
    }

    return {
        async off() {
            const http = await client();
            return (await http.put(`/appliances/${pncId}/command`, {
                'WorkMode': 'PowerOff',
            })).data;
        },
        async auto() {
            const http = await client();
            return (await http.put(`/appliances/${pncId}/command`, {
                'WorkMode': 'Auto',
            })).data;
        },
        async manual() {
            const http = await client();
            return (await http.put(`/appliances/${pncId}/command`, {
                'WorkMode': 'Manual',
            })).data;
        },
        async data() {
            const http = await client();
            return http.get(`/appliances/${pncId}`).then(response => {
                let metrics = response.data.properties.reported;
                return {
                    mode: metrics.Workmode.toLowerCase(),
                    filter: metrics.FilterLife,
                    speed: mapSpeedTo100Scale(metrics.Fanspeed),
                    ionizer: metrics.Ionizer,
                    tvoc: metrics.TVOC,
                    co2: metrics.CO2,
                    temperature: metrics.Temp,
                    humidity: metrics.Humidity,
                    pm1: metrics.PM1,
                    pm2_5: metrics.PM2_5,
                    pm10: metrics.PM10,
                    light: metrics.UILight
                };
            });
        },
        async speed(fanSpeed) {
            const http = await client();
            let fanSpeed1 = mapSpeedTo9Scale(fanSpeed);
            return (await http.put(`/appliances/${pncId}/command`, {
                'FanSpeed': fanSpeed1,
            })).data;
        },
        async ionizer(enabled) {
            const http = await client();
            return (await http.put(`/appliances/${pncId}/command`, {
                'Ionizer': enabled,
            })).data;
        },
        async light(enabled) {
            const http = await client();
            return (await http.put(`/appliances/${pncId}/command`, {
                'UILight': enabled,
            })).data;
        }
    }
}