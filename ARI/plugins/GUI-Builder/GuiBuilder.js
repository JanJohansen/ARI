var AriClient = require("../../www/app/ariclient.js").AriClient;
var ConfigStore = require("../../configStore.js");

var os = require('os');
var fs = require("fs");
var cp = require('child_process');

// Load state.
var stateStore = new ConfigStore(__dirname, "GuiBuilder_state");
var state = stateStore.load();

var ari = new AriClient("GUI-Builder");
if (!state.authToken) ari.connectDevice("controller");
else ari.connect(state.authToken);

var config = {
};

var guiFilesPath = __dirname + "/guiFiles/public/";

// TODO: Update list of widgets.
// ...


ari.onconnect = function (result) {
    if (!state.authToken) {
        // First time we get an authToken, save it!
        state.authToken = ari.authToken;
        stateStore.save();
    }
    clientName = result.name;   // Store name in case we got a new one (with (x) at the end!)
    console.log("Client connected as \"" + ari.name + "\"");
    
    // register functions.
    ari.registerFunction("listLayouts", { description: "Load GIU layout for UI." }, function (pars, callback) {
        var guiFiles = [];
        fs.readdir(guiFilesPath, function (err, files) {
            if (err) { callback(err, null); return; }
            
            files.forEach(function (file) {
                guiFiles.push(file);
            });
            callback(null, logs);
        });
    });

    ari.registerFunction("loadLayout", { description: "Load GIU layout for UI." }, function (pars, callback) {
        // Load file.
        var fileName = guiFilesPath + pars.fileName;
        fs.readFile(fileName, function (err, data) {
            if (err) {
                callback(err, null);
            }
            else {
                console.log("File loaded:", fileName);
                callback(null, { data: data.toString() }); // Indicate OK.
            }
        });
    });
    
    ari.registerFunction("saveLayout", { description: "Save GUI layout." }, function (pars, callback) {
        // Make sure there is a folder.!
        try { fs.mkdirSync(guiFilesPath); } catch (e) {
            // Ignore exception (dir already exists!)
        };  
        
        // Save file.
        var fileName = guiFilesPath + pars.fileName;
        fs.writeFile(fileName, pars.data, function (err) {
            if (err) {
                callback(err, null);
            }
            else {
                console.log("File saved:", fileName);
                callback(null, {}); // Indicate OK.
            }
        });
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

