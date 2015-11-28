var AriClient = require("../../www/app/ariclient.js").AriClient;
var ConfigStore = require("../../configStore.js");

var SerialPortModule = require("serialport");
var SerialPort = SerialPortModule.SerialPort; // localize object constructor

var serialPort = null;

// TODO: Select serial port based on pnpId to be able to use same HW when connected to different UDB port.
// TODO: Implement set/getConfig with "latest available" + configgured pnpId!

var simpleJSONFilter = require("simple-json-filter");
var sjf = new simpleJSONFilter();

// TODO: setreqTypes shall be moved to a separate file.
var setReqTypes = {};
setReqTypes[0] = "V_TEMP";
setReqTypes[1] = "V_HUM";
setReqTypes[2] = "V_STATUS";
setReqTypes[3] = "V_PERCENTAGE";
setReqTypes[4] = "V_PRESSURE";
setReqTypes[5] = "V_FORECAST";
setReqTypes[6] = "V_RAIN";
setReqTypes[7] = "V_RAINRATE";
setReqTypes[8] = "V_WIND";
setReqTypes[9] = "V_GUST";
setReqTypes[10] = "V_DIRECTION";
setReqTypes[11] = "V_UV";
setReqTypes[12] = "V_WEIGHT";
setReqTypes[13] = "V_DISTANCE";
setReqTypes[14] = "V_IMPEDANCE";
setReqTypes[15] = "V_ARMED";
setReqTypes[16] = "V_TRIPPED";
setReqTypes[17] = "V_WATT";
setReqTypes[18] = "V_KWH";
setReqTypes[19] = "V_SCENE_ON";
setReqTypes[20] = "V_SCENE_OFF";
setReqTypes[21] = "V_HVAC_FLOW_RATE";
setReqTypes[22] = "V_HVAC_SPEED";
setReqTypes[23] = "V_LIGHT_LEVEL";
setReqTypes[24] = "V_VAR1";
setReqTypes[25] = "V_VAR2";
setReqTypes[26] = "V_VAR3";
setReqTypes[27] = "V_VAR4";
setReqTypes[28] = "V_VAR5";
setReqTypes[29] = "V_UP";
setReqTypes[30] = "V_DOWN";
setReqTypes[31] = "V_STOP";
setReqTypes[32] = "V_IR_SEND";
setReqTypes[33] = "V_IR_RECEIVE";
setReqTypes[34] = "V_FLOW";
setReqTypes[35] = "V_VOLUME";
setReqTypes[36] = "V_LOCK_STATUS";
setReqTypes[37] = "V_LEVEL";
setReqTypes[38] = "V_VOLTAGE";
setReqTypes[39] = "V_CURRENT";
setReqTypes[40] = "V_RGB";
setReqTypes[41] = "V_RGBW";
setReqTypes[42] = "V_ID";
setReqTypes[43] = "V_UNIT_PREFIX";
setReqTypes[44] = "V_HVAC_SETPOINT_COOL";
setReqTypes[45] = "V_HVAC_SETPOINT_HEAT";
setReqTypes[46] = "V_FLOW_MODE";

