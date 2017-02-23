var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');

var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;

var yrno = require('yr.no-forecast');

/* SETUP */
app.use(express.static(__dirname + '/public'));
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

// MongoDB URL
var url = 'mongodb://localhost:27017/nextM17';


/* SERIAL COM */
var serialport = require('serialport');
var sp;
// var sp = new serialport.SerialPort(portName, {
//     baudRate: 9600,
//     dataBits: 8,
//     parity: 'none',
//     stopBits: 1,
//     flowControl: false,
//     parser: serialport.parsers.readline("\r\n")
// });
/*var sp = new serialport(portName, function(err) {
    if(err) {
        console.log('No serial connection');
        console.log('Error: ' + err);
    }
});*/
serialport.list(function (err, ports) {
    ports.forEach(function(port) {
        if(port.comName.indexOf('.usbmodem') !== -1) {
            console.log('Connecting to ' + port.comName);
            sp = new serialport(port.comName, {
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                flowControl: false,
                parser: serialport.parsers.readline("\r\n")
            },
            function(err) {
                if(err) {
                    console.log('Error: ' + err.message);
                }
                else {
                    console.log('Port opened on ' + port.comName);
                }
            });
        }
    });
});

// Listen for Arduino buttonpresses
io.on('connection', function(socket) {
    if(sp !== undefined && sp.isOpen()) {
        sp.on('data', function(input) {
            socket.emit('buttonPress', input);
        });
    }
});

/* ROUTES */
app.get('/', function(req, res, next) {
    res.render('index.html');
});

app.post('/drinks', function(req, res, next) {
    var data = req.body;

    MongoClient.connect(url).then(function (db) {
        drinks = db.collection('coffee');

        drinks.find(data).toArray(function(err, result) {
            if(err) {
                console.log('Could not find coffee in DB');
                console.log('Error: ' + err);
                return;
            }
            res.send(result);
        });

    }).catch(function (err) {
        console.log('Could not get drinks');
        console.log('Error: ' + err);
    });
});

app.post('/rfid/recieve', function(req, res, next) {
    var data = req.body;
    console.log(data);
    res.send('is good');
});

app.post('/dispense', function(req, res, next) {
    var data = req.body;
    var dispenser_number = data.dispenser_number.toString();

    if(sp.isOpen()) {
        sp.write(dispenser_number, function(err) {
            console.log('Could not send dispenser signal');
            console.log('Error: ' + err);
        });
    }
});

app.post('/weather', function(req, res, next) {

    var currTime = new Date();
    yrno.getWeather({
        lat: req.body.latitude,
        lon: req.body.longitude
    }, function(err, location) {
        if(err) {
            console.log('Could not get extended weather info for location');
            console.log('Error: ' + err);
            res.send(err);
        }
        if(location !== null) {
            location.getForecastForTime(currTime, function(err, result) {
                if(err) {
                    console.log('Could not get weather info for current time');
                    console.log('Error: ' + err);
                    return;
                }
                res.send(result);
            });
        }
    });
});

http.listen(5000, function() {
  console.log('listening on *:5000');
});

