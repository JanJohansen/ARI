# ARI - Automation Routing Infrastructure

## Personal home automation project

### More coming - some time soon'ish ;O)

[http://TBD](http://TBD.com).

install nodejs
npm install bower -g

git clone https://github.com/JanJohansen/ARI.git
cd ARI
npm install
cd www
bower install
cd ..
node server.js

# TODO's:
Authentication + Authorization
	User name in menu.	
	Use www auth token for websocket.
Device UI w. pending authorizations
Admin UI
Logging UI
Plugin UI
mDNS for dicovery (ESP8266)
Exit fullscreen button.
Use/support IFrame for views?
"Ari"-fy javascript object to serve.

//****************
DONE: Disconnect ariclient (incl. WebSocket) when closing view.