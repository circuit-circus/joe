var express = require('express');
var bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var yrno = require('yr.no-forecast');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

// Set mongo URL
var url = 'mongodb://localhost:27017/nextM17';

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
        console.log(location);
        location.getForecastForTime(currTime, function(err, result) {
            res.send(result);
        });
    });
});



app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

