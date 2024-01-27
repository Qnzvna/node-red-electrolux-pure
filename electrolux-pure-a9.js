module.exports = function (RED) {
    const createPurifier = require("./purifier");

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

        function updateData() {
            purifier.data().then(data => {
                node.send({
                    payload: data
                })
            });
        }

        node.on('input', function (msg) {
            const payload = msg.payload;
            try {
                if ('mode' in payload) {
                    setMode(payload.mode, msg).then(() => {
                    }, err => node.error(err));
                }
                if ('speed' in payload) {
                    purifier.speed(payload.speed).then(() => {
                    }, err => node.error(err));
                }
                if ('ionizer' in payload) {
                    purifier.ionizer(payload.ionizer).then(() => {
                    }, err => node.error(err));
                }
                if ('light' in payload) {
                    purifier.light(payload.light).then(() => {
                    }, err => node.error(err));
                }
            } catch (e) {
                node.error("Error updating purifier", e);
            }
            setTimeout(() => {
                try {
                    updateData()
                } catch (e) {
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