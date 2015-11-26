var AriClient = require("../../www/app/ariclient.js").AriClient;
var ConfigStore = require("../../configStore.js");

var SerialPortModule = require("serialport");
var SerialPort = SerialPortModule.SerialPort; // localize object constructor

var serialPort = null;

// TODO: Select serial port based on pnpId to be able to use same HW when connected to different UDB port.
// TODO: Implement set/getConfig with "latest available" + configgured pnpId!

var simpleJSONFilter = require("simple-json-filter");
var sjf = new simpleJSONFilter();

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

    // register functions.
    ari.registerFunction("getConfig", { description: "Get configuration data for UI." }, function (pars, callback) {

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

    ari.registerFunction("setConfig", { description: "Set configuration data for device." }, function (pars, callback) {
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
        for (key in config.notAdded) {
            var msNode = config.notAdded[key];
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
            ari.registerValue(msNode.name + "." + sensor.name, {}, function (name, value) {
                // This function is called if remote client wants to set this inputs.
                // TODO: Send message to sensor here.
                console.log("EXTERNAL SETVALUE:", name, value);
                sendDataToNode(name, value);
            });
        }
    }

    function sendDataToNode(name, value) {
      // Split name into usable entities
      var res = name.split(".");
      var num = value - 0;
      // create a filter to use with simpleJSONFilter
      var filter = {"name": res[0]};
      var nodeFound = sjf.exec(filter, config.nodes);
      if (nodeFound) {
        // Bingo node was found
        var address = Object.keys(nodeFound)[0];
        var filter = {"name": res[1]};
        var sensorFound = sjf.exec(filter, nodeFound[address].sensors);

        if (sensorFound) {
          // Sensor found, now lets send a telegram to the node.
          // It is currently only sending V_STATUS=2 to the node
          // with the value as payload (num = value -1).
          // Since sending 0 from nodeRed is ignored, somewhere.
          var sensorId = Object.keys(sensorFound)[0];
          console.log("serial message: " + address + ";" + sensorId+ ";1;0;2;" + num + "\n");
          serialPort.write(address + ";" + sensorId + ";1;0;2;" + num + "\n", function(err, results) {
             console.log('err ' + err);
             console.log('results ' + results);
          });
        }
      }
    }

    // Example on getValue
    // TODO: Remove... :O)
    ari.getValue("GW433.Garage.temperature", function (err, result) {
        console.log("GETVALUE:", result);
    });

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
                ari.setValue(node.name + "." + sensor.name, msMsg.payload);
                node.sensors[msMsg.sensorId].values = { "name": msMsg.subType, "msType": msMsg.subType, "value": msMsg.payload};
                configStore.save(config);
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
            // lookup nodeId in notAdded
            if (!config.notAdded) {
              config.notAdded = {};
            }
            var notAdded = config.notAdded[msMsg.nodeId];
            // if nodeId does not exists add it to the list
            if (!notAdded) {
              config.notAdded[msMsg.nodeId] = {};
            }

            if (!config.notAdded[msMsg.nodeId].name) {
              // Add new node to the notAdded list
              // together with the skechtname
              config.notAdded[msMsg.nodeId].name = msMsg.payload;
              configStore.save(config);
            }
          }
          else if(msMsg.sensorId == 255 && msMsg.messageType == 3 && msMsg.subType == 12)
          {
            // lookup nodeId in notAdded
            if (!config.notAdded) {
              config.notAdded = {};
            }
            var notAdded = config.notAdded[msMsg.nodeId];
            // if nodeId does not exists add it to the list
            if (!notAdded) {
              config.notAdded[msMsg.nodeId] = {};
            }
            // if nodeId does not exists add it to the list
            if (!config.notAdded[msMsg.nodeId].version) {
              // Add new node to the notAdded list
              // together with the skechtname
              config.notAdded[msMsg.nodeId].version = msMsg.payload;
              configStore.save(config);
            }
          }
          else if (msMsg.sensorId != 255 && msMsg.messageType == 0) {
            // Handle presentation message from node
            // the node presents the sensors it provides
            // with messageType set to 0 and the subtype represents
            // the sensor provided
            if (!config.notAdded) {
              config.notAdded = {};
            }
            var notAdded = config.notAdded[msMsg.nodeId];
            if (notAdded) {
              if(!config.notAdded[msMsg.nodeId].sensors) {
                config.notAdded[msMsg.nodeId].sensors = {};
              }
              // Check if sensor is not already added
              var sensors = notAdded.sensors[msMsg.sensorId];
              if (!sensors) {
                //sensor is not added to the list
                var presentation = {};
                presentation[3] = "Light"
                presentation[6] = "Temperature";
                presentation[7] = "Humidity";

                var sensor = {
                  "name": presentation[msMsg.subType],
                  "msType": msMsg.subType
                }
                config.notAdded[msMsg.nodeId].sensors[msMsg.sensorId] = sensor;
                //config.notAdded[msMsg.nodeId].sensors[msMsg.sensorId] = {"name": msMsg.subType};
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
  console.log("onClose: MySensorGW");
    if (serialPort) {
        if (serialPort.isOpen()) serialPort.close();
        serialPort = null;
    }
}
