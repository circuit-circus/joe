var socket = io(); // socket.io

// Location data
var HELSINKI_LOC = {
    'latitude' : 60.16952,
    'longitude' : 24.93545
};
var STOCKHOLM_LOC = {
    'latitude' : 59.33258,
    'longitude' : 18.0649
};
var COPENHAGEN_LOC = {
    'latitude' : 55.67594,
    'longitude' : 12.56553
};

var weather_data = {};

var date = new Date();

var bannedDrinkArray = [];
var availableDrinkArray = [];

var choices = {};

var questionCounter = 0;
var question_data = [
    {
        "phrase" : "Would you prefer a big or a small coffee?",
        "positive_answer" : "Small for me",
        "negative_answer" : "Big, please!"
    },
    {
        "phrase" : "How strong do you like it?",
        "positive_answer" : "Not too strong",
        "negative_answer" : "Give me a kick!"
    },
    {
        "phrase" : "You want milk in that?",
        "positive_answer" : "Yes, please",
        "negative_answer" : "I like it black like my soul!"
    },
    {
        "phrase" : "How frothy you want that milk?",
        "positive_answer" : "Lots of froth",
        "negative_answer" : "No froth"
    }
];


$(document).ready(function () {

    // Listen for button presses
    socket.on('buttonPress', function (data) {
        if(data === 'L') {
            $('#positive-answer').click();
        } else if (data === 'R') {
            $('#negative-answer').click();
        }
    });

    startJoe();
});



/*
 * First round of the programme
 *
 */
function startJoe() {
    // Get weather data
    var location_data;
    if(date.getMonth() === 2) {
        if(date.getDate() < 29) {
            location_data = HELSINKI_LOC;
        }
        else {
            location_data = STOCKHOLM_LOC;
        }
    }
    else {
        location_data = COPENHAGEN_LOC;
    }

    sendToPath('post', '/weather', location_data, function (error, response) {
        // Empty weather_data, if we get an error code
        if(response.errno === undefined) {
            weather_data = response;
        }
        else {
            weather_data = {};
        }

        var first = getFirst();
        insertQuestion(first);

        $('body').on('click', '.first-answer', function() {
            
        }, function(e) {
            $('.first-answer').addClass('elimination-answer').removeClass('first-answer');
            var text = $(this).text();
            var a_clone = $('.chat-answer-template').clone();
            a_clone.text(text);
            a_clone.removeClass('chat-answer-template').addClass('chat-answer');
            $('.conversation-container').append(a_clone);
            if(e.target.id === 'positive-answer') {
                finishJoe(first);
            }
            if(e.target.id === 'negative-answer') {
                eliminationRound();
            }
        });
    });
}

/*
 * Do the thing where we ask people questions about what they want
 *
 */
function eliminationRound() {
    if(questionCounter >= question_data.length) {
        finishJoe();
        return;
    }
    var question = question_data[questionCounter];
    insertQuestion(question);

    $('.elimination-answer').off('click');
    $('.elimination-answer').on('click', function(e) {
        var text = $(this).text();
        var a_clone = $('.chat-answer-template').clone();
        a_clone.text(text);
        a_clone.removeClass('chat-answer-template').addClass('chat-answer');
        $('.conversation-container').append(a_clone);

        var answer;

        if(e.target.id === 'positive-answer') {
            answer = 'pos';
        }
        if(e.target.id === 'negative-answer') {
            answer = 'neg';
        }

        switch(questionCounter) {
            case 0:
                choices.size = answer === 'pos' ? {$in: [1]} : {$in: [2]};
                break;
            case 1:
                choices.strength = answer === 'pos' ? {$in: [1]} : {$in: [2]};
                break;
            case 2:
                if(answer === 'pos') {
                    choices.milk = {$in: [1]};
                } else if (answer === 'neg') {
                    choices.milk = {$in: [0]};
                    choices.milk_froth = {$in: [0]};
                }
                break;
            case 3:
                choices.milk_froth = answer === 'pos' ? {$in: [1]} : {$in: [2]};
                break;
        }

        questionCounter++;

        // If there's only one option left, that's the coffee
        checkDrinkAvailability(function(no_of_drinks) {
            if(no_of_drinks > 1) {
                eliminationRound();
            } else {
                finishJoe(availableDrinkArray[0]);
            }
        });

    });

}

/*
 * Get the first example (test data atm)
 *
 */
