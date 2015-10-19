"use strict";
var port = 3000;

var server = require('http').createServer();
var url = require('url');
var WSServer = require('ws').Server;
var wss = new WSServer({ server: server });
var express = require('express');
var app = express();
var bodyParser = require('body-parser')
var jwt = require('jwt-simple');

//*****************************************************************************
// Set up Ari server...
var Ari = require('./ari.js').Ari;
var ari = new Ari({ websocketServer: wss });


//*****************************************************************************
// HTTP Server 
app.use(bodyParser.json());     // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true /* to support URL-encoded bodies */ }));


//server.on('request', app);
server.on('request', function (req, res, next) {
    //console.log(req.url);
    app(req, res, next);
});

server.listen(port, function () {
    console.log('Listening on ' + server.address().port)
});

// REST API *******************************************************************

// Middleware checking if there is a JWT token in "Auth-request header". Decoding it to "user" if exists...
app.use(function (req, res, next) {
    // check header or url parameters or post parameters for token
    var token = req.body.Auth || req.query.Auth || req.headers["auth"];
    
    // decode token
    if (token) {
        // verifies secret and checks exp
        var decoded = jwt.decode(token, ari.JWTSecret);
        if (decoded) {
            // TODO: Check date of token agains local store, to check if token has been revoked...
            req.user = decoded;
        }
        next();
    } else {
        // Allow for now!
        //if thereis no token check if targeturl route is allowed without it.
        //console.log("Checking if allowed without authentication?", req.url);
        //res.redirect("#/views/login");
        next();
    }
});

// GET userlist.
app.get('/api/users', function (req, res) {
    if (req.user && (req.user.role == "admin")) res.json(ari.usersModel);
    else {
        res.status(401).send("API only allowed for role admin.");
        console.log("Atempt to get user list from:");
    }
});


// Provide userToken if credentials are OK.
app.post('/api/users/login', function (req, res) {
    var userName = req.body.name;
    var passWord = req.body.password;
    
    // Check authorization.
    if (userName in ari.usersModel) {
        if (ari.usersModel[userName].password == passWord) {
            ari.usersModel[userName].signupDate = new Date().toISOString();
            var payload = { "name": userName, "role": ari.usersModel[userName].role, "created": ari.usersModel[userName].created };
            var authToken = jwt.encode(payload, ari.JWTSecret);
            res.json({ "authToken": authToken });
            return;
        }
    }
    res.status(401).send('Wrong user or password');
});


app.use("/", express.static(__dirname + "/www/app"));    // Serve static files. (Note: Don't use relative path since it is relative to CWD (Current Working Dir!") Yaiks!


//*****************************************************************************
// Enable user to properly close down server...
process.stdin.resume();
process.stdin.setEncoding("ascii");

process.stdin.on('data', function (text) {
    console.log('received data:', text);
    if (text == "q") {
        handleConsoleQuit();    // TODO: Doesn't seem to work!?
    }
    handleConsoleQuit(); // Use "AnyKey" for now!
});

function handleConsoleQuit() {
    console.log('User shut down... Bye.');
    ari.shutDown();
    process.exit();
}