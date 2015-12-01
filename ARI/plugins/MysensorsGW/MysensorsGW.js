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
        delete pars.portOptions;
        config = pars;
        // Store config.
        configStore.save(config);

        if (pars.portName != config.portName) {
            console.log("Selecting new serial port:", pars.portName);
            openPort(pars.portName);
        }

        // clear values on ari
        ari.clearValues();

        // Register values.
        for (key in config.nodes) {
          var msNode = config.nodes[key];
          if (msNode.active) {
            for (key2 in msNode.sensors) {
              var sensor = msNode.sensors[key2];
              for (key3 in sensor.setReqTypes) {
                var setReqType = sensor.setReqTypes[key3];
                ari.registerValue(msNode.name + "." + sensor.name + "." + setReqType.name, {}, function (name, value) {
                    // This function is called if remote client wants to set this inputs.
                    // TODO: Send message to sensor here.
                    console.log("EXTERNAL SETVALUE:", name, value);
                    sendDataToNode(name, value);
                });
              }
            }
          }
        }

        callback(null, {}); // Indicate OK.
    });

    // Register values.
    for (key in config.nodes) {
      var msNode = config.nodes[key];
      if (msNode.active) {
        for (key2 in msNode.sensors) {
          var sensor = msNode.sensors[key2];
          for (key3 in sensor.setReqTypes) {
            var setReqType = sensor.setReqTypes[key3];
            ari.registerValue(msNode.name + "." + sensor.name + "." + setReqType.name, {}, function (name, value) {
                // This function is called if remote client wants to set this inputs.
                // TODO: Send message to sensor here.
                console.log("EXTERNAL SETVALUE:", name, value);
                sendDataToNode(name, value);
            });
          }
        }
      }
    }

    function sendDataToNode(name, value) {
      // Split name into usable entities
      var res = name.split(".");
      var number = res.length;
      var subType = null;

      // create a filter to use with simpleJSONFilter
      var filter = {"name": res[0]};
      var nodeFound = sjf.exec(filter, config.nodes);
      if (nodeFound) {
        // Bingo node was found
        var address = Object.keys(nodeFound)[0];
        var filter = {"name": res[1]};
        var sensorFound = sjf.exec(filter, nodeFound[address].sensors);

        if (sensorFound) {
          var sensorId = Object.keys(sensorFound)[0];
          subType = nodeFound[address].sensors[sensorId].msType;

          // if number == 3, then node.sensor.value is specified in "name"
          // Therefore we have to lookup the subType of the value and not
          // the subType of the sensor.
          if (number == 3) {
            var filter = {"name": res[2]};

            var setReqTypeFound = sjf.exec(filter, nodeFound[address].sensors[sensorId].setReqTypes);
            if (setReqTypeFound) {
              subType = Object.keys(setReqTypeFound)[0];
            }
          }
          // We now have the node address, sensorId and the msType
          // Lets send the message :)
          console.log("serial message: " + address + ";" + sensorId+ ";1;0;" + subType + ";" + value + "\n");
          serialPort.write(address + ";" + sensorId + ";1;0;" + subType + ";" + value + "\n", function(err, results) {
             console.log('err ' + err);
             console.log('results ' + results);
          });
        }
      }
    }

    // Example on getValue
    // TODO: Remove... :O)
    ari.getValue("GW433.Garage.temperature", function (err, name, value) {
        console.log("GETVALUE: ", value + " sendTo: " + name);
    });

    // Open serial port and start handling telegrams from GW.
    openPort(config.portName);

