
module.exports = function (RED) {
    "use strict";
    // require any external libraries we may need....
    var AriSingleton = require("./AriSingleton.js");

    // The main node definition - most things happen in here
    function ariIn(config) {
        // Create a RED node
        RED.nodes.createNode(this, config);
        
        // Store local copies of the node configuration (as defined in the .html)
        this.ariValue = config.ariValue;
        
        var self = this;
        
        self.status({ fill: "red", shape: "ring", text: "disconnected" });

        // Do whatever you need to do in here - declare callbacks etc
        console.log("Get ARI singleton");
        var ari = new AriSingleton.getInstance("Node-Red");
        
        var handleValue = function (path, value) {
            //console.log("->", path, "=", value);
            var msg = {};
            //msg.name = path;
            msg.topic = path;
            msg.payload = value;
            // send out the message.
            self.send(msg);
        };
        
        var handleConnect = function () {
            self.status({ fill: "green", shape: "dot", text: "connected" });

            // handle subscriptions.
            ari.watchValue(self.ariValue, handleValue);
        }
        
        ari.on("connect", handleConnect);
        if (ari.isConnected) handleConnect();
        
        ari.on("disconnect", function () {
            self.status({ fill: "red", shape: "ring", text: "disconnected" });
        });

        this.on("close", function (done) {
            // Called when the node is shutdown - eg on redeploy.
            // Allows ports to be closed, connections dropped etc.
            ari.unWatchValue(this.ariValue, handleValue);
            done();
        });
    }
    
    // Register the node by name. This must be called before overriding any of the
    // Node functions.
    RED.nodes.registerType("ari-in", ariIn);
}