// TODO: presentation shall be moved to a separate file.
var presentation = {};
presentation[0] = "Door";
presentation[1] = "Motion";
presentation[2] = "Smoke";
presentation[3] = "Light";
presentation[4] = "Dimmer";
presentation[5] = "Cover";
presentation[6] = "Temperature";
presentation[7] = "Humidity";
presentation[8] = "Barometer";
presentation[9] = "Wind";
presentation[10] = "Rain";
presentation[11] = "UV";
presentation[12] = "Weight";
presentation[13] = "Power";
presentation[14] = "Heater";
presentation[15] = "Distance";
presentation[16] = "Light_Level";
presentation[17] = "Arduino_Node";
presentation[18] = "Arduino_Repeater_Node";
presentation[19] = "Lock";
presentation[20] = "IR";
presentation[21] = "Water";
presentation[22] = "Air_Quality";
presentation[23] = "Custom";
presentation[24] = "Dust";
presentation[25] = "Scene_Controller";
presentation[26] = "RGB_Light";
presentation[27] = "RGBW_Light";
presentation[28] = "Color_Sensor";
presentation[29] = "HVAC";
presentation[30] = "Multimeter";
presentation[31] = "Sprinkler";
presentation[32] = "Water_Leak";
presentation[33] = "Sound";
presentation[34] = "Vibration";
presentation[35] = "Moisture";

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
        for (key in config.nodes) {
            var msNode = config.nodes[key];
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
        console.log("Messages: "+ parts);

        switch (msMsg.messageType) {
          case "0": // 0 presentation
            msPresentation(msMsg);
            break;
          case "1": // 1 set
            msSet(msMsg);
            break;
          case "2": // 2 request
            break;
          case "3": // 3 Internal
            msInternal(msMsg);
            break;
          case "4": // Stream
            break;
          default:
            console.log("No success");
        }
    }

    function msPresentation(msMsg) {

      if (msMsg.sensorId != 255) {
        // Handle presentation message from node
        // the node presents the sensors it provides
        // with messageType set to 0 and the subtype represents
        // the sensor provided
        var nodes = config.nodes[msMsg.nodeId];
        if (nodes) {
          if(!config.nodes[msMsg.nodeId].sensors) {
            config.nodes[msMsg.nodeId].sensors = {};
          }
          // Check if sensor is not already added
          var sensors = nodes.sensors[msMsg.sensorId];
          if (!sensors) {
            //sensor is not added to the list

            var sensor = {
              "name": presentation[msMsg.subType],
              "msType": msMsg.subType
            }
            config.nodes[msMsg.nodeId].sensors[msMsg.sensorId] = sensor;
            //config.nodes[msMsg.nodeId].sensors[msMsg.sensorId] = {"name": msMsg.subType};
            configStore.save(config);
            console.log("Sensor added " + msMsg.sensorId);
          }
        }
      }
    }

    function msInternal(msMsg) {
      // lookup nodeId in nodes
      var nodes = config.nodes[msMsg.nodeId];
      // if nodeId does not exists add it to the list
      if (!nodes) {
        config.nodes[msMsg.nodeId] = {};
        config.nodes[msMsg.nodeId].status = "deactive";
      }

      switch (msMsg.subType) {
        case "0": // Battery Level 0-100
          config.nodes[msMsg.nodeId].batteryLevel = msMsg.payload;
          configStore.save(config);
          break;
        case "11": // Sketch name
          config.nodes[msMsg.nodeId].name = msMsg.payload;
          configStore.save(config);
          break;
        case "12": // Sketch version
          config.nodes[msMsg.nodeId].version = msMsg.payload;
          configStore.save(config);
          break;
        default:
        console.log("msInternal - subType not supported: " + msMsg.subType);
          break;
      }
    }

    function msSet(msMsg) {
      var node = config.nodes[msMsg.nodeId];
      if (node) {
        var sensor = node.sensors[msMsg.sensorId];
        if (sensor) {
          console.log("-> @" + new Date().toISOString(), "MySensor." + node.name + "." + sensor.name, "=", msMsg.payload);
          ari.setValue(node.name + "." + sensor.name, msMsg.payload);
          if(!node.sensors[msMsg.sensorId].setReqTypes) {
            node.sensors[msMsg.sensorId].setReqTypes = {};
          }
          if(!node.sensors[msMsg.sensorId].setReqTypes[msMsg.subType]) {
            // Add new name and set, request Type for sensor
            node.sensors[msMsg.sensorId].setReqTypes[msMsg.subType] = { "name": setReqTypes[msMsg.subType], "msType": msMsg.subType};
            configStore.save(config);
            console.log("set request type added for " + msMsg.nodeId);
          }
        }
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
