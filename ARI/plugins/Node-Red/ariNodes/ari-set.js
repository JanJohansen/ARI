
module.exports = function (RED) {
    "use strict";
    // require any external libraries we may need....
    var AriSingleton = require("./AriSingleton.js");

    // The main node definition - most things happen in here
    function ariSet(config) {
        // Create a RED node
        RED.nodes.createNode(this, config);

        // Store local copies of the node configuration (as defined in the .html)
        this.ariValue = config.ariValue;

        var self = this;
        
        self.status({ fill: "red", shape: "ring", text: "disconnected" });
        
        // Do whatever you need to do in here - declare callbacks etc
        console.log("Get ARI singleton");
        var ari = new AriSingleton.getInstance("Node-Red");
        
        var handleConnect = function () {
            self.status({ fill: "green", shape: "dot", text: "connected" });
        }
        
        ari.on("connect", handleConnect);
        if (ari.isConnected) handleConnect();
        
        ari.on("disconnect", function () {
            self.status({ fill: "red", shape: "ring", text: "disconnected" });
        });
        
        this.on("close", function (done) {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
        });

        // respond to inputs....
        this.on('input', function (msg) {
            ari.setValue(self.ariValue, msg.value || msg.payload);
        });
    }

    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("ari-set",ariSet);
}
