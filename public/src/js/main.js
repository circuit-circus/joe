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
    startJoe();

});


/*
 * First round of the programme
 *
 */
function startJoe() {
    var first = getFirst();
    insertQuestion(first);

    $('body').on('click', '.first-answer', function(e) {
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
        "_id" : "589b134671f90d703a4cf695",
        "name" : "Espresso",
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

