var AriClient = require("../ARI/www/app/ariclient.js").AriClient;
var SerialPortModule = require("serialport");
var SerialPort = SerialPortModule.SerialPort; // localize object constructor 
var ConfigStore = require("../ARI/configStore.js");


// For debug - and later configuration!
SerialPortModule.list(function (err, ports) {
    console.log("Available serial ports:");
    ports.forEach(function (port) {
        console.log(port.comName, "-", port.manufacturer, "(" + port.pnpId + ")");
    });
});

// TODO: Select serial port based on pnpId to be able to use same HW when connected to different UDB port.
// TODO: Implement set/getConfig with "latest available" + configgured pnpId!

// Load state.
var stateStore = new ConfigStore(__dirname, "GW433_state");
var state = stateStore.load();

var ari = new AriClient("GW433");

if (!state.authToken) ari.connectDevice("controller");
else ari.connect(state.authToken);

var config = {
    "protocols": {
        "WT450": {
            "H10S2T": { alias: "Garage.temperature" },
            "H10S2H": { alias: "Garage.humidity" },
            "H14S2T": { alias: "Depot.temperature" },
            "H14S2H": { alias: "Depot.humidity" },
            "H15S3T": { alias: "Studio.temperature" },
            "H15S3H": { alias: "Studio.humidity" },
            "H3S3T": { alias: "Livingroom.temperature" },
            "H3S3H": { alias: "Livingroom.humidity" }
        },
        "PT2262": {
            "0000000000B2125A": {
                "alias": "New_Pir_In_Office.motion"
            }
        }
    }
};

var WT450LastVals = {};
var PT2262Timers = {};
var serialPort = null;

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
    for (key in config.protocols.WT450) {
        ari.registerValue(config.protocols.WT450[key].alias, null);
    }
    for (key in config.protocols.PT2262) {
        ari.registerValue(config.protocols.PT2262[key].alias, null);
    }
    
    // Handle receiver on serial port.
    console.log("Opening serial port 'COM?'.");
    try {
        serialPort = new SerialPort("COM13", {
            baudrate: 115200,
            parser: SerialPortModule.parsers.readline("\n")
        });
    } catch (e) {
        console.log("ERROR when trying to open serialport:", e);
        if (serialPort) serialPort.close();
        process.exit(1);
    }
    
    serialPort.on("open", function () {
        console.log('Serial port opened.');
        
        serialPort.on('data', function (data) {
            console.log('433GW: ' + data);
            handle433Tlg(data);

        });
/*    serialPort.write("ls\n", function (err, results) {
        console.log('err ' + err);
        console.log('results ' + results);
    });
*/
    });
    
    function handle433Tlg(data) {
        var tlg = "";
        try {
            tlg = JSON.parse(data);
        }
        catch (e) {
            return;
        }
        
        if (tlg.prt == 5) {
            //console.log("Parsing WT450 telegram...", new Date().toISOString());
            
            var data = parseInt(tlg.val, 16);
            
            var house = (data >> 28) & (0x0f);
            var station = ((data >> 26) & (0x03)) + 1;
            var humidity = (data >> 16) & (0xff);
            var temperature = ((data >> 8) & (0xff));
            temperature = temperature - 50;
            var tempfraction = (data >> 4) & (0x0f);
            var tempdecimal = ((tempfraction >> 3 & 1) * 0.5) + ((tempfraction >> 2 & 1) * 0.25) + ((tempfraction >> 1 & 1) * 0.125) + ((tempfraction & 1) * 0.0625);
            var temperature = temperature + tempdecimal;
            temperature = temperature * 10;
            temperature = temperature / 10;
            
            // Convert to strings.
            temperature = parseFloat(temperature.toFixed(1));   // Only show 1 decimal!
            humidity = humidity;
            
            // Debug!
            var name = "H" + house.toString() + "S" + station.toString();
            
            // Find transmitter if defined...
            var transmitter = config.protocols.WT450[name + "T"];
            if (transmitter) {
                // Send if value changed.
                console.log("IS same?", name + "T", WT450LastVals[name + "T"]);
                if (WT450LastVals[name + "T"] != temperature) ari.publish(transmitter.alias, temperature);
                WT450LastVals[name + "T"] = temperature; // Store latest value.
            }
            else console.log("-> @" + new Date().toISOString(), name + ".temperature =", temperature);
            
            if (humidity <= 100) {
                transmitter = config.protocols.WT450[name + "H"];
                if (transmitter) {
                    // Send if value changed.
                    if (WT450LastVals[name + "H"] != humidity) ari.publish(transmitter.alias, humidity);
                    WT450LastVals[name + "H"] = humidity; // Store latest value.
                }
                else console.log("-> @" + new Date().toISOString(), name + ".humidity =", humidity);
            }
        }
        else if (tlg.prt == 1) {
            // For now ignoring bits and delay
            // Match received to find alias.            
            var transmitter = config.protocols.PT2262[tlg.val];
            if (transmitter) {
                console.log("-> @", new Date().toISOString(), "GW433." + transmitter.alias);
                
                // Set timer to send alias = 0 after 100 mSec
                if (!PT2262Timers[transmitter.alias]) ari.publish(transmitter.alias, "1");
                else clearTimeout(PT2262Timers[transmitter.alias]);
                PT2262Timers[transmitter.alias] = setTimeout(pt2262Timeout, 100, transmitter.alias);

            } else console.log("-> @", new Date().toISOString(), "GW433 Data:" + data.toString());
        }
        else console.log("Unknown protocol ID received from GW433!!!", data);
    }
}

var pt2262Timeout = function (alias){
    ari.publish(alias, "0");
    delete PT2262Timers[alias];
}

ari.onerror = function (err) {
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

