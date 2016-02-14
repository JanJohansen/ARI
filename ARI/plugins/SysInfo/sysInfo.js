var AriClient = require("../../www/app/ariclient.js").AriClient;
var ConfigStore = require("../../configStore.js");

var os = require('os');

// Load state.
var stateStore = new ConfigStore(__dirname, "SysInfo_state");
var state = stateStore.load();

var ari = new AriClient("SysInfo");
if (!state.authToken) ari.connectDevice("device");
else ari.connect(state.authToken);

var config = {

};

ari.onconnect = function (result) {
    if (!state.authToken) {
        // First time we get an authToken, save it!
        state.authToken = ari.authToken;
        stateStore.save();
    }
    clientName = result.name;   // Store name in case we got a new one (with (x) at the end!)
    console.log("Client connected as \"" + ari.name + "\"");
    
    // register functions.
    ari.registerFunction("getConfig", { description: "Get configuration data for UI." }, function (pars, callback) {
        callback(null, config);
    });
    
    ari.registerFunction("setConfig", { description: "Set configuration data for device." }, function (pars, callback) {
        config = pars.config;
        callback(null, {}); // Indicate OK.
    });
    
    // Register values.
    ari.registerValue("lastBoot", { description: "Last time the computer was started." });
    ari.registerValue("cpuLoad", { description: "Average CPU utilization since last update." });

    // Provide one time updates...
    ari.setValue("lastBoot", new Date(os.uptime()).toISOString());
    
    // Provide system infor each second.
    var reportInterval = 60000;
    var lastIdle = 0;
    setInterval(function () {
        var cpus = os.cpus();
        var totalIdle = 0;
        for (key in cpus) {
            totalIdle += cpus[key].times.idle;
        }
        var load = 1 - (totalIdle - lastIdle) / reportInterval / cpus.length;
        if (lastIdle > 0) ari.setValue("cpuLoad", +load.toFixed(3));   // Round to 3 digits and only send after first period!
        lastIdle = totalIdle;
    }, reportInterval);
}

ari.onerror = function (result) {
}

ari.onclose = function (result) {
}

