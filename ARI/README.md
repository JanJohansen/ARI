# ARI - Automation Routing Infrastructure

## Personal home automation project

## Getting started

### Raspberry pi
Follow the guidelines from raspberry.org [Getting started with NOOBS](https://www.raspberrypi.org/help/noobs-setup/)

Run the following commands
```
sudo apt-get update
sudo apt-get upgrade
```

Install GCC
```
sudo apt-get install gcc-4.8 g++-4.8
```

Install Node.js using this guide [adafruit installing node.js](https://learn.adafruit.com/node-embedded-development/installing-node-dot-js)

You should now have installed `node` version 0.12.6 on your Raspberry pi

Install `npm` which is the package manager for Node.js
```
sudo apt-get install npm
```

Select a folder on the raspberry pi to install ARI and run the following command
```
git clone https://github.com/JanJohansen/ARI.git
```

Run `npm install` to install the necessary packages required by ARI in the following folders
```
cd ARI
cd ARI
npm install
cd plugins
cd MysensorsGW
npm install
cd ..
cd Node-Red
npm install
cd ..
cd ..
```

You are now ready to start ARI for the first time
```
sudo node server.js
```

Open a browser (Chrome) `http://MyRaspberryPIaddress:3000`
You should now see the start screen for ARI.

# TODO's:
- [] Authentication + Authorization
- [] 	User name in menu.
- []	Use www auth token for websocket.
- [] Device UI w. pending authorizations
- [] Admin UI
- [] Logging UI
- [] Plugin UI
- [] mDNS for dicovery (ESP8266)
- [] Exit fullscreen button.
- [] Use/support IFrame for views?
- [] "Ari"-fy javascript object to serve.

//****************
DONE: Disconnect ariclient (incl. WebSocket) when closing view.
