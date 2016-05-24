"use strict";

var AriClient = require("../../www/app/ariclient.js").AriClient;
var ConfigStore = require("../../configStore.js");
var hue = require("node-hue-api");

var lights = {};
var scenes = {};



// Load state.
var stateStore = new ConfigStore(__dirname, "state");
var state = stateStore.load();

// Load configuration.
var configStore = new ConfigStore(__dirname, "config");
var config = configStore.load();
console.log("Config:", config, __dirname);

// Create ARI client.
var clientName = "PhilipsHueGW";
var ari = new AriClient(clientName);
if (!state.authToken) ari.connectDevice("device");
else ari.connect(state.authToken);

ari.onconnect = function (result) {
    if (!state.authToken) {
        // First time we get an authToken, save it!
        state.authToken = ari.authToken;
        stateStore.save();
    }
    clientName = result.name;   // Store name in case we got a new one (with (x) at the end!)
    console.log("Client connected as \"" + ari.name + "\"");

    
    // --------------------------
    hue.nupnpSearch().then(function (bridges) {
        console.log("Hue Bridges Found: " + JSON.stringify(bridges));
        
        var newLights = {};
        var bridgeCount = bridges.length;
        for (var i = 0; i < bridgeCount; i++) {
            var bridge = bridges[i];
            console.log("Philips Hue bridge found:", JSON.stringify(bridge));

            var host = bridge.ipaddress;
            var username = "1ed1812760c38a50dd1b4b72d1e5c4e";
            var api = new hue.HueApi(host, username);
            
            api.lights().then(function (result) {
                console.log("Lights:", JSON.stringify(result, null, 2));
                
                var lightsCount = result.lights.length;
                console.log("Lights found:", lightsCount);
                
                var newLightNames = [];
                // Add found lights to newLights object.
                for (var i = 0; i < lightsCount; i++) {
                    var light = result.lights[i];
                    //console.log("Philips Hue light found:", JSON.stringify(light));
                    console.log("Name:", light.name);
                    console.log("\tOn:", light.state.on, "Brightness:", light.state.bri, "Reachable:", light.state.reachable);
                    
                    //update light status.
                    lights[light.name] = { on: light.state.on, brightness: light.state.bri, reachable: light.state.reachable };
                    if (!newLights[light.name]) {
                        // New light!
                        ari.registerValue(light.name + ".brightness", {}, function (name, value) {
                            // This function is called if remote client wants to set this input.
                            console.log("EXTERNAL SETVALUE:", name, value);
                        });
                        ari.setValue(light.name + ".brightness", light.state.on == false ? 0 : (light.state.bri * 100) / 254);
                    } else {
                        // existing light
                        ari.setValue(light.name + ".brightness", light.state.on == false ? 0 : (light.state.bri * 100) / 254);
                    }
                    
                    // Store currently reported lights to be able to detect removed lights!
                    newLightNames.push(light.name);
                }
                    
                // Check for removed lights!
                // TODO: Only do this every x minutes!
                
                var lightNames = Object.getOwnPropertyNames(lights);
                var removed = lightNames.filter(function (x) { return newLightNames.indexOf(x) < 0 })
                console.log("removed", removed);

                /*for (var lightName in lights) {
                    var found = false;
                    for (var newLightName in newLights) {
                        if (newLigthName == lightName) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        // light was removed...
                        delete lights[lightName];
                        ari.unRegisterValue(light.name + ".brightness");
                    } else {

                    }
                }*/
                
            }).done();
        }
    }).done();


    // register functions.
/*    ari.registerFunction("getConfig", { description: "Get configuration data for UI." }, function (pars, callback) {
        callback(null, {}); // Indicate OK.
    });
    ari.registerFunction("setConfig", { description: "Set configuration data for device." }, function (pars, callback) {
        console.log("Storing new configuration.");
        callback(null, {}); // Indicate OK.
    });


    // Example on getValue
    // TODO: Remove... :O)
    ari.getValue("GW433.Garage.temperature", function (err, name, value) {
        console.log("GETVALUE: ", value + " sendTo: " + name);
    });
*/
}

ari.onerror = function (result) {
    console.log("!!!! - Error in PhilipsHueGW", result);
}

ari.onclose = function (result) {
    console.log("!!!! - Closed PhilipsHueGW", result);
}
