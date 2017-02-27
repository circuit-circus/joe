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
// var portName = '/dev/cu.usbmodem411';
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
                baudRate: 9600,
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

var listenForVisitors = false;

// Listen for Arduino buttonpresses
io.on('connection', function(socket) {

    if(sp !== undefined && sp.isOpen()) {
        sp.on('data', function(input) {
            console.log(input);
            socket.emit('buttonPress', input);
        });
    }

    // Turn listening for visitors on / off
    socket.on('listenForVisitors', function(msg) {
        listenForVisitors = msg;
    });
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

    var tagsession_query = req.body;
    if(!tagsession_query) return;
    
    res.send('is good');

    if(!listenForVisitors) return;

    MongoClient.connect(url).then(function (db) {

        tagsessions = db.collection('tagsessions');
        guests = db.collection('guests');

        tagsessions.find(tagsession_query).toArray(function(err, result) {
            if(err) {
                console.log('Could not find EPC in DB');
                console.log('Error: ' + err);
                return;
            }

            console.log(result);

            // Could not find guest
            if(result.length <= 0) {
                io.sockets.emit('couldNotFindGuest', result);
                return;
            }

            var guest_query = {
                _id : new ObjectId(result[0]._guest)
            }

            guests.find(guest_query).toArray(function(err, result) {
                if(err) {
                    console.log('Could not find Guest in DB');
                    console.log('Error: ' + err);
                    return;
                }

                console.log(result);

                io.sockets.emit('visitorCheckedIn', result);
            });

        });

    }).catch(function (err) {
        console.log('Could not connect to Mongo');
        console.log('Error: ' + err);
    });
});

app.post('/dispense', function(req, res, next) {
    var data = req.body;
    var coffee_number = data.coffee_number.toString() + '\n';

    console.log(coffee_number);

    if(sp !== undefined && sp.isOpen()) {
        sp.write(coffee_number, function(err) {
            if(err) {
                console.log('Could not send dispenser signal');
                console.log('Error: ' + err);
            }
            res.send('okk');
            sp.drain(function(error) {
                if(error) {
                    console.log('Could not drain');
                    console.log('Error: ' + err);
                }
            })
        });
    }
});

app.post('/update_visitor_last_drink', function(req, res, next) {
    var data = req.body;
    console.log(data);
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

