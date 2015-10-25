var AriClient = require("../../www/app/ariclient.js").AriClient;
var ConfigStore = require("../../configStore.js");

var SerialPortModule = require("serialport");
var SerialPort = SerialPortModule.SerialPort; // localize object constructor 

var serialPort = null;

// For debug - and later configuration!
SerialPortModule.list(function (err, ports) {
    console.log("Serial ports:");
    if (ports) {
        ports.forEach(function (port) {
            console.log(port.comName, "-", port.manufacturer, "(" + port.pnpId + ")");
        });
    } else console.log("NONE!");
});

// TODO: Select serial port based on pnpId to be able to use same HW when connected to different UDB port.
// TODO: Implement set/getConfig with "latest available" + configgured pnpId!

// Load state.
var stateStore = new ConfigStore(__dirname, "state");
var state = stateStore.load();

var ari = new AriClient("MysensorGW");
if (!state.authToken) ari.connectDevice("device");
else ari.connect(state.authToken);

var config = {
    nodes: {
        "1": {
            name: "MultiThing",
            sensors: {
                "0": {
                    name: "Temperature",
                },
                "1": {
                    name: "Humidity",
                },
                "2": {
                    name: "Motion",
                }
            }
        },
        "10": {
            name: "DevThing",
            sensors: {
                "0": {
                    name: "Temperature",
                },
                "1": {
                    name: "Humidity",
                },
                "2": {
                    name: "Motion",
                }
            }
        }
    }
};

ari.onconnect = function (result) {
    if (!state.authToken) {
        // First time we get an authToken, save it!
        state.authToken = ari.authToken;
        stateStore.save();
    }
    clientName = result.name;   // Store name in case we got a new one (with (x) at the end!)
    console.log("Client connected as \"" + ari.name + "\"");
    
    // handle subscriptions.
    ari.subscribe(clientName + ".*", function (path, value) {
        console.log("->", path, "=", value);
    });
    
    // register functions.
    ari.registerRpc("getConfig", { description: "Get configuration data for UI." }, function (pars, callback) {
        callback(null, config);
    });
    
    ari.registerRpc("setConfig", { description: "Set configuration data for device." }, function (pars, callback) {
        config = pars.config;
        callback(null, {}); // Indicate OK.
    });
    
    // Register values.
    for (key in config.nodes) {
        var msNode = config.nodes[key];
        for (key2 in msNode.sensors) {
            var sensor = msNode.sensors[key2];
            ari.registerValue(msNode.name + "." + sensor.name);
        }
    }
    
    // Serial port comuunication to mysensor gateway.    
    var serialPort = new SerialPort("COM3", {
        baudrate: 115200,
        parser: SerialPortModule.parsers.readline('\n')
    });
    
    serialPort.on("open", function () {
        console.log('open');
        
        serialPort.on('data', function (data) {
            //        console.log('MSGW: ' + data);
            handleMSGWTlg(data);

        });
/*    mySensorGW.write("ls\n", function (err, results) {
        console.log('err ' + err);
        console.log('results ' + results);
    });
*/
    });
    
    
    function handleMSGWTlg(data) {
        var parts = data.split(';');
        
        var msMsg = {
            nodeId: parts[0],
            sensorId: parts[1],
            messageType: parts[2],
            ack: parts[3],
            subType: parts[4], 
            payload: parts[5],
        };
        
        if (msMsg.nodeId == 0) return;  // Ignore gateway messages for now.
        var node = config.nodes[msMsg.nodeId];
        if (node) {
            var sensor = node.sensors[msMsg.sensorId];
            if (sensor) {
                console.log("-> @" + new Date().toISOString(), "MySensor." + node.name + "." + sensor.name, "=", msMsg.payload);
                ari.publish(node.name + "." + sensor.name, msMsg.payload);
            }
            else console.log(parts);
        }
        else console.log(parts);
    }
}

ari.onerror = function (result) {
    if (serialPort) {
        if (serialPort.isOpen()) serialPort.close();
        serialPort = null;
    }
}

ari.onclose = function (result) {
    if (serialPort) {
        if (serialPort.isOpen()) serialPort.close();
        serialPort = null;
    }
}

