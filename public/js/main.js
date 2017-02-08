var joe_container;
var positive_answer_container;
var negative_answer_container;

var bannedDrinkArray = [];
var availableDrinkArray = [];

var counter = 0;

var choices = {};
var question_data = [
    {
        "phrase" : "Big or small?",
        "positive_answer" : "Small for me",
        "negative_answer" : "Big, please!"
    },
    {
        "phrase" : "How strong?",
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

    joe_container = $('.joe');
    positive_answer_container = $('.positive-answer');
    negative_answer_container = $('.negative-answer');

    startJoe();
});


/*
 * First round of the programme
 *
 */
function startJoe() {
    var first = getFirst();
    insertQuestion(first);

    $('body').on('click', 'button#first-answer', function(e) {
        $('button').attr('id', 'elimination-answer');
        if(e.target.className === 'positive-answer') {
            var chosenDrink = {};
            chosenDrink.name = joe_container.attr('data-drink-name');
            chosenDrink.id = joe_container.attr('data-drink-id');
            finishJoe(chosenDrink);
        }
        if(e.target.className === 'negative-answer') {
            bannedDrinkArray.push(joe_container.attr('data-drink-id'));
            eliminationRound();
        }
    });
}

/*
 * Do the thing where we ask people questions about what they want
 *
 */
function eliminationRound() {
    if(counter >= question_data.length) {
        finishJoe();
        return;
    }
    var question = question_data[counter];
    insertQuestion(question);

    $('button#elimination-answer').off('click');
    $('button#elimination-answer').on('click', function(e) {

        var answer;

        if(e.target.className === 'positive-answer') {
            answer = 'pos';
        }
        if(e.target.className === 'negative-answer') {
            answer = 'neg';
        }

        switch(counter) {
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

        counter++;

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
    var first = {
        "phrase" : "Goodmorning! How about an Espresso to kickstart your day?",
        "drink_id" : "589b134671f90d703a4cf695",
        "drink_name" : "Espresso",
        "positive_answer" : "Yeah, that sounds great. Hit me, Joe!",
        "negative_answer" : "No thanks, I'm in the mood for something different"
    }

    return first;
}

/*
 * Insert questions / answers to the dom
 *
 */
function insertQuestion(data) {
    joe_container.text(data.phrase).attr('data-drink-name', data.drink_name).attr('data-drink-id', data.drink_id);
    positive_answer_container.text(data.positive_answer);
    negative_answer_container.text(data.negative_answer);
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
 * Finish
 *
 */
function finishJoe(chosenDrink) {
    positive_answer_container.hide();
    negative_answer_container.hide();

    joe_container.text('Great! Here\'s your ' + chosenDrink.name);
    // Send dispense command
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

