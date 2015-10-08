var AriClient = require("../ARI/www/app/ariclient.js").AriClient;
var serialport = require("serialport");
var SerialPort = serialport.SerialPort; // localize object constructor 
var jsonfile = require('jsonfile');

// Define defaults.
var config = {
    name: "GW433",
    clientToken: null
};

// Load configuration from file.
var configFile = __dirname + "\\ariClientConfig.json";
try {
    var config = jsonfile.readFileSync(configFile);
} catch (e) { 
};

var serialPort = null;

var ari = new AriClient({ "name": config.name, "clientToken": config.clientToken });

ari.onconnect = function (result){
    // Request clientToken and store in configuration file.
    if (!config.clientToken) {
        ari.requestClientToken(function (err, result) {
            if (err) {
            }
            else {
                config.clientToken = result.clientToken;
                jsonfile.writeFile(configFile, config, { spaces: 4 });
            }
        });
    }
    
    clientName = result.name;
    
    console.log("Client connected as \"" + ari.name + "\"");
    
    ari.subscribe(clientName + ".*", function (path, value) {
        console.log("->", path, "=", value);
    });

    serialPort = new SerialPort("COM6", {
        baudrate: 115200,
        parser: serialport.parsers.readline("\n")
    });
    
    serialPort.on("open", function () {
        console.log('open');
        
        serialPort.on('data', function (data) {
            //console.log('433GW: ' + data);
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
            
            temperature = temperature.toFixed(1);   // Only show 1 decimal!
            
            var WT450s = {
                "102": {
                    name: "Garage",
                },
                "142": {
                    name: "Depot",
                },
                "153": {
                    name: "Studio",
                },
                "33": {
                    name: "Livingroom",
                }
            };
            
            var wt = WT450s[house.toString() + station.toString()];
            if (wt) {
                console.log("-> @" + new Date().toISOString(), "433gw." + wt.name + ".temperature =", temperature);
                ari.publish(clientName + "." + wt.name +".temperature", temperature);
                
                console.log("-> @" + new Date().toISOString(), "433gw." + wt.name + ".humidity =", humidity);
                ari.publish(clientName + "." + wt.name + ".humidity", humidity);
            }
            else {
                console.log("house:", house, ",station:", station, ", humidity:", humidity, ", temperature:", temperature);
                ari.publish(clientName + ".H" + house + "S" + station + ".temperature", temperature);
                // Some sensors don't report humidity...
                if (humidity <= 100) ari.publish(clientName + "H" + house + ".S" + station + ".humidity", humidity);
            }
        }
        else {
            console.log("@", new Date().toISOString(), "433gw Data:" + data.toString());
            ari.publish(clientName + ".PT2262." + data.toString(), "1");
        }
    }
}

ari.onerror = function (result) {
    if (serialPort) {
        if (serialPort.isOpen()) serialPort.close();
        serialPort = null;
    }
}

ari.ondisconnect = function (result) {
    if (serialPort) {
        if (serialPort.isOpen()) serialPort.close();
        serialPort = null;
    }
}

