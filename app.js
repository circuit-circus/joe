var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');

var db = require('./db')
var ObjectId = require('mongodb').ObjectID;

var yrno = require('yr.no-forecast');

/* SETUP */
app.use(express.static(__dirname + '/public'));
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

/* CONNECT TO MONGO */
var url = 'mongodb://localhost:27017/nextM17';
db.connect(url, function(err) {
    if(err) {
        console.log('Could not connect to database');
        console.log('Error: ' + err);
        process.exit(1);
        return;
    }

    console.log('Connected to database');

    http.listen(5000, function() {
      console.log('listening on *:5000');
    });
})

/* SERIAL COM */
var serialport = require('serialport');
var sp;
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

    drinks = db.get().collection('coffee');

    drinks.find(data).toArray(function(err, result) {
        if(err) {
            console.log('Could not find coffee in DB');
            console.log('Error: ' + err);
            return;
        }
        res.send(result);
    });
});

app.post('/rfid/recieve', function(req, res, next) {

    var tagsession_query = req.body;
    if(!tagsession_query) return;

    res.send('is good');

    if(!listenForVisitors) return;

    tagsessions = db.get().collection('tagsessions');
    guests = db.get().collection('guests');

    tagsessions.find(tagsession_query).toArray(function(err, result) {
        if(err) {
            console.log('Could not find EPC in DB');
            console.log('Error: ' + err);
            return;
        }

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

            io.sockets.emit('visitorCheckedIn', result);
        });

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

    var guest_query = {
        'guest_id' : new ObjectId(data.visitor_id)
    };

    var update_query = {
        'last_drink' : new ObjectId(data.chosen_drink),
        'guest_id' : new ObjectId(data.visitor_id)
    };

    visitor_data = db.get().collection('visitor_data');
    visitor_data.update(guest_query, update_query, function(err, result) {
        if(err) {
            console.log('Could not find EPC in DB');
            console.log('Error: ' + err);
            return;
        }
    });
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

