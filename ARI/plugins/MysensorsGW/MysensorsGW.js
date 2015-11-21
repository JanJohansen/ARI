var AriClient = require("../../www/app/ariclient.js").AriClient;
var ConfigStore = require("../../configStore.js");

var SerialPortModule = require("serialport");
var SerialPort = SerialPortModule.SerialPort; // localize object constructor

var serialPort = null;

// TODO: Select serial port based on pnpId to be able to use same HW when connected to different UDB port.
// TODO: Implement set/getConfig with "latest available" + configgured pnpId!

// Load state.
var stateStore = new ConfigStore(__dirname, "state");
var state = stateStore.load();

// Load configuration.
var configStore = new ConfigStore(__dirname, "config");
var config = configStore.load();
console.log("Config:", config, __dirname);

// Create ARI client.
var ari = new AriClient("MysensorsGW");
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

    // handle subscriptions.
    ari.subscribe(clientName + ".*", function (path, value) {
        console.log("->", path, "=", value);
    });

    // register functions.
    ari.registerRpc("getConfig", { description: "Get configuration data for UI." }, function (pars, callback) {

        var uiconfig = config;

        // Add possble ports for configuration via settings view...
        SerialPortModule.list(function (err, ports) {
            console.log("Serial ports:");
            uiconfig.portOptions = [];
            if (ports) {
                ports.forEach(function (port) {
                    console.log(port.comName, "-", port.manufacturer, "(" + port.pnpId + ")");
                    //uiconfig.portOptions.push({ "name": port.comName, "manufacturer": port.manufacturer, "pnpId": port.pnpId });
                    uiconfig.portOptions.push(port.comName);
                });
            } else console.log("NONE!");
            callback(null, uiconfig);
        });
    });

    ari.registerRpc("setConfig", { description: "Set configuration data for device." }, function (pars, callback) {
        console.log("Storing new configuration.");
        if (pars.portName != config.portName) {
            console.log("Selecting new serial port:", pars.portName);
            openPort(pars.portName);
        }
        delete pars.portOptions;
        config = pars;
        // Store config.
        configStore.save(config);

        // Deregister deactive nodes
        for (key in config.NotAdded) {
            var msNode = config.NotAdded[key];
            for (key2 in msNode.sensors) {
                var sensor = msNode.sensors[key2];
                ari.deRegisterValue(msNode.name + "." + sensor.name);
            }
        }

        // Register active nodes
        for (key in config.nodes) {
            var msNode = config.nodes[key];
            for (key2 in msNode.sensors) {
                var sensor = msNode.sensors[key2];
                ari.registerValue(msNode.name + "." + sensor.name);
            }
        }

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

    // Open serial port and start handling telegrams from GW.
    openPort(config.portName);

/*    mySensorsGW.write("ls\n", function (err, results) {
        console.log('err ' + err);
        console.log('results ' + results);
    });
*/


    function openPort(name){
      console.log("Trying to open Serialport");
      // Serial port comuunication to mysensor gateway.
      if (serialPort) {
          if (serialPort.isOpen()) serialPort.close();
          serialPort = null;
      }


      serialPort = new SerialPort(config.portName, {
          baudrate: 115200,
          parser: SerialPortModule.parsers.readline('\n')},
          false
      );

      serialPort.open();

      serialPort.on("open", function (error) {
        serialPort.on('data', function (data) {
        //        console.log('MSGW: ' + data);
        handleMSGWTlg(data);

        });
      });

      serialPort.on("error", function(error) {
        console.log("error happend " + error);
      });
    }

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
        if (!config.nodes) config.nodes = {};
        var node = config.nodes[msMsg.nodeId];
        if (node) {
            var sensor = node.sensors[msMsg.sensorId];
            if (sensor) {
                console.log("-> @" + new Date().toISOString(), "MySensor." + node.name + "." + sensor.name, "=", msMsg.payload);
                ari.publish(node.name + "." + sensor.name, msMsg.payload);
            }
            else {
              console.log(parts);
            }
        }
        else {
          // sensorId 255 is used to provide skecth name and version
          // with message type 3 and subtype 11 for name and 12 for version
          if(msMsg.sensorId == 255 && msMsg.messageType == 3 && msMsg.subType == 11)
          {
            // lookup nodeId in NotAdded
            if (!config.NotAdded) {
              config.NotAdded = {};
            }
            var NotAdded = config.NotAdded[msMsg.nodeId];
            // if nodeId does not exists add it to the list
            if (!NotAdded) {
              // Add new node to the NotAdded list
              // together with the skechtname
              var element = {};
              element = {"name": msMsg.payload};
              config.NotAdded[msMsg.nodeId] = element;
              configStore.save(config);
            }
          }
          else if (msMsg.sensorId != 255 && msMsg.messageType == 0) {
            // Handle presentation message from node
            // the node presents the sensors it provides
            // with messageType set to 0 and the subtype represents
            // the sensor provided
            if (!config.NotAdded) config.NotAdded = {};
            var NotAdded = config.NotAdded[msMsg.nodeId];
            if (NotAdded) {
              if(!config.NotAdded[msMsg.nodeId].sensors) {
                config.NotAdded[msMsg.nodeId].sensors = {};
              }
              // Check if sensor is not already added
              var sensors = NotAdded.sensors[msMsg.sensorId];
              if (!sensors) {
                //sensor is not added to the list
                var presentation = {};
                presentation[3] = "Light"
                presentation[6] = "Temperature";
                presentation[7] = "Humidity";
                config.NotAdded[msMsg.nodeId].sensors[msMsg.sensorId] = {"name": presentation[msMsg.subType]};
                //config.NotAdded[msMsg.nodeId].sensors[msMsg.sensorId] = {"name": msMsg.subType};
                configStore.save(config);
                console.log("Sensor added " + msMsg.sensorId);
              }
            }
          }
          console.log(parts);
        }
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