function getFirst() {

    // Construct welcome greetings
    var welcome_greetings = [];
    var weather_greetings = [];
    var currentTime = date.getHours();

    var shouldReactToWeather = false;
    // Only react to weather sometimes and when we have weather data
    if(Math.random() < 0.2 && !jQuery.isEmptyObject(weather_data)) {
        shouldReactToWeather = true;
    }

    if(currentTime >= 6 && currentTime < 11) {
        welcome_greetings = ['Goodmorning [VISITOR]!', 'Hi [VISITOR], hope you\'re having a great morning!'];
    } else if(currentTime >= 11 && currentTime < 14) {
        welcome_greetings = ['Hi there [VISITOR]!', 'Hello [VISITOR], how are you?', 'Hi [VISITOR]! So nice to see you.', 'Welcome [VISITOR]!'];
    } else if (currentTime >= 14 && currentTime < 18) {
        welcome_greetings = ['Goodafternoon [VISITOR]!', 'Hi [VISITOR], so nice to see you this afternoon.'];
    } else if (currentTime >= 18 && currentTime < 23) {
        welcome_greetings = ['Goodevening [VISITOR]!', 'Goodevening [VISITOR], hope you\'re doing fine this lovely evening.', 'Hi [VISITOR], in the mood for an evening coffee?'];
    } else {
        welcome_greetings = ['Hi there [VISITOR]!', 'Hello [VISITOR]!'];
    }

    var chosen_welcome_greeting = welcome_greetings[Math.floor(Math.random()*welcome_greetings.length)];

    if(shouldReactToWeather) {
        if(parseInt(weather_data.cloudiness) > 75) {
            weather_greetings = [
                'Woah, it\'s looking cloudy!',
                'Man, those clouds just won\'t quit today!'
            ];
        }
        else if(parseInt(weather_data.fog) > 55) {
            weather_greetings = [
                'It sure is foggy today. You can barely see a thing!',
                'I heard that coffee tastes better when it\'s foggy, so today must be a great coffee day, huh?'
            ];
        }
        else if(parseInt(weather_data.rain) > 5) {
            weather_greetings = [
                'With all this rain, it\'s a good thing we\'re inside!',
                'Ever heard the expression "When it rains, it pours"? I\'m pretty sure they mean it pours coffee.'
            ];
        }
        else if(parseInt(weather_data.temperature) < 5) {
            weather_greetings = [
                'It\'s a cold one out there today. You better warm yourself with a cuppa joe.',
                'Some people say you should drink cold drinks, when it\'s cold. I strongly disagree with those people.'
            ];
        }
        else if(parseInt(weather_data.windSpeed.beaufort) > 5) {
            weather_greetings = [
                'Wow, the wind is really building up today!',
                'In this windy weather, luckily getting a coffee is a breeze.'
            ];
        }
        chosen_welcome_greeting += ' ' + weather_greetings[Math.floor(Math.random()*weather_greetings.length)];
        console.log("React to weather");
    }

    // Options if there's no visitor name
    var no_name_options = ['buddy', 'friend'];
    var visitor_info = getVisitorInfo();
    var visitor_name = visitor_info.first_name ? visitor_info.first_name : no_name_options[Math.floor(Math.random()*no_name_options.length)]
    // Replace [VISITOR] with visitor name
    chosen_welcome_greeting = chosen_welcome_greeting.replace('[VISITOR]', visitor_name);

    // Construct first suggestion obj
    var first = {
        'phrase' : chosen_welcome_greeting + ' How about an Espresso?',
        '_id' : '589b134671f90d703a4cf695',
        'name' : 'Espresso',
        'positive_answer' : 'Yeah, that sounds great. Hit me, Joe!',
        'negative_answer' : 'No thanks, I\'m in the mood for something different',
        'dispenser_number' : 4
    }

    return first;
}

/*
 * Insert questions / answers to the dom
 *
 */
function insertQuestion(data) {

    var q_clone = $('.chat-question-template').clone();
    q_clone.text(data.phrase);
    q_clone.removeClass('chat-question-template').addClass('chat-question');
    $('.conversation-container').append(q_clone);

    $('.answer-option#positive-answer').text(data.positive_answer);
    $('.answer-option#negative-answer').text(data.negative_answer);

    $('.conversation-container').animate({ scrollTop: $(document).height() }, 750);
}

/*
 * Check drink avaibility from the data
 *
 */
function checkDrinkAvailability(callback) {
    sendToPath('post', '/drinks', choices, function (error, response) {
        availableDrinkArray = response;
        callback(availableDrinkArray.length);
    });

}

/*
 * Get visitor info
 *
 */
function getVisitorInfo() {
    var visitor_info = {
        first_name : 'Nina',
        last_name : 'Højholdt',
        last_drink : {
            drink_name : 'Espresso',
            drink_id : '589b134671f90d703a4cf695'
        }
    }

    return visitor_info;
}

/*
 * Finish
 *
 */
function finishJoe(chosenDrink) {
    console.log(chosenDrink);
    var joeFinish = $('<div class="chat-question chat-buble"></div>');
    joeFinish.text('Great! Here\'s your ' + chosenDrink.name);
    $('.conversation-container').append(joeFinish);
    $('.conversation-container').animate({ scrollTop: $(document).height() }, 750);
    $('.answer-container').hide();

    sendToPath('post', '/dispense', chosenDrink, function (error, response) {
        console.log(response);
    });
}

/*
 * Send to route
 *
 */
function sendToPath(method, path, data, progress, done) {

    var callback = done || progress;

    var options = {
        url      : path,
        type     : method,
        contentType: 'application/json',
        dataType : 'json',
        data     : JSON.stringify(data),
        xhrFields: {
            withCredentials: true
        },
        success  : function (body) {
            if (body.status == 1) {
                // Redirect to destination if user is no longer logged in
                if (body.code === 'NOT_LOGGED_IN') {
                    $.notify('You are no longer logged in - redirecting you to the front page', 'failure');
                    setTimeout(function () { handleRegistrationNextStep(body.next_step); }, 3000);
                    return;
                }
                callback(body);
            } else {
                callback(undefined, body);
            }
        },
        error    : function (body) {
            if(body.responseJSON) {
                callback(body.responseJSON);
            } else {
                callback({
                    status: 1,
                    message: "Action failed, please try again later"
                })
            }
        }
    };

    // If a progress callback is specified, add event listener if possible
    if (done) {
        options.xhr = function () {
            var xhr = new window.XMLHttpRequest();

            if (xhr.upload) {
                xhr.upload.addEventListener('progress', function (e) {
                    if (e.lengthComputable) {
                        var percent = e.loaded / e.total;
                        progress(percent);
                    }
                }, false);
            }

            return xhr;
        }
    }
    $.ajax(options);
}

