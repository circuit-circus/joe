var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');

var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;

var yrno = require('yr.no-forecast');

var serialport = require('serialport');
var portName = '/dev/tty.usbmodem1411';
var sp = new serialport.SerialPort(portName, {
    baudRate: 9600,
    dataBits: 8,
    parity: 'none',
    stopBits: 1,
    flowControl: false,
    parser: serialport.parsers.readline("\r\n")
});

/* SETUP */
app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

/* Set mongo URL */
var url = 'mongodb://localhost:27017/nextM17';


/* SERIAL COM */
io.on('connection', function(socket) {
    sp.on('data', function(input) {
        socket.emit('buttonPress', input);
    });
});

/* ROUTES */
app.get('/', function(req, res, next) {
    res.render('index.html');
});

app.post('/drinks', function(req, res, next) {
    var data = req.body;

    console.log(data);

    MongoClient.connect(url).then(function (db) {
        drinks = db.collection('coffee');

        drinks.find(data).toArray(function(error, result) {
            console.log(result);
            res.send(result);
        });

    }).catch(function (error) {
        console.log(error);
        console.log('Could not connect');
    });
});

app.post('/weather', function(req, res, next) {

    var currTime = new Date();
    yrno.getWeather({
        lat: req.body.latitude,
        lon: req.body.longitude
    }, function(err, location) {
        location.getForecastForTime(currTime, function(err, result) {
            res.send(result);
        });
    });
});

http.listen(5000, function(){
  console.log('listening on *:5000');
});