/*    mySensorsGW.write("ls\n", function (err, results) {
        console.log('err ' + err);
        console.log('results ' + results);
    });
*/


    function openPort(name){
      console.log("Trying to open Serialport " + config.portName);
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

        if (msMsg.ack == 1) {
          // Currently only print a message to the console and return.
          console.log("This is an ACK message");
          return;
        }

        switch (msMsg.messageType) {
          case "0": // 0 presentation
            msPresentation(msMsg);
            break;
          case "1": // 1 set
            msSet(msMsg);
            break;
          case "2": // 2 request
            msRequest(msMsg);
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
            var sensorName = presentation[msMsg.subType];
            var number = findeSensorName(msMsg.nodeId, sensorName);
            if (number == 0) {
              sensorName = presentation[msMsg.subType];
            } else {
              sensorName = presentation[msMsg.subType] + "(" + number + ")";
            }
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
        config.nodes[msMsg.nodeId].active = false;
      }

      switch (msMsg.subType) {
        case "0": // Battery Level 0-100
          config.nodes[msMsg.nodeId].batteryLevel = msMsg.payload;
          configStore.save(config);
          break;
        case "6": // Config Metric or Imperial
          setMetric(msMsg);
          break;
        case "11": // Sketch name
          // Only for new nodes that are added set the name
          // TODO: Check that the name is unique.
          if (!config.nodes[msMsg.nodeId].name) {
            var number = findeNodeName(msMsg.payload);
            if ( number == 0 ) {
              config.nodes[msMsg.nodeId].name = msMsg.payload;
            } else {
              config.nodes[msMsg.nodeId].name = msMsg.payload + "(" + number + ")";
            }

          }
          config.nodes[msMsg.nodeId].sketchName = msMsg.payload;
          configStore.save(config);
          break;
        case "12": // Sketch version
          config.nodes[msMsg.nodeId].sketchVersion = msMsg.payload;
          configStore.save(config);
          break;
        default:
        console.log("msInternal - subType not supported: " + msMsg.subType);
          break;
      }
    }

    // findeNodeName search through the config.nodes
    // and returns the number of keys in the result
    // the return value can be used to create unique nodeName
    function findeNodeName(nodeName) {
      // create a filter to use with simpleJSONFilter
      var filter = {"name": nodeName};
      var result = sjf.exec(filter, config.nodes);
      console.log(result);
      console.log("Number of Nodes with the same name found: " + Object.keys(result).length);
      return Object.keys(result).length;
    }

    // findeSensorName search through the config.nodes[nodeId].sensors
    // and returns the number of keys in the result
    // the return value can be used to create unique sensorName
    function findeSensorName(nodeId, sensorName) {
      // create a filter to use with simpleJSONFilter
      var filter = {"name": sensorName};
      var result = sjf.exec(filter, config.nodes[nodeId].sensors);
      console.log(result);
      console.log("Number of Sensors with the same name found: " + Object.keys(result).length);
      return Object.keys(result).length;
    }

    // findeValueName search through the config.nodes[nodeId].sensors[sensorId].setReqTypes
    // and returns the number of keys in the result
    // the return value can be used to create unique nodeName
    function findeValueName(nodeId, sensorId, valueName) {
      // create a filter to use with simpleJSONFilter
      var filter = {"name": valueName};
      var result = sjf.exec(filter, config.nodes[nodeId].sensors[sensorId]);
      console.log(result);
      console.log("Number of Values with the same name found: " + Object.keys(result).length);
      return Object.keys(result).length;
    }

    function setMetric(msMsg) {
      console.log("Reply to node with (M)etric");
      console.log("serial message: " + msMsg.nodeId + ";" + msMsg.sensorId + ";" + msMsg.messageType + ";0;" + msMsg.subType + ";" + "M" + "\n");
      serialPort.write(msMsg.nodeId + ";" + msMsg.sensorId + ";" + msMsg.messageType + ";0;" + msMsg.subType + ";" + "M" + "\n", function(err, results) {
         console.log('err ' + err);
         console.log('results ' + results);
      });
    }

    function msRequest(msMsg) {
      var node = config.nodes[msMsg.nodeId];
      if (node) {
        var sensor = node.sensors[msMsg.sensorId];
        if (sensor) {
          if(node.active) {
            if(!node.sensors[msMsg.sensorId].setReqTypes) {
              node.sensors[msMsg.sensorId].setReqTypes = {};
            }
            if(!node.sensors[msMsg.sensorId].setReqTypes[msMsg.subType]) {
              var valueName = setReqTypes[msMsg.subType];
              var number = findeValueName(msMsg.nodeId, msMsg.sensorId, valueName)
              if (number == 0) {
                valueName = setReqTypes[msMsg.subType];
              } else {
                valueName = setReqTypes[msMsg.subType] + "(" + number + ")";
              }
              // Add new name and set, request Type for sensor
              sensor.setReqTypes[msMsg.subType] = { "name": valueName, "msType": msMsg.subType};
              configStore.save(config);
              console.log("request type added for " + msMsg.nodeId);
              // Since the node is active we have to register the subtype and
              // register the function to be called when the subtype shall be set
              ari.registerValue(node.name + "." + sensor.name + "." + valueName, {}, function (name, value) {
                  // This function is called if remote client wants to set this inputs.
                  // TODO: Send message to sensor here.
                  console.log("EXTERNAL SETVALUE:", name, value);
                  sendDataToNode(name, value);
              });
            }
            console.log("Request: " + node.name + "." + sensor.name + "." + sensor.setReqTypes[msMsg.subType].name);

            ari.getValue(node.name + "." + sensor.name + "." + sensor.setReqTypes[msMsg.subType].name, function (err, name, value) {
                console.log("GETVALUE:", value + " SendTo: " + name);
            });
          } else {
            if(!node.sensors[msMsg.sensorId].setReqTypes) {
              node.sensors[msMsg.sensorId].setReqTypes = {};
            }
            if(!node.sensors[msMsg.sensorId].setReqTypes[msMsg.subType]) {
              var valueName = setReqTypes[msMsg.subType];
              var number = findeValueName(msMsg.nodeId, msMsg.sensorId, valueName)
              if (number == 0) {
                valueName = setReqTypes[msMsg.subType];
              } else {
                valueName = setReqTypes[msMsg.subType] + "(" + number + ")";
              }
              // Add new name and set, request Type for sensor
              node.sensors[msMsg.sensorId].setReqTypes[msMsg.subType] = { "name": valueName, "msType": msMsg.subType};
              configStore.save(config);
              console.log("set request type added for " + msMsg.nodeId);
            }
          }
        }
      }
    }

    function msSet(msMsg) {
      var node = config.nodes[msMsg.nodeId];
      if (node) {
        var sensor = node.sensors[msMsg.sensorId];
        if (sensor) {
          if(node.active) {
            if(!node.sensors[msMsg.sensorId].setReqTypes) {
              node.sensors[msMsg.sensorId].setReqTypes = {};
            }
            if(!node.sensors[msMsg.sensorId].setReqTypes[msMsg.subType]) {
              var valueName = setReqTypes[msMsg.subType];
              var number = findeValueName(msMsg.nodeId, msMsg.sensorId, valueName)
              if (number == 0) {
                valueName = setReqTypes[msMsg.subType];
              } else {
                valueName = setReqTypes[msMsg.subType] + "(" + number + ")";
              }
              // Add new name and set, request Type for sensor
              sensor.setReqTypes[msMsg.subType] = { "name": valueName, "msType": msMsg.subType};
              configStore.save(config);
              console.log("set type added for " + msMsg.nodeId);

              // Since the node is active we have to register the subtype and
              // register the function to be called when the subtype shall be set
              ari.registerValue(node.name + "." + sensor.name + "." + sensor.setReqTypes[msMsg.subType].name, {}, function (name, value) {
                  // This function is called if remote client wants to set this inputs.
                  // TODO: Send message to sensor here.
                  console.log("EXTERNAL SETVALUE:", name, value);
                  sendDataToNode(name, value);
              });
            }
            // setValue
            console.log("-> @" + new Date().toISOString(), "MysensorsGW." + node.name + "." + sensor.name + "." + sensor.setReqTypes[msMsg.subType].name, "=", msMsg.payload);
            ari.setValue(node.name + "." + sensor.name + "." + sensor.setReqTypes[msMsg.subType], msMsg.payload);
          }
          else {
            if(!node.sensors[msMsg.sensorId].setReqTypes) {
              node.sensors[msMsg.sensorId].setReqTypes = {};
            }
            if(!node.sensors[msMsg.sensorId].setReqTypes[msMsg.subType]) {
              var valueName = setReqTypes[msMsg.subType];
              var number = findeValueName(msMsg.nodeId, msMsg.sensorId, valueName)
              if (number == 0) {
                valueName = setReqTypes[msMsg.subType];
              } else {
                valueName = setReqTypes[msMsg.subType] + "(" + number + ")";
              }
              // Add new name and set, request Type for sensor
              node.sensors[msMsg.sensorId].setReqTypes[msMsg.subType] = { "name": valueName, "msType": msMsg.subType};
              configStore.save(config);
              console.log("set request type added for " + msMsg.nodeId);
            }
            console.log("notActive " + msMsg.nodeId);
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
